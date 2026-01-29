import React, { useCallback } from 'react';
import { Job, Candidate, InternalCandidate, PastCandidate, UploadedCandidate } from '../types';
import { jobPersistenceService } from '../services/JobPersistenceService';

interface UseJobOperationsProps {
    jobs: Job[];
    setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
    allCandidates: Candidate[];
    setInternalCandidates: React.Dispatch<React.SetStateAction<InternalCandidate[]>>;
    setPastCandidates: React.Dispatch<React.SetStateAction<PastCandidate[]>>;
    setUploadedCandidates: React.Dispatch<React.SetStateAction<UploadedCandidate[]>>;
    calculateInitialMatch: (job: Job, candidate: Candidate) => { score: number, rationale: string };
    setSelectedJobId: React.Dispatch<React.SetStateAction<string | null>>;
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
}

export const useJobOperations = ({
    jobs,
    setJobs,
    allCandidates,
    setInternalCandidates,
    setPastCandidates,
    setUploadedCandidates,
    calculateInitialMatch,
    setSelectedJobId,
    showToast
}: UseJobOperationsProps) => {

    const handleAddJob = useCallback(async (job: Job, onAutoAnalyze?: (candidates: Candidate[]) => void) => {
        const shouldPersist = jobPersistenceService.isAvailable();
        const persistedJob = shouldPersist ? await jobPersistenceService.upsertJob(job) : null;
        const effectiveJob = persistedJob ?? job;

        if (shouldPersist && !persistedJob) {
            showToast('Job saved locally, but failed to save to Supabase. Check connection or permissions.', 'warning', 7000);
        }

        // Score all existing candidates against the new job
        const scoreUpdater = (c: Candidate) => {
            const matchResult = calculateInitialMatch(effectiveJob, c);
            return {
                ...c,
                matchScores: { ...(c.matchScores || {}), [effectiveJob.id]: matchResult.score },
                matchRationales: { ...(c.matchRationales || {}), [effectiveJob.id]: matchResult.rationale }
            };
        };

        setInternalCandidates(prev => prev.map(scoreUpdater) as InternalCandidate[]);
        setPastCandidates(prev => prev.map(scoreUpdater) as PastCandidate[]);
        setUploadedCandidates(prev => prev.map(scoreUpdater) as UploadedCandidate[]);

        setJobs(prev => [effectiveJob, ...prev]);
        setSelectedJobId(effectiveJob.id);

        // Calculate match statistics for feedback
        const scoredCandidates = allCandidates.map(c => {
            const matchResult = calculateInitialMatch(effectiveJob, c);
            return { ...c, score: matchResult.score };
        });

        const strongMatches = scoredCandidates.filter(c => c.score >= 70).length;
        const goodMatches = scoredCandidates.filter(c => c.score >= 50 && c.score < 70).length;

        showToast(
            `Job "${effectiveJob.title}" added! Found ${strongMatches} strong match${strongMatches !== 1 ? 'es' : ''} (≥70%) and ${goodMatches} good match${goodMatches !== 1 ? 'es' : ''} (50-69%) from ${scoredCandidates.length} candidates.`,
            'success',
            8000
        );

        // Auto-analyze trigger
        if (scoredCandidates.length > 0 && onAutoAnalyze) {
            const topCandidates = scoredCandidates
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, 10);

            if (topCandidates.length > 0) {
                setTimeout(() => onAutoAnalyze(topCandidates), 1000);
            }
        }
    }, [allCandidates, calculateInitialMatch, setInternalCandidates, setPastCandidates, setUploadedCandidates, setJobs, setSelectedJobId, showToast]);

    const handleUpdateJobStatus = useCallback(async (jobId: string, newStatus: Job['status']) => {
        setJobs(prevJobs => prevJobs.map(job => job.id === jobId ? { ...job, status: newStatus } : job));

        if (!jobPersistenceService.isAvailable()) return;
        const existing = jobs.find((job) => job.id === jobId);
        if (!existing) return;

        const updated = { ...existing, status: newStatus };
        const saved = await jobPersistenceService.upsertJob(updated);
        if (!saved) {
            showToast('Failed to update job status in Supabase. Changes are local only.', 'warning', 7000);
        }
    }, [jobs, setJobs, showToast]);

    return {
        handleAddJob,
        handleUpdateJobStatus
    };
};
