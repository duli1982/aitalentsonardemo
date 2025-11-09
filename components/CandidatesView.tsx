import React from 'react';
import type { Candidate, Job, FitAnalysis } from '../types';
import CandidateList from './CandidateList';
import CandidateProfile from './CandidateProfile';

interface CandidatesViewProps {
  candidates: Candidate[];
  jobs: Job[];
  selectedCandidateId: string | null;
  onSelectCandidate: (id: string | null) => void;
  onInitiateAnalysis: (candidate: Candidate, job: Job) => Promise<FitAnalysis | null>;
  onUpdateCandidate: (candidateId: string, updatedData: Partial<Candidate>) => void;
}

const CandidatesView: React.FC<CandidatesViewProps> = ({ candidates, jobs, selectedCandidateId, onSelectCandidate, onInitiateAnalysis, onUpdateCandidate }) => {
  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId) || null;

  return (
    <>
      <div className="w-full md:w-1/3 flex flex-col min-h-0">
        <CandidateList
          candidates={candidates}
          selectedCandidateId={selectedCandidateId}
          onSelectCandidate={onSelectCandidate}
        />
      </div>
      <div className="w-full md:w-2/3 flex flex-col min-h-0">
        <CandidateProfile
          candidate={selectedCandidate}
          jobs={jobs}
          onInitiateAnalysis={onInitiateAnalysis}
          onUpdateCandidate={onUpdateCandidate}
        />
      </div>
    </>
  );
};

export default CandidatesView;