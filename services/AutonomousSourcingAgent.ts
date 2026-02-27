/**
 * Autonomous Sourcing Agent
 * Runs continuously in the background to find candidates matching open job requirements
 * This is a PROACTIVE agent - it works while you sleep!
 */

import { semanticSearchService } from './SemanticSearchService';
import { agenticSourcingPrototype } from './AgenticSourcingPrototype';
import { backgroundJobService } from './BackgroundJobService';
import { pulseService } from './PulseService';
import { eventBus, EVENTS } from '../utils/EventBus';
import { processingMarkerService } from './ProcessingMarkerService';
import { decisionArtifactService } from './DecisionArtifactService';
import { pipelineEventService } from './PipelineEventService';
import { fitAnalysisService } from './FitAnalysisService';
import type { AgentMode } from './AgentSettingsService';
import { proposedActionService } from './ProposedActionService';
import { jobContextPackService } from './JobContextPackService';
import { evidencePackService } from './EvidencePackService';
import type { Candidate, IntakeScorecard } from '../types';
import { toCandidateSnapshot, toJobSnapshot } from '../utils/snapshots';
import { intakeCallPersistenceService } from './IntakeCallPersistenceService';

const AI_PROMOTE_TO_LONG_LIST_THRESHOLD = 75;
const SOURCING_SEMANTIC_THRESHOLD = 0.65;
const SOURCING_CANDIDATE_LIMIT = 10;

export interface SourcingMatch {
    jobId: string;
    jobTitle: string;
    candidateId: string;
    candidateName: string;
    matchScore: number;
    skills: string[];
    discoveredAt: Date;
}

class AutonomousSourcingAgent {
    private jobId: string | null = null;
    private matches: SourcingMatch[] = [];
    private isInitialized = false;
    private mode: AgentMode = 'recommend';
    private jobs: any[] = [];

    /**
     * Initialize the autonomous sourcing agent
     * This agent runs every 5 minutes to find new candidates
     */
    initialize(jobs: any[], options?: { enabled?: boolean; mode?: AgentMode }) {
        // Keep jobs up-to-date even if initialize is called before jobs load (React often passes [] first).
        this.jobs = Array.isArray(jobs) ? jobs : [];

        if (this.isInitialized) {
            if (options?.mode) this.mode = options.mode;
            console.log('[AutonomousSourcingAgent] Already initialized; jobs updated:', this.jobs.length);
            return;
        }

        console.log('[AutonomousSourcingAgent] Initializing autonomous sourcing...');
        this.mode = options?.mode ?? 'recommend';

        // Register background job
        this.jobId = backgroundJobService.registerJob({
            name: 'Autonomous Candidate Sourcing',
            type: 'SOURCING',
            interval: 5 * 60 * 1000, // 5 minutes
            enabled: options?.enabled ?? false,
            handler: async () => {
                await this.scanForCandidates();
            }
        });

        this.isInitialized = true;
        console.log('[AutonomousSourcingAgent] ✓ Initialized successfully');
    }

