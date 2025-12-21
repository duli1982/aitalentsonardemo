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

// Mock data for candidates with demographics (added based on instruction)
// Note: This mock data is placed here as it was provided in the instruction,
// but typically mock data would reside in a separate mock file or be part of a testing setup.
const mockCandidatesWithDemographics = [
    {
        id: 'c3',
        name: 'Michael Chen',
        role: 'Senior Process Engineer',
        skills: ['Upstream Processing', 'GMP', 'Leadership', 'Cross-functional Collaboration'],
        experience: 8,
        location: 'Boston, USA',
        availability: '2 months',
        demographics: { gender: 'Male', educationType: 'Elite', university: 'MIT' }
    },
    {
        id: 'c4',
        name: 'Sarah Jansen',
        role: 'Quality Assurance Specialist',
        skills: ['GMP', 'SOP Writing', 'Audit Preparation'],
        experience: 5,
        location: 'Berlin, Germany',
        availability: 'Immediate',
        demographics: { gender: 'Female', educationType: 'Traditional', university: 'TU Berlin' }
    },
    {
        id: 'c5',
        name: 'David Muller',
        role: 'Biotech Technician',
        skills: ['Bioreactor Operation', 'Filtration', 'GMP'],
        experience: 3,
        location: 'Darmstadt, Germany',
        availability: '1 month',
        demographics: { gender: 'Female', educationType: 'Bootcamp', university: 'General Assembly' }
    }
];

