import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Candidate, Job, InternalCandidate, UploadedCandidate, PipelineStage } from '../../types';
import { Briefcase, MapPin, FileText, TrendingUp, ChevronRight, User, Calendar, Tag, RefreshCw, Flame, Thermometer, Snowflake, GraduationCap, ClipboardList, Mail, BadgeCheck, BadgeX, X, MoreHorizontal } from 'lucide-react';
import ScheduleInterviewModal from '../modals/ScheduleInterviewModal';
import AutoTagModal from '../modals/AutoTagModal';
import RefreshProfileModal from '../modals/RefreshProfileModal';
import TrainingRecommenderModal from '../modals/TrainingRecommenderModal';
import InterviewNotesSummarizerModal from '../modals/InterviewNotesSummarizerModal';
import EmailComposerModal from '../modals/EmailComposerModal';
import * as geminiService from '../../services/geminiService';
import { autonomousScreeningAgent, type ScreeningResult } from '../../services/AutonomousScreeningAgent';
import { decisionArtifactService, type DecisionArtifactRecord } from '../../services/DecisionArtifactService';
import { pipelineEventService, type PipelineEventRecord } from '../../services/PipelineEventService';
import { toCandidateSnapshot, toJobSnapshot } from '../../utils/snapshots';
import { aiService } from '../../services/AIService';
import { recruitingScorecardService, type RecruitingScorecardRecord } from '../../services/RecruitingScorecardService';
import { determineNextAction, type NextActionSuggestion } from '../../services/NextActionService';
import { schedulingPersistenceService, type ScheduledInterviewRecord } from '../../services/SchedulingPersistenceService';
import { interviewSessionPersistenceService, type InterviewSessionRecord } from '../../services/InterviewSessionPersistenceService';
import RecommendationScorecardPanel from './RecommendationScorecardPanel';
import { TIMING } from '../../config/timing';

interface CandidateDetailProps {
    candidate: Candidate | undefined;
    jobs: Job[];
    onInitiateAnalysis: (candidate: Candidate, job: Job) => void;
    onAddToPipeline?: (candidate: Candidate, jobId: string, initialStage?: PipelineStage) => void | Promise<void>;
    onUpdateCandidateStage?: (candidateId: string, jobId: string, newStage: PipelineStage) => void;
}

type ActiveModal = 'schedule' | 'autoTag' | 'refresh' | 'training' | 'notes' | 'email' | null;

const SEMANTIC_JOB_MATCH_CACHE_VERSION = 1;
const SEMANTIC_JOB_MATCH_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

type SemanticJobMatchCache = {
    version: number;
    createdAt: number;
    scoresByJobId: Record<string, number>;
    jobSignatureByJobId: Record<string, string>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getJobSignature(job: Job): string {
    const requiredSkills = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];
    const jobExtensions = job as unknown as { seniority?: string; experienceLevel?: string };
    const seniority = jobExtensions.seniority || jobExtensions.experienceLevel || '';
    return [
        job.id,
        job.title ?? '',
        job.department ?? '',
        job.location ?? '',
        seniority,
        requiredSkills.slice(0, 20).join(','),
        (job.description ?? '').slice(0, 250)
    ].join('|');
}

function buildJobEmbeddingText(job: Job): string {
    const requiredSkills = Array.isArray(job.requiredSkills) ? job.requiredSkills : [];
    const jobExtensions = job as unknown as { seniority?: string; experienceLevel?: string };
    const seniority = jobExtensions.seniority || jobExtensions.experienceLevel || '';
    const description = (job.description ?? '').slice(0, 1200);
    return [
        `Job title: ${job.title || ''}`,
        `Department: ${job.department || ''}`,
        `Location: ${job.location || ''}`,
        seniority ? `Seniority: ${seniority}` : '',
        requiredSkills.length > 0 ? `Required skills: ${requiredSkills.join(', ')}` : '',
        description ? `Description: ${description}` : ''
    ]
        .filter(Boolean)
        .join('\n');
}

function buildCandidateEmbeddingText(candidate: Candidate): string {
    const role = candidate.role || candidate.currentRole || candidate.previousRoleAppliedFor || '';
    const department = candidate.department || '';
    const summary = candidate.summary || candidate.careerAspirations || candidate.notes || '';
    const experienceYears = candidate.experienceYears ?? candidate.experience ?? 0;

    return [
        `Candidate: ${candidate.name || ''}`,
        role ? `Role: ${role}` : '',
        department ? `Department: ${department}` : '',
        candidate.location ? `Location: ${candidate.location}` : '',
        `Experience: ${experienceYears} years`,
        Array.isArray(candidate.skills) && candidate.skills.length > 0 ? `Skills: ${candidate.skills.join(', ')}` : '',
        summary ? `Summary: ${String(summary).slice(0, 1200)}` : ''
    ]
        .filter(Boolean)
        .join('\n');
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const length = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < length; i++) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        dot += av * bv;
        normA += av * av;
        normB += bv * bv;
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function similarityToPercent(similarity: number): number {
    const sim = Math.max(0, Math.min(1, similarity));
    if (sim <= 0.45) return 0;
    if (sim < 0.65) return Math.round(((sim - 0.45) / 0.2) * 50);
    if (sim < 0.85) return Math.round(50 + ((sim - 0.65) / 0.2) * 50);
    return 100;
}

