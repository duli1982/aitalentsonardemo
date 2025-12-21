import { supabase } from './supabaseClient';
import type { InterviewSession } from './AutonomousInterviewAgent';

export interface InterviewSessionRecord {
  sessionId: string;
  interviewId?: string;
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  meetingProvider: string;
  meetingLink?: string;
  startedAt: string;
  endedAt?: string;
  questions: unknown[];
  missingQuestions: unknown[];
  transcript: unknown[];
  debrief: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const TABLE = 'interview_sessions';

function isMissingTable(error: any): boolean {
  return Boolean(error && (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')));
}

class InterviewSessionPersistenceService {
  async upsertSession(session: InterviewSession, metadata: Record<string, unknown> = {}): Promise<void> {
    if (!supabase) return;

    const payload = {
      session_id: session.id,
      interview_id: session.interviewId ?? null,
      candidate_id: session.candidateId,
      candidate_name: session.candidateName ?? null,
      job_id: session.jobId,
      job_title: session.jobTitle ?? null,
      meeting_provider: session.meetingProvider,
      meeting_link: session.meetingLink ?? null,
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : null,
      questions: session.questions ?? [],
      missing_questions: session.missingQuestions ?? [],
      transcript: (session.transcript ?? []).map((t) => ({
        ...t,
        timestamp: (t as any).timestamp ? new Date((t as any).timestamp).toISOString() : undefined
      })),
      debrief: session.debrief ?? {},
      metadata,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: 'session_id' });
    if (error) {
      if (isMissingTable(error)) {
        if (import.meta.env.DEV) console.warn('[InterviewSessionPersistenceService] interview_sessions not deployed; skipping persistence.');
        return;
      }
      if (import.meta.env.DEV) console.warn('[InterviewSessionPersistenceService] Failed to persist session:', error);
    }
  }

  async listForCandidate(candidateId: string, limit = 100): Promise<InterviewSessionRecord[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('candidate_id', candidateId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    if (!data) return [];

    return data.map((row: any): InterviewSessionRecord => ({
      sessionId: row.session_id,
      interviewId: row.interview_id ?? undefined,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name ?? undefined,
      jobId: row.job_id,
      jobTitle: row.job_title ?? undefined,
      meetingProvider: row.meeting_provider,
      meetingLink: row.meeting_link ?? undefined,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      questions: row.questions ?? [],
      missingQuestions: row.missing_questions ?? [],
      transcript: row.transcript ?? [],
      debrief: row.debrief ?? {},
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

export const interviewSessionPersistenceService = new InterviewSessionPersistenceService();

