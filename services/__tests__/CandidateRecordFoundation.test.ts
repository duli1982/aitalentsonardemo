import { describe, expect, it } from 'vitest';
import type { Candidate, UploadedCandidate } from '../../types';
import type { EngagementMessage } from '../SharedOperationsService';
import { searchCandidates } from '../CandidateBooleanSearchService';
import { buildRecordedEngagementScore, canContactCandidate, consentExpiresAt, effectiveConsent, findCandidateDuplicates, validateCandidateDraft } from '../CandidateRecordService';

const alice: Candidate = { id: 'alice', name: 'Alice Example', type: 'uploaded', email: 'alice@example.com', role: 'Senior Engineer', location: 'Budapest', skills: ['React', 'TypeScript'], languages: [{ language: 'English', level: 'C1', source: 'assessment', verified: true, rating: 4 }], clientSubmissions: [{ id: 'sub-1', clientName: 'Acme', jobTitle: 'Engineer', submittedAt: '2026-08-01T00:00:00.000Z', status: 'submitted' }] };
const bob: Candidate = { id: 'bob', name: 'Bob Example', type: 'internal', role: 'Project Manager', location: 'Vienna', skills: ['Agile', 'Jira'] };

describe('Candidate Record Foundation', () => {
  it('validates structured drafts and detects exact duplicates', () => {
    const draft = { name: 'Alice Example', email: 'ALICE@example.com', skills: ['React'], summary: 'Engineer', role: 'Engineer' } as UploadedCandidate;
    expect(validateCandidateDraft(draft).valid).toBe(true);
    expect(findCandidateDuplicates(draft, [alice])[0]).toMatchObject({ confidence: 'exact', reasons: ['same email address', 'same full name'] });
  });

  it('enforces the 28-day permission window and permanent opt-outs', () => {
    const capturedAt = '2026-01-01T00:00:00.000Z';
    expect(consentExpiresAt(capturedAt)).toBe('2026-01-29T00:00:00.000Z');
    expect(effectiveConsent({ status: 'permitted', capturedAt }, new Date('2026-01-15')).status).toBe('permitted');
    expect(effectiveConsent({ status: 'permitted', capturedAt }, new Date('2026-02-01')).status).toBe('expired');
    expect(canContactCandidate({ ...alice, consent: { status: 'opted_out', optedOutAt: capturedAt } }, new Date('2026-01-02'))).toBe(false);
  });

  it('supports Boolean operators, phrases, parentheses and structured fields', () => {
    expect(searchCandidates('skill:React AND location:Budapest', [alice, bob]).candidates.map((item) => item.id)).toEqual(['alice']);
    expect(searchCandidates('(role:"Project Manager" OR skill:React) AND NOT location:London', [alice, bob]).candidates).toHaveLength(2);
    expect(searchCandidates('language:"English C1" AND client:Acme', [alice, bob]).candidates.map((item) => item.id)).toEqual(['alice']);
    expect(searchCandidates('(skill:React', [alice, bob]).error).toMatch(/closing parenthesis/i);
  });

  it('calculates readiness from recorded provider events only', () => {
    expect(buildRecordedEngagementScore(alice, []).score).toBe(0);
    expect(buildRecordedEngagementScore(alice, []).activities).toHaveLength(0);
    const messages: EngagementMessage[] = [
      { id: 'one', candidateId: alice.id, provider: 'postmark', direction: 'outbound', subject: 'Role', body: 'Hello', status: 'opened', sentAt: '2026-08-01T00:00:00.000Z', openedAt: '2026-08-01T01:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'two', candidateId: alice.id, provider: 'postmark', direction: 'outbound', subject: 'Follow-up', body: 'Hello', status: 'replied', sentAt: '2026-08-02T00:00:00.000Z', repliedAt: '2026-08-02T01:00:00.000Z', createdAt: '2026-08-02T00:00:00.000Z' },
    ];
    const result = buildRecordedEngagementScore(alice, messages);
    expect(result.score).toBeGreaterThan(0);
    expect(result.activities.map((item) => item.type)).toEqual(['email_open', 'response']);
    expect(result.lastInteraction).toBe('2026-08-02T01:00:00.000Z');
  });
});
