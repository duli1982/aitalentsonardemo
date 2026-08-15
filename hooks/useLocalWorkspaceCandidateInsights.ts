import { useCallback, useMemo } from 'react';
import type { DepartmentInsight } from '../types';
import { useData } from '../contexts/DataContext';

export interface LocalWorkspaceCandidateInsightsOptions { enabled?: boolean; pageSize?: number; cacheTtlMs?: number }

export const useLocalWorkspaceCandidateInsights = ({ enabled = true }: LocalWorkspaceCandidateInsightsOptions = {}) => {
  const { internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const candidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const insights = useMemo<DepartmentInsight[]>(() => {
    if (!enabled) return [];
    const counts = new Map<string, Map<string, number>>();
    for (const candidate of candidates) {
      const metadata = candidate.metadata || {};
      const department = String((candidate as any).department || metadata.department || metadata.industry || 'Unknown');
      const skills = counts.get(department) || new Map<string, number>();
      for (const skill of candidate.skills || []) skills.set(skill, (skills.get(skill) || 0) + 1);
      counts.set(department, skills);
    }
    return Array.from(counts, ([department, values]) => ({ department, topSkills: Array.from(values, ([skill, count]) => ({ skill, count })).sort((a, b) => b.count - a.count).slice(0, 5) }));
  }, [candidates, enabled]);
  const refresh = useCallback(() => undefined, []);
  return { insights, isLoading: false, error: null as Error | null, totalCandidates: candidates.length, refresh };
};
