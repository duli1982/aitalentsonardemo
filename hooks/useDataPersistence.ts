import { useState, useEffect } from 'react';
import type { Job, InternalCandidate, PastCandidate, UploadedCandidate } from '../types';
import { ALL_JOBS } from '../data/jobs';
import { ALL_CANDIDATES } from '../data/candidates';
import { detectHiddenGem } from '../utils/candidateUtils';

export const useDataPersistence = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [internalCandidates, setInternalCandidates] = useState<InternalCandidate[]>([]);
    const [pastCandidates, setPastCandidates] = useState<PastCandidate[]>([]);
    const [uploadedCandidates, setUploadedCandidates] = useState<UploadedCandidate[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        try {
            const savedJobs = localStorage.getItem('talentSonar-jobs');
            const savedInternal = localStorage.getItem('talentSonar-internalCandidates');
            const savedPast = localStorage.getItem('talentSonar-pastCandidates');
            const savedUploaded = localStorage.getItem('talentSonar-uploadedCandidates');

            if (savedJobs && savedInternal && savedPast && savedUploaded) {
                setJobs(JSON.parse(savedJobs));
                setInternalCandidates(JSON.parse(savedInternal));
                setPastCandidates(JSON.parse(savedPast));
                setUploadedCandidates(JSON.parse(savedUploaded));
                const savedSelectedJobId = localStorage.getItem('talentSonar-selectedJobId');
                if (savedSelectedJobId) setSelectedJobId(JSON.parse(savedSelectedJobId));
            } else {
                // Initialize with mock data if no local storage exists
                setJobs(ALL_JOBS);

                // Apply Hidden Gem detection to initial candidates
                const processedCandidates = ALL_CANDIDATES.map(c => ({
                    ...c,
                    isHiddenGem: detectHiddenGem(c)
                }));

                setInternalCandidates(processedCandidates.filter(c => c.type === 'internal') as InternalCandidate[]);
                setPastCandidates(processedCandidates.filter(c => c.type === 'past') as PastCandidate[]);
                setUploadedCandidates(processedCandidates.filter(c => c.type === 'uploaded') as UploadedCandidate[]);
                setSelectedJobId(null);
            }
        } catch (e) {
            console.error("Failed to load data. Starting with empty state.", e);
            setJobs([]);
            setInternalCandidates([]);
            setPastCandidates([]);
            setUploadedCandidates([]);
            setSelectedJobId(null);
        } finally {
            setIsInitialized(true);
        }
    }, []);

    useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-jobs', JSON.stringify(jobs)); }, [jobs, isInitialized]);
    useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-internalCandidates', JSON.stringify(internalCandidates)); }, [internalCandidates, isInitialized]);
    useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-pastCandidates', JSON.stringify(pastCandidates)); }, [pastCandidates, isInitialized]);
    useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-uploadedCandidates', JSON.stringify(uploadedCandidates)); }, [uploadedCandidates, isInitialized]);
    useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-selectedJobId', JSON.stringify(selectedJobId)); }, [selectedJobId, isInitialized]);

    return {
        jobs, setJobs,
        internalCandidates, setInternalCandidates,
        pastCandidates, setPastCandidates,
        uploadedCandidates, setUploadedCandidates,
        selectedJobId, setSelectedJobId,
        isInitialized
    };
};
