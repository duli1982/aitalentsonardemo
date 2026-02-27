/**
 * Autonomous Analytics Agent
 * Monitors pipeline + talent pool metrics, detects anomalies, and emits Pulse alerts.
 */

import { Type } from '@google/genai';
import { backgroundJobService } from './BackgroundJobService';
import { pulseService } from './PulseService';
import { supabase } from './supabaseClient';
import { aiService } from './AIService';
import type { AgentMode } from './AgentSettingsService';
import { sanitizeForPrompt, buildSecurePrompt } from '../utils/promptSecurity';

export type AnalyticsAlertSeverity = 'info' | 'warning' | 'error';

export interface AnalyticsAlert {
    id: string;
    severity: AnalyticsAlertSeverity;
    title: string;
    message: string;
    createdAt: string;
    metadata?: Record<string, any>;
}

export interface PipelineSnapshot {
    id: string;
    createdAt: string;
    openJobs: number;
    pipeline: {
        totalInPipeline: number;
        stageCounts: Record<string, number>;
        jobStageCounts: Record<string, Record<string, number>>;
    };
    talentPool: {
        supabaseCandidateCount: number | null;
    };
}

const STORAGE_KEYS = {
    snapshots: 'autonomous_analytics_snapshots_v1',
    alerts: 'autonomous_analytics_alerts_v1'
} as const;

function safeParseJson<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function stageKey(raw: unknown): string {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return 'new';
    // Back-compat: older pipeline stages
    if (value === 'sourcing' || value === 'contacted') return 'new';
    return value;
}

function countByStageForJob(candidates: any[], jobId: string): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const candidate of candidates) {
        const score = candidate?.matchScores?.[jobId];
        if (!score) continue;

        const stage = stageKey(candidate?.pipelineStage?.[jobId] ?? candidate?.stage ?? 'new');
        counts[stage] = (counts[stage] || 0) + 1;
    }

    return counts;
}

function countByStageOverall(candidates: any[], jobs: any[]): { total: number; stageCounts: Record<string, number>; jobStageCounts: Record<string, Record<string, number>> } {
    const jobStageCounts: Record<string, Record<string, number>> = {};
    const stageCounts: Record<string, number> = {};

    for (const job of jobs) {
        const jobId = String(job?.id || '');
        if (!jobId) continue;
        const counts = countByStageForJob(candidates, jobId);
        jobStageCounts[jobId] = counts;

        for (const [stage, count] of Object.entries(counts)) {
            stageCounts[stage] = (stageCounts[stage] || 0) + count;
        }
    }

    const total = Object.values(stageCounts).reduce((sum, value) => sum + value, 0);
    return { total, stageCounts, jobStageCounts };
}

class AutonomousAnalyticsAgent {
    private jobId: string | null = null;
    private isInitialized = false;
    private mode: AgentMode = 'recommend';

    initialize(jobs: any[], candidates: any[], options?: { enabled?: boolean; mode?: AgentMode }) {
        if (this.isInitialized) return;
        this.mode = options?.mode ?? 'recommend';

        this.jobId = backgroundJobService.registerJob({
            name: 'Autonomous Pipeline Analytics',
            type: 'MONITORING',
            interval: 30 * 60 * 1000, // 30 minutes
            enabled: options?.enabled ?? false,
            handler: async () => {
                await this.runAnalysis(jobs, candidates);
            }
        });

        this.isInitialized = true;
        console.log('[AutonomousAnalyticsAgent] ✓ Initialized');
    }

    setEnabled(enabled: boolean) {
        if (!this.jobId) return;
        backgroundJobService.setJobEnabled(this.jobId, enabled);
    }

    setMode(mode: AgentMode) {
        this.mode = mode;
    }

    getStatus() {
        if (!this.jobId) {
            return {
                initialized: false,
                enabled: false,
                lastRun: null,
                nextRun: null
            };
        }

        const job = backgroundJobService.getJob(this.jobId);
        return {
            initialized: this.isInitialized,
            enabled: job?.enabled || false,
            lastRun: job?.lastRun || null,
            nextRun: job?.nextRun || null,
            recentResults: backgroundJobService.getJobResults(this.jobId, 5)
        };
    }

