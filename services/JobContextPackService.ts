import { supabase } from './supabaseClient';
import type { RoleContextPack, RoleContextQuestionId, RoleContextAnswer } from '../types';

const STORAGE_VERSION = 1;
const LOCAL_KEY_PREFIX = 'job_context_pack';

export const ROLE_CONTEXT_QUESTION_IDS: RoleContextQuestionId[] = [
  'success_90_days',
  'must_haves_top3',
  'nice_signals_top2',
  'dealbreakers',
  'location_reality',
  'reject_even_if_skills_match'
];

function localKey(jobId: string) {
  return `${LOCAL_KEY_PREFIX}:v${STORAGE_VERSION}:${jobId}`;
}

function defaultAnswers(): Record<RoleContextQuestionId, RoleContextAnswer> {
  return ROLE_CONTEXT_QUESTION_IDS.reduce((acc, id) => {
    acc[id] = { choices: [] };
    return acc;
  }, {} as Record<RoleContextQuestionId, RoleContextAnswer>);
}

function normalizePack(input: Partial<RoleContextPack> & Pick<RoleContextPack, 'jobId'>): RoleContextPack {
  const mergedAnswers: Record<RoleContextQuestionId, RoleContextAnswer> = {
    ...defaultAnswers(),
    ...(input.answers || {})
  };

  // Backward compatibility: older packs stored `{ choice: string }`.
  ROLE_CONTEXT_QUESTION_IDS.forEach((id) => {
    const a = mergedAnswers[id] || {};
    const existingChoices = Array.isArray(a.choices) ? a.choices.map((c) => String(c)).filter(Boolean) : [];
    const legacyChoice = typeof a.choice === 'string' ? a.choice.trim() : '';
    const choices = existingChoices.length > 0 ? existingChoices : (legacyChoice ? [legacyChoice] : []);
    mergedAnswers[id] = {
      choices,
      otherText: typeof a.otherText === 'string' ? a.otherText : undefined
    };
  });

  return {
    jobId: String(input.jobId),
    jobTitle: input.jobTitle ? String(input.jobTitle) : undefined,
    answers: mergedAnswers,
    notes: input.notes ? String(input.notes) : undefined,
    updatedAt: input.updatedAt ? String(input.updatedAt) : new Date().toISOString()
  };
}

class JobContextPackService {
  isAvailable(): boolean {
    return Boolean(supabase);
  }

  async get(jobId: string): Promise<RoleContextPack | null> {
    const id = String(jobId);

    if (supabase) {
      const { data, error } = await supabase
        .from('job_context_packs')
        .select('*')
        .eq('job_id', id)
        .maybeSingle();

      if (!error && data) {
        return normalizePack({
          jobId: id,
          jobTitle: data.job_title ?? undefined,
          answers: (data.answers ?? undefined) as any,
          updatedAt: data.updated_at ?? undefined
        });
      }
    }

    try {
      const raw = localStorage.getItem(localKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RoleContextPack;
      if (!parsed?.jobId) return null;
      return normalizePack(parsed);
    } catch {
      return null;
    }
  }

  async upsert(pack: RoleContextPack): Promise<RoleContextPack> {
    const normalized = normalizePack(pack);

    if (supabase) {
      const payload = {
        job_id: normalized.jobId,
        job_title: normalized.jobTitle ?? null,
        answers: normalized.answers ?? {},
        updated_at: normalized.updatedAt
      };

      const { error } = await supabase
        .from('job_context_packs')
        .upsert(payload, { onConflict: 'job_id' });

      if (error && import.meta.env.DEV) {
        console.warn('[JobContextPackService] Failed to upsert job_context_packs:', error);
      }
    }

    try {
      localStorage.setItem(localKey(normalized.jobId), JSON.stringify(normalized));
    } catch {
      // ignore
    }

    return normalized;
  }
}

export const jobContextPackService = new JobContextPackService();
