import { useState, useCallback } from 'react';
import type { Job, Candidate, AnalysisResult, FitAnalysis } from '../types';
import * as geminiService from '../services/geminiService';
import { evidencePackService } from '../services/EvidencePackService';
import { outreachDraftService } from '../services/OutreachDraftService';
import { jobContextPackService } from '../services/JobContextPackService';

interface UseAnalysisProps {
    selectedJob: Job | undefined;
    onUpdateCandidate: (candidateId: string, updatedData: Partial<Candidate>) => void;
    onUpdateCandidateStage: (candidateId: string, jobId: string, newStage: any) => void;
}

export const useAnalysis = ({ selectedJob, onUpdateCandidate, onUpdateCandidateStage }: UseAnalysisProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingCandidateId, setLoadingCandidateId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
    const [batchAnalysisProgress, setBatchAnalysisProgress] = useState({ current: 0, total: 0 });
    const [analysisState, setAnalysisState] = useState<{ type: string; candidate?: Candidate; result: any }>({ type: '', result: null });
    const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);

    const runFitAnalysis = useCallback(async (candidate: Candidate, job: Job): Promise<FitAnalysis | null> => {
        try {
            const result = await geminiService.analyzeFit(job, candidate);
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
    }, [onUpdateCandidate]);

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
            let result: AnalysisResult | null = null;
            switch (type) {
                case 'JOB_SUMMARY': result = await geminiService.analyzeJob(selectedJob); break;
                case 'FIT_ANALYSIS': if (candidate) result = await runFitAnalysis(candidate, selectedJob); break;
                case 'HIDDEN_GEM_ANALYSIS': if (candidate) result = await geminiService.analyzeHiddenGem(selectedJob, candidate); break;
                case 'OUTREACH':
                    if (candidate) {
                        // Prefer evidence-pack grounded drafts (fallbacks are deterministic).
                        const contextPack = await jobContextPackService.get(selectedJob.id);
                        const evidencePack = await evidencePackService.build({ job: selectedJob, candidate, contextPack });
                        const draft = await outreachDraftService.build({ job: selectedJob, candidate, evidencePack, contextPack });
                        result = draft.body;
                    }
                    break;
                case 'INTERVIEW_GUIDE':
                    if (candidate) {
                        // Ensure we have fit analysis data first
                        let fitAnalysis = candidate.matchScores?.[selectedJob.id] ? {
                            matchScore: candidate.matchScores[selectedJob.id],
                            gaps: [], // We might need to fetch full analysis if not stored
                            strengths: []
                        } as any : null;

                        // If we don't have full analysis data stored, we might need to re-run or fetch it.
                        // For now, let's assume we run a quick fit analysis if missing, or use what we have.
                        // Ideally, we should store the full FitAnalysis object in the candidate data.
                        // Since we only store score and rationale, let's re-run fit analysis if needed or just use the service.
                        // Actually, geminiService.generateInterviewGuide takes a FitAnalysis object.
                        // Let's run fit analysis first if we don't have it, or just pass the candidate and let the service handle it?
                        // The service expects FitAnalysis.

                        // Strategy: Run analyzeFit first to get fresh data for the guide.
                        fitAnalysis = await geminiService.analyzeFit(selectedJob, candidate);
                        result = await geminiService.generateInterviewGuide(selectedJob, candidate, fitAnalysis);
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
    }, [selectedJob, runFitAnalysis, onUpdateCandidateStage]);

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
                await new Promise(resolve => setTimeout(resolve, 500));
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
        setTimeout(() => setSuccessMessage(null), 8000);

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
