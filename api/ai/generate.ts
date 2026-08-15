import type { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { GeminiGateway, GeminiGatewayError } from './_lib/geminiGateway.js';
import { universalHandler } from '../_lib/universalHandler.js';

const requestSchema = z.object({
  purpose: z.enum(['analysis', 'interview', 'search', 'summary', 'resume_parse']),
  prompt: z.string().trim().min(1, 'prompt is required.').max(16_000, 'prompt is too long.'),
  responseSchema: z.record(z.unknown()).optional(),
});

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function send(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'POST only.' });
  try {
    const body = requestSchema.safeParse(await readJson(req));
    if (!body.success) return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: body.error.issues[0]?.message || 'Invalid request.' });
    const gateway = new GeminiGateway();
    const text = await gateway.generate({
      requesterKey: String(req.headers['x-talent-sonar-organization-id'] || 'local-workspace'),
      prompt: body.data.prompt,
      responseSchema: body.data.responseSchema,
    });
    return send(res, 200, { ok: true, text });
  } catch (error) {
    if (error instanceof GeminiGatewayError) return send(res, error.statusCode, { ok: false, errorCode: error.statusCode === 429 ? 'RATE_LIMITED' : 'UPSTREAM', message: error.message, retryAfterMs: error.retryAfterMs });
    const message = error instanceof Error ? error.message : 'AI request failed.';
    return send(res, message === 'Request body is too large.' ? 413 : 500, { ok: false, errorCode: 'UPSTREAM', message });
  }
}

export default universalHandler(handler);
