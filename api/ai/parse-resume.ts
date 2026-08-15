import type { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { GeminiGateway, GeminiGatewayError } from './_lib/geminiGateway';
import { universalHandler } from '../_lib/universalHandler';

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const supported = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', 'application/octet-stream']);
const requestSchema = z.object({ fileName: z.string().trim().min(1).max(240), mimeType: z.string().trim().min(1).max(150), base64: z.string().min(1).max(11_000_000) });

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += buffer.length; if (size > MAX_BODY_BYTES) throw new Error('Request body is too large.'); chunks.push(buffer); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res: ServerResponse, status: number, body: Record<string, unknown>) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); }

const responseSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' }, email: { type: 'STRING' }, phone: { type: 'STRING' }, role: { type: 'STRING' }, location: { type: 'STRING' }, experienceYears: { type: 'NUMBER' }, summary: { type: 'STRING' },
    skills: { type: 'ARRAY', items: { type: 'STRING' } }, education: { type: 'ARRAY', items: { type: 'STRING' } },
    languages: { type: 'ARRAY', items: { type: 'OBJECT', properties: { language: { type: 'STRING' }, level: { type: 'STRING', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native', 'unknown'] } }, required: ['language', 'level'] } },
  },
  required: ['name', 'skills', 'summary', 'education', 'languages'],
};

async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'POST only.' });
  try {
    const parsed = requestSchema.safeParse(await readJson(req));
    if (!parsed.success) return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid resume request.' });
    if (!supported.has(parsed.data.mimeType)) return send(res, 415, { ok: false, errorCode: 'UNSUPPORTED_FILE', message: 'Only PDF, DOCX, TXT, and Markdown resumes are supported.' });
    const gateway = new GeminiGateway();
    const text = await gateway.parseAttachment({ requesterKey: String(req.headers['x-talent-sonar-organization-id'] || 'local-workspace'), ...parsed.data, responseSchema });
    return send(res, 200, { ok: true, candidate: JSON.parse(text) });
  } catch (error) {
    if (error instanceof GeminiGatewayError) return send(res, error.statusCode, { ok: false, errorCode: error.statusCode === 429 ? 'RATE_LIMITED' : 'UPSTREAM', message: error.message, retryAfterMs: error.retryAfterMs });
    const message = error instanceof Error ? error.message : 'Resume parsing failed.';
    return send(res, message === 'Request body is too large.' ? 413 : 500, { ok: false, errorCode: 'UPSTREAM', message });
  }
}

export default universalHandler(handler);
