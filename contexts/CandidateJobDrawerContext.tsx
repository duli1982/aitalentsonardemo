import React, { createContext, useContext } from 'react';
import type { Candidate, Job } from '../types';

type CandidateJobDrawerContextValue = {
  openCandidateJobDrawer: (candidate: Candidate, job: Job) => void;
};

const CandidateJobDrawerContext = createContext<CandidateJobDrawerContextValue | null>(null);

type CandidateJobDrawerProviderProps = {
  openCandidateJobDrawer: (candidate: Candidate, job: Job) => void;
  children: React.ReactNode;
};

export const CandidateJobDrawerProvider: React.FC<CandidateJobDrawerProviderProps> = ({
  openCandidateJobDrawer,
  children
}) => {
  return (
    <CandidateJobDrawerContext.Provider value={{ openCandidateJobDrawer }}>
      {children}
    </CandidateJobDrawerContext.Provider>
  );
};

export function useCandidateJobDrawer(): CandidateJobDrawerContextValue | null {
  return useContext(CandidateJobDrawerContext);
}

