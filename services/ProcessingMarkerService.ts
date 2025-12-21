import { supabase } from './supabaseClient';

export interface ProcessingMarkAcquireParams {
  candidateId: string;
  jobId: string;
  step: string;
  ttlMs?: number;
  metadata?: Record<string, unknown>;
}

class ProcessingMarkerService {
  /**
   * Restart-safe step locking:
   * - If `status=completed`: skip
   * - If `status=started` and updated recently: skip
   * - If `status=started` but stale: take over (retry)
   *
   * If the table isn't deployed yet, this returns `true` (best-effort) so the app keeps working.
   */
  async beginStep(params: ProcessingMarkAcquireParams): Promise<boolean> {
    if (!supabase) return true;

    const ttlMs = params.ttlMs ?? 1000 * 60 * 10; // default 10 min
    const nowIso = new Date().toISOString();

    const read = await supabase
      .from('pipeline_processing_marks')
      .select('status,updated_at')
      .eq('candidate_id', params.candidateId)
      .eq('job_id', params.jobId)
      .eq('step', params.step)
      .maybeSingle();

    if (read.error) {
      // 42P01 = undefined_table (table not deployed)
      if ((read.error as any).code === '42P01') {
        if (import.meta.env.DEV) {
          console.warn('[ProcessingMarkerService] pipeline_processing_marks not deployed; proceeding without idempotency');
        }
        return true;
      }
      if (import.meta.env.DEV) {
        console.warn('[ProcessingMarkerService] Failed to read processing mark; proceeding:', read.error);
      }
      return true;
    }

    const existing = read.data as any | null;
    if (existing?.status === 'completed') return false;

    if (existing?.status === 'started' && existing.updated_at) {
      const updatedAtMs = new Date(existing.updated_at).getTime();
      if (Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs < ttlMs) {
        return false;
      }
    }

    // Upsert to (re)start the step.
    const upsert = await supabase
      .from('pipeline_processing_marks')
      .upsert(
        {
          candidate_id: params.candidateId,
          job_id: params.jobId,
          step: params.step,
          status: 'started',
          updated_at: nowIso,
          metadata: params.metadata ?? {}
        },
        { onConflict: 'candidate_id,job_id,step' }
      );

    if (upsert.error) {
      if ((upsert.error as any).code === '42P01') return true;
      if (import.meta.env.DEV) console.warn('[ProcessingMarkerService] Failed to begin step; proceeding:', upsert.error);
      return true;
    }
    return true;
  }

  async completeStep(params: { candidateId: string; jobId: string; step: string; metadata?: Record<string, unknown> }): Promise<void> {
    if (!supabase) return;

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('pipeline_processing_marks')
      .upsert(
        {
          candidate_id: params.candidateId,
          job_id: params.jobId,
          step: params.step,
          status: 'completed',
          updated_at: nowIso,
          metadata: params.metadata ?? {}
        },
        { onConflict: 'candidate_id,job_id,step' }
      );

    if (error && import.meta.env.DEV) {
      console.warn('[ProcessingMarkerService] Failed to complete step (non-fatal):', error);
    }
  }
}

export const processingMarkerService = new ProcessingMarkerService();
