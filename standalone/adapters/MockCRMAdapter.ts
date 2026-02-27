
import { CRMAdapter, CRMCandidate, CRMSearchParams } from './CRMAdapter';
import { Result, ok } from '../../types/result';

/**
 * A mock adapter that simulates a CRM API response.
 * This allows us to test the "Stateless" engine without real API keys.
 */
export class MockCRMAdapter implements CRMAdapter {
    async searchCandidates(params: CRMSearchParams): Promise<Result<CRMCandidate[]>> {
        console.log(`[MockCRM] Searching CRM for job: ${params.job.title}`);

        // Simulating 500ms API latency
        await new Promise(r => setTimeout(r, 500));

        const mockCandidates: CRMCandidate[] = [
            {
                id: 'mock-1',
                externalId: 'crm-abc-123',
                name: 'Alex Rivera',
                role: 'Senior Software Engineer',
                skills: ['React', 'Node.js', 'PostgreSQL'],
                experienceYears: 8,
                email: 'alex@example.com',
                sourceRaw: { original_status: 'Silver Medalist' },
                type: 'past'
            },
            {
                id: 'mock-2',
                externalId: 'crm-def-456',
                name: 'Sam Chen',
                role: 'Fullstack Developer',
                skills: ['React', 'TypeScript', 'AWS'],
                experienceYears: 5,
                email: 'sam@example.com',
                sourceRaw: { original_status: 'Applied 6mo ago' },
                type: 'past'
            }
        ];

        return ok(mockCandidates);
    }

    async getCandidateDetails(candidateId: string): Promise<Result<CRMCandidate>> {
        return ok({
            id: candidateId,
            externalId: 'crm-id',
            name: 'Mock Candidate',
            role: 'Developer',
            skills: ['JS'],
            experienceYears: 3,
            email: 'mock@example.com',
            sourceRaw: {},
            type: 'past'
        });
    }

    async pushInsight(candidateId: string, insight: string): Promise<Result<void>> {
        console.log(`[MockCRM] Pushed insight to CRM for ${candidateId}: ${insight}`);
        return ok(undefined);
    }
}