    getSnapshots(limit = 48): PipelineSnapshot[] {
        const snapshots = safeParseJson<PipelineSnapshot[]>(localStorage.getItem(STORAGE_KEYS.snapshots), []);
        return snapshots.slice(0, limit);
    }

    getAlerts(limit = 50): AnalyticsAlert[] {
        const alerts = safeParseJson<AnalyticsAlert[]>(localStorage.getItem(STORAGE_KEYS.alerts), []);
        return alerts.slice(0, limit);
    }

    async triggerRun(jobs: any[], candidates: any[]) {
        if (!this.jobId) return;
        await this.runAnalysis(jobs, candidates, { manual: true });
    }

    private persistSnapshot(snapshot: PipelineSnapshot) {
        const existing = safeParseJson<PipelineSnapshot[]>(localStorage.getItem(STORAGE_KEYS.snapshots), []);
        const next = [snapshot, ...existing].slice(0, 500);
        localStorage.setItem(STORAGE_KEYS.snapshots, JSON.stringify(next));
    }

    private persistAlert(alert: AnalyticsAlert) {
        const existing = safeParseJson<AnalyticsAlert[]>(localStorage.getItem(STORAGE_KEYS.alerts), []);
        const next = [alert, ...existing].slice(0, 500);
        localStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(next));
    }

    private emitAlert(alert: Omit<AnalyticsAlert, 'id' | 'createdAt'>) {
        const full: AnalyticsAlert = {
            ...alert,
            id: `aa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString()
        };

        this.persistAlert(full);

        pulseService.addEvent({
            type: 'AGENT_ACTION',
            severity: full.severity,
            title: full.title,
            message: full.message,
            metadata: {
                agentType: 'ANALYTICS',
                ...full.metadata
            }
        });
    }

    private async fetchSupabaseCandidateCount(): Promise<number | null> {
        try {
            const result = await supabase
                .from('candidate_documents')
                .select('id', { count: 'exact', head: true });

            if (result.error) return null;
            return result.count ?? null;
        } catch {
            return null;
        }
    }

    private async runAnalysis(jobs: any[], candidates: any[], opts?: { manual?: boolean }) {
        const openJobs = jobs.filter((j) => (j?.status || '').toLowerCase() === 'open' || (j?.status || '').toLowerCase() === 'active');

        const pipeline = countByStageOverall(candidates, openJobs);
        const supabaseCandidateCount = await this.fetchSupabaseCandidateCount();

        const snapshot: PipelineSnapshot = {
            id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
            openJobs: openJobs.length,
            pipeline: {
                totalInPipeline: pipeline.total,
                stageCounts: pipeline.stageCounts,
                jobStageCounts: pipeline.jobStageCounts
            },
            talentPool: {
                supabaseCandidateCount
            }
        };

        this.persistSnapshot(snapshot);

        const previous = this.getSnapshots(2)[1] || null;
        this.detectAnomalies(snapshot, previous);

        if (opts?.manual) {
            pulseService.addEvent({
                type: 'AGENT_ACTION',
                severity: 'info',
                title: 'Analytics Agent',
                message: `Analytics snapshot captured. Open jobs: ${snapshot.openJobs}. Pipeline candidates: ${snapshot.pipeline.totalInPipeline}.`,
                metadata: { agentType: 'ANALYTICS' }
            });
        }

        // Optional: add an AI-generated insight if Gemini is configured (best-effort, no hard dependency).
        await this.tryGenerateAiInsight(snapshot);
    }

    private detectAnomalies(current: PipelineSnapshot, previous: PipelineSnapshot | null) {
        if (!previous) return;

        // 1) Pipeline velocity drop: sharp drop in late-stage (interview/offer/hired) counts between snapshots.
        const lateStages = ['interview', 'offer', 'hired'];
        const currentLate = lateStages.reduce((sum, s) => sum + (current.pipeline.stageCounts[s] || 0), 0);
        const prevLate = lateStages.reduce((sum, s) => sum + (previous.pipeline.stageCounts[s] || 0), 0);

        if (prevLate >= 5 && currentLate <= Math.floor(prevLate * 0.4)) {
            this.emitAlert({
                severity: 'warning',
                title: 'Pipeline Velocity Drop',
                message: `Late-stage pipeline volume dropped from ${prevLate} to ${currentLate}. Check interview throughput and offer approvals.`,
                metadata: { prevLate, currentLate }
            });
        }

        // 2) Screening pile-up: screening grows while interview stays flat.
        const curScreen = current.pipeline.stageCounts['screening'] || 0;
        const prevScreen = previous.pipeline.stageCounts['screening'] || 0;
        const curScheduling = current.pipeline.stageCounts['scheduling'] || 0;
        const prevScheduling = previous.pipeline.stageCounts['scheduling'] || 0;
        const curInterview = current.pipeline.stageCounts['interview'] || 0;
        const prevInterview = previous.pipeline.stageCounts['interview'] || 0;

        // Screening should feed into scheduling/interview; if screening balloons while downstream stays flat, flag it.
        if (curScreen >= prevScreen + 10 && (curScheduling + curInterview) <= (prevScheduling + prevInterview) + 1) {
            this.emitAlert({
                severity: 'warning',
                title: 'Screening Bottleneck',
                message: `Screening queue increased (+${curScreen - prevScreen}) while scheduling/interview volume is flat. Consider adding interviewer capacity.`,
                metadata: { curScreen, prevScreen, curScheduling, prevScheduling, curInterview, prevInterview }
            });
        }

        // 3) Talent pool availability: Supabase count dropped (rare, but a good signal for ingestion/migration issues).
        const curPool = current.talentPool.supabaseCandidateCount;
        const prevPool = previous.talentPool.supabaseCandidateCount;
        if (typeof curPool === 'number' && typeof prevPool === 'number' && curPool < prevPool - 1000) {
            this.emitAlert({
                severity: 'error',
                title: 'Talent Pool Size Drop',
                message: `Supabase candidate pool count dropped from ${prevPool} to ${curPool}. Verify ingestion jobs and data retention policies.`,
                metadata: { prevPool, curPool }
            });
        }
    }

    private async tryGenerateAiInsight(snapshot: PipelineSnapshot) {
        try {
            const prompt = buildSecurePrompt({
                system: 'You are an analytics agent for a recruiting pipeline. Given a pipeline snapshot, return JSON with keys: insight (string) and recommendation (string). Be brief and actionable. If no issues, highlight the strongest signal.',
                dataBlocks: [
                    { label: 'PIPELINE_SNAPSHOT', content: sanitizeForPrompt(JSON.stringify(snapshot), 4000) }
                ],
                outputSpec: 'Return ONLY valid JSON: { "insight": string, "recommendation": string }'
            });

            // Layer 6: Enforce structured output schema at the API level.
            const analyticsSchema = {
                type: Type.OBJECT,
                properties: {
                    insight: { type: Type.STRING, description: 'A brief actionable insight about the pipeline.' },
                    recommendation: { type: Type.STRING, description: 'A concise recommendation based on the insight.' }
                },
                required: ['insight', 'recommendation']
            };

            const result = await aiService.generateJson<{ insight: string; recommendation: string }>(prompt, analyticsSchema);
            if (!result?.insight || !result?.recommendation) return;

            this.emitAlert({
                severity: 'info',
                title: 'AI Insight',
                message: `${result.insight} Recommendation: ${result.recommendation}`,
                metadata: { snapshotId: snapshot.id }
            });
        } catch {
            // No-op; AI is optional for this agent.
        }
    }
}

export const autonomousAnalyticsAgent = new AutonomousAnalyticsAgent();
