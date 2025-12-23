/**
 * Autonomous Screening Agent
 * Conducts initial phone/chat screens with candidates
 * Asks qualifying questions, scores responses, filters candidates
 */

import { backgroundJobService } from './BackgroundJobService';
import { pulseService } from './PulseService';
import { aiService } from './AIService';
import { eventBus, EVENTS } from '../utils/EventBus';
import { decisionArtifactService } from './DecisionArtifactService';
import { pipelineEventService } from './PipelineEventService';
import { processingMarkerService } from './ProcessingMarkerService';
import type { AgentMode } from './AgentSettingsService';
import { proposedActionService } from './ProposedActionService';

export interface ScreeningCandidate {
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    jobId: string;
    jobTitle: string;
    jobRequirements: string[];
    addedAt: Date;
}

export interface ScreeningResult {
    id: string;
    candidateId: string;
    candidateName: string;
    jobId: string;
    jobTitle: string;
    score: number;  // 0-100
    passed: boolean;
    questions: {
        question: string;
        answer: string;
        score: number;
    }[];
    recommendation: 'STRONG_PASS' | 'PASS' | 'BORDERLINE' | 'FAIL';
    summary: string;
    screenedAt: Date;
}

class AutonomousScreeningAgent {
    private jobId: string | null = null;
    private screeningQueue: ScreeningCandidate[] = [];
    private screeningResults: ScreeningResult[] = [];
    private isInitialized = false;
    private mode: AgentMode = 'recommend';
    private readonly storageKey = 'autonomous_screening_results_v1';
    private readonly maxStoredResults = 500;

    private loadPersistedResults() {
        if (typeof window === 'undefined') return;

        try {
            const raw = window.localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Array<Omit<ScreeningResult, 'screenedAt'> & { screenedAt: string }>;

            this.screeningResults = (parsed || [])
                .map((r) => ({
                    ...r,
                    screenedAt: new Date(r.screenedAt)
                }))
                .filter((r) => r.id && r.candidateId && r.jobId);
        } catch (e) {
            console.warn('[AutonomousScreeningAgent] Failed to load persisted results:', e);
        }
    }

    private persistResults() {
        if (typeof window === 'undefined') return;

        try {
            const trimmed = this.screeningResults.slice(0, this.maxStoredResults);
            window.localStorage.setItem(
                this.storageKey,
                JSON.stringify(
                    trimmed.map((r) => ({
                        ...r,
                        screenedAt: new Date(r.screenedAt).toISOString()
                    }))
                )
            );
        } catch (e) {
            console.warn('[AutonomousScreeningAgent] Failed to persist results:', e);
        }
    }

    /**
     * Initialize the screening agent
     * Runs every 4 hours to screen candidates
     */
    initialize(options?: { enabled?: boolean; mode?: AgentMode }) {
        if (this.isInitialized) {
            console.log('[AutonomousScreeningAgent] Already initialized');
            return;
        }

        console.log('[AutonomousScreeningAgent] Initializing autonomous screening...');
        this.loadPersistedResults();
        this.mode = options?.mode ?? 'recommend';

        this.jobId = backgroundJobService.registerJob({
            name: 'Autonomous Candidate Screening',
            type: 'SCREENING',
            interval: 4 * 60 * 60 * 1000, // 4 hours
            enabled: options?.enabled ?? false,
            handler: async () => {
                await this.processScreeningQueue();
            }
        });

        this.isInitialized = true;
        console.log('[AutonomousScreeningAgent] ✓ Initialized successfully');
    }

    /**
     * Add candidate to screening queue
     */
    requestScreening(candidate: ScreeningCandidate) {
        this.screeningQueue.push(candidate);

        pulseService.addEvent({
            type: 'AGENT_ACTION',
            message: `📞 Screening Agent will conduct initial screen with ${candidate.candidateName} for ${candidate.jobTitle}`,
            severity: 'info',
            metadata: {
                candidateId: candidate.candidateId,
                jobId: candidate.jobId,
                agentType: 'SCREENING'
            }
        });

        void pipelineEventService.logEvent({
            candidateId: candidate.candidateId,
            candidateName: candidate.candidateName,
            jobId: candidate.jobId,
            jobTitle: candidate.jobTitle,
            eventType: 'SCREENING_REQUESTED',
            actorType: 'agent',
            actorId: 'screening-agent',
            summary: `Screening requested for ${candidate.candidateName} (${candidate.jobTitle}).`,
            metadata: {
                agentType: 'SCREENING'
            }
        });

        console.log(`[AutonomousScreeningAgent] Added ${candidate.candidateName} to screening queue`);
    }

