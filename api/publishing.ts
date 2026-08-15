import type { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { getEnv } from './ai/_lib/env';

const providers = ['greenhouse', 'lever', 'facebook'] as const;
type Provider = typeof providers[number];
const requestSchema = z.object({ provider: z.enum(providers), campaignId: z.string().min(1).max(200), contentId: z.string().min(1).max(200), approvedBy: z.string().min(1).max(200), payload: z.object({ headline: z.string().max(500), body: z.string().max(12_000), callToAction: z.string().max(500), landingUrl: z.string().url(), targetSkills: z.array(z.string().max(100)).max(40), location: z.string().max(300).optional() }) });
const config = (provider: Provider) => ({ url: getEnv(`${provider.toUpperCase()}_PUBLISH_WEBHOOK_URL`), token: getEnv(`${provider.toUpperCase()}_PUBLISH_WEBHOOK_TOKEN`) });
const send = (res: ServerResponse, status: number, body: Record<string, unknown>) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
async function readJson(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += buffer.length; if (size > 64 * 1024) throw new Error('Request body is too large.'); chunks.push(buffer); } return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') return send(res, 200, { ok: true, providers: Object.fromEntries(providers.map((provider) => [provider, { configured: Boolean(config(provider).url), mode: 'server_webhook' }])) });
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'GET or POST only.' });
  try {
    const parsed = requestSchema.safeParse(await readJson(req));
    if (!parsed.success) return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid publishing request.' });
    const connector = config(parsed.data.provider);
    if (!connector.url) return send(res, 409, { ok: false, errorCode: 'NOT_CONFIGURED', message: `${parsed.data.provider} publishing is not configured on the server.` });
    const url = new URL(connector.url);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return send(res, 400, { ok: false, errorCode: 'UNSAFE_CONNECTOR', message: 'Publishing webhooks must use HTTPS.' });
    const upstream = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(connector.token ? { Authorization: `Bearer ${connector.token}` } : {}) }, body: JSON.stringify(parsed.data) });
    if (!upstream.ok) return send(res, 502, { ok: false, errorCode: 'PROVIDER_REJECTED', message: `${parsed.data.provider} connector returned ${upstream.status}.` });
    return send(res, 200, { ok: true, provider: parsed.data.provider, externalId: upstream.headers.get('x-external-id') ?? undefined, publishedAt: new Date().toISOString() });
  } catch (error) { return send(res, error instanceof Error && error.message === 'Request body is too large.' ? 413 : 500, { ok: false, errorCode: 'PUBLISH_FAILED', message: error instanceof Error ? error.message : 'Publishing failed.' }); }
}
