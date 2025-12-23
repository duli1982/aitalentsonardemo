import React, { createContext, useContext, ReactNode } from 'react';
import { useDataPersistence } from '../hooks/useDataPersistence';
import type { Job, InternalCandidate, PastCandidate, UploadedCandidate } from '../types';

interface DataContextType {
    jobs: Job[];
    setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
    internalCandidates: InternalCandidate[];
    setInternalCandidates: React.Dispatch<React.SetStateAction<InternalCandidate[]>>;
    pastCandidates: PastCandidate[];
    setPastCandidates: React.Dispatch<React.SetStateAction<PastCandidate[]>>;
    uploadedCandidates: UploadedCandidate[];
    setUploadedCandidates: React.Dispatch<React.SetStateAction<UploadedCandidate[]>>;
    selectedJobId: string | null;
    setSelectedJobId: React.Dispatch<React.SetStateAction<string | null>>;
    isInitialized: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const data = useDataPersistence();

    return (
        <DataContext.Provider value={data}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

