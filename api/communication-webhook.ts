import { createHmac, timingSafeEqual } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { getEnv } from './ai/_lib/env.js';
import { universalHandler } from './_lib/universalHandler.js';

const reply = (res: ServerResponse, status: number, body: Record<string, unknown> | string) => { res.statusCode = status; if (typeof body === 'string') { res.setHeader('Content-Type', 'text/plain'); res.end(body); } else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); } };
const safeEqual = (left: string, right: string) => { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); };
async function raw(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length; if (size > 256 * 1024) throw new Error('Request too large.'); chunks.push(part); } return Buffer.concat(chunks); }
async function forward(event: Record<string, unknown>) { const url = getEnv('COMMUNICATION_EVENT_SINK_URL'); if (!url) return; const target = new URL(url); if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Event sink must use HTTPS.'); await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(getEnv('COMMUNICATION_EVENT_SINK_TOKEN') ? { Authorization: `Bearer ${getEnv('COMMUNICATION_EVENT_SINK_TOKEN')}` } : {}) }, body: JSON.stringify(event) }); }

async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost'); const provider = url.searchParams.get('provider');
    if (provider === 'meta_whatsapp' && req.method === 'GET') {
      if (url.searchParams.get('hub.mode') !== 'subscribe' || !safeEqual(url.searchParams.get('hub.verify_token') ?? '', getEnv('META_WHATSAPP_VERIFY_TOKEN') ?? '')) return reply(res, 403, { ok: false });
      return reply(res, 200, url.searchParams.get('hub.challenge') ?? '');
    }
    if (req.method !== 'POST') return reply(res, 405, { ok: false, message: 'POST only.' });
    const body = await raw(req);
    if (provider === 'twilio') {
      const signature = String(req.headers['x-twilio-signature'] ?? ''); const authToken = getEnv('TWILIO_AUTH_TOKEN'); const publicUrl = getEnv('TWILIO_WEBHOOK_PUBLIC_URL');
      if (!signature || !authToken || !publicUrl) return reply(res, 503, { ok: false, errorCode: 'WEBHOOK_NOT_CONFIGURED' });
      const params = new URLSearchParams(body.toString('utf8')); const payload = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).reduce((value, [name, item]) => value + name + item, publicUrl);
      const expected = createHmac('sha1', authToken).update(payload).digest('base64');
      if (!safeEqual(signature, expected)) return reply(res, 401, { ok: false, errorCode: 'INVALID_SIGNATURE' });
      await forward({ provider, externalId: params.get('MessageSid'), status: params.get('MessageStatus'), to: params.get('To'), occurredAt: new Date().toISOString() });
      return reply(res, 200, { ok: true });
    }
    if (provider === 'meta_whatsapp') {
      const secret = getEnv('META_WHATSAPP_APP_SECRET'); const signature = String(req.headers['x-hub-signature-256'] ?? '');
      if (!secret || !signature) return reply(res, 503, { ok: false, errorCode: 'WEBHOOK_NOT_CONFIGURED' });
      const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
      if (!safeEqual(signature, expected)) return reply(res, 401, { ok: false, errorCode: 'INVALID_SIGNATURE' });
      const value = JSON.parse(body.toString('utf8') || '{}') as { entry?: Array<{ changes?: Array<{ value?: { statuses?: unknown[]; messages?: unknown[] } }> }> };
      await forward({ provider, payload: value.entry?.flatMap((entry) => entry.changes ?? []).map((change) => change.value) ?? [], occurredAt: new Date().toISOString() });
      return reply(res, 200, { ok: true });
    }
    return reply(res, 400, { ok: false, errorCode: 'UNKNOWN_PROVIDER' });
  } catch (error) { return reply(res, error instanceof Error && error.message === 'Request too large.' ? 413 : 500, { ok: false, message: error instanceof Error ? error.message : 'Webhook failed.' }); }
}

export default universalHandler(handler);
