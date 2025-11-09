
import type { Job, InternalCandidate, PastCandidate, UploadedCandidate } from './types';
import { ALL_CANDIDATES } from './data/candidates';
import { ALL_JOBS } from './data/jobs';

export const MOCK_JOBS: Job[] = ALL_JOBS;

export const MOCK_INTERNAL_CANDIDATES: InternalCandidate[] = ALL_CANDIDATES.filter(
  (c): c is InternalCandidate => c.type === 'internal'
);

export const MOCK_PAST_CANDIDATES: PastCandidate[] = ALL_CANDIDATES.filter(
  (c): c is PastCandidate => c.type === 'past'
);

export const MOCK_UPLOADED_CANDIDATES: UploadedCandidate[] = ALL_CANDIDATES.filter(
    (c): c is UploadedCandidate => c.type === 'uploaded'
);
