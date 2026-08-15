import React, { useCallback } from 'react';
import { Job, Candidate, InternalCandidate, PastCandidate, UploadedCandidate } from '../types';
import { jobPersistenceService } from '../services/JobPersistenceService';
import { TIMING } from '../config/timing';
import { useAuth } from '../contexts/AuthContext';
import { careerSiteService } from '../services/CareerSiteService';

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
    const { activeOrganization } = useAuth();
    const organizationId = activeOrganization?.organizationId;

    const handleAddJob = useCallback(async (job: Job, onAutoAnalyze?: (candidates: Candidate[]) => void) => {
        const shouldPersist = jobPersistenceService.isAvailable() && Boolean(organizationId);
        const persistedJob = shouldPersist ? await jobPersistenceService.upsertJob(job, organizationId!) : null;
        const effectiveJob = persistedJob ?? job;

        if (shouldPersist && !persistedJob) {
            showToast('Job could not be saved in this browser.', 'warning', 7000);
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
                setTimeout(() => onAutoAnalyze(topCandidates), TIMING.JOB_AUTO_ANALYZE_TRIGGER_DELAY_MS);
            }
        }
    }, [allCandidates, calculateInitialMatch, setInternalCandidates, setPastCandidates, setUploadedCandidates, setJobs, setSelectedJobId, showToast, organizationId]);

    const handleUpdateJobStatus = useCallback(async (jobId: string, newStatus: Job['status']) => {
        setJobs(prevJobs => prevJobs.map(job => job.id === jobId ? { ...job, status: newStatus } : job));

        if (!jobPersistenceService.isAvailable() || !organizationId) return;
        const existing = jobs.find((job) => job.id === jobId);
        if (!existing) return;

        const updated = { ...existing, status: newStatus };
        const saved = await jobPersistenceService.upsertJob(updated, organizationId);
        if (!saved) {
            showToast('The job status changed for this session but could not be persisted.', 'warning', 7000);
        }
        if (newStatus !== 'open') {
            try { await careerSiteService.unpublish(organizationId, jobId, 'closed'); }
            catch { /* The requisition may never have been published. */ }
        }
    }, [jobs, setJobs, showToast, organizationId]);

    return {
        handleAddJob,
        handleUpdateJobStatus
    };
};
