import { beforeEach, describe, expect, it } from 'vitest';
import type { Candidate, Job } from '../../types';
import type { SharedTalentPool } from '../SharedOperationsService';
import { workforceOperatingService } from '../WorkforceOperatingService';

const organizationId = 'workforce-test';
const manager = { userId: 'local-user', role: 'sourcing_manager' as const };
const recruiter = { userId: 'recruiter-technology', role: 'recruiter' as const };

const job: Job = {
  id: 'job-react',
  title: 'Senior React Engineer',
  department: 'Technology',
  location: 'Budapest',
  requiredSkills: ['React', 'TypeScript', 'Node.js'],
  description: 'Build customer-facing software.',
  status: 'open',
  headcount: 1,
  postedDate: '2026-08-01',
};

const candidate: Candidate = {
  id: 'candidate-one',
  name: 'Candidate One',
  type: 'internal',
  skills: ['React', 'TypeScript'],
  email: 'candidate@example.com',
  location: 'Budapest',
  currentRole: 'Software Engineer',
  employmentStatus: 'available',
};

describe('WorkforceOperatingService', () => {
  beforeEach(() => localStorage.clear());

  it('keeps recruiter access private and manager access team-wide', () => {
    expect(workforceOperatingService.listProfiles(organizationId, recruiter).map((profile) => profile.userId)).toEqual(['recruiter-technology']);
    expect(workforceOperatingService.listProfiles(organizationId, manager).length).toBeGreaterThan(1);
    expect(() => workforceOperatingService.recommendAllocations(organizationId, recruiter, job, [candidate])).toThrow(/team leads and sourcing managers/i);
  });

  it('recommends by explicit evidence and requires manager confirmation before assignment', () => {
    const recommendations = workforceOperatingService.recommendAllocations(organizationId, manager, job, [candidate]);
    expect(recommendations[0].recruiter.userId).toBe('recruiter-technology');
    expect(recommendations[0].breakdown.skillAlignment).toBe(100);
    expect(recommendations[0].rationale).toContain('3/3 required skills align');
    expect(workforceOperatingService.listAllocations(organizationId, manager)).toHaveLength(0);

    workforceOperatingService.assign(organizationId, manager, job, recommendations[0]);
    expect(workforceOperatingService.listAllocations(organizationId, recruiter)).toHaveLength(1);
    expect(workforceOperatingService.listAllocations(organizationId, { userId: 'recruiter-business', role: 'recruiter' })).toHaveLength(0);
  });

  it('retains one current daily pool-health snapshot without inventing trend history', () => {
    const timestamp = new Date().toISOString();
    const pool: SharedTalentPool = { id: 'pool-one', name: 'React pool', description: '', candidateIds: [candidate.id], targetSkills: ['React', 'Node.js'], createdAt: timestamp, updatedAt: timestamp };
    const first = workforceOperatingService.capturePoolHealth(organizationId, pool, [candidate], []);
    const second = workforceOperatingService.capturePoolHealth(organizationId, pool, [candidate], []);
    expect(second.id).toBe(first.id);
    expect(workforceOperatingService.listPoolHealth(organizationId, pool.id)).toHaveLength(1);
  });

  it('allows recruiters to draft intelligence but only managers to approve and share it', () => {
    const report = workforceOperatingService.generateReport(organizationId, recruiter, { job, jobs: [job], candidates: [candidate], externalPostings: [], pools: [], poolHealth: [] });
    expect(report.status).toBe('draft');
    expect(report.sourceNote).toMatch(/market signals/i);
    expect(() => workforceOperatingService.shareReport(organizationId, recruiter, report.id)).toThrow(/team lead or sourcing manager/i);
    workforceOperatingService.shareReport(organizationId, manager, report.id);
    expect(workforceOperatingService.listReports(organizationId, manager)[0].status).toBe('shared');
  });
});
