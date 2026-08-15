import { beforeEach, describe, expect, it } from 'vitest';
import { conversationalEngagementService, defaultClientCriteria, evaluateCandidateAgainstCriteria, evaluateRouting, type CandidateEngagementPreferences } from '../ConversationalEngagementService';
import type { Candidate, Job } from '../../types';

const candidate: Candidate = { id: 'candidate-1', name: 'Ada Example', email: 'ada@example.com', phone: '+3612345678', role: 'Quality Specialist', location: 'Budapest', skills: ['Quality', 'SAP'], availability: 'Available immediately', consent: { status: 'permitted', capturedAt: '2026-01-01T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z' }, metadata: { eligibility: ['EU work authorization'] } };
const job: Job = { id: 'job-1', title: 'Senior Quality Specialist', department: 'Manufacturing', location: 'Budapest', requiredSkills: ['Quality', 'SAP'], niceToHaveSkills: [], description: 'Senior specialist role', status: 'open' };
const preferences: CandidateEngagementPreferences = { channels: ['email', 'whatsapp'], frequency: 'monthly', locale: 'hu-HU', language: 'Hungarian', timezone: 'Europe/Budapest', preferredStartTime: '09:00', preferredEndTime: '16:00', quietDays: ['Saturday', 'Sunday'], talentCommunityConsent: true, updatedAt: '2026-01-01T00:00:00.000Z' };

describe('ConversationalEngagementService', () => {
  const organizationId = 'conversation-test';
  beforeEach(() => localStorage.clear());

  it('persists real candidate responses, evidence, preferences and human decisions', () => {
    const criteria = { ...defaultClientCriteria(job), clientName: 'Client', eligibilityRequirements: ['EU work authorization'], softSkills: ['Collaboration'] };
    const session = conversationalEngagementService.createSession(organizationId, 'recruiter-1', candidate, job, 'pool-1', criteria);
    conversationalEngagementService.invite(organizationId, session.id);
    const responses = session.questions.map((question) => ({ questionId: question.id, answer: `Candidate response for ${question.category}`, evidence: ['https://example.com/evidence'], answeredAt: new Date().toISOString() }));
    conversationalEngagementService.saveCandidateProgress(organizationId, session.token, responses, preferences, true);
    expect(conversationalEngagementService.getSession(organizationId, session.id)?.status).toBe('awaiting_review');
    expect(conversationalEngagementService.getPreferences(organizationId, candidate.id)?.channels).toContain('whatsapp');
    conversationalEngagementService.decide(organizationId, session.id, { outcome: 'approve', reason: 'Evidence reviewed', reviewerUserId: 'manager-1', decidedAt: new Date().toISOString() });
    expect(conversationalEngagementService.getSession(organizationId, session.id)?.humanDecision?.reason).toBe('Evidence reviewed');
  });

  it('evaluates client-specific location, skills, eligibility and availability', () => {
    const result = evaluateCandidateAgainstCriteria(candidate, { clientName: 'Client', vertical: '', locations: ['Budapest'], requiredSkills: ['Quality', 'SAP'], eligibilityRequirements: ['EU work authorization'], availabilityRequirement: 'immediately', softSkills: [] });
    expect(result.score).toBe(100);
    expect(result.locationMatch).toBe(true);
    expect(result.eligibilityUnknown).toBe(false);
  });

  it('routes low-risk strong candidates to agent assistance and elevated risk to a human', () => {
    expect(evaluateRouting(candidate, job, 80).route).toBe('agent');
    const noConsent = { ...candidate, id: 'candidate-2', consent: { status: 'pending' as const } };
    expect(evaluateRouting(noConsent, job, 0).route).toBe('human');
  });

  it('requires approval state before a proposed call can become scheduled in the workflow', () => {
    const call = conversationalEngagementService.proposeCall(organizationId, { candidateId: candidate.id, candidateName: candidate.name, provider: 'google', startsAt: '2026-09-01T09:00:00.000Z', durationMinutes: 30, purpose: 'Talent community conversation' });
    expect(call.status).toBe('proposed');
    conversationalEngagementService.updateCall(organizationId, call.id, { status: 'approved', approvedBy: 'manager-1' });
    expect(conversationalEngagementService.listCalls(organizationId)[0].approvedBy).toBe('manager-1');
  });
});
