import { supabase } from './supabaseClient';
import type { MeetingProvider, ScheduledInterview } from './AutonomousSchedulingAgent';

export type ScheduledInterviewStatus = 'queued' | 'proposed' | 'confirmed' | 'declined' | 'rescheduled' | 'cancelled';

export interface ScheduledInterviewRecord {
  interviewId: string;
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  interviewType: 'phone' | 'video' | 'onsite';
  meetingProvider: MeetingProvider;
  meetingLink?: string;
  status: ScheduledInterviewStatus;
  requestedAt?: string;
  proposedSlots: string[];
  scheduledTime?: string;
  confirmationSentAt?: string;
  rescheduleHistory: any[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const TABLE = 'scheduled_interviews';

function isMissingTable(error: any): boolean {
  return Boolean(error && (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')));
}

function safeIso(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return new Date(value).toISOString();
}

class SchedulingPersistenceService {
  async upsertInterview(params: {
    interview: ScheduledInterview;
    status?: ScheduledInterviewStatus;
    requestedAt?: Date;
    proposedSlots?: Date[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!supabase) return;

    const { interview } = params;

    const payload = {
      interview_id: interview.id,
      candidate_id: interview.candidateId,
      candidate_name: interview.candidateName ?? null,
      job_id: interview.jobId,
      job_title: interview.jobTitle ?? null,
      interview_type: interview.interviewType,
      meeting_provider: interview.meetingProvider,
      meeting_link: interview.meetingLink ?? null,
      status: params.status ?? (interview.status === 'confirmed' ? 'confirmed' : 'queued'),
      requested_at: safeIso(params.requestedAt ?? null) ?? null,
      proposed_slots: (params.proposedSlots ?? []).map((d) => new Date(d).toISOString()),
      scheduled_time: safeIso(interview.scheduledTime) ?? null,
      confirmation_sent_at: safeIso(interview.confirmationSentAt) ?? null,
      reschedule_history: interview.rescheduleHistory ?? [],
      metadata: params.metadata ?? {},
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: 'interview_id' });
    if (error) {
      if (isMissingTable(error)) {
        if (import.meta.env.DEV) console.warn('[SchedulingPersistenceService] scheduled_interviews not deployed; skipping persistence.');
        return;
      }
      if (import.meta.env.DEV) console.warn('[SchedulingPersistenceService] Failed to persist interview:', error);
    }
  }

  async listForCandidate(candidateId: string, limit = 200): Promise<ScheduledInterviewRecord[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('candidate_id', candidateId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTable(error)) return [];
      return [];
    }
    if (!data) return [];

    return data.map((row: any): ScheduledInterviewRecord => ({
      interviewId: row.interview_id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name ?? undefined,
      jobId: row.job_id,
      jobTitle: row.job_title ?? undefined,
      interviewType: row.interview_type,
      meetingProvider: row.meeting_provider,
      meetingLink: row.meeting_link ?? undefined,
      status: row.status,
      requestedAt: row.requested_at ?? undefined,
      proposedSlots: Array.isArray(row.proposed_slots) ? row.proposed_slots : [],
      scheduledTime: row.scheduled_time ?? undefined,
      confirmationSentAt: row.confirmation_sent_at ?? undefined,
      rescheduleHistory: row.reschedule_history ?? [],
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

export const schedulingPersistenceService = new SchedulingPersistenceService();

