import { describe, expect, it } from 'vitest';
import type { InternalCandidate, Job } from '../../types';
import { mobilityPlanningService } from '../MobilityPlanningService';

const candidate = (id: string, skills: string[], overrides: Partial<InternalCandidate> = {}): InternalCandidate => ({
  id,
  name: `Candidate ${id}`,
  type: 'internal',
  currentRole: 'QC Analyst',
  department: 'Quality',
  tenure: 3,
  performanceRating: 4,
  learningAgility: 4,
  careerAspirations: 'Move into a data analyst role',
  skills,
  profileStatus: 'complete',
  ...overrides,
});

const job: Job = {
  id: 'job-data',
  title: 'Data Analyst',
  department: 'Data',
  location: 'Budapest, Hungary',
  requiredSkills: ['SQL', 'Python'],
  description: 'Analyze operational data.',
  status: 'open',
  headcount: 2,
};

describe('MobilityPlanningService', () => {
  it('builds requisition and capability-gap opportunities from workspace demand', () => {
    const opportunities = mobilityPlanningService.buildOpportunities([job], [candidate('one', ['SQL'])]);
    expect(opportunities.some((item) => item.id === 'requisition:job-data')).toBe(true);
    expect(opportunities.some((item) => item.id === 'capability:python')).toBe(true);
  });

  it('ranks internal candidates using skills and career evidence', () => {
    const opportunity = mobilityPlanningService.buildOpportunities([job], [candidate('strong', ['SQL', 'Python']), candidate('weak', ['Excel'], { careerAspirations: undefined })])[0];
    const ranked = mobilityPlanningService.rankCandidates(opportunity, [candidate('strong', ['SQL', 'Python']), candidate('weak', ['Excel'], { careerAspirations: undefined })]);
    expect(ranked[0].candidate.id).toBe('strong');
    expect(ranked[0].skillCoverage).toBe(100);
    expect(ranked[1].constraints).toContain('Career aspirations not recorded');
  });

  it('keeps evidence confidence separate from readiness', () => {
    const unverified = candidate('unverified', ['SQL', 'Python']);
    const opportunity = mobilityPlanningService.buildOpportunities([job], [unverified])[0];
    const [result] = mobilityPlanningService.rankCandidates(opportunity, [unverified]);
    expect(result.score).toBeGreaterThan(result.confidence);
    expect(result.constraints).toContain('No matched skills are independently verified');
  });
});
