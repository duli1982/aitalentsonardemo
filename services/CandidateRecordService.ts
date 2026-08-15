import type { Candidate, CandidateConsentRecord, CandidateLanguageAssessment, UploadedCandidate } from '../types';
import type { EngagementMessage } from './SharedOperationsService';
import type { EngagementScore } from './geminiService';

export const CONSENT_VALID_DAYS = 28;

const normalize = (value?: string) => String(value ?? '').trim().toLowerCase();
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

export type CandidateDraftValidation = { valid: boolean; errors: string[]; warnings: string[] };
export type DuplicateCandidateMatch = { candidate: Candidate; reasons: string[]; confidence: 'exact' | 'possible' };

export function validateCandidateDraft(candidate: Partial<UploadedCandidate>): CandidateDraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!candidate.name?.trim()) errors.push('Full name is required.');
  if (candidate.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email)) errors.push('Email address is not valid.');
  if (!candidate.email && !candidate.phone) warnings.push('No email or phone number was extracted.');
  if (!candidate.skills?.length) warnings.push('No skills were extracted.');
  if (!candidate.summary?.trim()) warnings.push('No professional summary was extracted.');
  if (!candidate.role?.trim()) warnings.push('Current or most recent role was not extracted.');
  return { valid: errors.length === 0, errors, warnings };
}

export function findCandidateDuplicates(candidate: Partial<Candidate>, existing: Candidate[]): DuplicateCandidateMatch[] {
  const email = normalize(candidate.email);
  const phone = normalize(candidate.phone).replace(/\D/g, '');
  const name = normalize(candidate.name);
  return existing.flatMap((item) => {
    const reasons: string[] = [];
    if (email && email === normalize(item.email)) reasons.push('same email address');
    if (phone && phone.length >= 7 && phone === normalize(item.phone).replace(/\D/g, '')) reasons.push('same phone number');
    if (name && name === normalize(item.name)) reasons.push('same full name');
    if (!reasons.length) return [];
    const exact = reasons.some((reason) => reason !== 'same full name');
    return [{ candidate: item, reasons, confidence: exact ? 'exact' as const : 'possible' as const }];
  });
}

export function consentExpiresAt(capturedAt: string): string {
  return new Date(Date.parse(capturedAt) + CONSENT_VALID_DAYS * 86_400_000).toISOString();
}

export function effectiveConsent(consent?: CandidateConsentRecord, at = new Date()): CandidateConsentRecord {
  if (!consent) return { status: 'pending' };
  if (consent.status === 'opted_out') return consent;
  const expiresAt = consent.expiresAt ?? (consent.capturedAt ? consentExpiresAt(consent.capturedAt) : undefined);
  if (consent.status === 'permitted' && expiresAt && Date.parse(expiresAt) <= at.getTime()) return { ...consent, status: 'expired', expiresAt };
  return { ...consent, expiresAt };
}

export function canContactCandidate(candidate: Candidate, at = new Date()): boolean {
  return effectiveConsent(candidate.consent, at).status === 'permitted';
}

export function parseLanguages(value: string, source: CandidateLanguageAssessment['source'] = 'recruiter'): CandidateLanguageAssessment[] {
  return value.split(/[;\n]+/).flatMap((entry) => {
    const [language, rawLevel = 'unknown', rawRating] = entry.split(':').map((item) => item.trim());
    if (!language) return [];
    const allowed = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native', 'unknown'];
    const level = allowed.find((item) => item.toLowerCase() === rawLevel.toLowerCase()) ?? 'unknown';
    const rating = rawRating ? Math.max(1, Math.min(5, Number(rawRating))) : undefined;
    return [{ language, level: level as CandidateLanguageAssessment['level'], rating: Number.isFinite(rating) ? rating : undefined, source: rating ? 'assessment' : source, verified: Boolean(rating) || source === 'assessment', assessedAt: rating ? new Date().toISOString() : undefined }];
  });
}

export function normalizeUploadedCandidate(candidate: UploadedCandidate): UploadedCandidate {
  return {
    ...candidate,
    name: candidate.name.trim(),
    email: candidate.email?.trim().toLowerCase(),
    skills: unique(candidate.skills ?? []),
    languages: candidate.languages?.filter((item) => item.language.trim()).map((item) => ({ ...item, language: item.language.trim() })) ?? [],
    profileStatus: validateCandidateDraft(candidate).warnings.length ? 'partial' : 'complete',
  };
}

function toActivity(message: EngagementMessage) {
  const timestamp = message.repliedAt ?? message.openedAt ?? message.sentAt ?? message.createdAt;
  const type = message.status === 'replied' ? 'response' : message.status === 'opened' ? 'email_open' : 'email_sent';
  return { type: type as 'response' | 'email_open' | 'email_sent', timestamp, details: `${message.subject} · ${message.status}` };
}

export function buildRecordedEngagementScore(candidate: Candidate, messages: EngagementMessage[]): EngagementScore {
  const recorded = messages.filter((message) => message.candidateId === candidate.id && ['sent', 'delivered', 'opened', 'replied', 'bounced', 'failed'].includes(message.status));
  const sent = recorded.filter((message) => ['sent', 'delivered', 'opened', 'replied'].includes(message.status)).length;
  const opened = recorded.filter((message) => ['opened', 'replied'].includes(message.status)).length;
  const replied = recorded.filter((message) => message.status === 'replied').length;
  const failed = recorded.filter((message) => ['bounced', 'failed'].includes(message.status)).length;
  const score = sent ? Math.max(0, Math.min(100, Math.round((opened / sent) * 35 + (replied / sent) * 55 + Math.min(10, sent * 2) - failed * 10))) : 0;
  const level = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
  const last = recorded.map((message) => message.repliedAt ?? message.openedAt ?? message.sentAt ?? message.createdAt).sort().at(-1);
  const insights = sent ? [`${sent} recorded outbound message${sent === 1 ? '' : 's'}.`, `${opened} opened and ${replied} replied.`, failed ? `${failed} delivery failure${failed === 1 ? '' : 's'} require attention.` : 'No delivery failures recorded.'] : ['No provider-recorded communication events are available.'];
  const recommendation = !sent ? 'Record a consented outreach event before assessing readiness.' : replied ? 'Candidate has replied; prioritize recruiter follow-up.' : opened ? 'Candidate has opened outreach; send a relevant follow-up.' : 'No response signal yet; review channel and message relevance.';
  return { candidateId: candidate.id, candidateName: candidate.name, score, level, activities: recorded.map(toActivity), insights, recommendation, lastInteraction: last ?? '' };
}
