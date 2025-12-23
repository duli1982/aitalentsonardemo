import React, { useEffect, useMemo, useState } from 'react';
import { Phone, Play, Pause, Clock, CheckCircle, AlertCircle, Zap, BadgeCheck, BadgeX, Search, Users, Database, PencilLine, X } from 'lucide-react';
import type { Candidate, Job, PipelineStage } from '../types';
import { useData } from '../contexts/DataContext';
import { useAllSupabaseCandidates } from '../hooks/useAllSupabaseCandidates';
import { autonomousScreeningAgent, type ScreeningResult } from '../services/AutonomousScreeningAgent';
import { agentSettingsService } from '../services/AgentSettingsService';

interface AutonomousScreeningControlProps {
    jobs: Job[];
}

const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
};

const formatNextRun = (date: Date | null) => {
    if (!date) return 'Disabled';
    const now = Date.now();
    const next = new Date(date).getTime();
    const diff = next - now;
    if (diff < 0) return 'Running soon...';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
};

const AutonomousScreeningControl: React.FC<AutonomousScreeningControlProps> = ({ jobs }) => {
    const { internalCandidates, pastCandidates, uploadedCandidates } = useData();

    const [status, setStatus] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [jobId, setJobId] = useState<string>('');
    const [candidateSource, setCandidateSource] = useState<'pipeline' | 'supabase' | 'manual'>('pipeline');
    const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
    const [pipelineStageFilter, setPipelineStageFilter] = useState<PipelineStage | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [manualCandidateName, setManualCandidateName] = useState('');
    const [manualCandidateEmail, setManualCandidateEmail] = useState('');
    const [showAllResults, setShowAllResults] = useState(false);
    const [resultsSearch, setResultsSearch] = useState('');
    const [resultsOutcome, setResultsOutcome] = useState<'all' | 'pass' | 'fail'>('all');
    const [showAllResultCards, setShowAllResultCards] = useState(false);
    const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

    const selectedJob = useMemo(() => jobs.find((j) => j.id === jobId) || null, [jobs, jobId]);

    const allPipelineCandidates = useMemo<Candidate[]>(
        () => [...internalCandidates, ...pastCandidates, ...uploadedCandidates],
        [internalCandidates, pastCandidates, uploadedCandidates]
    );

    const pipelineCandidatesForJob = useMemo(() => {
        if (!jobId) return [];
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return allPipelineCandidates
            .filter((candidate) => {
                const matchScore = candidate.matchScores?.[jobId];
                if (!matchScore) return false;

                const rawStage = (candidate as any).pipelineStage?.[jobId] || 'new';
                const stage = (((rawStage === 'sourcing' || rawStage === 'contacted') ? 'new' : rawStage) as PipelineStage);
                if (pipelineStageFilter !== 'all' && stage !== pipelineStageFilter) return false;

                if (!normalizedQuery) return true;

                const haystack = [
                    candidate.name,
                    candidate.email || '',
                    ...(candidate.skills || [])
                ]
                    .join(' ')
                    .toLowerCase();

                return haystack.includes(normalizedQuery);
            })
            .sort((a, b) => (b.matchScores?.[jobId] || 0) - (a.matchScores?.[jobId] || 0));
    }, [allPipelineCandidates, jobId, pipelineStageFilter, searchQuery]);

    const {
        candidates: supabaseCandidates,
        isLoading: supabaseLoading,
        error: supabaseError,
        hasMore: supabaseHasMore,
        loadMore: loadMoreSupabase
    } = useAllSupabaseCandidates({ enabled: candidateSource === 'supabase', limit: 200 });

    const filteredSupabaseCandidates = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (!normalizedQuery) return supabaseCandidates;

        return supabaseCandidates.filter((candidate) => {
            const haystack = [
                candidate.name,
                candidate.email || '',
                ...(candidate.skills || [])
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [supabaseCandidates, searchQuery]);

    const selectedCandidate = useMemo(() => {
        if (candidateSource === 'pipeline') {
            return pipelineCandidatesForJob.find((c) => c.id === selectedCandidateId) || null;
        }
        if (candidateSource === 'supabase') {
            return filteredSupabaseCandidates.find((c) => c.id === selectedCandidateId) || null;
        }
        return null;
    }, [candidateSource, filteredSupabaseCandidates, pipelineCandidatesForJob, selectedCandidateId]);

    const selectedCandidateHasEmail = useMemo(() => {
        if (candidateSource === 'manual') return !!(manualCandidateEmail || '').trim();
        return !!(selectedCandidate?.email || '').trim();
    }, [candidateSource, manualCandidateEmail, selectedCandidate?.email]);

    const results = useMemo(() => {
        if (showAllResults || !jobId) return autonomousScreeningAgent.getResults();
        return autonomousScreeningAgent.getResultsForJob(jobId);
    }, [status, jobId, showAllResults]);

    const filteredResults = useMemo(() => {
        const normalizedQuery = resultsSearch.trim().toLowerCase();

        return [...results]
            .sort((a: any, b: any) => new Date(b.screenedAt).getTime() - new Date(a.screenedAt).getTime())
            .filter((r: any) => {
                if (resultsOutcome === 'pass' && !r.passed) return false;
                if (resultsOutcome === 'fail' && r.passed) return false;
                if (!normalizedQuery) return true;

                const haystack = [
                    r.candidateName,
                    r.jobTitle,
                    r.recommendation,
                    r.summary
                ]
                    .join(' ')
                    .toLowerCase();

                return haystack.includes(normalizedQuery);
            });
    }, [results, resultsOutcome, resultsSearch]);

    const visibleResults = useMemo(() => {
        if (showAllResultCards) return filteredResults;
        return filteredResults.slice(0, 10);
    }, [filteredResults, showAllResultCards]);

    const selectedResult = useMemo<ScreeningResult | null>(() => {
        if (!selectedResultId) return null;
        const r = autonomousScreeningAgent.getResultById(selectedResultId);
        return r || null;
    }, [selectedResultId, status]);

    const decisionDetails = useMemo(() => {
        if (!selectedResult) return null;
        const questionCount = selectedResult.questions?.length || 0;
        const total = (selectedResult.questions || []).reduce((sum, qa) => sum + (qa.score || 0), 0);
        const avg = questionCount > 0 ? total / questionCount : 0;
        const threshold = 65;

        return {
            questionCount,
            avgScore: avg,
            threshold,
            tiers: [
                { label: 'STRONG_PASS', rule: 'avg ≥ 85' },
                { label: 'PASS', rule: '65 ≤ avg < 85' },
                { label: 'BORDERLINE', rule: '50 ≤ avg < 65' },
                { label: 'FAIL', rule: 'avg < 50' }
            ]
        };
    }, [selectedResult]);

    useEffect(() => {
        const settings = agentSettingsService.getAgent('screening');
        autonomousScreeningAgent.initialize({ enabled: settings.enabled, mode: settings.mode });
        const refresh = () => setStatus(autonomousScreeningAgent.getStatus());
        refresh();
        const interval = setInterval(refresh, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!jobId && jobs.length > 0) setJobId(jobs[0].id);
    }, [jobId, jobs]);

    const handleToggle = () => {
        const newState = !status?.enabled;
        agentSettingsService.setEnabled('screening', newState);
        autonomousScreeningAgent.setEnabled(newState);
        setTimeout(() => setStatus(autonomousScreeningAgent.getStatus()), 100);
    };

    const handleManualRun = async () => {
        setIsRefreshing(true);
        try {
            await autonomousScreeningAgent.triggerScreening();
            setTimeout(() => setStatus(autonomousScreeningAgent.getStatus()), 250);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleQueue = () => {
        if (!selectedJob) return;

        const queueCandidate = (candidate: { id: string; name: string; email?: string }) => {
            const email = (candidate.email || '').trim();
            if (!email) return;

            autonomousScreeningAgent.requestScreening({
                candidateId: String(candidate.id),
                candidateName: candidate.name,
                candidateEmail: email,
                jobId: selectedJob.id,
                jobTitle: selectedJob.title,
                jobRequirements: selectedJob.requiredSkills || [],
                addedAt: new Date()
            });
        };

        if (candidateSource === 'manual') {
            if (!manualCandidateName.trim() || !manualCandidateEmail.trim()) return;
            queueCandidate({
                id: `manual_${Date.now()}`,
                name: manualCandidateName.trim(),
                email: manualCandidateEmail.trim()
            });
            setManualCandidateName('');
            setManualCandidateEmail('');
        } else if (candidateSource === 'pipeline') {
            const candidate = pipelineCandidatesForJob.find((c) => c.id === selectedCandidateId);
            if (!candidate) return;
            queueCandidate(candidate);
        } else {
            const candidate = filteredSupabaseCandidates.find((c) => c.id === selectedCandidateId);
            if (!candidate) return;
            queueCandidate(candidate);
        }

        setTimeout(() => setStatus(autonomousScreeningAgent.getStatus()), 50);
    };

    if (!status) return <div className="text-slate-400">Loading screening agent status...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${status.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                            <Phone className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Autonomous Screening Agent</h3>
                            <p className="text-sm text-slate-400">{status.enabled ? 'Running in background' : 'Paused'}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleToggle}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                            status.enabled ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                    >
                        {status.enabled ? (
                            <>
                                <Pause className="h-4 w-4" />
                                <span>Pause Agent</span>
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4" />
                                <span>Start Agent</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Last Run</span>
                        </div>
                        <p className="text-sm font-semibold text-white">{formatTime(status.lastRun)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Next Run</span>
                        </div>
                        <p className="text-sm font-semibold text-white">{formatNextRun(status.nextRun)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">Queue</span>
                        </div>
                        <p className="text-lg font-semibold text-white">{status.queueSize}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">Screened</span>
                        </div>
                        <p className="text-lg font-semibold text-white">{status.totalScreened}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <BadgeCheck className="h-4 w-4" />
                            <span className="text-sm">Pass Rate</span>
                        </div>
                        <p className="text-lg font-semibold text-white">{status.passRate}%</p>
                    </div>
                </div>

                <div className="mt-6 flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1 text-xs text-slate-400">
                        Screens candidates in the queue every 4 hours, generating Q&A, a score, and a recommendation. Results are posted to Pulse.
                    </div>
                    <button
                        onClick={handleManualRun}
                        disabled={isRefreshing}
                        className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60"
                    >
                        <Zap className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? 'Running…' : 'Run Now'}</span>
                    </button>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h4 className="text-lg font-semibold text-white mb-4">Queue Screening Request</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Job</label>
                        <select
                            value={jobId}
                            onChange={(e) => setJobId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                        >
                            {jobs.map((j) => (
                                <option key={j.id} value={j.id}>
                                    {j.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Candidate Source</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setCandidateSource('pipeline');
                                    setSelectedCandidateId('');
                                }}
                                className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${
                                    candidateSource === 'pipeline'
                                        ? 'bg-slate-700 text-white border-slate-600'
                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                            >
                                <Users className="h-4 w-4" />
                                Pipeline
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCandidateSource('supabase');
                                    setSelectedCandidateId('');
                                }}
                                className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${
                                    candidateSource === 'supabase'
                                        ? 'bg-slate-700 text-white border-slate-600'
                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                            >
                                <Database className="h-4 w-4" />
                                Supabase
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCandidateSource('manual');
                                    setSelectedCandidateId('');
                                }}
                                className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${
                                    candidateSource === 'manual'
                                        ? 'bg-slate-700 text-white border-slate-600'
                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                            >
                                <PencilLine className="h-4 w-4" />
                                Manual
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Search</label>
                        <div className="relative">
                            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm"
                                placeholder="Search by name, email, skill..."
                            />
                        </div>
                    </div>
                </div>

                {candidateSource === 'pipeline' && (
                    <div className="mt-4 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-end gap-3">
                            <div className="md:w-56">
                                <label className="block text-xs text-slate-400 mb-1">Pipeline Stage</label>
                                <select
                                    value={pipelineStageFilter}
                                    onChange={(e) => setPipelineStageFilter(e.target.value as any)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="all">All stages</option>
                                    <option value="sourced">Sourced</option>
                                    <option value="new">New</option>
                                    <option value="long_list">Long List</option>
                                    <option value="screening">Screening</option>
                                    <option value="scheduling">Interview Scheduling</option>
                                    <option value="interview">Interview</option>
                                    <option value="offer">Offer</option>
                                    <option value="hired">Hired</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div className="text-xs text-slate-500">
                                {jobId ? `${pipelineCandidatesForJob.length} candidates for this job` : 'Select a job to see pipeline candidates'}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg max-h-56 overflow-auto">
                            {pipelineCandidatesForJob.length === 0 ? (
                                <div className="p-4 text-sm text-slate-400">No pipeline candidates found for this job.</div>
                            ) : (
                                <div className="divide-y divide-slate-800">
                                    {pipelineCandidatesForJob.slice(0, 50).map((candidate) => {
                                        const rawStage = (candidate as any).pipelineStage?.[jobId] || 'new';
                                        const stage = (((rawStage === 'sourcing' || rawStage === 'contacted') ? 'new' : rawStage) as PipelineStage);
                                        const score = candidate.matchScores?.[jobId] || 0;
                                        const email = candidate.email || '';
                                        const selected = selectedCandidateId === candidate.id;

                                        return (
                                            <button
                                                key={candidate.id}
                                                type="button"
                                                onClick={() => setSelectedCandidateId(candidate.id)}
                                                className={`w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors ${
                                                    selected ? 'bg-slate-800/80' : ''
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm text-white font-medium">{candidate.name}</div>
                                                        <div className="text-xs text-slate-400">{email || 'No email on file'}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            Stage: <span className="text-slate-300">{stage}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-400">Match</div>
                                                        <div className={`text-sm font-semibold ${score >= 70 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                                            {score}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {pipelineCandidatesForJob.length > 50 && (
                            <div className="text-xs text-slate-500">Showing top 50 by match score.</div>
                        )}
                    </div>
                )}

                {candidateSource === 'supabase' && (
                    <div className="mt-4 space-y-3">
                        {supabaseError && (
                            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                Failed to load Supabase candidates: {supabaseError.message}
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-500">
                                {supabaseLoading ? 'Loading...' : `${filteredSupabaseCandidates.length} candidates loaded`}
                            </div>
                            {supabaseHasMore && (
                                <button
                                    type="button"
                                    onClick={loadMoreSupabase}
                                    className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                                >
                                    Load more
                                </button>
                            )}
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg max-h-56 overflow-auto">
                            {filteredSupabaseCandidates.length === 0 ? (
                                <div className="p-4 text-sm text-slate-400">No Supabase candidates match your search.</div>
                            ) : (
                                <div className="divide-y divide-slate-800">
                                    {filteredSupabaseCandidates.slice(0, 50).map((candidate) => {
                                        const email = candidate.email || '';
                                        const selected = selectedCandidateId === candidate.id;

                                        return (
                                            <button
                                                key={candidate.id}
                                                type="button"
                                                onClick={() => setSelectedCandidateId(candidate.id)}
                                                className={`w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors ${
                                                    selected ? 'bg-slate-800/80' : ''
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm text-white font-medium">{candidate.name}</div>
                                                        <div className="text-xs text-slate-400">{email || 'No email on file'}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            Skills: {(candidate.skills || []).slice(0, 5).join(', ') || '—'}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-slate-500">{candidate.id}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {filteredSupabaseCandidates.length > 50 && (
                            <div className="text-xs text-slate-500">Showing first 50 of loaded candidates.</div>
                        )}
                    </div>
                )}

                {candidateSource === 'manual' && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Candidate Name</label>
                            <input
                                value={manualCandidateName}
                                onChange={(e) => setManualCandidateName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                                placeholder="Jane Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Candidate Email</label>
                            <input
                                value={manualCandidateEmail}
                                onChange={(e) => setManualCandidateEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                                placeholder="jane@example.com"
                            />
                        </div>
                    </div>
                )}

                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-400 select-none">
                        <input
                            type="checkbox"
                            checked={showAllResults}
                            onChange={(e) => setShowAllResults(e.target.checked)}
                            className="accent-emerald-500"
                        />
                        Show results across all jobs
                    </label>

                    {!selectedCandidateHasEmail && candidateSource !== 'manual' && selectedCandidateId && (
                        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                            Selected candidate has no email. Add an email to queue screening.
                        </div>
                    )}

                    <button
                        onClick={handleQueue}
                        disabled={
                            !selectedJob ||
                            (candidateSource === 'manual' && (!manualCandidateName.trim() || !manualCandidateEmail.trim())) ||
                            (candidateSource !== 'manual' && (!selectedCandidateId || !selectedCandidateHasEmail))
                        }
                        className="px-4 py-2 rounded-lg font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                    >
                        Add to Queue
                    </button>
                </div>
            </div>

            {results.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <h4 className="text-lg font-semibold text-white flex items-center">
                            <CheckCircle className="h-5 w-5 mr-2 text-emerald-400" />
                            Screening Results
                        </h4>
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="relative">
                                <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    value={resultsSearch}
                                    onChange={(e) => setResultsSearch(e.target.value)}
                                    className="w-full sm:w-64 bg-slate-900 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm"
                                    placeholder="Search results..."
                                />
                            </div>
                            <select
                                value={resultsOutcome}
                                onChange={(e) => setResultsOutcome(e.target.value as any)}
                                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="all">All</option>
                                <option value="pass">Pass</option>
                                <option value="fail">Fail</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowAllResultCards((v) => !v)}
                                className="px-3 py-2 rounded-lg text-sm border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                            >
                                {showAllResultCards ? 'Show top 10' : `Show all (${filteredResults.length})`}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {visibleResults.map((r: any) => (
                            <div key={r.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="font-semibold text-white">{r.candidateName}</div>
                                            {r.passed ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                                    <BadgeCheck className="h-3.5 w-3.5" /> PASS
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-red-500/20 text-red-300 border-red-500/30">
                                                    <BadgeX className="h-3.5 w-3.5" /> FAIL
                                                </span>
                                            )}
                                            <span className="inline-flex items-center px-2 py-0.5 text-xs rounded border bg-slate-800 text-slate-200 border-slate-700">
                                                {r.score}/100
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 text-xs rounded border bg-purple-500/10 text-purple-200 border-purple-500/20">
                                                {r.recommendation}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-400">{r.jobTitle}</div>
                                        <div className="text-sm text-slate-300 mt-2">{r.summary}</div>
                                        <div className="text-xs text-slate-500 mt-2">
                                            Screened: {new Date(r.screenedAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end md:justify-start">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedResultId(r.id)}
                                            className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                                        >
                                            View Q&A / Decision Trail
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {!showAllResultCards && filteredResults.length > 10 && (
                        <button
                            type="button"
                            onClick={() => setShowAllResultCards(true)}
                            className="text-xs text-slate-300 mt-3 underline underline-offset-2 hover:text-white"
                        >
                            + {filteredResults.length - 10} more (show all)
                        </button>
                    )}
                </div>
            )}

            {selectedResult && decisionDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-700 bg-slate-800/60">
                            <div>
                                <div className="text-white font-semibold text-lg">{selectedResult.candidateName}</div>
                                <div className="text-sm text-slate-400">{selectedResult.jobTitle}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Screened: {new Date(selectedResult.screenedAt).toLocaleString()}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedResultId(null)}
                                className="text-slate-300 hover:text-white"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
                            <div className="flex flex-wrap gap-2 items-center">
                                {selectedResult.passed ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                        <BadgeCheck className="h-3.5 w-3.5" /> PASS
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-red-500/20 text-red-300 border-red-500/30">
                                        <BadgeX className="h-3.5 w-3.5" /> FAIL
                                    </span>
                                )}
                                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded border bg-slate-800 text-slate-200 border-slate-700">
                                    {selectedResult.score}/100
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded border bg-purple-500/10 text-purple-200 border-purple-500/20">
                                    {selectedResult.recommendation}
                                </span>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                <div className="text-sm text-white font-semibold mb-2">Decision Trail</div>
                                <div className="text-sm text-slate-200">
                                    Average question score: <span className="font-semibold">{decisionDetails.avgScore.toFixed(1)}</span> / 100
                                    {' · '}
                                    Pass threshold: <span className="font-semibold">{decisionDetails.threshold}</span>
                                    {' · '}
                                    Questions: <span className="font-semibold">{decisionDetails.questionCount}</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-2">
                                    Recommendation tiers: {decisionDetails.tiers.map((t) => `${t.label} (${t.rule})`).join(' · ')}
                                </div>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                <div className="text-sm text-white font-semibold mb-2">Summary</div>
                                <div className="text-sm text-slate-200">{selectedResult.summary}</div>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                <div className="text-sm text-white font-semibold mb-2">Questions & Answers</div>
                                <div className="space-y-3">
                                    {(selectedResult.questions || []).map((qa, idx) => (
                                        <div key={`${selectedResult.id}_${idx}`} className="border border-slate-700 rounded-lg p-3 bg-slate-900/40">
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
        </div>
    );
};

export default AutonomousScreeningControl;