    /**
     * Process all candidates in screening queue
     */
    private async processScreeningQueue() {
        if (this.screeningQueue.length === 0) {
            console.log('[AutonomousScreeningAgent] No pending screens');
            return;
        }

        console.log(`[AutonomousScreeningAgent] Screening ${this.screeningQueue.length} candidates...`);

        for (const candidate of this.screeningQueue) {
            try {
                const screeningStep = 'screening:v1';
                const shouldRun = await processingMarkerService.beginStep({
                    candidateId: candidate.candidateId,
                    jobId: candidate.jobId,
                    step: screeningStep,
                    ttlMs: 1000 * 60 * 30, // 30 minutes
                    metadata: { agent: 'screening-agent' }
                });

                if (!shouldRun) {
                    if (import.meta.env.DEV) {
                        console.log(
                            `[AutonomousScreeningAgent] Skipping ${candidate.candidateName} (${candidate.jobTitle}) - already processed (${screeningStep})`
                        );
                    }
                    continue;
                }

                // Conduct screening
                const result = await this.conductScreen(candidate);

                // Store result
                this.screeningResults.push(result);
                this.screeningResults.sort((a, b) => new Date(b.screenedAt).getTime() - new Date(a.screenedAt).getTime());
                this.persistResults();

                void decisionArtifactService.saveScreeningResult({
                    result,
                    rubricName: 'Screening Rubric',
                    rubricVersion: 1
                });

                void pipelineEventService.logEvent({
                    candidateId: candidate.candidateId,
                    candidateName: candidate.candidateName,
                    jobId: candidate.jobId,
                    jobTitle: candidate.jobTitle,
                    eventType: 'SCREENING_COMPLETED',
                    actorType: 'agent',
                    actorId: 'screening-agent',
                    fromStage: undefined,
                    toStage: undefined,
                    summary: `Screening completed for ${candidate.candidateName}: ${result.recommendation} (${result.score}/100).`,
                    metadata: {
                        recommendation: result.recommendation,
                        score: result.score
                    }
                });

                const shouldPromote =
                    result.recommendation === 'STRONG_PASS' ||
                    result.recommendation === 'PASS' ||
                    result.recommendation === 'BORDERLINE';

                if (shouldPromote) {
                    const stageStep = 'stage_move:long_list:screening:v1';
                    const moved = await processingMarkerService.beginStep({
                        candidateId: candidate.candidateId,
                        jobId: candidate.jobId,
                        step: stageStep,
                        ttlMs: 1000 * 60 * 10,
                        metadata: { recommendation: result.recommendation, score: result.score }
                    });

                    if (!moved) continue;

                    if (this.mode === 'auto_write') {
                        eventBus.emit(EVENTS.CANDIDATE_STAGED, {
                            candidateId: candidate.candidateId,
                            candidateName: candidate.candidateName,
                            jobId: candidate.jobId,
                            stage: 'long_list',
                            source: 'screening-agent',
                            recommendation: result.recommendation,
                            score: result.score
                        });
                    } else {
                        proposedActionService.add({
                            agentType: 'SCREENING',
                            title: 'Move Stage',
                            description: `${candidate.candidateName} for "${candidate.jobTitle}" • Screening ${result.recommendation} (${result.score}/100).`,
                            candidateId: candidate.candidateId,
                            jobId: candidate.jobId,
                            payload: {
                                type: 'MOVE_CANDIDATE_TO_STAGE',
                                candidate: {
                                    id: candidate.candidateId,
                                    name: candidate.candidateName,
                                    email: candidate.candidateEmail,
                                    role: 'Candidate',
                                    type: 'uploaded',
                                    skills: [],
                                    experience: 0,
                                    location: '',
                                    availability: ''
                                } as any,
                                jobId: candidate.jobId,
                                stage: 'long_list'
                            },
                            evidence: [{ label: 'Screening', value: `${result.recommendation} (${result.score}/100)` }]
                        });

                        pulseService.addEvent({
                            type: 'AGENT_ACTION',
                            severity: 'info',
                            message: `Proposal created: Move ${candidate.candidateName} → Long List after screening (${result.score}/100).`,
                            metadata: { agentType: 'SCREENING', candidateId: candidate.candidateId, jobId: candidate.jobId, actionLink: '/agent-inbox' }
                        });
                    }

                    void pipelineEventService.logEvent({
                        candidateId: candidate.candidateId,
                        candidateName: candidate.candidateName,
                        jobId: candidate.jobId,
                        jobTitle: candidate.jobTitle,
                        eventType: this.mode === 'auto_write' ? 'STAGE_MOVED' : 'ACTION_PROPOSED',
                        actorType: 'agent',
                        actorId: 'screening-agent',
                        fromStage: 'screening',
                        toStage: 'long_list',
                        summary:
                            this.mode === 'auto_write'
                                ? `Auto-moved to Long List after screening: ${result.recommendation} (${result.score}/100).`
                                : `Proposed: Move to Long List after screening: ${result.recommendation} (${result.score}/100).`,
                        metadata: {
                            recommendation: result.recommendation,
                            score: result.score
                        }
                    });

                    void processingMarkerService.completeStep({
                        candidateId: candidate.candidateId,
                        jobId: candidate.jobId,
                        step: stageStep,
                        metadata: { recommendation: result.recommendation, score: result.score }
                    });
                } else if (result.recommendation === 'FAIL') {
                    const stageStep = 'stage_move:rejected:screening:v1';
                    const moved = await processingMarkerService.beginStep({
                        candidateId: candidate.candidateId,
                        jobId: candidate.jobId,
                        step: stageStep,
                        ttlMs: 1000 * 60 * 10,
                        metadata: { recommendation: result.recommendation, score: result.score }
                    });

                    if (!moved) continue;

                    if (this.mode === 'auto_write') {
                        eventBus.emit(EVENTS.CANDIDATE_STAGED, {
                            candidateId: candidate.candidateId,
                            candidateName: candidate.candidateName,
                            jobId: candidate.jobId,
                            stage: 'rejected',
                            source: 'screening-agent',
                            recommendation: result.recommendation,
                            score: result.score
                        });
                    } else {
                        proposedActionService.add({
                            agentType: 'SCREENING',
                            title: 'Move Stage',
                            description: `${candidate.candidateName} for "${candidate.jobTitle}" • Screening FAIL (${result.score}/100).`,
                            candidateId: candidate.candidateId,
                            jobId: candidate.jobId,
                            payload: {
                                type: 'MOVE_CANDIDATE_TO_STAGE',
                                candidate: {
                                    id: candidate.candidateId,
                                    name: candidate.candidateName,
                                    email: candidate.candidateEmail,
                                    role: 'Candidate',
                                    type: 'uploaded',
                                    skills: [],
                                    experience: 0,
                                    location: '',
                                    availability: ''
                                } as any,
                                jobId: candidate.jobId,
                                stage: 'rejected'
                            },
                            evidence: [{ label: 'Screening', value: `FAIL (${result.score}/100)` }]
                        });

                        pulseService.addEvent({
                            type: 'AGENT_ACTION',
                            severity: 'warning',
                            message: `Proposal created: Move ${candidate.candidateName} → Rejected after screening (FAIL ${result.score}/100).`,
                            metadata: { agentType: 'SCREENING', candidateId: candidate.candidateId, jobId: candidate.jobId, actionLink: '/agent-inbox' }
                        });
                    }

                    void pipelineEventService.logEvent({
                        candidateId: candidate.candidateId,
                        candidateName: candidate.candidateName,
                        jobId: candidate.jobId,
                        jobTitle: candidate.jobTitle,
                        eventType: this.mode === 'auto_write' ? 'STAGE_MOVED' : 'ACTION_PROPOSED',
                        actorType: 'agent',
                        actorId: 'screening-agent',
                        fromStage: 'screening',
                        toStage: 'rejected',
                        summary:
                            this.mode === 'auto_write'
                                ? `Auto-moved to Rejected after screening: FAIL (${result.score}/100).`
                                : `Proposed: Move to Rejected after screening: FAIL (${result.score}/100).`,
                        metadata: {
                            recommendation: result.recommendation,
                            score: result.score
                        }
                    });

                    void processingMarkerService.completeStep({
                        candidateId: candidate.candidateId,
                        jobId: candidate.jobId,
                        step: stageStep,
                        metadata: { recommendation: result.recommendation, score: result.score }
                    });
                }

                void processingMarkerService.completeStep({
                    candidateId: candidate.candidateId,
                    jobId: candidate.jobId,
                    step: screeningStep,
                    metadata: { resultId: result.id, recommendation: result.recommendation, score: result.score }
                });

                // Notify via Pulse Feed
                const emoji = result.passed ? '✅' : '❌';
                const action = result.passed ? 'passed' : 'did not pass';

                pulseService.addEvent({
                    type: 'AGENT_ACTION',
                    message: `${emoji} ${candidate.candidateName} ${action} initial screening (${result.score}/100). Recommendation: ${result.recommendation}`,
                    severity: result.passed ? 'success' : 'warning',
                    metadata: {
                        candidateId: candidate.candidateId,
                        jobId: candidate.jobId,
                        score: result.score,
                        recommendation: result.recommendation,
                        agentType: 'SCREENING'
                    }
                });

                console.log(`[AutonomousScreeningAgent] ✓ Screened ${candidate.candidateName}: ${result.score}/100`);

            } catch (error) {
                console.error(`[AutonomousScreeningAgent] Failed to screen ${candidate.candidateName}:`, error);
            }
        }

        // Clear queue
        this.screeningQueue = [];
        console.log('[AutonomousScreeningAgent] ✓ Screening complete');
    }

