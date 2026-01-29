import { useState, useEffect } from 'react';
import type { Job, InternalCandidate, PastCandidate, UploadedCandidate } from '../types';
import { ALL_JOBS } from '../data/jobs';
import { ALL_CANDIDATES } from '../data/candidates';
import { detectHiddenGem } from '../utils/candidateUtils';
import { jobPersistenceService } from '../services/JobPersistenceService';

export const useDataPersistence = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [internalCandidates, setInternalCandidates] = useState<InternalCandidate[]>([]);
    const [pastCandidates, setPastCandidates] = useState<PastCandidate[]>([]);
    const [uploadedCandidates, setUploadedCandidates] = useState<UploadedCandidate[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // 1. Try Supabase first
                let finalJobs: Job[] = [];
                if (jobPersistenceService.isAvailable()) {
                    const sbJobs = await jobPersistenceService.getAll();
                    if (sbJobs.length > 0) {
                        finalJobs = sbJobs;
                    }
                }

                // 2. Try localStorage if no Supabase jobs found
                const savedJobsRaw = localStorage.getItem('talentSonar-jobs');
                if (finalJobs.length === 0 && savedJobsRaw) {
                    finalJobs = JSON.parse(savedJobsRaw);
                }

                // 3. Fallback to mock data if still empty
                if (finalJobs.length === 0) {
                    finalJobs = ALL_JOBS;
                }

                setJobs(finalJobs);

                // Candidates still use LocalStorage primarily for now, or until fully migrated
                const savedInternal = localStorage.getItem('talentSonar-internalCandidates');
                const savedPast = localStorage.getItem('talentSonar-pastCandidates');
                const savedUploaded = localStorage.getItem('talentSonar-uploadedCandidates');

                if (savedInternal && savedPast && savedUploaded) {
                    setInternalCandidates(JSON.parse(savedInternal));
                    setPastCandidates(JSON.parse(savedPast));
                    setUploadedCandidates(JSON.parse(savedUploaded));
                } else {
                    const processedCandidates = ALL_CANDIDATES.map(c => ({
                        ...c,
                        isHiddenGem: detectHiddenGem(c)
                    }));
                    setInternalCandidates(processedCandidates.filter(c => c.type === 'internal') as InternalCandidate[]);
                    setPastCandidates(processedCandidates.filter(c => c.type === 'past') as PastCandidate[]);
                    setUploadedCandidates(processedCandidates.filter(c => c.type === 'uploaded') as UploadedCandidate[]);
                }

                const savedSelectedJobId = localStorage.getItem('talentSonar-selectedJobId');
                if (savedSelectedJobId) {
                    const parsedSelectedJobId = JSON.parse(savedSelectedJobId);
                    const exists = finalJobs.some((job) => job.id === parsedSelectedJobId);
                    setSelectedJobId(exists ? parsedSelectedJobId : null);
                } else {
                    setSelectedJobId(null);
                }

            } catch (e) {
                console.error("Failed to load data.", e);
            } finally {
                setIsInitialized(true);
            }
        };

        init();
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