    /**
     * Main scanning logic - runs automatically
     */
    private async scanForCandidates() {
        console.log('[AutonomousSourcingAgent] 🔍 Starting candidate scan...');

        const jobs = this.jobs || [];
        // Filter for open jobs only
        const openJobs = jobs.filter(job =>
            job.status === 'open' || job.status === 'active'
        );

        if (openJobs.length === 0) {
            const statusCounts = jobs.reduce<Record<string, number>>((acc, job) => {
                const key = String(job?.status ?? 'unknown');
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            console.log('[AutonomousSourcingAgent] No open jobs to source for', { totalJobs: jobs.length, statusCounts });
            return;
        }

        let totalMatches = 0;

        for (const job of openJobs) {
            try {
                const contextPack = await jobContextPackService.get(String(job.id));

                // Check for an approved intake scorecard — its criteria take priority
                const intakeScorecard = await intakeCallPersistenceService.getApprovedScorecardForJob(String(job.id));
                if (intakeScorecard) {
                    console.log(`[AutonomousSourcingAgent] Using intake scorecard criteria for "${job.title}"`);
                    // Enrich job skills from intake scorecard must-haves if not already present
                    const intakeSkills = intakeScorecard.mustHave
                        .filter((c) => c.category === 'technical')
                        .map((c) => c.criterion);
                    const existingSkills = new Set((job.requiredSkills || []).map((s: string) => s.toLowerCase()));
                    for (const skill of intakeSkills) {
                        if (!existingSkills.has(skill.toLowerCase())) {
                            job.requiredSkills = [...(job.requiredSkills || []), skill];
                        }
                    }
                }

                // Build search query from job requirements
                const searchQuery = this.buildSearchQuery(job);

                // Search the vector database
                // Search using Agentic Prototype (Multi-step reasoning)
                const searchResult = await this.retryTransient(() =>
                    agenticSourcingPrototype.findCandidatesForJob(job)
                );

                // Map Agentic results to the format expected by the rest of the method
                const candidates = searchResult.success
                    ? searchResult.data.map(r => ({
                        id: r.candidateId,
                        name: r.candidateName,
                        skills: r.candidateSkills,
                        similarity: r.score / 100, // Normalize back to 0-1 for compatibility
                        metadata: {
                            ...(r.fullCandidate?.metadata || {}),
                            agentReasoning: r.reasoning.join('; ')
                        },
                        // Ensure we carry over other fields like email/type/location if available from fullCandidate
                        email: r.fullCandidate?.email,
                        type: r.fullCandidate?.type || 'uploaded',
                        location: r.fullCandidate?.location || r.fullCandidate?.metadata?.location
                    }))
                    : [];

                if (!searchResult.success) {
                    pulseService.addEvent({
                        type: 'AGENT_ACTION',
                        message: `Sourcing Agent could not run semantic search for "${job.title}". I tried twice; please confirm a retry.`,
                        severity: 'warning',
                        metadata: {
                            agentType: 'SOURCING',
                            jobId: job.id,
                            jobTitle: job.title,
                            errorCode: searchResult.error.code,
                            debugId: searchResult.error.debugId,
                            retryAfterMs: searchResult.retryAfterMs,
                            requiresConfirmation: true,
                            attempted: 2
                        }
                    });
                }

                // Filter out candidates already in the job pipeline
                const newCandidates = candidates.filter(candidate => {
                    const isAlreadyInPipeline = job.candidateIds?.includes(candidate.id);
                    const alreadyDiscovered = this.matches.some(
                        m => m.candidateId === candidate.id && m.jobId === job.id
                    );

                    return !isAlreadyInPipeline && !alreadyDiscovered;
                });

                if (newCandidates.length > 0) {
                    console.log(
                        `[AutonomousSourcingAgent] 🎯 Found ${newCandidates.length} new matches for "${job.title}"`
                    );

                    // Store matches
                    for (const candidate of newCandidates) {
                        const semanticScore = Math.round(candidate.similarity * 100);

                        const sourcedStep = 'sourcing:stage:sourced:v1';
                        const canStageSourced = await processingMarkerService.beginStep({
                            candidateId: candidate.id,
                            jobId: job.id,
                            step: sourcedStep,
                            ttlMs: 1000 * 60 * 60, // 1 hour
                            metadata: { semanticScore, agent: 'sourcing-agent' }
                        });

                        if (!canStageSourced) {
                            continue;
                        }

                        const match: SourcingMatch = {
                            jobId: job.id,
                            jobTitle: job.title,
                            candidateId: candidate.id,
                            candidateName: candidate.name,
                            matchScore: semanticScore,
                            skills: candidate.skills,
                            discoveredAt: new Date()
                        };

                        this.matches.push(match);
                        totalMatches++;

                        // Place candidate into pipeline as "sourced" for this job.
                        // We include a lightweight candidate payload so the app can import it into local state if needed.
                        if (this.mode === 'auto_write') {
                            eventBus.emit(EVENTS.CANDIDATE_STAGED, {
                                candidateId: candidate.id,
                                candidateName: candidate.name,
                                jobId: job.id,
                                stage: 'sourced',
                                source: 'sourcing-agent',
                                matchScore: semanticScore,
                                candidate: {
                                    id: candidate.id,
                                    type: 'uploaded',
                                    name: candidate.name,
                                    role: candidate.metadata?.role || candidate.metadata?.title || 'Candidate',
                                    skills: candidate.skills || [],
                                    experience: candidate.metadata?.experience ?? candidate.metadata?.experienceYears ?? 0,
                                    location: candidate.metadata?.location || candidate.metadata?.city || '',
                                    availability: candidate.metadata?.availability || 'Unknown',
                                    email: candidate.email,
                                    source: candidate.type,
                                    matchScores: { [job.id]: semanticScore },
                                    matchRationales: { [job.id]: `Semantic match ${semanticScore}% — sourced by Autonomous Sourcing Agent. Running AI shortlist...` },
                                    matchRationale: `Semantic match ${semanticScore}% — sourced by Autonomous Sourcing Agent.`
                                }
                            });
                        } else {
                            const proposalCandidate = {
                                id: candidate.id,
                                type: 'uploaded',
                                name: candidate.name,
                                role: candidate.metadata?.role || candidate.metadata?.title || 'Candidate',
                                skills: candidate.skills || [],
                                experience: candidate.metadata?.experience ?? candidate.metadata?.experienceYears ?? 0,
                                location: candidate.metadata?.location || candidate.metadata?.city || '',
                                availability: candidate.metadata?.availability || 'Unknown',
                                email: candidate.email,
                                source: candidate.type
                            } as any;

                            proposedActionService.add({
                                agentType: 'SOURCING',
                                title: 'Add to Pipeline (Sourced)',
                                description: `${candidate.name} for "${job.title}" • Semantic match ${semanticScore}%`,
                                candidateId: candidate.id,
                                jobId: job.id,
                                payload: {
                                    type: 'MOVE_CANDIDATE_TO_STAGE',
                                    candidate: proposalCandidate,
                                    jobId: job.id,
                                    stage: 'sourced'
                                },
                                evidence: [
                                    { label: 'Semantic', value: `${semanticScore}%` }
                                ]
                            });
                        }

                        void pipelineEventService.logEvent({
                            candidateId: candidate.id,
                            candidateName: candidate.name,
                            jobId: job.id,
                            jobTitle: job.title,
                            eventType: 'SOURCED',
                            actorType: 'agent',
                            actorId: 'sourcing-agent',
                            toStage: 'sourced',
                            summary: `Sourced by agent: semantic match ${semanticScore}%.`,
                            metadata: { semanticScore, agentType: 'SOURCING' }
                        });

                        void processingMarkerService.completeStep({
                            candidateId: candidate.id,
                            jobId: job.id,
                            step: sourcedStep,
                            metadata: { semanticScore }
                        });

                        // Send notification to user via Pulse Feed
                        pulseService.addEvent({
                            type: 'AGENT_ACTION',
                            message: `🤖 Sourcing Agent found ${candidate.name} (${Math.round(candidate.similarity * 100)}% match) for "${job.title}"`,
                            severity: 'info',
                            metadata: {
                                candidateId: candidate.id,
                                candidateName: candidate.name,
                                jobId: job.id,
                                jobTitle: job.title,
                                matchScore: semanticScore,
                                agentType: 'SOURCING',
                                actionLink: '/agent-inbox'
                            }
                        });

                        // AI gating: AI score >= 75 → Long List, else → New with score note
                        try {
                            const analysisStep = 'shortlist_analysis:v1';
                            const canAnalyze = await processingMarkerService.beginStep({
                                candidateId: candidate.id,
                                jobId: job.id,
                                step: analysisStep,
                                ttlMs: 1000 * 60 * 30,
                                metadata: { semanticScore, agent: 'sourcing-agent' }
                            });

                            if (!canAnalyze) {
                                continue;
                            }

                            const candidateForAi: Candidate = {
                                id: String(candidate.id),
                                type: 'uploaded',
                                name: candidate.name || 'Candidate',
                                role: String(candidate.metadata?.role || candidate.metadata?.title || 'Candidate'),
                                skills: Array.isArray(candidate.skills) ? candidate.skills : [],
                                experienceYears: Number(candidate.metadata?.experienceYears ?? candidate.metadata?.experience ?? 0) || 0,
                                summary: String(candidate.metadata?.summary || candidate.metadata?.content || ''),
                                location: String(candidate.metadata?.location || candidate.metadata?.city || ''),
                                email: candidate.email || ''
                            };

                            const fit = await fitAnalysisService.analyze(job, candidateForAi, semanticScore);
                            const aiScore = Math.round(fit.score);
                            const aiRationale = String(fit.rationale ?? '').trim();
                            const shouldPromote = aiScore >= AI_PROMOTE_TO_LONG_LIST_THRESHOLD;
                            const targetStage = shouldPromote ? 'long_list' : 'new';
                            const decision =
                                aiScore >= 85 ? 'STRONG_PASS' : aiScore >= 75 ? 'PASS' : aiScore >= 60 ? 'BORDERLINE' : 'FAIL';

                            const evidencePack = await evidencePackService.build({
                                job: toJobSnapshot(job),
                                candidate: toCandidateSnapshot(candidateForAi),
                                contextPack
                            });

                            void decisionArtifactService.saveShortlistAnalysis({
                                candidateId: candidate.id,
                                candidateName: candidate.name,
                                jobId: job.id,
                                jobTitle: job.title,
                                score: aiScore,
                                decision: decision as any,
                                summary: aiRationale || undefined,
                                details: {
                                    semanticScore,
                                    aiScore,
                                    threshold: AI_PROMOTE_TO_LONG_LIST_THRESHOLD,
                                    targetStage,
                                    method: fit.method,
                                    confidence: fit.confidence,
                                    reasons: fit.reasons ?? [],
                                    evidencePack
                                },
                                externalId: fitAnalysisService.getExternalIdForJob(job, 'agent'),
                                rubricName: 'Shortlist Rubric',
                                rubricVersion: 1
                            });

                            void pipelineEventService.logEvent({
                                candidateId: candidate.id,
                                candidateName: candidate.name,
                                jobId: job.id,
                                jobTitle: job.title,
                                eventType: 'SHORTLIST_ANALYZED',
                                actorType: 'agent',
                                actorId: 'sourcing-agent',
                                summary: `AI shortlist scored ${aiScore}/100 (${decision}).`,
                                metadata: { semanticScore, aiScore, decision, targetStage }
                            });
                            const note = shouldPromote
                                ? `AI shortlist score ${aiScore}/100 (≥ ${AI_PROMOTE_TO_LONG_LIST_THRESHOLD}). Auto-promoted to Long List. ${aiRationale}`
                                : `AI shortlist score ${aiScore}/100 (< ${AI_PROMOTE_TO_LONG_LIST_THRESHOLD}). Moved to New for recruiter review. ${aiRationale}`;

                            if (this.mode === 'auto_write') {
                                eventBus.emit(EVENTS.CANDIDATE_UPDATED, {
                                    candidateId: candidate.id,
                                    updates: {
                                        matchScores: { [job.id]: aiScore },
                                        matchRationales: { [job.id]: note }
                                    }
                                });

                                eventBus.emit(EVENTS.CANDIDATE_STAGED, {
                                    candidateId: candidate.id,
                                    candidateName: candidate.name,
                                    jobId: job.id,
                                    stage: targetStage,
                                    source: 'sourcing-agent',
                                    score: aiScore
                                });

                                pulseService.addEvent({
                                    type: 'AGENT_ACTION',
                                    message: shouldPromote
                                        ? `✅ ${candidate.name} auto-promoted to Long List (${aiScore}/100 AI score) for "${job.title}".`
                                        : `📝 ${candidate.name} moved to New for recruiter review (${aiScore}/100 AI score) for "${job.title}".`,
                                    severity: shouldPromote ? 'success' : 'info',
                                    metadata: {
                                        candidateId: candidate.id,
                                        jobId: job.id,
                                        aiScore,
                                        semanticScore,
                                        targetStage,
                                        agentType: 'SOURCING'
                                    }
                                });

                                void pipelineEventService.logEvent({
                                    candidateId: candidate.id,
                                    candidateName: candidate.name,
                                    jobId: job.id,
                                    jobTitle: job.title,
                                    eventType: 'STAGE_MOVED',
                                    actorType: 'agent',
                                    actorId: 'sourcing-agent',
                                    fromStage: 'sourced',
                                    toStage: targetStage,
                                    summary: shouldPromote
                                        ? `Auto-promoted to Long List (AI ${aiScore}/100).`
                                        : `Moved to New for recruiter review (AI ${aiScore}/100).`,
                                    metadata: { aiScore, semanticScore, decision }
                                });
                            } else {
                                const proposalCandidate = {
                                    id: candidate.id,
                                    type: 'uploaded',
                                    name: candidate.name,
                                    role: candidate.metadata?.role || candidate.metadata?.title || 'Candidate',
                                    skills: candidate.skills || [],
                                    experience: candidate.metadata?.experience ?? candidate.metadata?.experienceYears ?? 0,
                                    location: candidate.metadata?.location || candidate.metadata?.city || '',
                                    availability: candidate.metadata?.availability || 'Unknown',
                                    email: candidate.email,
                                    source: candidate.type,
                                    matchScores: { [job.id]: aiScore },
                                    matchRationales: { [job.id]: note },
                                    matchRationale: note
                                } as any;

                                proposedActionService.add({
                                    agentType: 'SOURCING',
                                    title: shouldPromote ? 'Add to Long List' : 'Add to Pipeline (New)',
                                    description: `${candidate.name} for "${job.title}" • ${note}`,
                                    candidateId: candidate.id,
                                    jobId: job.id,
                                    payload: {
                                        type: 'MOVE_CANDIDATE_TO_STAGE',
                                        candidate: proposalCandidate,
                                        jobId: job.id,
                                        stage: targetStage as any
                                    },
                                    evidence: [
                                        { label: 'Semantic', value: `${semanticScore}%` },
                                        { label: 'AI', value: `${aiScore}/100 (${decision})` }
                                    ]
                                });

                                pulseService.addEvent({
                                    type: 'AGENT_ACTION',
                                    message: `Proposal created: ${candidate.name} → ${shouldPromote ? 'Long List' : 'New'} (${aiScore}/100 AI score) for "${job.title}".`,
                                    severity: 'info',
                                    metadata: {
                                        candidateId: candidate.id,
                                        jobId: job.id,
                                        aiScore,
                                        semanticScore,
                                        targetStage,
                                        agentType: 'SOURCING',
                                        actionLink: '/agent-inbox'
                                    }
                                });

                                void pipelineEventService.logEvent({
                                    candidateId: candidate.id,
                                    candidateName: candidate.name,
                                    jobId: job.id,
                                    jobTitle: job.title,
                                    eventType: 'ACTION_PROPOSED',
                                    actorType: 'agent',
                                    actorId: 'sourcing-agent',
                                    toStage: targetStage,
                                    summary: shouldPromote
                                        ? `Proposed: Add to Long List (AI ${aiScore}/100).`
                                        : `Proposed: Add to New for recruiter review (AI ${aiScore}/100).`,
                                    metadata: { aiScore, semanticScore, decision }
                                });
                            }

                            void processingMarkerService.completeStep({
                                candidateId: candidate.id,
                                jobId: job.id,
                                step: analysisStep,
                                metadata: { semanticScore, aiScore, decision, targetStage }
                            });
                        } catch (error) {
                            console.warn('[AutonomousSourcingAgent] AI shortlist failed; moving to New for review:', error);
                            void pipelineEventService.logEvent({
                                candidateId: candidate.id,
                                candidateName: candidate.name,
                                jobId: job.id,
                                jobTitle: job.title,
                                eventType: 'SHORTLIST_FAILED',
                                actorType: 'agent',
                                actorId: 'sourcing-agent',
                                summary: 'AI shortlist failed (quota/rate-limit).',
                                metadata: { semanticScore }
                            });

                            void processingMarkerService.completeStep({
                                candidateId: candidate.id,
                                jobId: job.id,
                                step: analysisStep,
                                metadata: { semanticScore, error: error instanceof Error ? error.message : String(error) }
                            });
                            const note = `AI shortlist failed (quota/rate-limit). Moved to New for recruiter review. Semantic match ${semanticScore}%.`;

                            if (this.mode === 'auto_write') {
                                eventBus.emit(EVENTS.CANDIDATE_UPDATED, {
                                    candidateId: candidate.id,
                                    updates: {
                                        matchRationales: { [job.id]: note }
                                    }
                                });
                                eventBus.emit(EVENTS.CANDIDATE_STAGED, {
                                    candidateId: candidate.id,
                                    candidateName: candidate.name,
                                    jobId: job.id,
                                    stage: 'new',
                                    source: 'sourcing-agent'
                                });
                            } else {
                                const proposalCandidate = {
                                    id: candidate.id,
                                    type: 'uploaded',
                                    name: candidate.name,
                                    role: candidate.metadata?.role || candidate.metadata?.title || 'Candidate',
                                    skills: candidate.skills || [],
                                    experience: candidate.metadata?.experience ?? candidate.metadata?.experienceYears ?? 0,
                                    location: candidate.metadata?.location || candidate.metadata?.city || '',
                                    availability: candidate.metadata?.availability || 'Unknown',
                                    email: candidate.email,
                                    source: candidate.type,
                                    matchScores: { [job.id]: semanticScore },
                                    matchRationales: { [job.id]: note },
                                    matchRationale: note
                                } as any;

                                proposedActionService.add({
                                    agentType: 'SOURCING',
                                    title: 'Add to Pipeline (New)',
                                    description: `${candidate.name} for "${job.title}" • ${note}`,
                                    candidateId: candidate.id,
                                    jobId: job.id,
                                    payload: {
                                        type: 'MOVE_CANDIDATE_TO_STAGE',
                                        candidate: proposalCandidate,
                                        jobId: job.id,
                                        stage: 'new'
                                    },
                                    evidence: [{ label: 'Semantic', value: `${semanticScore}%` }]
                                });

                                pulseService.addEvent({
                                    type: 'AGENT_ACTION',
                                    message: `Proposal created: ${candidate.name} → New (AI shortlist failed) for "${job.title}".`,
                                    severity: 'warning',
                                    metadata: {
                                        candidateId: candidate.id,
                                        jobId: job.id,
                                        semanticScore,
                                        agentType: 'SOURCING',
                                        actionLink: '/agent-inbox'
                                    }
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`[AutonomousSourcingAgent] Error scanning for ${job.title}:`, error);
            }
        }

        if (totalMatches > 0) {
            console.log(
                `[AutonomousSourcingAgent] ✓ Scan complete. Found ${totalMatches} total new matches.`
            );
        } else {
            console.log('[AutonomousSourcingAgent] ✓ Scan complete. No new matches found.');
        }
    }

    private async retryTransient<T>(op: () => Promise<import('../types/result').Result<T>>): Promise<import('../types/result').Result<T>> {
        const maxAttempts = 2; // total attempts
        let last: import('../types/result').Result<T> | null = null;

        for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
            const res = await op();
            last = res;
            if (res.success) return res;

            const retryable = Boolean(res.error?.retryable);
            if (!retryable) return res;

            // Only wait if we're going to retry again.
            if (attemptIndex < maxAttempts - 1) {
                const base = typeof res.retryAfterMs === 'number' ? res.retryAfterMs : 800 * Math.pow(2, attemptIndex);
                const jitter = Math.floor(Math.random() * 250);
                const waitMs = Math.min(15_000, base + jitter);
                await new Promise((r) => setTimeout(r, waitMs));
            }
        }

        return last as import('../types/result').Result<T>;
    }

    /**
     * Build semantic search query from job requirements
     */
    private buildSearchQuery(job: any): string {
        const parts: string[] = [];

        const description = String(job.description || '').trim();
        const descriptionSnippet = description.replace(/\s+/g, ' ').slice(0, 800);

        // Add title/role
        if (job.title) {
            parts.push(job.title);
        }

        // Add seniority
        if (job.seniority) {
            parts.push(job.seniority);
        }

        if (descriptionSnippet) {
            parts.push(descriptionSnippet);
        }

        // Add required skills
        if (job.requiredSkills && job.requiredSkills.length > 0) {
            parts.push(`with expertise in ${job.requiredSkills.slice(0, 5).join(', ')}`);
        }

        // Add experience level
        if (job.experienceRequired) {
            parts.push(`${job.experienceRequired}+ years experience`);
        }

        return parts.join(' ');
    }

    /**
     * Get all discovered matches
     */
    getMatches(jobId?: string): SourcingMatch[] {
        if (jobId) {
            return this.matches.filter(m => m.jobId === jobId);
        }
        return this.matches;
    }

    /**
     * Get match count for a specific job
     */
    getMatchCount(jobId: string): number {
        return this.matches.filter(m => m.jobId === jobId).length;
    }

    /**
     * Clear matches (e.g., after user reviews them)
     */
    clearMatches(jobId?: string) {
        if (jobId) {
            this.matches = this.matches.filter(m => m.jobId !== jobId);
        } else {
            this.matches = [];
        }
    }

    /**
     * Enable/disable the agent
     */
    setEnabled(enabled: boolean) {
        if (!this.jobId) {
            console.warn('[AutonomousSourcingAgent] Not initialized yet');
            return;
        }

        backgroundJobService.setJobEnabled(this.jobId, enabled);
        console.log(`[AutonomousSourcingAgent] Agent ${enabled ? 'enabled' : 'disabled'}`);
    }

    setMode(mode: AgentMode) {
        this.mode = mode;
    }

    /**
     * Get agent status
     */
    getStatus() {
        if (!this.jobId) {
            return {
                initialized: false,
                enabled: false,
                lastRun: null,
                nextRun: null,
                totalMatches: 0
            };
        }

        const job = backgroundJobService.getJob(this.jobId);

        return {
            initialized: this.isInitialized,
            enabled: job?.enabled || false,
            lastRun: job?.lastRun || null,
            nextRun: job?.nextRun || null,
            totalMatches: this.matches.length,
            recentResults: backgroundJobService.getJobResults(this.jobId, 5)
        };
    }

    /**
     * Manually trigger a scan (for testing)
     */
    async triggerScan(jobs: any[]) {
        if (!this.jobId) {
            throw new Error('Agent not initialized');
        }

        this.jobs = Array.isArray(jobs) ? jobs : [];
        console.log('[AutonomousSourcingAgent] Manual scan triggered');
        await backgroundJobService.runJob(this.jobId);
    }
}

export const autonomousSourcingAgent = new AutonomousSourcingAgent();
