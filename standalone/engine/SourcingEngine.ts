
import { CRMAdapter, CRMCandidate } from '../adapters/CRMAdapter';
import { Result, ok, err } from '../../types/result';
import { Job } from '../../types';
import { AgenticSearchResult } from '../../services/AgenticSourcingPrototype';

/**
 * The Brain of the Standalone App.
 * Coordination between the raw CRM search and the AI "Hidden Gem" analysis.
 */
export class SourcingEngine {
    constructor(private adapter: CRMAdapter) { }

    /**
     * Finds and analyzes candidates for a specific job.
     */
    async processRediscovery(job: Job): Promise<Result<AgenticSearchResult[]>> {
        console.log(`[SourcingEngine] 🚀 Starting rediscovery for ${job.title}`);

        // 1. Fetch from CRM
        const searchRes = await this.adapter.searchCandidates({ job, limit: 20 });
        if (!searchRes.success) return err(searchRes.error);

        const candidates = searchRes.data;
        const results: AgenticSearchResult[] = [];

        // 2. Perform On-Demand Analysis (Triage)
        // Note: For the standalone version, we do all logic in-memory.
        for (const candidate of candidates) {
            const basicScore = this.calculateBasicFit(job, candidate);

            // Only perform deep AI extraction for candidates with a minimum threshold
            if (basicScore > 40) {
                results.push({
                    candidateId: candidate.id,
                    candidateName: candidate.name,
                    candidateSkills: candidate.skills,
                    score: basicScore,
                    reasoning: [`Initial match score: ${basicScore}%`],
                    sources: ['crm_search'],
                    fullCandidate: candidate
                });
            }
        }

        // 3. Sort by basic score and return
        return ok(results.sort((a, b) => b.score - a.score));
    }

    private calculateBasicFit(job: Job, candidate: CRMCandidate): number {
        let score = 0;
        const jobSkills = (job.requiredSkills || []).map(s => s.toLowerCase());
        const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());

        // Simple skill overlap
        const intersection = jobSkills.filter(s => candidateSkills.includes(s));
        if (jobSkills.length > 0) {
            score += (intersection.length / jobSkills.length) * 60;
        }

        // Title match
        if (candidate.role?.toLowerCase().includes(job.title.toLowerCase())) {
            score += 40;
        }

        return Math.min(100, Math.round(score));
    }
}
