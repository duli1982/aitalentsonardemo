import { useEffect, useMemo, useState } from 'react';
import type { InternalCandidate, Job, PastCandidate, UploadedCandidate } from '../types';
import { ALL_JOBS } from '../data/jobs';
import { ALL_CANDIDATES } from '../data/candidates';
import { detectHiddenGem } from '../utils/candidateUtils';

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

export const useDataPersistence = ({ organizationId }: { organizationId: string | null; isDemoMode: boolean; canManageData: boolean }) => {
  const keyPrefix = useMemo(() => organizationId ? `talentSonar:${organizationId}` : 'talentSonar:local', [organizationId]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [internalCandidates, setInternalCandidates] = useState<InternalCandidate[]>([]);
  const [pastCandidates, setPastCandidates] = useState<PastCandidate[]>([]);
  const [uploadedCandidates, setUploadedCandidates] = useState<UploadedCandidate[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(false);
    const legacyPrefix = 'talentSonar';
    const savedJobs = read<Job[]>(`${keyPrefix}-jobs`, read<Job[]>(`${legacyPrefix}-jobs`, ALL_JOBS));
    const defaults = ALL_CANDIDATES.map((candidate) => ({ ...candidate, isHiddenGem: detectHiddenGem(candidate) }));
    const internal = read<InternalCandidate[]>(`${keyPrefix}-internalCandidates`, read<InternalCandidate[]>(`${legacyPrefix}-internalCandidates`, defaults.filter((candidate) => candidate.type === 'internal') as InternalCandidate[]));
    const past = read<PastCandidate[]>(`${keyPrefix}-pastCandidates`, read<PastCandidate[]>(`${legacyPrefix}-pastCandidates`, defaults.filter((candidate) => candidate.type === 'past') as PastCandidate[]));
    const uploaded = read<UploadedCandidate[]>(`${keyPrefix}-uploadedCandidates`, read<UploadedCandidate[]>(`${legacyPrefix}-uploadedCandidates`, defaults.filter((candidate) => candidate.type === 'uploaded') as UploadedCandidate[]));
    const selected = read<string | null>(`${keyPrefix}-selectedJobId`, null);
    setJobs(savedJobs);
    setInternalCandidates(internal);
    setPastCandidates(past);
    setUploadedCandidates(uploaded);
    setSelectedJobId(savedJobs.some((job) => job.id === selected) ? selected : null);
    setIsInitialized(true);
  }, [keyPrefix]);

  useEffect(() => { if (isInitialized) localStorage.setItem(`${keyPrefix}-jobs`, JSON.stringify(jobs)); }, [isInitialized, jobs, keyPrefix]);
  useEffect(() => { if (isInitialized) localStorage.setItem(`${keyPrefix}-internalCandidates`, JSON.stringify(internalCandidates)); }, [internalCandidates, isInitialized, keyPrefix]);
  useEffect(() => { if (isInitialized) localStorage.setItem(`${keyPrefix}-pastCandidates`, JSON.stringify(pastCandidates)); }, [isInitialized, keyPrefix, pastCandidates]);
  useEffect(() => { if (isInitialized) localStorage.setItem(`${keyPrefix}-uploadedCandidates`, JSON.stringify(uploadedCandidates)); }, [isInitialized, keyPrefix, uploadedCandidates]);
  useEffect(() => { if (isInitialized) localStorage.setItem(`${keyPrefix}-selectedJobId`, JSON.stringify(selectedJobId)); }, [isInitialized, keyPrefix, selectedJobId]);

  return { jobs, setJobs, internalCandidates, setInternalCandidates, pastCandidates, setPastCandidates, uploadedCandidates, setUploadedCandidates, selectedJobId, setSelectedJobId, isInitialized };
};
