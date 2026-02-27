import { useState, useCallback } from 'react';
import type { Job, Candidate, FitAnalysis, PipelineStage } from '../types';
import * as geminiService from '../services/geminiService';
import { evidencePackService } from '../services/EvidencePackService';
import { outreachDraftService } from '../services/OutreachDraftService';
import { jobContextPackService } from '../services/JobContextPackService';
import type { Result } from '../types/result';
import { toCandidateSnapshot, toJobSnapshot } from '../utils/snapshots';
import { TIMING } from '../config/timing';

interface UseAnalysisProps {
    selectedJob: Job | undefined;
    onUpdateCandidate: (candidateId: string, updatedData: Partial<Candidate>) => void;
    onUpdateCandidateStage: (candidateId: string, jobId: string, newStage: PipelineStage) => void;
}

export const useAnalysis = ({ selectedJob, onUpdateCandidate, onUpdateCandidateStage }: UseAnalysisProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingCandidateId, setLoadingCandidateId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
    const [batchAnalysisProgress, setBatchAnalysisProgress] = useState({ current: 0, total: 0 });
    const [analysisState, setAnalysisState] = useState<{ type: string; candidate?: Candidate; result: unknown }>({ type: '', result: null });
    const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);

    const requireSuccess = useCallback(<T,>(result: Result<T>): T => {
        if (!result.success && 'error' in result) {
            throw new Error(result.error.message);
        }
        return result.data;
    }, []);

    const runFitAnalysis = useCallback(async (candidate: Candidate, job: Job): Promise<FitAnalysis | null> => {
        try {
            const result = requireSuccess(await geminiService.analyzeFitResult(job, candidate));
            const { matchScore, matchRationale } = result;
            onUpdateCandidate(candidate.id, {
                matchScores: { ...(candidate.matchScores || {}), [job.id]: matchScore },
                matchRationales: { ...(candidate.matchRationales || {}), [job.id]: matchRationale }
            });
            return result;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred during fit analysis.');
            return null;
        }
    }, [onUpdateCandidate, requireSuccess]);

    const handleInitiateAnalysis = useCallback(async (type: string, target: Job | Candidate) => {
        if (!selectedJob) return;
        const isJob = 'department' in target;
        const candidate = isJob ? undefined : target as Candidate;

        setAnalysisState({ type, candidate, result: null });
        setAnalysisModalOpen(true);
        setIsLoading(true);
        if (candidate) setLoadingCandidateId(candidate.id);
        setError(null);

        try {
            let result: unknown = null;
            switch (type) {
                case 'JOB_SUMMARY': result = requireSuccess(await geminiService.analyzeJobResult(selectedJob)); break;
                case 'FIT_ANALYSIS': if (candidate) result = await runFitAnalysis(candidate, selectedJob); break;
                case 'HIDDEN_GEM_ANALYSIS': if (candidate) result = requireSuccess(await geminiService.analyzeHiddenGemResult(selectedJob, candidate)); break;
                case 'OUTREACH':
                    if (candidate) {
                        // Prefer evidence-pack grounded drafts (fallbacks are deterministic).
                        const contextPack = await jobContextPackService.get(selectedJob.id);
                        const jobSnapshot = toJobSnapshot(selectedJob);
                        const candidateSnapshot = toCandidateSnapshot(candidate);
                        const evidencePack = await evidencePackService.build({ job: jobSnapshot, candidate: candidateSnapshot, contextPack });
                        const draft = await outreachDraftService.build({ job: jobSnapshot, candidate: candidateSnapshot, evidencePack, contextPack });
                        result = draft.body;
                    }
                    break;
                case 'INTERVIEW_GUIDE':
                    if (candidate) {
                        // Interview guide generation requires a complete fit analysis payload.
                        const fitAnalysis = requireSuccess(await geminiService.analyzeFitResult(selectedJob, candidate));
                        result = requireSuccess(await geminiService.generateInterviewGuideResult(selectedJob, candidate, fitAnalysis));
                    }
                    break;
            }
            setAnalysisState(prev => ({ ...prev, result }));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            setAnalysisModalOpen(false);
        } finally {
            setIsLoading(false);
            setLoadingCandidateId(null);
        }
    }, [selectedJob, runFitAnalysis, onUpdateCandidateStage, requireSuccess]);

    const handleBatchAnalysis = useCallback(async (candidates: Candidate[]) => {
        if (!selectedJob) return;

        setIsBatchAnalyzing(true);
        setBatchAnalysisProgress({ current: 0, total: candidates.length });
        setError(null);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            setBatchAnalysisProgress({ current: i + 1, total: candidates.length });

            try {
                await runFitAnalysis(candidate, selectedJob);
                successCount++;
                await new Promise(resolve => setTimeout(resolve, TIMING.ANALYSIS_PROGRESS_STEP_DELAY_MS));
            } catch (e) {
                console.error(`Failed to analyze candidate ${candidate.name}:`, e);
                failCount++;
            }
        }

        setIsBatchAnalyzing(false);
        setBatchAnalysisProgress({ current: 0, total: 0 });

        const message = failCount === 0
            ? `Successfully analyzed ${successCount} top candidates! Check individual profiles for detailed insights.`
            : `Analyzed ${successCount} candidates successfully. ${failCount} analysis failed.`;

        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(null), TIMING.ANALYSIS_SUCCESS_MESSAGE_MS);

        console.log(`🎯 Batch Analysis Complete: ${successCount} successful, ${failCount} failed`);
    }, [selectedJob, runFitAnalysis]);

    return {
        isLoading,
        loadingCandidateId,
        error, setError,
        successMessage, setSuccessMessage,
        isBatchAnalyzing,
        batchAnalysisProgress,
        analysisState, setAnalysisState,
        isAnalysisModalOpen, setAnalysisModalOpen,
        runFitAnalysis,
        handleInitiateAnalysis,
        handleBatchAnalysis
    };
};