const CandidateDetail: React.FC<CandidateDetailProps> = ({ candidate, jobs, onInitiateAnalysis, onAddToPipeline, onUpdateCandidateStage }) => {
    // Consolidated State
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);
    const [selectedJobContext, setSelectedJobContext] = useState<Job | null>(null);
    const [candidateTags, setCandidateTags] = useState<string[]>([]);
    const [selectedPipelineJobId, setSelectedPipelineJobId] = useState<string>('');
    const [semanticJobMatchScores, setSemanticJobMatchScores] = useState<Record<string, number>>({});
    const [semanticJobMatchLoading, setSemanticJobMatchLoading] = useState(false);
    const [semanticJobMatchError, setSemanticJobMatchError] = useState<string | null>(null);
    const [shortlistArtifacts, setShortlistArtifacts] = useState<DecisionArtifactRecord[]>([]);
    const [scorecardsByJobId, setScorecardsByJobId] = useState<Record<string, RecruitingScorecardRecord>>({});
    const scorecardsByJobIdRef = useRef<Record<string, RecruitingScorecardRecord>>({});

    // Engagement Analysis State
    const [engagementScore, setEngagementScore] = useState<geminiService.EngagementScore | null>(null);
    const [engagementLoading, setEngagementLoading] = useState(false);
    const [engagementError, setEngagementError] = useState<string | null>(null);
    const [showEngagementDetails, setShowEngagementDetails] = useState(false);
    const [headerActionsOpen, setHeaderActionsOpen] = useState(false);
    const [showAllJobMatches, setShowAllJobMatches] = useState(false);
    const [showScreeningHistory, setShowScreeningHistory] = useState(false);
    const [selectedScreeningId, setSelectedScreeningId] = useState<string | null>(null);
    const [screeningRefreshTick, setScreeningRefreshTick] = useState(0);
    const [dbScreeningResults, setDbScreeningResults] = useState<ScreeningResult[] | null>(null);
    const [pipelineEvents, setPipelineEvents] = useState<PipelineEventRecord[]>([]);
    const [pipelineEventsLoading, setPipelineEventsLoading] = useState(false);
    const [showPipelineActivity, setShowPipelineActivity] = useState(false);
    const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterviewRecord[]>([]);
    const [scheduledInterviewsLoading, setScheduledInterviewsLoading] = useState(false);
    const [showSchedulingHistory, setShowSchedulingHistory] = useState(false);
    const [interviewSessions, setInterviewSessions] = useState<InterviewSessionRecord[]>([]);
    const [interviewSessionsLoading, setInterviewSessionsLoading] = useState(false);
    const [showInterviewSessions, setShowInterviewSessions] = useState(false);
    const [selectedInterviewSessionId, setSelectedInterviewSessionId] = useState<string | null>(null);
    const [nextAction, setNextAction] = useState<NextActionSuggestion | null>(null);
    const [actionInProgress, setActionInProgress] = useState(false);

    useEffect(() => {
        scorecardsByJobIdRef.current = scorecardsByJobId;
    }, [scorecardsByJobId]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!candidate?.id) {
                if (!cancelled) {
                    setShortlistArtifacts([]);
                    setScorecardsByJobId({});
                }
                return;
            }

            try {
                const [scorecards, shortlist] = await Promise.all([
                    recruitingScorecardService.listForCandidate(String(candidate.id), 1, 250),
                    decisionArtifactService.listShortlistAnalysesForCandidate(String(candidate.id), 250)
                ]);

                if (cancelled) return;

                const byJobId: Record<string, RecruitingScorecardRecord> = {};
                scorecards.forEach((s) => {
                    byJobId[s.jobId] = s;
                });

                setScorecardsByJobId(byJobId);
                setShortlistArtifacts(shortlist);
            } catch {
                if (!cancelled) {
                    setShortlistArtifacts([]);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [candidate?.id]);

    useEffect(() => {
        if (!candidate) {
            setEngagementScore(null);
            setEngagementLoading(false);
            setEngagementError(null);
            return;
        }

        let cancelled = false;
        const cacheKey = `engagement_score:v1:${candidate.id}`;
        const ttlMs = 1000 * 60 * 60 * 6; // 6 hours

        const load = async () => {
            setEngagementLoading(true);
            setEngagementError(null);

            try {
                const raw = localStorage.getItem(cacheKey);
                if (raw) {
                    const parsed = JSON.parse(raw) as { createdAt: number; value: geminiService.EngagementScore };
                    if (parsed?.createdAt && parsed?.value && Date.now() - parsed.createdAt < ttlMs) {
                        if (!cancelled) setEngagementScore(parsed.value);
                        return;
                    }
                }
            } catch {
                // ignore cache parse errors
            }

            try {
                const scoreResult = await geminiService.calculateEngagementScoreResult(candidate, { mode: 'estimated' });
                if (!scoreResult.success && 'error' in scoreResult) {
                    throw new Error(scoreResult.error.message);
                }
                const score = scoreResult.data;
                if (cancelled) return;
                setEngagementScore(score);
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({ createdAt: Date.now(), value: score }));
                } catch {
                    // ignore cache write errors
                }
            } catch (e) {
                if (cancelled) return;
                const message = e instanceof Error ? e.message : 'Failed to compute engagement score.';
                setEngagementError(message);
                setEngagementScore(null);
            } finally {
                if (!cancelled) setEngagementLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [candidate?.id]);

    useEffect(() => {
        if (!candidate || jobs.length === 0) {
            setSemanticJobMatchScores({});
            setSemanticJobMatchLoading(false);
            setSemanticJobMatchError(null);
            return;
        }

        let cancelled = false;
        const candidateId = String(candidate.id);
        const cacheKey = `semantic_job_match:${SEMANTIC_JOB_MATCH_CACHE_VERSION}:${candidateId}`;
        const jobSignatureByJobId = Object.fromEntries(jobs.map((j) => [j.id, getJobSignature(j)]));

        const load = async () => {
            setSemanticJobMatchLoading(true);
            setSemanticJobMatchError(null);

            const now = Date.now();
            let cachedScores: Record<string, number> = {};
            let cachedSignatures: Record<string, string> = {};

            try {
                const raw = localStorage.getItem(cacheKey);
                if (raw) {
                    const parsed = JSON.parse(raw) as SemanticJobMatchCache;
                    if (
                        parsed &&
                        parsed.version === SEMANTIC_JOB_MATCH_CACHE_VERSION &&
                        typeof parsed.createdAt === 'number' &&
                        now - parsed.createdAt < SEMANTIC_JOB_MATCH_CACHE_TTL_MS &&
                        parsed.scoresByJobId &&
                        parsed.jobSignatureByJobId
                    ) {
                        cachedScores = parsed.scoresByJobId;
                        cachedSignatures = parsed.jobSignatureByJobId;
                    }
                }
            } catch {
                // Ignore cache parse errors
            }

            const jobsNeedingCompute = jobs.filter((job) => cachedSignatures[job.id] !== jobSignatureByJobId[job.id]);

            if (jobsNeedingCompute.length === 0) {
                if (!cancelled) {
                    setSemanticJobMatchScores(cachedScores);
                    setSemanticJobMatchLoading(false);
                }
                return;
            }

            try {
                const candidateText = buildCandidateEmbeddingText(candidate);
                const candidateEmbeddingResult = await aiService.embedText(candidateText);
                if (!candidateEmbeddingResult.success || !candidateEmbeddingResult.data) {
                    const errorMessage =
                        !candidateEmbeddingResult.success && 'error' in candidateEmbeddingResult
                            ? candidateEmbeddingResult.error.message
                            : 'Failed to generate candidate embedding';
                    throw new Error(errorMessage);
                }

                const updatedScores: Record<string, number> = { ...cachedScores };
                const updatedSignatures: Record<string, string> = { ...cachedSignatures };

                for (const job of jobsNeedingCompute) {
                    if (cancelled) return;
                    const jobText = buildJobEmbeddingText(job);
                    const jobEmbeddingResult = await aiService.embedText(jobText);
                    if (!jobEmbeddingResult.success || !jobEmbeddingResult.data) {
                        continue;
                    }

                    const similarity = cosineSimilarity(candidateEmbeddingResult.data, jobEmbeddingResult.data);
                    updatedScores[job.id] = similarityToPercent(similarity);
                    updatedSignatures[job.id] = jobSignatureByJobId[job.id];
                }

                if (cancelled) return;
                setSemanticJobMatchScores(updatedScores);

                try {
                    const payload: SemanticJobMatchCache = {
                        version: SEMANTIC_JOB_MATCH_CACHE_VERSION,
                        createdAt: now,
                        scoresByJobId: updatedScores,
                        jobSignatureByJobId: updatedSignatures
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(payload));
                } catch {
                    // Ignore cache write errors
                }
            } catch (e) {
                if (!cancelled) {
                    const message = e instanceof Error ? e.message : 'Failed to compute semantic job match scores.';
                    setSemanticJobMatchError(message);
                }
            } finally {
                if (!cancelled) setSemanticJobMatchLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [candidate?.id, jobs]);

    useEffect(() => {
        if (!selectedPipelineJobId && jobs.length > 0) {
            setSelectedPipelineJobId(jobs[0].id);
        }
    }, [jobs, selectedPipelineJobId]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!candidate?.id) {
                setDbScreeningResults(null);
                return;
            }

            try {
                const results = await decisionArtifactService.listScreeningsForCandidate(candidate.id, 200);
                if (!cancelled) setDbScreeningResults(results);
            } catch {
                if (!cancelled) setDbScreeningResults(null);
            }
        };

        void load();

        // Poll to keep UI updated (DB-first, localStorage fallback below).
        const interval = setInterval(() => {
            setScreeningRefreshTick((v) => v + 1);
            void load();
        }, TIMING.SCREENING_RESULTS_REFRESH_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [candidate?.id]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!candidate?.id) {
                setPipelineEvents([]);
                setPipelineEventsLoading(false);
                return;
            }

            setPipelineEventsLoading(true);
            try {
                const events = await pipelineEventService.listForCandidate(String(candidate.id), 50);
                if (!cancelled) setPipelineEvents(events);
            } catch {
                if (!cancelled) setPipelineEvents([]);
            } finally {
                if (!cancelled) setPipelineEventsLoading(false);
            }
        };

        void load();

        const interval = setInterval(() => {
            void load();
        }, TIMING.PIPELINE_EVENTS_REFRESH_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [candidate?.id]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!candidate?.id) {
                setScheduledInterviews([]);
                setScheduledInterviewsLoading(false);
                return;
            }

            setScheduledInterviewsLoading(true);
            try {
                const results = await schedulingPersistenceService.listForCandidate(String(candidate.id), 200);
                if (!cancelled) setScheduledInterviews(results);
            } catch {
                if (!cancelled) setScheduledInterviews([]);
            } finally {
                if (!cancelled) setScheduledInterviewsLoading(false);
            }
        };

        void load();

        const interval = setInterval(() => {
            void load();
        }, TIMING.SCHEDULED_INTERVIEWS_REFRESH_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [candidate?.id]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!candidate?.id) {
                setInterviewSessions([]);
                setInterviewSessionsLoading(false);
                return;
            }

            setInterviewSessionsLoading(true);
            try {
                const results = await interviewSessionPersistenceService.listForCandidate(String(candidate.id), 100);
                if (!cancelled) setInterviewSessions(results);
            } catch {
                if (!cancelled) setInterviewSessions([]);
            } finally {
                if (!cancelled) setInterviewSessionsLoading(false);
            }
        };

        void load();

        const interval = setInterval(() => {
            void load();
        }, TIMING.INTERVIEW_SESSIONS_REFRESH_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [candidate?.id]);

    const candidateId = candidate?.id ?? '';

    const screeningResults = useMemo<ScreeningResult[]>(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = screeningRefreshTick;
        if (!candidateId) return [];
        if (dbScreeningResults && dbScreeningResults.length > 0) {
            return dbScreeningResults;
        }
        return autonomousScreeningAgent.getResultsForCandidate(candidateId);
    }, [candidateId, dbScreeningResults, screeningRefreshTick]);

    const screeningsByJob = useMemo(() => {
        const map = new Map<string, ScreeningResult[]>();
        screeningResults.forEach((r) => {
            if (!map.has(r.jobId)) map.set(r.jobId, []);
            map.get(r.jobId)!.push(r);
        });

        // Ensure each list is newest-first
        map.forEach((list, key) => {
            map.set(
                key,
                [...list].sort((a, b) => new Date(b.screenedAt).getTime() - new Date(a.screenedAt).getTime())
            );
        });

        return map;
    }, [screeningResults]);

    const shortlistArtifactsByJob = useMemo(() => {
        const map = new Map<string, DecisionArtifactRecord[]>();
        shortlistArtifacts.forEach((artifact) => {
            if (!map.has(artifact.jobId)) map.set(artifact.jobId, []);
            map.get(artifact.jobId)!.push(artifact);
        });

        map.forEach((list, key) => {
            map.set(
                key,
                [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
        });

        return map;
    }, [shortlistArtifacts]);

    const scheduledInterviewsByJob = useMemo(() => {
        const map = new Map<string, ScheduledInterviewRecord[]>();
        scheduledInterviews.forEach((record) => {
            if (!map.has(record.jobId)) map.set(record.jobId, []);
            map.get(record.jobId)!.push(record);
        });

        map.forEach((list, key) => {
            map.set(
                key,
                [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            );
        });

        return map;
    }, [scheduledInterviews]);

    const interviewSessionsByJob = useMemo(() => {
        const map = new Map<string, InterviewSessionRecord[]>();
        interviewSessions.forEach((session) => {
            if (!map.has(session.jobId)) map.set(session.jobId, []);
            map.get(session.jobId)!.push(session);
        });

        map.forEach((list, key) => {
            map.set(
                key,
                [...list].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
            );
        });

        return map;
    }, [interviewSessions]);

    const selectedInterviewSession = useMemo(() => {
        if (!selectedInterviewSessionId) return null;
        return interviewSessions.find((s) => s.sessionId === selectedInterviewSessionId) ?? null;
    }, [interviewSessions, selectedInterviewSessionId]);

    const jobMatches = useMemo(() => {
        if (!candidate) return [];

        const rows = jobs
            .map((job) => {
                const semanticScore = semanticJobMatchScores[job.id];
                const fallbackScore = candidate.matchScores?.[job.id];
                const score = typeof semanticScore === 'number' ? semanticScore : (typeof fallbackScore === 'number' ? fallbackScore : null);
                if (typeof score !== 'number') return null;

                const screeningsForJob = screeningsByJob.get(job.id) || [];
                const latestScreening = screeningsForJob[0];

                return { job, score, screeningsForJob, latestScreening };
            })
            .filter(Boolean) as Array<{ job: Job; score: number; screeningsForJob: ScreeningResult[]; latestScreening?: ScreeningResult }>;

        return rows.sort((a, b) => b.score - a.score);
    }, [candidate, jobs, semanticJobMatchScores, screeningsByJob]);

    useEffect(() => {
        if (!candidate || jobMatches.length === 0) {
            setNextAction(null);
            return;
        }

	        const jobsWithScores = jobMatches.map(({ job, score }) => ({ job, score }));
	        const suggestion = determineNextAction({
	            candidateId: String(candidate.id),
	            pipelineStageByJobId: candidate.pipelineStage || {},
	            jobMatches: jobsWithScores,
	            pipelineEvents,
	            screeningsByJob,
	            shortlistByJob: shortlistArtifactsByJob,
	            scorecards: scorecardsByJobId
	        });

	        setNextAction(suggestion);
	    }, [candidate, jobMatches, pipelineEvents, screeningsByJob, shortlistArtifactsByJob, scorecardsByJobId]);

    useEffect(() => {
        let cancelled = false;

        const computeAndPersist = async () => {
            if (!candidate || jobs.length === 0) return;

            const nextByJobId: Record<string, RecruitingScorecardRecord> = {};
            let changed = false;

            for (const job of jobs) {
                if (cancelled) return;

                const semanticScore = semanticJobMatchScores[job.id];
                const fallbackScore = candidate.matchScores?.[job.id];
                const semanticMatchScore = typeof semanticScore === 'number' ? semanticScore : (typeof fallbackScore === 'number' ? fallbackScore : undefined);

                const latestShortlist = (shortlistArtifactsByJob.get(job.id) || [])[0];
                const latestScreening = (screeningsByJob.get(job.id) || [])[0];

                const screeningArtifact = latestScreening
                    ? {
                        id: latestScreening.id,
                        externalId: latestScreening.id,
                        score: latestScreening.score,
                        decision: latestScreening.recommendation,
                        createdAt: new Date(latestScreening.screenedAt).toISOString(),
                        details: { questions: latestScreening.questions ?? [], passed: latestScreening.passed }
                    }
                    : undefined;

                const scorecard = recruitingScorecardService.compute({
                    candidateId: String(candidate.id),
                    candidateName: candidate.name,
                    jobId: job.id,
                    jobTitle: job.title,
                    semanticMatchScore,
                    shortlistArtifact: latestShortlist,
                    screeningArtifact,
                    engagementScore: engagementScore
                        ? {
                            score: engagementScore.score,
                            level: engagementScore.level,
                            mode: 'estimated',
                            createdAt: new Date().toISOString()
                        }
                        : undefined
                });

                if (Object.keys(scorecard.dimensions || {}).length === 0) continue;

                nextByJobId[job.id] = scorecard;

                const previous = scorecardsByJobIdRef.current[job.id];
                const previousFingerprint = asRecord(previous?.provenance)?.fingerprint;
                const nextFingerprint = asRecord(scorecard.provenance)?.fingerprint;

                if (!previous || previousFingerprint !== nextFingerprint || previous.overallScore !== scorecard.overallScore) {
                    changed = true;
                    await recruitingScorecardService.upsert(scorecard);
                }
            }

            if (!cancelled && changed) {
                setScorecardsByJobId((prev) => ({ ...prev, ...nextByJobId }));
            }
        };

        void computeAndPersist();

        return () => {
            cancelled = true;
        };
    }, [candidate?.id, jobs, semanticJobMatchScores, screeningsByJob, shortlistArtifactsByJob, engagementScore?.score]);

    const selectedScreening = useMemo(() => {
        if (!selectedScreeningId) return null;
        const fromDb = (dbScreeningResults || []).find((r) => r.id === selectedScreeningId);
        if (fromDb) return fromDb;
        return autonomousScreeningAgent.getResultById(selectedScreeningId) || null;
    }, [dbScreeningResults, selectedScreeningId, screeningRefreshTick]);

    const selectedScreeningDecision = useMemo(() => {
        if (!selectedScreening) return null;
        const questionCount = selectedScreening.questions?.length || 0;
        const total = (selectedScreening.questions || []).reduce((sum, qa) => sum + (qa.score || 0), 0);
        const avg = questionCount > 0 ? total / questionCount : 0;
        const threshold = 65;

        return {
            questionCount,
            avgScore: avg,
            threshold,
            tiers: [
                { label: 'STRONG_PASS', rule: 'avg >= 85' },
                { label: 'PASS', rule: '65 <= avg < 85' },
                { label: 'BORDERLINE', rule: '50 <= avg < 65' },
                { label: 'FAIL', rule: 'avg < 50' }
            ]
        };
    }, [selectedScreening]);

    const loadEngagementScore = async (mode: 'estimated' | 'ai' = 'estimated') => {
        if (!candidate) return;
        try {
            setEngagementLoading(true);
            setEngagementError(null);
            const scoreResult = await geminiService.calculateEngagementScoreResult(candidate, { mode, maxRetries: 1 });
            if (!scoreResult.success && 'error' in scoreResult) {
                throw new Error(scoreResult.error.message);
            }
            const score = scoreResult.data;
            setEngagementScore(score);
            try {
                localStorage.setItem(`engagement_score:v1:${candidate.id}`, JSON.stringify({ createdAt: Date.now(), value: score }));
            } catch {
                // ignore cache write errors
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load engagement score.';
            setEngagementError(message);
            console.error('Error loading engagement score:', error);
        } finally {
            setEngagementLoading(false);
        }
    };

    const getEngagementIcon = (level: string) => {
        switch (level) {
            case 'hot': return <Flame size={16} className="text-orange-400" />;
            case 'warm': return <Thermometer size={16} className="text-amber-400" />;
            case 'cold': return <Snowflake size={16} className="text-sky-400" />;
            default: return null;
        }
    };

    const getEngagementColor = (level: string) => {
        switch (level) {
            case 'hot': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
            case 'warm': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'cold': return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    const handleOpenModal = (modal: ActiveModal, job: Job | null = null) => {
        setSelectedJobContext(job);
        setActiveModal(modal);
    };

    const handleCloseModal = () => {
        setActiveModal(null);
        setSelectedJobContext(null);
    };

	    const handleNextActionCTA = async () => {
	        if (!nextAction || !candidate) return;
	        const job = nextAction.job;
	        setActionInProgress(true);
	        try {
	            switch (nextAction.type) {
	                case 'add_pipeline':
	                    if (onAddToPipeline) {
	                        await onAddToPipeline(candidate, job.id, 'long_list');
	                    }

	                    await pipelineEventService.logEvent({
	                        candidateId: String(candidate.id),
	                        candidateName: candidate.name,
	                        jobId: job.id,
	                        jobTitle: job.title,
	                        eventType: 'STAGE_MOVED',
	                        actorType: 'user',
	                        fromStage: candidate.pipelineStage?.[job.id] || 'new',
	                        toStage: 'long_list',
	                        summary: `Candidate added to Long List for ${job.title}.`
	                    });
	                    break;
	                case 'request_screening': {
	                    const alreadyInPipeline = Boolean(candidate.pipelineStage?.[job.id]);
	                    if (!alreadyInPipeline && onAddToPipeline) {
	                        await onAddToPipeline(candidate, job.id, 'long_list');
	                    }
	                    onUpdateCandidateStage?.(String(candidate.id), job.id, 'screening');

	                    await pipelineEventService.logEvent({
	                        candidateId: String(candidate.id),
	                        candidateName: candidate.name,
	                        jobId: job.id,
	                        jobTitle: job.title,
	                        eventType: 'STAGE_MOVED',
	                        actorType: 'user',
	                        fromStage: 'long_list',
	                        toStage: 'screening',
	                        summary: `Moved to Screening for ${job.title}.`
	                    });

	                    autonomousScreeningAgent.requestScreening({
	                        candidateId: String(candidate.id),
	                        candidateName: candidate.name,
	                        candidateEmail: candidate.email || '',
	                        jobId: job.id,
	                        jobTitle: job.title,
	                        jobRequirements: job.requiredSkills || [],
	                        addedAt: new Date(),
	                        candidateSnapshot: toCandidateSnapshot(candidate),
	                        jobSnapshot: toJobSnapshot(job)
	                    });

	                    // Demo UX: run the screening job immediately so the Next Action advances without waiting hours.
	                    try {
	                        autonomousScreeningAgent.initialize();
	                        await autonomousScreeningAgent.triggerScreening();
	                        setScreeningRefreshTick((v) => v + 1);
	                    } catch {
	                        // ignore: agent may not be available in this environment
	                    }
	                    break;
	                }
	                case 'schedule_interview':
	                    handleOpenModal('schedule', job);
	                    break;
	                case 'move_rejected':
	                    onUpdateCandidateStage?.(String(candidate.id), job.id, 'rejected');
	                    await pipelineEventService.logEvent({
	                        candidateId: String(candidate.id),
	                        candidateName: candidate.name,
	                        jobId: job.id,
	                        jobTitle: job.title,
	                        eventType: 'REJECTED',
	                        actorType: 'user',
	                        summary: `Candidate manually moved to Rejected.`
	                    });
	                    break;
	            }
	        } finally {
	            setActionInProgress(false);
	        }
	    };

    if (!candidate) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <User className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg">Select a candidate to view their full profile</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">{candidate.name}</h1>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                            <div className="flex items-center">
                                <Briefcase className="h-4 w-4 mr-1.5 text-sky-400" />
                                {candidate.type === 'internal'
                                    ? (candidate as InternalCandidate).currentRole
                                    : candidate.role || 'Candidate'}
                            </div>
                            <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1.5 text-sky-400" />
                                {candidate.type === 'internal'
                                    ? (candidate as InternalCandidate).department
                                    : candidate.location || 'External'}
                            </div>
                            <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-1.5 text-sky-400" />
                                {candidate.email || 'No email provided'}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                            {jobs.length > 0 && onAddToPipeline && (
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedPipelineJobId}
                                        onChange={(e) => setSelectedPipelineJobId(e.target.value)}
                                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none max-w-[240px]"
                                        aria-label="Select job to add to pipeline"
                                    >
                                        {jobs.map((j) => (
                                            <option key={j.id} value={j.id}>
                                                {j.title}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => {
                                            if (!selectedPipelineJobId) return;
                                            onAddToPipeline(candidate, selectedPipelineJobId);
                                        }}
                                        disabled={!selectedPipelineJobId || Boolean(candidate.pipelineStage?.[selectedPipelineJobId])}
                                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={Boolean(candidate.pipelineStage?.[selectedPipelineJobId]) ? 'Already in pipeline for this job' : 'Add candidate to pipeline'}
                                    >
                                        <Briefcase size={16} />
                                        {Boolean(candidate.pipelineStage?.[selectedPipelineJobId]) ? 'In Pipeline' : 'Add to Pipeline'}
                                    </button>
                                </div>
                            )}

                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setHeaderActionsOpen((v) => !v)}
                                    className={`p-2 rounded-lg border transition-colors ${headerActionsOpen ? 'bg-sky-600/15 border-sky-500/40 text-sky-200' : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'}`}
                                    title="More actions"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>

                                {headerActionsOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHeaderActionsOpen(false);
                                                const jobForEmail = jobs.find(j => candidate.matchScores?.[j.id]) || jobs[0];
                                                if (jobForEmail) handleOpenModal('email', jobForEmail);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                        >
                                            <Mail className="h-4 w-4 text-cyan-300" />
                                            Email
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHeaderActionsOpen(false);
                                                handleOpenModal('refresh');
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                        >
                                            <RefreshCw className="h-4 w-4 text-emerald-300" />
                                            Refresh profile
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHeaderActionsOpen(false);
                                                handleOpenModal('autoTag');
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                        >
                                            <Tag className="h-4 w-4 text-purple-300" />
                                            Auto-tag
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${candidate.employmentStatus === 'available' ? 'bg-green-500/20 text-green-300' :
                            candidate.employmentStatus === 'interviewing' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-slate-600 text-gray-300'
                            }`}>
                            {candidate.employmentStatus || 'Available'}
                        </span>
                        {engagementLoading && !engagementScore && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-slate-600 text-slate-300">
                                Engagementâ€¦
                            </span>
                        )}
                        {engagementScore && (
                            <button
                                onClick={() => setShowEngagementDetails(!showEngagementDetails)}
                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border flex items-center gap-1 hover:scale-105 transition-transform ${getEngagementColor(engagementScore.level)}`}
                                title="Click for engagement details"
                            >
                                {getEngagementIcon(engagementScore.level)}
                                {engagementScore.level} {engagementScore.score}%
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Skills Section */}
                    <div className="bg-slate-700/30 rounded-lg p-5 border border-slate-700">
                        <h3 className="text-lg font-semibold text-sky-300 mb-4 flex items-center">
                            <TrendingUp className="h-5 w-5 mr-2" /> Skills & Expertise
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {candidate.skills.map(skill => (
                                <span key={skill} className="bg-slate-600 text-gray-200 px-3 py-1 rounded-md text-sm">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* AI Tags Section */}
                    {candidateTags.length > 0 && (
                        <div className="bg-slate-700/30 rounded-lg p-5 border border-slate-700">
                            <h3 className="text-lg font-semibold text-sky-300 mb-4 flex items-center">
                                <Tag className="h-5 w-5 mr-2" /> AI Tags
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {candidateTags.map(tag => (
                                    <span key={tag} className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300 px-3 py-1 rounded-md text-sm font-medium">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Engagement Details */}
                    {showEngagementDetails && engagementScore && (
                        <div className="col-span-1 lg:col-span-2 bg-slate-700/30 rounded-lg p-5 border border-slate-700">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <h3 className="text-lg font-semibold text-sky-300 flex items-center">
                                    {getEngagementIcon(engagementScore.level)}
                                    <span className="ml-2">Engagement Details</span>
                                </h3>
                                <button
                                    onClick={() => loadEngagementScore('estimated')}
                                    disabled={engagementLoading}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-60"
                                    title="Recompute estimated engagement"
                                >
                                    {engagementLoading ? 'Refreshingâ€¦' : 'Refresh'}
                                </button>
                            </div>

                            {engagementError && (
                                <div className="mb-3 text-xs text-red-400">{engagementError}</div>
                            )}

                            <div className="space-y-4">
                                {/* Activities Timeline */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Recent Activity</h4>
                                    <div className="space-y-2">
                                        {engagementScore.activities.map((activity, index) => (
                                            <div key={index} className="flex items-start gap-3 text-sm">
                                                <div className="w-2 h-2 rounded-full bg-sky-400 mt-1.5"></div>
                                                <div className="flex-grow">
                                                    <p className="text-gray-300">{activity.details}</p>
                                                    <p className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Insights */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Insights</h4>
                                    <ul className="space-y-1">
                                        {engagementScore.insights.map((insight, index) => (
                                            <li key={index} className="text-sm text-gray-400 flex items-start gap-2">
                                                <span className="text-sky-400">â€¢</span>
                                                {insight}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Recommendation */}
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-sm text-sky-300 font-medium">
                                        ðŸ’¡ Recommendation: {engagementScore.recommendation}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Profile Summary */}
                    <div className="bg-slate-700/30 rounded-lg p-5 border border-slate-700">
                        <h3 className="text-lg font-semibold text-sky-300 mb-4 flex items-center">
                            <FileText className="h-5 w-5 mr-2" /> Profile Summary
                        </h3>
                        <p className="text-gray-300 leading-relaxed">
                            {candidate.type === 'uploaded'
                                ? (candidate as UploadedCandidate).summary
                                : candidate.type === 'internal'
                                    ? (candidate as InternalCandidate).careerAspirations
                                    : candidate.notes || 'No summary available.'}
                        </p>
                    </div>

                    {/* Match History */}
                    <div className="col-span-1 lg:col-span-2 bg-slate-700/30 rounded-lg p-5 border border-slate-700">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="text-lg font-semibold text-sky-300 flex items-center">
                                <Briefcase className="h-5 w-5 mr-2" /> Job Matches
                            </h3>
                            {jobMatches.length > 3 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllJobMatches((v) => !v)}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                                >
                                    {showAllJobMatches ? 'Show less' : `Show all (${jobMatches.length})`}
                                </button>
                            )}
                        </div>
                        {nextAction && (
                            <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-3 shadow-sm">
                                <div>
                                    <p className="text-sm font-semibold text-white">{nextAction.label}</p>
                                    <p className="text-xs text-slate-400">{nextAction.description}</p>
                                    <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1">{nextAction.job.title}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleNextActionCTA}
                                    disabled={actionInProgress}
                                    className="px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 text-xs font-semibold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {actionInProgress ? 'Workingâ€¦' : 'Next action'}
                                </button>
                            </div>
                        )}
                        {nextAction && <RecommendationScorecardPanel candidate={candidate} job={nextAction.job} />}
                        {semanticJobMatchLoading && (
                            <p className="text-xs text-slate-400 mb-3">Computing semantic match scoresâ€¦</p>
                        )}
                        {semanticJobMatchError && (
                            <p className="text-xs text-red-400 mb-3">{semanticJobMatchError}</p>
                        )}

                        {jobMatches.length > 0 ? (
                            <div className="space-y-3">
                                {(showAllJobMatches ? jobMatches : jobMatches.slice(0, 3)).map(({ job, score, screeningsForJob, latestScreening }) => {
                                    const scorecard = scorecardsByJobId[job.id];
                                    const displayScore = scorecard?.overallScore ?? score;
                                    const displayLabel = scorecard ? 'Scorecard' : 'Semantic Match';
                                    const confidence = typeof scorecard?.confidence === 'number' ? Math.round(scorecard.confidence * 100) : null;

                                    return (
                                        <div key={job.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
                                            <div>
                                                <h4 className="font-medium text-gray-200">{job.title}</h4>
                                                <p className="text-xs text-gray-400">{job.department}</p>
                                                {latestScreening && (
                                                    <div className="mt-1 flex flex-wrap gap-2 items-center">
                                                        {latestScreening.passed ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                                                <BadgeCheck className="h-3 w-3" /> Screened PASS
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border bg-red-500/20 text-red-300 border-red-500/30">
                                                                <BadgeX className="h-3 w-3" /> Screened FAIL
                                                            </span>
                                                        )}
                                                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded border bg-slate-900 text-slate-200 border-slate-700">
                                                            {latestScreening.score}/100 - {latestScreening.recommendation}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {new Date(latestScreening.screenedAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <span className={`text-lg font-bold ${displayScore >= 70 ? 'text-green-400' : displayScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                                                        }`}>
                                                        {displayScore}%
                                                    </span>
                                                    <p className="text-[10px] text-gray-500 uppercase" title={confidence !== null ? `Confidence: ${confidence}%` : undefined}>
                                                        {displayLabel}
                                                    </p>
                                                </div>
                                                {screeningsForJob.length > 0 && (
                                                    <button
                                                        onClick={() => setSelectedScreeningId(screeningsForJob[0].id)}
                                                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white"
                                                        title="View latest screening Q&A"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenModal('schedule', job)}
                                                    className="p-2 bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors text-white"
                                                    title="Schedule Interview"
                                                >
                                                    <Calendar className="h-4 w-4" />
                                                </button>
                                                {candidate.type === 'internal' && score < 70 && (
                                                    <button
                                                        onClick={() => handleOpenModal('training', job)}
                                                        className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors text-white"
                                                        title="Get Training Recommendations"
                                                    >
                                                        <GraduationCap className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenModal('notes', job)}
                                                    className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-white"
                                                    title="Summarize Interview Notes"
                                                >
                                                    <ClipboardList className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => onInitiateAnalysis(candidate, job)}
                                                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors text-sky-400"
                                                    title="Run Deep Analysis"
                                                >
                                                    <ChevronRight className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-gray-400 italic">No active jobs to match against.</p>
                        )}

                        {/* Screening History */}
                        <div className="mt-6 pt-5 border-t border-slate-700">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <h4 className="text-base font-semibold text-sky-300 flex items-center">
                                    <ClipboardList className="h-4 w-4 mr-2" /> Screening History
                                </h4>
                                {screeningResults.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowScreeningHistory((v) => !v)}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                                    >
                                        {showScreeningHistory ? 'Hide' : `Show (${screeningResults.length})`}
                                    </button>
                                )}
                            </div>

                            {screeningResults.length === 0 ? (
                                <p className="text-gray-400 italic">No screening history for this candidate yet.</p>
                            ) : showScreeningHistory ? (
                                <div className="space-y-3">
                                    {[...screeningsByJob.entries()]
                                        .sort((a, b) => {
                                            const aLatest = a[1][0]?.screenedAt ? new Date(a[1][0].screenedAt).getTime() : 0;
                                            const bLatest = b[1][0]?.screenedAt ? new Date(b[1][0].screenedAt).getTime() : 0;
                                            return bLatest - aLatest;
                                        })
                                        .map(([jobKey, screenings]) => {
                                            const jobTitle = screenings[0]?.jobTitle || jobs.find((j) => j.id === jobKey)?.title || 'Job';
                                            return (
                                                <div key={jobKey} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                                                    <div className="flex items-center justify-between gap-3 mb-2">
                                                        <div>
                                                            <div className="text-sm font-semibold text-white">{jobTitle}</div>
                                                            <div className="text-[10px] text-slate-500">{screenings.length} screening run{screenings.length !== 1 ? 's' : ''}</div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {screenings
                                                            .sort((a, b) => new Date(b.screenedAt).getTime() - new Date(a.screenedAt).getTime())
                                                            .map((s) => (
                                                                <div key={s.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                                                                    <div>
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            {s.passed ? (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                                                                    <BadgeCheck className="h-3 w-3" /> PASS
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border bg-red-500/20 text-red-300 border-red-500/30">
                                                                                    <BadgeX className="h-3 w-3" /> FAIL
                                                                                </span>
                                                                            )}
                                                                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded border bg-slate-800 text-slate-200 border-slate-700">
                                                                                {s.score}/100
                                                                            </span>
                                                                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded border bg-purple-500/10 text-purple-200 border-purple-500/20">
                                                                                {s.recommendation}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-500 mt-1">
                                                                            {new Date(s.screenedAt).toLocaleString()}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-end">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSelectedScreeningId(s.id)}
                                                                            className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                                                                        >
                                                                            View Q&A / Decision Trail
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">
                                    Hidden. Use "Show" to view the full screening trail.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Scheduling History */}
            <div className="mt-6 pt-5 border-t border-slate-700">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h4 className="text-base font-semibold text-sky-300 flex items-center">
                        <Calendar className="h-4 w-4 mr-2" /> Scheduling History
                    </h4>
                    {scheduledInterviews.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowSchedulingHistory((v) => !v)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                        >
                            {showSchedulingHistory ? 'Hide' : `Show (${scheduledInterviews.length})`}
                        </button>
                    )}
                </div>

                {scheduledInterviewsLoading ? (
                    <div className="text-xs text-slate-400">Loading scheduling history...</div>
                ) : scheduledInterviews.length === 0 ? (
                    <p className="text-gray-400 italic">No scheduling activity recorded for this candidate yet.</p>
                ) : showSchedulingHistory ? (
                    <div className="space-y-3">
                        {[...scheduledInterviewsByJob.entries()]
                            .sort((a, b) => new Date(b[1][0]?.updatedAt ?? 0).getTime() - new Date(a[1][0]?.updatedAt ?? 0).getTime())
                            .map(([jobId, interviews]) => {
                                const jobTitle = interviews[0]?.jobTitle ?? jobs.find((j) => j.id === jobId)?.title ?? jobId;
                                return (
                                    <div key={`sched_${jobId}`} className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div>
                                                <div className="text-sm font-semibold text-white">{jobTitle}</div>
                                                <div className="text-[10px] text-slate-500">{interviews.length} record{interviews.length !== 1 ? 's' : ''}</div>
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                Updated: {new Date(interviews[0].updatedAt).toLocaleString()}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {interviews.map((record) => {
                                                const providerLabel = record.meetingProvider === 'ms_teams' ? 'MS Teams' : 'Google Meet';
                                                const statusTone =
                                                    record.status === 'confirmed'
                                                        ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                                                        : record.status === 'declined' || record.status === 'cancelled'
                                                            ? 'bg-red-500/15 text-red-200 border-red-500/20'
                                                            : record.status === 'rescheduled'
                                                                ? 'bg-amber-500/15 text-amber-200 border-amber-500/20'
                                                                : 'bg-slate-800 text-slate-200 border-slate-700';

                                                return (
                                                    <div
                                                        key={record.interviewId}
                                                        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-900/40 border border-slate-700 rounded-lg p-3"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] rounded border ${statusTone}`}>
                                                                    {record.status.toUpperCase()}
                                                                </span>
                                                                <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded border bg-slate-800 text-slate-200 border-slate-700">
                                                                    {providerLabel}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {record.interviewType.toUpperCase()}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {new Date(record.updatedAt).toLocaleString()}
                                                                </span>
                                                            </div>

                                                            <div className="text-sm text-slate-200 mt-1">
                                                                {record.scheduledTime
                                                                    ? `Scheduled: ${new Date(record.scheduledTime).toLocaleString()}`
                                                                    : record.proposedSlots?.length
                                                                        ? `Proposed ${record.proposedSlots.length} slot${record.proposedSlots.length !== 1 ? 's' : ''}`
                                                                        : 'No time proposed yet.'}
                                                            </div>

                                                            {record.meetingLink && (
                                                                <a
                                                                    className="text-xs text-sky-300 hover:text-sky-200 underline mt-1 inline-block"
                                                                    href={record.meetingLink}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    Open meeting link
                                                                </a>
                                                            )}

                                                            {Array.isArray(record.rescheduleHistory) && record.rescheduleHistory.length > 0 && (
                                                                <div className="text-[10px] text-slate-500 mt-1">
                                                                    Rescheduled {record.rescheduleHistory.length} time{record.rescheduleHistory.length !== 1 ? 's' : ''}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {record.proposedSlots?.length ? (
                                                            <div className="text-[10px] text-slate-400 lg:text-right">
                                                                Next proposed:
                                                                <div className="text-slate-300">
                                                                    {new Date(record.proposedSlots[0]).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    <div className="text-xs text-slate-400">Hidden. Use "Show" to view scheduling history.</div>
                )}
            </div>

            {/* Interview Sessions */}
            <div className="mt-6 pt-5 border-t border-slate-700">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h4 className="text-base font-semibold text-sky-300 flex items-center">
                        <FileText className="h-4 w-4 mr-2" /> Interview Sessions
                    </h4>
                    {interviewSessions.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowInterviewSessions((v) => !v)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                        >
                            {showInterviewSessions ? 'Hide' : `Show (${interviewSessions.length})`}
                        </button>
                    )}
                </div>

                {interviewSessionsLoading ? (
                    <div className="text-xs text-slate-400">Loading interview sessions...</div>
                ) : interviewSessions.length === 0 ? (
                    <p className="text-gray-400 italic">No interview sessions recorded for this candidate yet.</p>
                ) : showInterviewSessions ? (
                    <div className="space-y-3">
                        {[...interviewSessionsByJob.entries()]
                            .sort((a, b) => new Date(b[1][0]?.startedAt ?? 0).getTime() - new Date(a[1][0]?.startedAt ?? 0).getTime())
                            .map(([jobId, sessions]) => {
                                const jobTitle = sessions[0]?.jobTitle ?? jobs.find((j) => j.id === jobId)?.title ?? jobId;
                                return (
                                    <div key={`sess_${jobId}`} className="bg-slate-800/40 border border-slate-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div>
                                                <div className="text-sm font-semibold text-white">{jobTitle}</div>
                                                <div className="text-[10px] text-slate-500">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</div>
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                Latest: {new Date(sessions[0].startedAt).toLocaleString()}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {sessions.map((session) => {
                                                const providerLabel = session.meetingProvider === 'ms_teams' ? 'MS Teams' : session.meetingProvider === 'google_meet' ? 'Google Meet' : session.meetingProvider;
                                                const transcriptCount = Array.isArray(session.transcript) ? session.transcript.length : 0;
                                                const debriefRecord = asRecord(session.debrief);
                                                const debriefSummary = debriefRecord?.summary ?? debriefRecord?.notes ?? null;

                                                return (
                                                    <div
                                                        key={session.sessionId}
                                                        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-900/40 border border-slate-700 rounded-lg p-3"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded border bg-slate-800 text-slate-200 border-slate-700">
                                                                    {providerLabel}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {new Date(session.startedAt).toLocaleString()}
                                                                </span>
                                                                {session.endedAt && (
                                                                    <span className="text-[10px] text-slate-500">
                                                                        Ended: {new Date(session.endedAt).toLocaleString()}
                                                                    </span>
                                                                )}
                                                                {session.interviewId && (
                                                                    <span className="text-[10px] text-slate-500">
                                                                        Interview: {session.interviewId}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {debriefSummary && (
                                                                <div className="text-sm text-slate-200 mt-1 line-clamp-2">
                                                                    {String(debriefSummary)}
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] text-slate-500 mt-1">
                                                                Transcript items: {transcriptCount}
                                                            </div>
                                                            {session.meetingLink && (
                                                                <a
                                                                    className="text-xs text-sky-300 hover:text-sky-200 underline mt-1 inline-block"
                                                                    href={session.meetingLink}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    Open meeting link
                                                                </a>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedInterviewSessionId(session.sessionId)}
                                                                className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                                                            >
                                                                View Transcript / Debrief
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    <div className="text-xs text-slate-400">Hidden. Use "Show" to view interview sessions.</div>
                )}
            </div>

            {/* Pipeline Activity */}
            <div className="mt-6 pt-5 border-t border-slate-700">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h4 className="text-base font-semibold text-sky-300 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" /> Pipeline Activity
                    </h4>
                    {pipelineEvents.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowPipelineActivity((v) => !v)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                        >
                            {showPipelineActivity ? 'Hide' : `Show (${pipelineEvents.length})`}
                        </button>
                    )}
                </div>

                {pipelineEventsLoading ? (
                    <div className="text-xs text-slate-400">Loading pipeline activityâ€¦</div>
                ) : pipelineEvents.length === 0 ? (
                    <p className="text-gray-400 italic">No pipeline activity recorded for this candidate yet.</p>
                ) : showPipelineActivity ? (
                    <div className="space-y-2">
                        {pipelineEvents.slice(0, 20).map((evt) => (
                            <div
                                key={evt.id}
                                className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 bg-slate-900/40 border border-slate-700 rounded-lg p-3"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded border bg-slate-800 text-slate-200 border-slate-700">
                                            {evt.eventType}
                                        </span>
                                        <span className="text-xs text-slate-200 font-semibold truncate">
                                            {evt.jobTitle ?? evt.jobId}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {new Date(evt.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-200 mt-1">{evt.summary}</div>
                                    {(evt.fromStage || evt.toStage) && (
                                        <div className="text-[10px] text-slate-500 mt-1">
                                            {evt.fromStage ? `From: ${evt.fromStage}` : ''}
                                            {evt.fromStage && evt.toStage ? ' -> ' : ''}
                                            {evt.toStage ? `To: ${evt.toStage}` : ''}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-end">
                                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded border bg-slate-800 text-slate-200 border-slate-700">
                                        {evt.actorType}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-slate-400">Hidden. Use "Show" to view the activity trail.</div>
                )}
            </div>

            {/* Screening Detail Modal */}
            {selectedScreening && selectedScreeningDecision && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-700 bg-slate-800/60">
                            <div>
                                <div className="text-white font-semibold text-lg">{candidate.name}</div>
                                <div className="text-sm text-slate-400">{selectedScreening.jobTitle}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Screened: {new Date(selectedScreening.screenedAt).toLocaleString()}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedScreeningId(null)}
                                className="text-slate-300 hover:text-white"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
                            <div className="flex flex-wrap gap-2 items-center">
                                {selectedScreening.passed ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                        <BadgeCheck className="h-3.5 w-3.5" /> PASS
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-red-500/20 text-red-300 border-red-500/30">
                                        <BadgeX className="h-3.5 w-3.5" /> FAIL
                                    </span>
                                )}
                                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded border bg-slate-800 text-slate-200 border-slate-700">
                                    {selectedScreening.score}/100
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded border bg-purple-500/10 text-purple-200 border-purple-500/20">
                                    {selectedScreening.recommendation}
                                </span>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                <div className="text-sm text-white font-semibold mb-2">Decision Trail</div>
                                <div className="text-sm text-slate-200">
                                    Average question score: <span className="font-semibold">{selectedScreeningDecision.avgScore.toFixed(1)}</span> / 100
                                    {' | '}
                                    Pass threshold: <span className="font-semibold">{selectedScreeningDecision.threshold}</span>
                                    {' | '}
                                    Questions: <span className="font-semibold">{selectedScreeningDecision.questionCount}</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-2">
                                    Recommendation tiers: {selectedScreeningDecision.tiers.map((t) => `${t.label} (${t.rule})`).join(' | ')}
                                </div>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                <div className="text-sm text-white font-semibold mb-2">Summary</div>
                                <div className="text-sm text-slate-200">{selectedScreening.summary}</div>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                <div className="text-sm text-white font-semibold mb-2">Questions & Answers</div>
                                <div className="space-y-3">
                                    {(selectedScreening.questions || []).map((qa, idx) => (
                                        <div key={`${selectedScreening.id}_${idx}`} className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="text-sm text-white font-medium">{idx + 1}. {qa.question}</div>
                                                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded border bg-slate-800 text-slate-200 border-slate-700">
                                                    {qa.score}/100
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">{qa.answer}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Interview Session Modal */}
            {selectedInterviewSession && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-700 bg-slate-800/60">
                            <div>
                                <div className="text-white font-semibold text-lg">{candidate.name}</div>
                                <div className="text-sm text-slate-400">{selectedInterviewSession.jobTitle ?? selectedInterviewSession.jobId}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Started: {new Date(selectedInterviewSession.startedAt).toLocaleString()}
                                    {selectedInterviewSession.endedAt ? ` | Ended: ${new Date(selectedInterviewSession.endedAt).toLocaleString()}` : ''}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedInterviewSessionId(null)}
                                className="text-slate-300 hover:text-white"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
                            {selectedInterviewSession.meetingLink && (
                                <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                    <div className="text-sm text-white font-semibold mb-2">Meeting</div>
                                    <a
                                        className="text-sm text-sky-300 hover:text-sky-200 underline"
                                        href={selectedInterviewSession.meetingLink}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Open meeting link
                                    </a>
                                </div>
                            )}

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                <div className="text-sm text-white font-semibold mb-2">Debrief</div>
                                <pre className="text-xs text-slate-200 whitespace-pre-wrap break-words">
                                    {JSON.stringify(selectedInterviewSession.debrief ?? {}, null, 2)}
                                </pre>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="text-sm text-white font-semibold">Transcript (latest)</div>
                                    <div className="text-[10px] text-slate-500">
                                        {Array.isArray(selectedInterviewSession.transcript) ? selectedInterviewSession.transcript.length : 0} items
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {(Array.isArray(selectedInterviewSession.transcript) ? selectedInterviewSession.transcript.slice(-25) : []).map((t: unknown, idx: number) => {
                                        const entry = asRecord(t);
                                        return (
                                            <div key={`${selectedInterviewSession.sessionId}_${idx}`} className="text-xs text-slate-200">
                                                {entry?.timestamp ? (
                                                    <span className="text-[10px] text-slate-500 mr-2">
                                                        {new Date(String(entry.timestamp)).toLocaleTimeString()}
                                                    </span>
                                                ) : null}
                                                <span className="text-slate-400 mr-2">{entry?.speaker ? String(entry.speaker) : 'Speaker'}</span>
                                                <span className="whitespace-pre-wrap">{entry?.text ? String(entry.text) : JSON.stringify(t)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals - Simplified Conditional Rendering */}
            {activeModal === 'schedule' && selectedJobContext && (
                <ScheduleInterviewModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    candidate={candidate}
                    job={selectedJobContext}
                />
            )}

            {activeModal === 'autoTag' && (
                <AutoTagModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    candidate={candidate}
                    onApplyTags={(tags) => setCandidateTags(tags)}
                />
            )}

            {activeModal === 'refresh' && (
                <RefreshProfileModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    candidate={candidate}
                    onApplyChanges={(updates) => {
                        console.log('Profile updates:', updates);
                    }}
                />
            )}

            {activeModal === 'training' && selectedJobContext && (
                <TrainingRecommenderModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    candidate={candidate}
                    job={selectedJobContext}
                />
            )}

            {activeModal === 'notes' && selectedJobContext && (
                <InterviewNotesSummarizerModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    candidate={candidate}
                    job={selectedJobContext}
                />
            )}

            {activeModal === 'email' && selectedJobContext && (
                <EmailComposerModal
                    isOpen={true}
                    onClose={handleCloseModal}
                    candidate={candidate}
                    job={selectedJobContext}
                    scorecard={scorecardsByJobId[selectedJobContext.id]}
                    latestScreening={(screeningsByJob.get(selectedJobContext.id) || [])[0]}
                    latestShortlist={(shortlistArtifactsByJob.get(selectedJobContext.id) || [])[0]}
                    pipelineEvents={pipelineEvents}
                />
            )}
        </div>
    );
};

export default CandidateDetail;
