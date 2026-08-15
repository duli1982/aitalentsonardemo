import { useCallback, useMemo } from 'react';
import { useData } from '../contexts/DataContext';

export interface OrgTwinCandidatesOptions { enabled?: boolean; limit?: number }

export function useOrgTwinLocalWorkspaceCandidates({ enabled = true, limit = 7000 }: OrgTwinCandidatesOptions = {}) {
  const { internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const candidates = useMemo(
    () => enabled ? [...internalCandidates, ...pastCandidates, ...uploadedCandidates].slice(0, limit) : [],
    [enabled, internalCandidates, limit, pastCandidates, uploadedCandidates],
  );
  const refresh = useCallback(() => undefined, []);
  return { candidates, isLoading: false, error: null as Error | null, refresh };
}
