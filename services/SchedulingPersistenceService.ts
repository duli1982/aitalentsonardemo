import type { MeetingProvider, ScheduledInterview } from './AutonomousSchedulingAgent';
export type ScheduledInterviewStatus = 'queued' | 'proposed' | 'confirmed' | 'declined' | 'rescheduled' | 'cancelled';
export interface ScheduledInterviewRecord { interviewId: string; candidateId: string; candidateName?: string; jobId: string; jobTitle?: string; interviewType: 'phone' | 'video' | 'onsite'; meetingProvider: MeetingProvider; meetingLink?: string; status: ScheduledInterviewStatus; requestedAt?: string; proposedSlots: string[]; scheduledTime?: string; confirmationSentAt?: string; rescheduleHistory: any[]; metadata: Record<string, unknown>; createdAt: string; updatedAt: string }
const KEY = 'talentSonar:scheduledInterviews';
const read = (): ScheduledInterviewRecord[] => { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const iso = (value: Date | string | undefined): string | undefined => value ? new Date(value).toISOString() : undefined;
class SchedulingPersistenceService {
  async upsertInterview(params: { interview: ScheduledInterview; status?: ScheduledInterviewStatus; requestedAt?: Date; proposedSlots?: Date[]; metadata?: Record<string, unknown> }): Promise<void> {
    const now = new Date().toISOString(); const interview = params.interview;
    const record: ScheduledInterviewRecord = { interviewId: interview.id, candidateId: interview.candidateId, candidateName: interview.candidateName, jobId: interview.jobId, jobTitle: interview.jobTitle, interviewType: interview.interviewType, meetingProvider: interview.meetingProvider, meetingLink: interview.meetingLink, status: params.status || (interview.status === 'confirmed' ? 'confirmed' : 'queued'), requestedAt: iso(params.requestedAt), proposedSlots: (params.proposedSlots || []).map((value) => value.toISOString()), scheduledTime: iso(interview.scheduledTime), confirmationSentAt: iso(interview.confirmationSentAt), rescheduleHistory: interview.rescheduleHistory || [], metadata: params.metadata || {}, createdAt: now, updatedAt: now };
    const existing = read().find((item) => item.interviewId === record.interviewId); if (existing) record.createdAt = existing.createdAt;
    localStorage.setItem(KEY, JSON.stringify([record, ...read().filter((item) => item.interviewId !== record.interviewId)]));
  }
  async listForCandidate(candidateId: string, limit = 200): Promise<ScheduledInterviewRecord[]> { return read().filter((item) => item.candidateId === candidateId).slice(0, limit); }
}
export const schedulingPersistenceService = new SchedulingPersistenceService();
