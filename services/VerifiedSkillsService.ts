import type { Candidate } from '../types';
import type { AssessmentResult, ValidatedSkill } from '../types/assessment';
import type { ProposedAction } from './ProposedActionService';
import { proposedActionService } from './ProposedActionService';
import { supabase } from './supabaseClient';
import { err, ok, type Result } from '../types/result';
import { notConfigured, upstream } from './errorHandling';
import { eventBus, EVENTS } from '../utils/EventBus';

const SERVICE = 'VerifiedSkillsService';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mergeVerifiedSkills(existing: any[], delta: ValidatedSkill[]): ValidatedSkill[] {
  const next = [...(Array.isArray(existing) ? existing : [])] as ValidatedSkill[];
  delta.forEach((d) => {
    const idx = next.findIndex((s) => String((s as any)?.skillName || '').toLowerCase() === String(d.skillName).toLowerCase());
    if (idx >= 0) {
      const prevLevel = Number((next[idx] as any)?.proficiencyLevel ?? 0);
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

  const existingSkills = (candidate.passport?.verifiedSkills ?? []) as any[];
  const existingBadges = candidate.passport?.badges ?? [];

  const existingByName = new Map<string, number>();
  existingSkills.forEach((s: any) => {
    const name = String(s?.skillName || '').toLowerCase();
    if (!name) return;
    existingByName.set(name, Number(s?.proficiencyLevel ?? 0));
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

export async function applyVerifiedSkillsProposal(action: ProposedAction): Promise<Result<{ skills: string[]; passport: any }>> {
  if (action.payload.type !== 'UPDATE_VERIFIED_SKILLS') {
    return err(upstream(SERVICE, 'Not a verified-skills proposal.', null), { data: null as any });
  }

  const { candidateId, verifiedSkillsDelta, badgesAdded, skillsAdded, assessment } = action.payload;

  // If this isn't a UUID, it can't be in candidates system-of-record; treat as demo-only.
  if (!isUuid(candidateId)) {
    eventBus.emit(EVENTS.CANDIDATE_UPDATED, {
      candidateId,
      updates: {
        skills: skillsAdded,
        passport: { verifiedSkills: verifiedSkillsDelta, badges: badgesAdded }
      }
    });
    return ok({ skills: skillsAdded, passport: { verifiedSkills: verifiedSkillsDelta, badges: badgesAdded } });
  }

  if (!supabase) return err(notConfigured(SERVICE, 'Supabase is not configured.'), { data: null as any });

  try {
    const { data: row, error: fetchError } = await supabase
      .from('candidates')
      .select('skills, metadata')
      .eq('id', candidateId)
      .maybeSingle();

    if (fetchError) {
      return err(upstream(SERVICE, `Failed to load candidate system-of-record for ${candidateId}.`, fetchError), { data: null as any });
    }

    const existingSkills = (row as any)?.skills;
    const nextSkills = mergeDistinctStrings(existingSkills, skillsAdded);

    const existingMeta = ((row as any)?.metadata ?? {}) as Record<string, any>;
    const existingPassport = existingMeta.passport ?? {};
    const mergedPassport = {
      verifiedSkills: mergeVerifiedSkills(existingPassport.verifiedSkills, verifiedSkillsDelta),
      badges: Array.from(new Set([...(existingPassport.badges ?? []), ...badgesAdded]))
    };

    const assessmentHistory = Array.isArray(existingMeta.assessmentHistory) ? existingMeta.assessmentHistory : [];
    const nextAssessmentHistory = [
      {
        id: assessment.id,
        title: assessment.title,
        type: assessment.type,
        score: assessment.score,
        dateCompleted: assessment.dateCompleted,
        skillsValidated: assessment.skillsValidated
      },
      ...assessmentHistory
    ].slice(0, 50);

    const nextMeta = {
      ...existingMeta,
      passport: mergedPassport,
      assessmentHistory: nextAssessmentHistory
    };

    const { error: updateError } = await supabase
      .from('candidates')
      .update({ skills: nextSkills, metadata: nextMeta, updated_at: new Date().toISOString() } as any)
      .eq('id', candidateId);

    if (updateError) {
      return err(upstream(SERVICE, 'Failed to persist verified skills to Supabase.', updateError), { data: null as any });
    }

    eventBus.emit(EVENTS.CANDIDATE_UPDATED, {
      candidateId,
      updates: {
        skills: skillsAdded.length ? skillsAdded : nextSkills,
        passport: { verifiedSkills: verifiedSkillsDelta, badges: badgesAdded },
        metadata: nextMeta
      }
    });
    return ok({ skills: nextSkills, passport: mergedPassport });
  } catch (e) {
    return err(upstream(SERVICE, 'Verified skills apply threw unexpectedly.', e), { data: null as any });
  }
}
