import type { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { getEnv } from './ai/_lib/env';
import { universalHandler } from './_lib/universalHandler';

const providers = ['twilio', 'meta_whatsapp'] as const;
const schema = z.object({ provider: z.enum(providers), organizationId: z.string().min(1).max(200), sessionId: z.string().min(1).max(200), candidateId: z.string().min(1).max(200), to: z.string().min(7).max(40), body: z.string().min(1).max(4000), consentConfirmed: z.literal(true), approvedBy: z.string().min(1).max(200) });
const send = (res: ServerResponse, status: number, body: Record<string, unknown>) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
async function json(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length; if (size > 64 * 1024) throw new Error('Request too large.'); chunks.push(part); } return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
const configured = () => ({ twilio: Boolean(getEnv('TWILIO_ACCOUNT_SID') && getEnv('TWILIO_AUTH_TOKEN') && getEnv('TWILIO_WHATSAPP_FROM')), meta_whatsapp: Boolean(getEnv('META_WHATSAPP_TOKEN') && getEnv('META_WHATSAPP_PHONE_NUMBER_ID')) });

async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') return send(res, 200, { ok: true, providers: configured(), webhookVerification: { twilio: Boolean(getEnv('TWILIO_AUTH_TOKEN') && getEnv('TWILIO_WEBHOOK_PUBLIC_URL')), meta_whatsapp: Boolean(getEnv('META_WHATSAPP_APP_SECRET') && getEnv('META_WHATSAPP_VERIFY_TOKEN')) } });
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'GET or POST only.' });
  try {
    const parsed = schema.safeParse(await json(req));
    if (!parsed.success) return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid communication request.' });
    const data = parsed.data;
    if (!configured()[data.provider]) return send(res, 409, { ok: false, errorCode: 'NOT_CONFIGURED', message: `${data.provider} is not configured on the server.` });
    if (data.provider === 'twilio') {
      const sid = getEnv('TWILIO_ACCOUNT_SID')!; const token = getEnv('TWILIO_AUTH_TOKEN')!; const from = getEnv('TWILIO_WHATSAPP_FROM')!;
      const form = new URLSearchParams({ To: data.to.startsWith('whatsapp:') ? data.to : `whatsapp:${data.to}`, From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`, Body: data.body, StatusCallback: getEnv('TWILIO_STATUS_CALLBACK_URL') ?? '' });
      if (!form.get('StatusCallback')) form.delete('StatusCallback');
      const upstream = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const result = await upstream.json().catch(() => ({})) as Record<string, unknown>;
      if (!upstream.ok) return send(res, 502, { ok: false, errorCode: 'PROVIDER_REJECTED', message: String(result.message ?? `Twilio returned ${upstream.status}.`) });
      return send(res, 200, { ok: true, provider: data.provider, externalId: result.sid, status: result.status, sentAt: new Date().toISOString() });
    }
    const phoneId = getEnv('META_WHATSAPP_PHONE_NUMBER_ID')!; const token = getEnv('META_WHATSAPP_TOKEN')!;
    const upstream = await fetch(`https://graph.facebook.com/${getEnv('META_GRAPH_VERSION') ?? 'v21.0'}/${encodeURIComponent(phoneId)}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: data.to.replace(/\D/g, ''), type: 'text', text: { preview_url: false, body: data.body } }) });
    const result = await upstream.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
    if (!upstream.ok) return send(res, 502, { ok: false, errorCode: 'PROVIDER_REJECTED', message: result.error?.message ?? `Meta returned ${upstream.status}.` });
    return send(res, 200, { ok: true, provider: data.provider, externalId: result.messages?.[0]?.id, status: 'accepted', sentAt: new Date().toISOString() });
  } catch (error) { return send(res, error instanceof Error && error.message === 'Request too large.' ? 413 : 500, { ok: false, errorCode: 'SEND_FAILED', message: error instanceof Error ? error.message : 'Communication failed.' }); }
}

export default universalHandler(handler);
