import { describe, expect, it } from 'vitest';
import { hybridCandidateRankingService } from '../HybridCandidateRankingService';

describe('HybridCandidateRankingService', () => {
  const job = { title: 'Senior React Engineer', location: 'Remote', requiredSkills: ['React', 'TypeScript'], niceToHaveSkills: ['GraphQL'], description: '5+ years experience' };

  it('prioritizes required skill coverage over a small semantic advantage', () => {
    const ranked = hybridCandidateRankingService.rankForJob(job, [
      { id: 'semantic-only', name: 'Ada', skills: ['Java'], semanticSimilarity: 0.95, title: 'Engineer', experienceYears: 5 },
      { id: 'qualified', name: 'Bea', skills: ['React', 'TypeScript'], semanticSimilarity: 0.83, title: 'Senior Engineer', experienceYears: 6 },
    ]);
    expect(ranked.map((candidate) => candidate.id)).toEqual(['qualified', 'semantic-only']);
  });

  it('uses stable name and ID tie-breakers', () => {
    const ranked = hybridCandidateRankingService.rankForQuery('react', [
      { id: 'b', name: 'Zoe', skills: ['React'], semanticSimilarity: 0.8 },
      { id: 'a', name: 'Amy', skills: ['React'], semanticSimilarity: 0.8 },
    ]);
    expect(ranked.map((candidate) => candidate.id)).toEqual(['a', 'b']);
  });
});
