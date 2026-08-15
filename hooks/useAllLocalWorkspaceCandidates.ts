import { useCallback, useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';

export interface AllCandidatesOptions { enabled?: boolean; limit?: number }

/** Reads the organization candidate collection from the local workspace store. */
export const useAllLocalWorkspaceCandidates = ({ enabled = true, limit = 100 }: AllCandidatesOptions = {}) => {
  const { internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const [currentLimit, setCurrentLimit] = useState(limit);
  const all = useMemo(
    () => [...internalCandidates, ...pastCandidates, ...uploadedCandidates],
    [internalCandidates, pastCandidates, uploadedCandidates],
  );
  const candidates = enabled ? all.slice(0, currentLimit) : [];
  const loadMore = useCallback(() => setCurrentLimit((value) => value + limit), [limit]);
  const refresh = useCallback(() => setCurrentLimit(limit), [limit]);
  return { candidates, isLoading: false, error: null as Error | null, hasMore: candidates.length < all.length, loadMore, refresh, total: all.length };
};
