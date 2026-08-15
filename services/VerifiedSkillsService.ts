import type { Candidate } from '../types';
import type { AssessmentResult, ValidatedSkill } from '../types/assessment';
import type { ProposedAction } from './ProposedActionService';
import { proposedActionService } from './ProposedActionService';
import { err, ok, type Result } from '../types/result';
import { upstream } from './errorHandling';
import { eventBus, EVENTS } from '../utils/EventBus';

const SERVICE = 'VerifiedSkillsService';
type CandidatePassport = NonNullable<Candidate['passport']>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asValidatedSkills(value: unknown): ValidatedSkill[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item) => typeof item.skillName === 'string')
    .map((item) => ({
      skillName: String(item.skillName),
      proficiencyLevel: Number(item.proficiencyLevel ?? 0),
      verifiedAt: String(item.verifiedAt ?? new Date().toISOString()),
      source: String(item.source ?? 'assessment'),
      confidenceScore: typeof item.confidenceScore === 'number' ? item.confidenceScore : 0.8,
      evidenceLink: typeof item.evidenceLink === 'string' ? item.evidenceLink : undefined
    }));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mergeVerifiedSkills(existing: ValidatedSkill[], delta: ValidatedSkill[]): ValidatedSkill[] {
  const next = [...existing];
  delta.forEach((d) => {
    const idx = next.findIndex((s) => String(s.skillName || '').toLowerCase() === String(d.skillName).toLowerCase());
    if (idx >= 0) {
      const prevLevel = Number(next[idx]?.proficiencyLevel ?? 0);
      if (Number(d.proficiencyLevel) >= prevLevel) next[idx] = d;
    } else {
      next.push(d);
    }
  });
  return next;
}

function mergeDistinctStrings(existing: unknown, added: string[]): string[] {
  const base = Array.isArray(existing) ? existing.map((v) => String(v)) : [];
  const set = new Set(base.map((s) => s.toLowerCase()));
  added.forEach((s) => set.add(String(s).toLowerCase()));
  // Preserve original casing when possible; fall back to added.
  const next: string[] = [];
  base.forEach((s) => {
    const key = s.toLowerCase();
    if (set.has(key)) {
      next.push(s);
      set.delete(key);
    }
  });
  added.forEach((s) => {
    const key = String(s).toLowerCase();
    if (set.has(key)) {
      next.push(String(s));
      set.delete(key);
    }
  });
  // Any remaining (only possible if base had duplicates)
  return Array.from(new Set(next));
}

export function proposeVerifiedSkillsFromAssessment(params: {
  candidate: Candidate;
  jobId?: string;
  assessment: AssessmentResult;
  inferred: { verifiedSkills: ValidatedSkill[]; badges: string[] };
}): ProposedAction | null {
  const { candidate, jobId, assessment, inferred } = params;

  const existingSkills = candidate.passport?.verifiedSkills ?? [];
  const existingBadges = candidate.passport?.badges ?? [];

  const existingByName = new Map<string, number>();
  existingSkills.forEach((s) => {
    const name = String(s.skillName || '').toLowerCase();
    if (!name) return;
    existingByName.set(name, Number(s.proficiencyLevel ?? 0));
  });

  const verifiedSkillsDelta = inferred.verifiedSkills.filter((s) => {
    const key = String(s.skillName).toLowerCase();
    const prev = existingByName.get(key);
    return prev === undefined || Number(s.proficiencyLevel) > prev;
  });

  const badgesAdded = inferred.badges.filter((b) => !existingBadges.includes(b));
  const skillsAdded = verifiedSkillsDelta
    .map((s) => String(s.skillName))
    .filter((name) => !candidate.skills.some((x) => String(x).toLowerCase() === name.toLowerCase()));

  if (!verifiedSkillsDelta.length && !badgesAdded.length && !skillsAdded.length) return null;

  return proposedActionService.add({
    agentType: 'USER',
    title: 'Update verified skills',
    description: `${candidate.name}${jobId ? ` (job ${jobId})` : ''} — add assessment-verified skills to the system-of-record (recommend-only).`,
    candidateId: candidate.id,
    jobId,
    payload: {
      type: 'UPDATE_VERIFIED_SKILLS',
      candidateId: candidate.id,
      jobId,
      assessment,
      verifiedSkillsDelta,
      badgesAdded,
      skillsAdded
    },
    evidence: [
      { label: 'Assessment', value: assessment.title },
      { label: 'Score', value: `${assessment.score}/100` },
      { label: 'Validated', value: assessment.skillsValidated.slice(0, 6).join(', ') || '—' }
    ]
  });
}

export async function applyVerifiedSkillsProposal(action: ProposedAction): Promise<Result<{ skills: string[]; passport: CandidatePassport }>> {
  if (action.payload.type !== 'UPDATE_VERIFIED_SKILLS') {
    return err(upstream(SERVICE, 'Not a verified-skills proposal.', null));
  }

  const { candidateId, verifiedSkillsDelta, badgesAdded, skillsAdded, assessment } = action.payload;

  const passport = { verifiedSkills: verifiedSkillsDelta, badges: badgesAdded } satisfies CandidatePassport;
  eventBus.emit(EVENTS.CANDIDATE_UPDATED, { candidateId, updates: { skills: skillsAdded, passport, metadata: { assessmentHistory: [{ id: assessment.id, title: assessment.title, type: assessment.type, score: assessment.score, dateCompleted: assessment.dateCompleted, skillsValidated: assessment.skillsValidated }] } } });
  return ok({ skills: skillsAdded, passport });
}
