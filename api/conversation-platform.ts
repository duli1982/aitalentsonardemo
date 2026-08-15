import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { getEnv } from './ai/_lib/env';
import { platformId, platformNow, readConversationStore, updateConversationStore, type LanguageAssessment, type LanguageCode } from './_lib/conversationStore';
import { universalHandler } from './_lib/universalHandler';

const languages: Record<LanguageCode, string> = { en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', he: 'Hebrew', hu: 'Hungarian', pl: 'Polish', cs: 'Czech', sk: 'Slovak' };
const languageCodes = Object.keys(languages) as [LanguageCode, ...LanguageCode[]];
const send = (res: ServerResponse, status: number, body: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
async function body(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length; if (size > 256 * 1024) throw new Error('Request too large.'); chunks.push(part); } return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>; }
const base = z.object({ action: z.string(), organizationId: z.string().min(1).max(200), actorUserId: z.string().min(1).max(200).optional() });
const configured = () => ({
  // Vercel's /tmp directory prevents invocation failures but is ephemeral.
  // Do not present it as durable storage in the product UI.
  durableStorage: !process.env.VERCEL,
  assessmentProvider: Boolean(getEnv('LANGUAGE_ASSESSMENT_PROVIDER_URL') && getEnv('LANGUAGE_ASSESSMENT_PROVIDER_TOKEN')),
  twilioVoice: Boolean(getEnv('TWILIO_ACCOUNT_SID') && getEnv('TWILIO_AUTH_TOKEN') && getEnv('TWILIO_VOICE_FROM') && getEnv('TWILIO_VOICE_TWIML_URL')),
  transcription: Boolean(getEnv('TRANSCRIPTION_PROVIDER_URL') && getEnv('TRANSCRIPTION_PROVIDER_TOKEN')),
  fraudLiveness: Boolean(getEnv('VOICE_LIVENESS_PROVIDER_URL') && getEnv('VOICE_LIVENESS_PROVIDER_TOKEN')),
  journeyDelivery: Boolean(getEnv('ENGAGEMENT_DELIVERY_WEBHOOK_URL') && getEnv('ENGAGEMENT_DELIVERY_WEBHOOK_TOKEN')),
});
async function providerPost(url: string, token: string, payload: unknown) { const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(String((result as { message?: string }).message || `Provider returned ${response.status}.`)); return result as Record<string, unknown>; }
const pick = <T extends { id: string }>(items: T[], id: string) => { const item = items.find((entry) => entry.id === id); if (!item) throw new Error('Record not found.'); return item; };

export async function runConversationWorker(organizationId: string) {
  return updateConversationStore(organizationId, async (store) => {
    const due = store.journeys.filter((item) => item.status === 'active' && item.nextRunAt <= platformNow()); let delivered = 0; let escalated = 0;
    for (const journey of due) {
      journey.lastRunAt = platformNow(); journey.attempts += 1; journey.updatedAt = platformNow();
      const weekday = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: journey.timezone || 'UTC' }).format(new Date());
      if (!journey.consentConfirmed || journey.quietDays.includes(weekday)) { journey.status = 'escalated'; journey.lastResult = !journey.consentConfirmed ? 'Consent missing; recruiter review required.' : `Quiet period (${weekday}); recruiter review required.`; escalated += 1; continue; }
      const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: journey.timezone || 'UTC' }).formatToParts(new Date()); const currentMinutes = Number(parts.find((item) => item.type === 'hour')?.value || 0) * 60 + Number(parts.find((item) => item.type === 'minute')?.value || 0); const [startHour, startMinute] = journey.preferredStartTime.split(':').map(Number); const [endHour, endMinute] = journey.preferredEndTime.split(':').map(Number); const start = startHour * 60 + startMinute; const end = endHour * 60 + endMinute;
      if (currentMinutes < start || currentMinutes > end) { journey.nextRunAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); journey.lastResult = `Deferred outside preferred hours (${journey.preferredStartTime}–${journey.preferredEndTime}).`; continue; }
      const url = getEnv('ENGAGEMENT_DELIVERY_WEBHOOK_URL'); const token = getEnv('ENGAGEMENT_DELIVERY_WEBHOOK_TOKEN');
      if (!url || !token) { journey.status = 'escalated'; journey.lastResult = 'Delivery provider is not configured.'; escalated += 1; continue; }
      try { await providerPost(url, token, { organizationId, candidateId: journey.candidateId, channel: journey.channel, locale: journey.locale, message: journey.message }); journey.status = 'completed'; journey.lastResult = 'Delivered by configured provider.'; delivered += 1; }
      catch (error) { journey.status = 'escalated'; journey.lastResult = error instanceof Error ? error.message : 'Delivery failed.'; escalated += 1; }
    }
    return { processed: due.length, delivered, escalated };
  });
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/', 'http://localhost'); const organizationId = url.searchParams.get('organizationId') || '';
    if (req.method === 'GET') {
      if (!organizationId) return send(res, 400, { ok: false, message: 'organizationId is required.' });
      const token = url.searchParams.get('token'); const store = await readConversationStore(organizationId);
      if (token) return send(res, 200, { ok: true, assessment: store.assessments.find((item) => item.token === token), phoneSession: store.phoneSessions.find((item) => item.token === token) });
      return send(res, 200, { ok: true, store, providers: configured(), languages });
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'GET or POST only.' });
    const raw = await body(req); const parsedBase = base.safeParse(raw); if (!parsedBase.success) return send(res, 400, { ok: false, message: parsedBase.error.issues[0]?.message || 'Invalid request.' });
    const { action, organizationId: org, actorUserId } = parsedBase.data; const timestamp = platformNow();
    if (action === 'run_worker') return send(res, 200, { ok: true, result: await runConversationWorker(org) });
    const result = await updateConversationStore(org, async (store) => {
      if (action === 'create_assessment') {
        const input = z.object({ candidateId: z.string(), candidateName: z.string(), candidateEmail: z.string().optional(), language: z.enum(languageCodes), requestedLevel: z.string().default('B2') }).parse(raw);
        const assessment: LanguageAssessment = { id: platformId(), token: platformId(), organizationId: org, candidateId: input.candidateId, candidateName: input.candidateName, candidateEmail: input.candidateEmail, language: input.language, languageLabel: languages[input.language], requestedLevel: input.requestedLevel, provider: configured().assessmentProvider ? 'external' : 'internal', status: 'invited', autoDeclineBlocked: true, createdAt: timestamp, updatedAt: timestamp };
        if (configured().assessmentProvider) { const response = await providerPost(getEnv('LANGUAGE_ASSESSMENT_PROVIDER_URL')!, getEnv('LANGUAGE_ASSESSMENT_PROVIDER_TOKEN')!, { ...assessment, callbackUrl: getEnv('LANGUAGE_ASSESSMENT_CALLBACK_URL') }); assessment.providerAssessmentId = String(response.id || response.assessmentId || ''); }
        store.assessments.unshift(assessment); return assessment;
      }
      if (action === 'submit_assessment') {
        const input = z.object({ token: z.string(), scores: z.object({ reading: z.number().min(0).max(100).optional(), writing: z.number().min(0).max(100).optional(), listening: z.number().min(0).max(100).optional(), speaking: z.number().min(0).max(100).optional(), overall: z.number().min(0).max(100), cefr: z.string() }), evidence: z.array(z.string()).default([]) }).parse(raw);
        const assessment = store.assessments.find((item) => item.token === input.token); if (!assessment) throw new Error('Assessment not found.'); Object.assign(assessment, { scores: input.scores, evidence: input.evidence, status: 'awaiting_review', submittedAt: timestamp, updatedAt: timestamp }); return assessment;
      }
      if (action === 'review_assessment') {
        const input = z.object({ assessmentId: z.string(), decision: z.enum(['verified', 'needs_follow_up']), note: z.string().default('') }).parse(raw); const assessment = pick(store.assessments, input.assessmentId); Object.assign(assessment, { status: 'reviewed', reviewerId: actorUserId, reviewDecision: input.decision, reviewNote: input.note, updatedAt: timestamp }); return assessment;
      }
      if (action === 'create_phone_session') {
        const input = z.object({ candidateId: z.string(), candidateName: z.string(), candidateEmail: z.string().optional(), candidatePhone: z.string().optional(), jobId: z.string().optional(), jobTitle: z.string().optional(), timezone: z.string(), durationMinutes: z.number().min(10).max(120), availableSlots: z.array(z.string()).min(1), requirements: z.array(z.string()).default([]) }).parse(raw);
        const questions = input.requirements.slice(0, 6).map((requirement) => `Please describe a recent example that demonstrates ${requirement}, including your actions and the result.`); if (!questions.length) questions.push('Please describe the experience most relevant to this opportunity and the measurable result.', 'What availability, location or working-pattern constraints should the recruiter consider?');
        const session = { id: platformId(), token: platformId(), organizationId: org, ...input, questions, recordingConsent: false, status: 'availability_open' as const, provider: configured().twilioVoice ? 'twilio_voice' as const : 'manual' as const, fraud: { provider: configured().fraudLiveness ? 'external' as const : 'not_configured' as const, status: 'not_run' as const, signals: [] }, humanReviewRequired: true as const, createdAt: timestamp, updatedAt: timestamp }; store.phoneSessions.unshift(session); return session;
      }
      if (action === 'schedule_phone') { const input = z.object({ token: z.string(), scheduledAt: z.string(), recordingConsent: z.literal(true) }).parse(raw); const session = store.phoneSessions.find((item) => item.token === input.token); if (!session || !session.availableSlots.includes(input.scheduledAt)) throw new Error('The selected slot is unavailable.'); Object.assign(session, { scheduledAt: input.scheduledAt, recordingConsent: true, consentCapturedAt: timestamp, status: 'scheduled', updatedAt: timestamp }); return session; }
      if (action === 'start_phone') {
        const input = z.object({ phoneSessionId: z.string() }).parse(raw); const session = pick(store.phoneSessions, input.phoneSessionId); if (!session.recordingConsent) throw new Error('Recording consent is required.'); if (!configured().twilioVoice || !session.candidatePhone) throw new Error('Twilio Voice and a candidate phone number are required.');
        const sid = getEnv('TWILIO_ACCOUNT_SID')!; const twimlUrl = new URL(getEnv('TWILIO_VOICE_TWIML_URL')!); twimlUrl.searchParams.set('organizationId', org); twimlUrl.searchParams.set('phoneSessionId', session.id); const form = new URLSearchParams({ To: session.candidatePhone, From: getEnv('TWILIO_VOICE_FROM')!, Url: twimlUrl.toString(), Record: 'true', RecordingStatusCallback: getEnv('TWILIO_VOICE_RECORDING_CALLBACK_URL') || '', StatusCallback: getEnv('TWILIO_VOICE_STATUS_CALLBACK_URL') || '' });
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${sid}:${getEnv('TWILIO_AUTH_TOKEN')}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form }); const provider = await response.json() as { sid?: string; message?: string }; if (!response.ok) throw new Error(provider.message || 'Voice provider rejected the call.'); Object.assign(session, { status: 'calling', providerCallId: provider.sid, updatedAt: timestamp }); return session;
      }
      if (action === 'ingest_transcript') { const input = z.object({ phoneSessionId: z.string(), transcript: z.string().min(1), recordingUrl: z.string().optional(), requirements: z.array(z.string()).default([]) }).parse(raw); const session = pick(store.phoneSessions, input.phoneSessionId); const sentences = input.transcript.split(/(?<=[.!?])\s+/); session.transcript = input.transcript; session.recordingUrl = input.recordingUrl; session.evidence = input.requirements.map((requirement) => { const excerpt = sentences.find((sentence) => sentence.toLowerCase().includes(requirement.toLowerCase())) || 'No direct transcript evidence found.'; return { requirement, finding: excerpt.startsWith('No direct') ? 'Requires human follow-up' : 'Relevant evidence identified', transcriptExcerpt: excerpt, confidence: excerpt.startsWith('No direct') ? 0 : 0.65 }; }); session.status = 'completed'; session.updatedAt = timestamp; return session; }
      if (action === 'run_fraud_check') { const input = z.object({ phoneSessionId: z.string() }).parse(raw); const session = pick(store.phoneSessions, input.phoneSessionId); if (!configured().fraudLiveness || !session.recordingUrl) { session.fraud = { provider: 'not_configured', status: 'unavailable', signals: ['Specialist voice-liveness provider and recording URL are required.'], checkedAt: timestamp }; return session; } const response = await providerPost(getEnv('VOICE_LIVENESS_PROVIDER_URL')!, getEnv('VOICE_LIVENESS_PROVIDER_TOKEN')!, { recordingUrl: session.recordingUrl, sessionId: session.id }); session.fraud = { provider: 'external', status: response.status === 'clear' ? 'clear' : 'review', signals: Array.isArray(response.signals) ? response.signals.map(String) : [], checkedAt: timestamp }; return session; }
      if (action === 'create_navigator_item') { const input = z.object({ candidateId: z.string(), candidateName: z.string(), type: z.enum(['registration', 'ats_application', 'hiring_day', 'job_alert', 'status_query', 'recruiter_escalation']), title: z.string(), detail: z.string(), dueAt: z.string().optional(), jobId: z.string().optional(), externalUrl: z.string().optional(), ownerUserId: z.string().optional() }).parse(raw); const item = { id: platformId(), organizationId: org, ...input, status: 'open' as const, createdAt: timestamp, updatedAt: timestamp }; store.navigatorItems.unshift(item); return item; }
      if (action === 'update_navigator_item') { const input = z.object({ itemId: z.string(), status: z.enum(['open', 'waiting_candidate', 'waiting_recruiter', 'completed', 'dismissed']) }).parse(raw); const item = pick(store.navigatorItems, input.itemId); item.status = input.status; item.updatedAt = timestamp; return item; }
      if (action === 'create_journey') { const input = z.object({ candidateId: z.string(), candidateName: z.string(), channel: z.enum(['email', 'whatsapp', 'phone']), locale: z.string(), timezone: z.string(), preferredStartTime: z.string(), preferredEndTime: z.string(), quietDays: z.array(z.string()), consentConfirmed: z.boolean(), nextRunAt: z.string(), message: z.string().min(1) }).parse(raw); const journey = { id: platformId(), organizationId: org, ...input, status: 'draft' as const, attempts: 0, createdAt: timestamp, updatedAt: timestamp }; store.journeys.unshift(journey); return journey; }
      if (action === 'approve_journey') { const input = z.object({ journeyId: z.string() }).parse(raw); const journey = pick(store.journeys, input.journeyId); if (!journey.consentConfirmed) throw new Error('Current candidate consent is required.'); journey.status = 'active'; journey.approvedBy = actorUserId; journey.updatedAt = timestamp; return journey; }
      throw new Error(`Unsupported action: ${action}`);
    });
    return send(res, 200, { ok: true, result });
  } catch (error) { return send(res, error instanceof Error && error.message === 'Request too large.' ? 413 : 400, { ok: false, message: error instanceof Error ? error.message : 'Conversation platform request failed.' }); }
}

export default universalHandler(handler);
