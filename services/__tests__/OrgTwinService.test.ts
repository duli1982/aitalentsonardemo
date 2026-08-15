import { describe, expect, it } from 'vitest';
import type { Candidate, Job } from '../../types';
import { orgTwinService } from '../OrgTwinService';

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: 'candidate-1',
  name: 'Candidate One',
  skills: ['GMP'],
  location: 'Cork, Ireland',
  type: 'internal',
  ...overrides,
});

const job = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  title: 'Quality Lead',
  department: 'Quality',
  location: 'Cork, Ireland (Hybrid)',
  requiredSkills: ['GMP'],
  description: 'Quality leadership',
  status: 'open',
  ...overrides,
});

describe('OrgTwinService workforce planning trust rules', () => {
  it('does not return fallback capability claims when no records are mapped', () => {
    expect(orgTwinService.analyzeCapabilities('pharma', 'site_cork', { candidates: [], jobs: [] })).toEqual([]);
  });

  it('matches normalized city and country location tokens', () => {
    const unit = orgTwinService.getOrgTree('pharma').children?.find((item) => item.id === 'site_cork');
    expect(unit).toBeDefined();
    expect(orgTwinService.candidatesForUnit(unit!, [candidate()])).toHaveLength(1);
    expect(orgTwinService.jobsForUnit(unit!, [job()])).toHaveLength(1);
  });

  it('uses explicit org-unit metadata before location matching', () => {
    const unit = orgTwinService.getOrgTree('pharma').children?.find((item) => item.id === 'site_cork');
    const explicitlyMapped = candidate({ location: 'Berlin, Germany', metadata: { orgUnitId: 'site_cork' } });
    expect(orgTwinService.candidatesForUnit(unit!, [explicitlyMapped])).toHaveLength(1);
  });

  it('derives supply and demand without treating unverified skills as expert evidence', () => {
    const metrics = orgTwinService.analyzeCapabilities('pharma', 'site_cork', { candidates: [candidate()], jobs: [job()] });
    expect(metrics[0]).toMatchObject({ skillName: 'GMP', supplyCount: 1, demandCount: 1, expertCount: 0, verifiedCount: 0 });
  });
});
