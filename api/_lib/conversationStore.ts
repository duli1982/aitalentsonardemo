import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PlatformChannel = 'email' | 'whatsapp' | 'phone';
export type LanguageCode = 'en' | 'de' | 'fr' | 'es' | 'it' | 'he' | 'hu' | 'pl' | 'cs' | 'sk';

export type LanguageAssessment = {
  id: string; token: string; organizationId: string; candidateId: string; candidateName: string; candidateEmail?: string;
  language: LanguageCode; languageLabel: string; requestedLevel: string; provider: 'internal' | 'external'; providerAssessmentId?: string;
  status: 'draft' | 'invited' | 'in_progress' | 'submitted' | 'awaiting_review' | 'reviewed' | 'cancelled';
  scores?: { reading?: number; writing?: number; listening?: number; speaking?: number; overall: number; cefr: string };
  evidence?: string[]; reviewerId?: string; reviewDecision?: 'verified' | 'needs_follow_up'; reviewNote?: string;
  autoDeclineBlocked: true; createdAt: string; updatedAt: string; submittedAt?: string;
};

export type PhoneSession = {
  id: string; token: string; organizationId: string; candidateId: string; candidateName: string; candidateEmail?: string; candidatePhone?: string;
  jobId?: string; jobTitle?: string; timezone: string; durationMinutes: number; availableSlots: string[]; scheduledAt?: string;
  questions: string[];
  recordingConsent: boolean; consentCapturedAt?: string; status: 'draft' | 'availability_open' | 'scheduled' | 'calling' | 'completed' | 'failed' | 'cancelled';
  provider: 'twilio_voice' | 'manual'; providerCallId?: string; recordingUrl?: string; transcript?: string;
  evidence?: Array<{ requirement: string; finding: string; transcriptExcerpt: string; confidence: number }>;
  fraud?: { provider: 'external' | 'not_configured'; status: 'not_run' | 'pending' | 'clear' | 'review' | 'unavailable'; signals: string[]; checkedAt?: string };
  humanReviewRequired: true; createdAt: string; updatedAt: string;
};

export type NavigatorItem = {
  id: string; organizationId: string; candidateId: string; candidateName: string; type: 'registration' | 'ats_application' | 'hiring_day' | 'job_alert' | 'status_query' | 'recruiter_escalation';
  title: string; detail: string; status: 'open' | 'waiting_candidate' | 'waiting_recruiter' | 'completed' | 'dismissed';
  dueAt?: string; jobId?: string; externalUrl?: string; ownerUserId?: string; createdAt: string; updatedAt: string;
};

export type Journey = {
  id: string; organizationId: string; candidateId: string; candidateName: string; channel: PlatformChannel; locale: string; timezone: string;
  preferredStartTime: string; preferredEndTime: string; quietDays: string[]; consentConfirmed: boolean; nextRunAt: string;
  message: string; status: 'draft' | 'approved' | 'active' | 'paused' | 'completed' | 'escalated'; attempts: number; lastRunAt?: string; lastResult?: string;
  approvedBy?: string; createdAt: string; updatedAt: string;
};

export type ConversationStore = { assessments: LanguageAssessment[]; phoneSessions: PhoneSession[]; navigatorItems: NavigatorItem[]; journeys: Journey[] };
const empty = (): ConversationStore => ({ assessments: [], phoneSessions: [], navigatorItems: [], journeys: [] });
const dataDir = path.resolve(process.cwd(), process.env.TALENT_SONAR_DATA_DIR || '.talent-sonar-data');
const locks = new Map<string, Promise<unknown>>();
const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'default';
const fileFor = (organizationId: string) => path.join(dataDir, `${safe(organizationId)}-conversation-platform.json`);

export const platformId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const platformNow = () => new Date().toISOString();

export async function readConversationStore(organizationId: string): Promise<ConversationStore> {
  try {
    const value = JSON.parse(await readFile(fileFor(organizationId), 'utf8')) as Partial<ConversationStore>;
    return {
      assessments: Array.isArray(value.assessments) ? value.assessments : [],
      phoneSessions: Array.isArray(value.phoneSessions) ? value.phoneSessions.map((item) => ({ ...item, questions: Array.isArray(item.questions) ? item.questions : [] })) : [],
      navigatorItems: Array.isArray(value.navigatorItems) ? value.navigatorItems : [],
      journeys: Array.isArray(value.journeys) ? value.journeys : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty();
    throw error;
  }
}

export async function updateConversationStore<T>(organizationId: string, mutate: (store: ConversationStore) => Promise<T> | T): Promise<T> {
  const previous = locks.get(organizationId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current); locks.set(organizationId, queued);
  await previous;
  try {
    const store = await readConversationStore(organizationId);
    const result = await mutate(store);
    await mkdir(dataDir, { recursive: true });
    const target = fileFor(organizationId); const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, JSON.stringify(store, null, 2), 'utf8');
    await rename(temp, target);
    return result;
  } finally {
    release();
    if (locks.get(organizationId) === queued) locks.delete(organizationId);
  }
}
