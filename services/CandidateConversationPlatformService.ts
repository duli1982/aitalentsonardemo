import type { ConversationStore, LanguageAssessment, LanguageCode, NavigatorItem, PhoneSession, Journey } from '../api/_lib/conversationStore';

export type PlatformProviders = { durableStorage: boolean; assessmentProvider: boolean; twilioVoice: boolean; transcription: boolean; fraudLiveness: boolean; journeyDelivery: boolean };
export type PlatformSnapshot = { store: ConversationStore; providers: PlatformProviders; languages: Record<LanguageCode, string> };

async function responseJson<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => ({})) as { ok?: boolean; message?: string } & T;
  if (!response.ok || result.ok === false) throw new Error(result.message || `Request failed (${response.status}).`);
  return result;
}

async function post<T>(organizationId: string, action: string, input: Record<string, unknown>, actorUserId?: string): Promise<T> {
  const response = await responseJson<{ result: T }>(await fetch('/api/conversation-platform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, action, actorUserId, ...input }) }));
  return response.result;
}

export const candidateConversationPlatformService = {
  async snapshot(organizationId: string): Promise<PlatformSnapshot> { const result = await responseJson<{ store: ConversationStore; providers: PlatformProviders; languages: Record<LanguageCode, string> }>(await fetch(`/api/conversation-platform?organizationId=${encodeURIComponent(organizationId)}`)); return { store: result.store, providers: result.providers, languages: result.languages }; },
  async external(organizationId: string, token: string) { return responseJson<{ assessment?: LanguageAssessment; phoneSession?: PhoneSession }>(await fetch(`/api/conversation-platform?organizationId=${encodeURIComponent(organizationId)}&token=${encodeURIComponent(token)}`)); },
  createAssessment: (organizationId: string, actorUserId: string, input: { candidateId: string; candidateName: string; candidateEmail?: string; language: LanguageCode; requestedLevel: string }) => post<LanguageAssessment>(organizationId, 'create_assessment', input, actorUserId),
  submitAssessment: (organizationId: string, input: { token: string; scores: { reading?: number; writing?: number; listening?: number; speaking?: number; overall: number; cefr: string }; evidence: string[] }) => post<LanguageAssessment>(organizationId, 'submit_assessment', input),
  reviewAssessment: (organizationId: string, actorUserId: string, assessmentId: string, decision: 'verified' | 'needs_follow_up', note: string) => post<LanguageAssessment>(organizationId, 'review_assessment', { assessmentId, decision, note }, actorUserId),
  createPhoneSession: (organizationId: string, actorUserId: string, input: { candidateId: string; candidateName: string; candidateEmail?: string; candidatePhone?: string; jobId?: string; jobTitle?: string; timezone: string; durationMinutes: number; availableSlots: string[]; requirements: string[] }) => post<PhoneSession>(organizationId, 'create_phone_session', input, actorUserId),
  schedulePhone: (organizationId: string, token: string, scheduledAt: string) => post<PhoneSession>(organizationId, 'schedule_phone', { token, scheduledAt, recordingConsent: true }),
  startPhone: (organizationId: string, actorUserId: string, phoneSessionId: string) => post<PhoneSession>(organizationId, 'start_phone', { phoneSessionId }, actorUserId),
  ingestTranscript: (organizationId: string, actorUserId: string, phoneSessionId: string, transcript: string, requirements: string[], recordingUrl?: string) => post<PhoneSession>(organizationId, 'ingest_transcript', { phoneSessionId, transcript, requirements, recordingUrl }, actorUserId),
  runFraudCheck: (organizationId: string, actorUserId: string, phoneSessionId: string) => post<PhoneSession>(organizationId, 'run_fraud_check', { phoneSessionId }, actorUserId),
  createNavigatorItem: (organizationId: string, actorUserId: string, input: Omit<NavigatorItem, 'id' | 'organizationId' | 'status' | 'createdAt' | 'updatedAt'>) => post<NavigatorItem>(organizationId, 'create_navigator_item', input, actorUserId),
  updateNavigatorItem: (organizationId: string, actorUserId: string, itemId: string, status: NavigatorItem['status']) => post<NavigatorItem>(organizationId, 'update_navigator_item', { itemId, status }, actorUserId),
  createJourney: (organizationId: string, actorUserId: string, input: Omit<Journey, 'id' | 'organizationId' | 'status' | 'attempts' | 'createdAt' | 'updatedAt' | 'approvedBy' | 'lastRunAt' | 'lastResult'>) => post<Journey>(organizationId, 'create_journey', input, actorUserId),
  approveJourney: (organizationId: string, actorUserId: string, journeyId: string) => post<Journey>(organizationId, 'approve_journey', { journeyId }, actorUserId),
  runWorker: (organizationId: string, actorUserId: string) => post<{ processed: number; delivered: number; escalated: number }>(organizationId, 'run_worker', {}, actorUserId),
};