    /**
     * Conduct automated screening interview
     */
    private async conductScreen(candidate: ScreeningCandidate): Promise<ScreeningResult> {
        console.log(`[AutonomousScreeningAgent] Conducting screen for ${candidate.candidateName}...`);

        // Generate screening questions based on job requirements
        const questions = this.generateQuestions(candidate.jobRequirements);

        // Simulate candidate responses (in real app: send email/SMS or conduct chat)
        const qaResults = await this.simulateScreening(questions, candidate);

        // Calculate overall score
        const avgScore = qaResults.reduce((sum, qa) => sum + qa.score, 0) / qaResults.length;
        const passed = avgScore >= 65;  // 65% threshold

        // Determine recommendation
        let recommendation: ScreeningResult['recommendation'];
        if (avgScore >= 85) recommendation = 'STRONG_PASS';
        else if (avgScore >= 65) recommendation = 'PASS';
        else if (avgScore >= 50) recommendation = 'BORDERLINE';
        else recommendation = 'FAIL';

        // Generate AI summary
        const summary = await this.generateSummary(candidate, qaResults, avgScore);

        return {
            id: `screen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            candidateId: candidate.candidateId,
            candidateName: candidate.candidateName,
            jobId: candidate.jobId,
            jobTitle: candidate.jobTitle,
            score: Math.round(avgScore),
            passed,
            questions: qaResults,
            recommendation,
            summary,
            screenedAt: new Date()
        };
    }

    /**
     * Generate screening questions from job requirements
     */
    private generateQuestions(requirements: string[]): string[] {
        const questions: string[] = [];

        // Add requirement-specific questions
        requirements.slice(0, 3).forEach(req => {
            questions.push(`Tell me about your experience with ${req}.`);
        });

        // Add general questions
        questions.push('Why are you interested in this role?');
        questions.push('What are your salary expectations?');
        questions.push('When would you be available to start?');

        return questions;
    }

    /**
     * Simulate screening Q&A (in real app: conduct via chat/email)
     */
    private async simulateScreening(
        questions: string[],
        candidate: ScreeningCandidate
    ): Promise<{ question: string; answer: string; score: number }[]> {

        const results: { question: string; answer: string; score: number }[] = [];

        for (const question of questions) {
            // Simulate candidate response
            const answer = this.generateMockAnswer(question);

            // Score the answer (in real app: use AI to evaluate)
            const score = this.scoreAnswer(question, answer);

            results.push({ question, answer, score });

            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return results;
    }

    /**
     * Generate mock candidate answer
     */
    private generateMockAnswer(question: string): string {
        const templates = [
            "I have extensive experience in this area, having worked on multiple projects involving...",
            "I'm very familiar with this technology and have been using it for the past 2-3 years in production environments.",
            "This is one of my core strengths. In my previous role, I...",
            "I'm quite interested in this position because it aligns with my career goals and expertise.",
            "My expectation is market rate for this role and location, around $X - $Y range."
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    /**
     * Score an answer (simplified - real version uses AI)
     */
    private scoreAnswer(question: string, answer: string): number {
        // Random score between 50-95 for simulation
        // Real implementation would use:
        // - AI to evaluate answer quality
        // - Keyword matching for technical skills
        // - Sentiment analysis
        return 50 + Math.floor(Math.random() * 45);
    }

    /**
     * Generate AI summary of screening
     */
    private async generateSummary(
        candidate: ScreeningCandidate,
        qaResults: any[],
        avgScore: number
    ): Promise<string> {

        if (!aiService.isAvailable()) {
            return `Automated screening completed with ${Math.round(avgScore)}% match. ${qaResults.length} questions answered.`;
        }

        // In real implementation: use AI to generate comprehensive summary
        const summaries = [
            `Strong candidate with solid technical background. Demonstrates clear communication and relevant experience. Recommended for technical interview.`,
            `Candidate shows promise but needs deeper evaluation on specific technical skills. Schedule follow-up to assess hands-on capabilities.`,
            `Excellent fit for role requirements. Strong answers across all screening questions. Fast-track to hiring manager interview.`,
            `Candidate lacks some key requirements but shows learning potential. Consider for junior version of role.`
        ];

        return summaries[Math.floor(Math.random() * summaries.length)];
    }

    /**
     * Get all screening results
     */
    getResults(): ScreeningResult[] {
        return this.screeningResults;
    }

    getResultById(id: string): ScreeningResult | undefined {
        return this.screeningResults.find((r) => r.id === id);
    }

    getResultsForCandidate(candidateId: string): ScreeningResult[] {
        return this.screeningResults
            .filter((r) => r.candidateId === String(candidateId))
            .sort((a, b) => new Date(b.screenedAt).getTime() - new Date(a.screenedAt).getTime());
    }

    getResultsForCandidateJob(candidateId: string, jobId: string): ScreeningResult[] {
        return this.screeningResults
            .filter((r) => r.candidateId === String(candidateId) && r.jobId === jobId)
            .sort((a, b) => new Date(b.screenedAt).getTime() - new Date(a.screenedAt).getTime());
    }

    /**
     * Get results for specific job
     */
    getResultsForJob(jobId: string): ScreeningResult[] {
        return this.screeningResults.filter((r) => r.jobId === jobId);
    }

    /**
     * Get passed candidates
     */
    getPassedCandidates(): ScreeningResult[] {
        return this.screeningResults.filter(r => r.passed);
    }

    /**
     * Get agent status
     */
    getStatus() {
        if (!this.jobId) {
            return {
                initialized: false,
                enabled: false,
                queueSize: 0,
                totalScreened: 0,
                passedCount: 0,
                passRate: 0
            };
        }

        const job = backgroundJobService.getJob(this.jobId);
        const passedCount = this.getPassedCandidates().length;
        const totalScreened = this.screeningResults.length;
        const passRate = totalScreened > 0 ? (passedCount / totalScreened) * 100 : 0;

        return {
            initialized: this.isInitialized,
            enabled: job?.enabled || false,
            lastRun: job?.lastRun || null,
            nextRun: job?.nextRun || null,
            queueSize: this.screeningQueue.length,
            totalScreened,
            passedCount,
            passRate: Math.round(passRate)
        };
    }

    /**
     * Enable/disable agent
     */
    setEnabled(enabled: boolean) {
        if (!this.jobId) {
            console.warn('[AutonomousScreeningAgent] Not initialized yet');
            return;
        }

        backgroundJobService.setJobEnabled(this.jobId, enabled);
        console.log(`[AutonomousScreeningAgent] Agent ${enabled ? 'enabled' : 'disabled'}`);
    }

    setMode(mode: AgentMode) {
        this.mode = mode;
    }

    /**
     * Manually trigger screening
     */
    async triggerScreening() {
        if (!this.jobId) {
            throw new Error('Agent not initialized');
        }

        console.log('[AutonomousScreeningAgent] Manual screening triggered');
        await backgroundJobService.runJob(this.jobId);
    }
}

export const autonomousScreeningAgent = new AutonomousScreeningAgent();
