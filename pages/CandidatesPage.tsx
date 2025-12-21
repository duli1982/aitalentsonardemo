import React from 'react';
import CandidatesView from '../components/CandidatesView';
import { Candidate, PipelineStage } from '../types';

interface CandidatesPageProps {
    selectedCandidateId: string | null;
    setSelectedCandidateId: (id: string | null) => void;
    runFitAnalysis: (type: any, candidate: Candidate) => void;
    handleUpdateCandidate: (id: string, data: Partial<Candidate>) => void;
    handleAddCandidateToPipeline: (candidate: Candidate, jobId: string, initialStage?: PipelineStage) => void;
    handleUpdateCandidateStage: (candidateId: string, jobId: string, newStage: PipelineStage) => void;
}

const CandidatesPage: React.FC<CandidatesPageProps> = ({
    selectedCandidateId,
    setSelectedCandidateId,
    runFitAnalysis,
    handleUpdateCandidate,
    handleAddCandidateToPipeline,
    handleUpdateCandidateStage
}) => {
    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-140px)]">
            <CandidatesView
                selectedCandidateId={selectedCandidateId}
                onSelectCandidate={setSelectedCandidateId}
                onInitiateAnalysis={runFitAnalysis}
                onUpdateCandidate={handleUpdateCandidate}
                onAddCandidateToPipeline={handleAddCandidateToPipeline}
                onUpdateCandidateStage={handleUpdateCandidateStage}
            />
        </div>
    );
};

export default CandidatesPage;
