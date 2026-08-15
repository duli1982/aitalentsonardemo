import { useCallback, useMemo, useState } from 'react';
import type { Candidate, Job } from '../types';
import { useData } from '../contexts/DataContext';

export interface LocalWorkspaceCandidateResult {
  id: string;
  name: string;
  email: string;
  type: 'uploaded';
  skills: string[];
  matchScore: number;
  metadata?: Record<string, unknown>;
  companies?: string[];
  schools?: string[];
  experienceYears?: number;
  location?: string;
  matchReason?: string;
}

interface Options { enabled?: boolean; limit?: number; threshold?: number; experienceLevel?: 'junior' | 'mid' | 'senior' | null; location?: string | null; requiredSkills?: string[] | null }

const scoreCandidate = (job: Job, candidate: Candidate) => {
  const persisted = candidate.matchScores?.[job.id];
  if (typeof persisted === 'number') return Math.round(persisted);
  const required = (job.requiredSkills || []).map((skill) => skill.toLowerCase());
  if (!required.length) return 50;
  const skills = new Set((candidate.skills || []).map((skill) => skill.toLowerCase()));
  return Math.round((required.filter((skill) => skills.has(skill)).length / required.length) * 100);
};

export const useLocalWorkspaceCandidates = (job: Job | null, options: Options = {}) => {
  const { enabled = true, limit = 50, threshold = 0, experienceLevel = null, location = null, requiredSkills = null } = options;
  const { internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const [currentLimit, setCurrentLimit] = useState(limit);
  const all = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const ranked = useMemo<LocalWorkspaceCandidateResult[]>(() => {
    if (!enabled || !job) return [];
    return all.map((candidate) => {
      const matchScore = scoreCandidate(job, candidate);
      return {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email || '',
        type: 'uploaded' as const,
        skills: candidate.skills || [],
        matchScore,
        metadata: candidate.metadata || {},
        companies: Array.isArray((candidate as Candidate & { companies?: string[] }).companies) ? (candidate as Candidate & { companies?: string[] }).companies : [],
        schools: Array.isArray((candidate as Candidate & { schools?: string[] }).schools) ? (candidate as Candidate & { schools?: string[] }).schools : [],
        experienceYears: candidate.experienceYears ?? candidate.experience ?? 0,
        location: candidate.location || '',
        matchReason: candidate.matchRationales?.[job.id] || `${matchScore}% required-skill coverage`,
      };
    }).filter((candidate) => candidate.matchScore / 100 >= threshold)
      .filter((candidate) => !location || candidate.location?.toLowerCase().includes(location.toLowerCase()))
      .filter((candidate) => !requiredSkills?.length || requiredSkills.some((skill) => candidate.skills.some((value) => value.toLowerCase().includes(skill.toLowerCase()))))
      .filter((candidate) => {
        if (!experienceLevel) return true;
        const years = candidate.experienceYears || 0;
        return experienceLevel === 'junior' ? years < 3 : experienceLevel === 'mid' ? years >= 3 && years < 7 : years >= 7;
      }).sort((a, b) => b.matchScore - a.matchScore);
  }, [all, enabled, experienceLevel, job, location, requiredSkills, threshold]);
  const candidates = ranked.slice(0, currentLimit);
  const loadMore = useCallback(() => setCurrentLimit((value) => value + limit), [limit]);
  const refresh = useCallback(() => setCurrentLimit(limit), [limit]);
  return { candidates, isLoading: false, error: null as Error | null, hasMore: candidates.length < ranked.length, loadMore, refresh, total: ranked.length };
};
