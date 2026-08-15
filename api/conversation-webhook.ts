import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getEnv } from './ai/_lib/env';
import { platformNow, updateConversationStore } from './_lib/conversationStore';

const reply = (res: ServerResponse, status: number, value: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
const equal = (left: string, right: string) => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
async function raw(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length; if (size > 512 * 1024) throw new Error('Request too large.'); chunks.push(part); } return Buffer.concat(chunks); }
const bearerValid = (req: IncomingMessage) => { const expected = getEnv('CONVERSATION_WEBHOOK_TOKEN'); const actual = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); return Boolean(expected && actual && equal(actual, expected)); };

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'POST') return reply(res, 405, { ok: false, message: 'POST only.' });
    const url = new URL(req.url || '/', 'http://localhost'); const provider = url.searchParams.get('provider'); const organizationId = url.searchParams.get('organizationId') || '';
    if (!organizationId) return reply(res, 400, { ok: false, message: 'organizationId is required.' });
    const payload = await raw(req); const timestamp = platformNow();
    if (provider === 'twilio_voice') {
      const authToken = getEnv('TWILIO_AUTH_TOKEN'); const callbackUrl = getEnv('TWILIO_VOICE_RECORDING_CALLBACK_URL'); const signature = String(req.headers['x-twilio-signature'] || '');
      if (!authToken || !callbackUrl || !signature) return reply(res, 503, { ok: false, errorCode: 'WEBHOOK_NOT_CONFIGURED' });
      const params = new URLSearchParams(payload.toString('utf8')); const signed = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).reduce((value, [key, item]) => value + key + item, callbackUrl); const expected = createHmac('sha1', authToken).update(signed).digest('base64');
      if (!equal(signature, expected)) return reply(res, 401, { ok: false, errorCode: 'INVALID_SIGNATURE' });
      const callSid = params.get('CallSid'); const recordingUrl = params.get('RecordingUrl');
      await updateConversationStore(organizationId, (store) => { const session = store.phoneSessions.find((item) => item.providerCallId === callSid); if (!session) throw new Error('Phone session not found.'); if (recordingUrl) session.recordingUrl = recordingUrl; session.status = params.get('CallStatus') === 'failed' ? 'failed' : session.status; session.updatedAt = timestamp; });
      if (recordingUrl && getEnv('TRANSCRIPTION_PROVIDER_URL') && getEnv('TRANSCRIPTION_PROVIDER_TOKEN')) await fetch(getEnv('TRANSCRIPTION_PROVIDER_URL')!, { method: 'POST', headers: { Authorization: `Bearer ${getEnv('TRANSCRIPTION_PROVIDER_TOKEN')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, callId: callSid, recordingUrl, callbackUrl: getEnv('TRANSCRIPTION_CALLBACK_URL') }) });
      return reply(res, 200, { ok: true });
    }
    if (!bearerValid(req)) return reply(res, 401, { ok: false, errorCode: 'INVALID_SIGNATURE' });
    const value = JSON.parse(payload.toString('utf8') || '{}') as Record<string, unknown>;
    if (provider === 'language_assessment') {
      await updateConversationStore(organizationId, (store) => { const assessment = store.assessments.find((item) => item.providerAssessmentId === value.assessmentId || item.id === value.assessmentId); if (!assessment) throw new Error('Assessment not found.'); assessment.scores = value.scores as typeof assessment.scores; assessment.evidence = Array.isArray(value.evidence) ? value.evidence.map(String) : []; assessment.status = 'awaiting_review'; assessment.submittedAt = timestamp; assessment.updatedAt = timestamp; });
      return reply(res, 200, { ok: true, humanReviewRequired: true });
    }
    if (provider === 'transcription') {
      await updateConversationStore(organizationId, (store) => { const session = store.phoneSessions.find((item) => item.id === value.phoneSessionId || item.providerCallId === value.callId); if (!session) throw new Error('Phone session not found.'); session.transcript = String(value.transcript || ''); if (value.recordingUrl) session.recordingUrl = String(value.recordingUrl); session.status = 'completed'; session.updatedAt = timestamp; });
      return reply(res, 200, { ok: true, humanReviewRequired: true });
    }
    return reply(res, 400, { ok: false, errorCode: 'UNKNOWN_PROVIDER' });
  } catch (error) { return reply(res, error instanceof Error && error.message === 'Request too large.' ? 413 : 400, { ok: false, message: error instanceof Error ? error.message : 'Webhook failed.' }); }
}
