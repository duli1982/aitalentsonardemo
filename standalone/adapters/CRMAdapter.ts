
import { Result } from '../../types/result';
import { Candidate, Job } from '../../types';

export interface CRMCandidate extends Candidate {
    externalId: string;
    sourceRaw: any; // Raw data from the CRM
}

export interface CRMSearchParams {
    job: Job;
    limit?: number;
    offset?: number;
}

export interface CRMAdapter {
    /**
     * Search for candidates directly in the CRM's native search engine.
     * This replaces our local Supabase keyword/vector search.
     */
    searchCandidates(params: CRMSearchParams): Promise<Result<CRMCandidate[]>>;

    /**
     * Fetch full profile details for a specific candidate.
     */
    getCandidateDetails(candidateId: string): Promise<Result<CRMCandidate>>;

    /**
     * Optional: Push a note or status update back to the CRM.
     */
    pushInsight(candidateId: string, insight: string): Promise<Result<void>>;
}
