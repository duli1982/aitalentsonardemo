import { supabase } from './supabaseClient';

export type PipelineActorType = 'agent' | 'user' | 'system';

export interface PipelineEventCreate {
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  eventType: string;
  actorType: PipelineActorType;
  actorId?: string;
  fromStage?: string;
  toStage?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineEventRecord {
  id: number;
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  eventType: string;
  actorType: PipelineActorType;
  actorId?: string;
  fromStage?: string;
  toStage?: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

class PipelineEventService {
  async logEvent(event: PipelineEventCreate): Promise<void> {
    if (!supabase) return;

    const payload = {
      candidate_id: event.candidateId,
      candidate_name: event.candidateName ?? null,
      job_id: event.jobId,
      job_title: event.jobTitle ?? null,
      event_type: event.eventType,
      actor_type: event.actorType,
      actor_id: event.actorId ?? null,
      from_stage: event.fromStage ?? null,
      to_stage: event.toStage ?? null,
      summary: event.summary,
      metadata: event.metadata ?? {}
    };

    const { error } = await supabase.from('pipeline_events').insert(payload);
    if (error) {
      // Don't break the app if the table/policies aren't deployed yet.
      if (import.meta.env.DEV) {
        console.warn('[PipelineEventService] Failed to log event:', error);
      }
    }
  }

  async listForCandidate(candidateId: string, limit = 50): Promise<PipelineEventRecord[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('pipeline_events')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name ?? undefined,
      jobId: row.job_id,
      jobTitle: row.job_title ?? undefined,
      eventType: row.event_type,
      actorType: row.actor_type as PipelineActorType,
      actorId: row.actor_id ?? undefined,
      fromStage: row.from_stage ?? undefined,
      toStage: row.to_stage ?? undefined,
      summary: row.summary,
      metadata: row.metadata ?? {},
      createdAt: row.created_at
    }));
  }
}

export const pipelineEventService = new PipelineEventService();

