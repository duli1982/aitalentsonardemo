import type { IncomingMessage, ServerResponse } from 'http';
import { GeminiResumeService } from './_lib/geminiResume';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import { z } from 'zod';

const applyRequestSchema = z.object({
  candidateId: z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .pipe(z.string().min(1, 'candidateId is required.')),
  documentId: z.coerce.number().int().positive('documentId must be a positive integer.'),
});

type ApplyRequest = z.infer<typeof applyRequestSchema>;

type ApplyResponse =
  | { ok: true; candidateId: string; documentId: number }
  | { ok: false; errorCode: string; message: string; retryAfterMs?: number };

function send(res: ServerResponse, status: number, body: ApplyResponse) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'POST only.' });

  try {
    let rawBody: unknown;
    try {
      rawBody = await readJson(req);
    } catch {
      return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: 'Request body must be valid JSON.' });
    }

    const parsedBody = applyRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      const message = parsedBody.error.issues[0]?.message || 'Invalid request body.';
      return send(res, 400, { ok: false, errorCode: 'VALIDATION', message });
    }
    const body: ApplyRequest = parsedBody.data;

    const supabase = getSupabaseAdmin();

    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .select('id, metadata')
      .eq('id', body.candidateId)
      .single();
    if (candErr) throw candErr;

    const { data: doc, error: docErr } = await supabase
      .from('candidate_documents')
      .select('id, candidate_id, content, metadata, is_active')
      .eq('id', body.documentId)
      .single();
    if (docErr) throw docErr;
    if (String(doc.candidate_id) !== String(body.candidateId)) {
      return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: 'Document does not belong to candidate.' });
    }

    const content = typeof doc.content === 'string' ? doc.content : '';
    if (!content.trim()) {
      return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: 'Document has no content to embed.' });
    }

    const gemini = new GeminiResumeService();
    const embedded = await gemini.embed(content);
    if (!embedded.success && 'error' in embedded) {
      const errorCode = embedded.error.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'UPSTREAM';
      const retryAfterMs =
        typeof embedded.error.details?.retryAfterMs === 'number' ? (embedded.error.details.retryAfterMs as number) : undefined;
      const message = embedded.error.message;
      const status = errorCode === 'RATE_LIMITED' ? 429 : 502;
      return send(res, status, { ok: false, errorCode, message, retryAfterMs });
    }

    const parsedResume = (doc.metadata as Record<string, unknown> | null | undefined)?.parsed_resume as
      | { name?: string; email?: string; skills?: unknown[] }
      | undefined;
    const fullName = typeof parsedResume?.name === 'string' ? parsedResume.name.trim() : null;
    const email = typeof parsedResume?.email === 'string' ? parsedResume.email.trim().toLowerCase() : null;
    const skills = Array.isArray(parsedResume?.skills) ? parsedResume.skills.map((s: unknown) => String(s)).filter(Boolean) : null;

    // Ensure only one active document per candidate.
    await supabase
      .from('candidate_documents')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('candidate_id', body.candidateId)
      .neq('id', body.documentId);

    const { error: updateDocErr } = await supabase
      .from('candidate_documents')
      .update({
        embedding: embedded.data,
        is_active: true,
        updated_at: new Date().toISOString(),
        metadata: { ...((doc.metadata as Record<string, unknown>) || {}), status: 'active' },
      })
      .eq('id', body.documentId);
    if (updateDocErr) throw updateDocErr;

    const { error: updateCandidateErr } = await supabase
      .from('candidates')
      .update({
        status: 'active',
        active_document_id: body.documentId,
        full_name: fullName ?? undefined,
        email: email ?? undefined,
        skills: skills ?? undefined,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(typeof candidate?.metadata === 'object' && candidate?.metadata ? (candidate.metadata as Record<string, unknown>) : {}),
          activated_from: 'resume_upload',
          activated_at: new Date().toISOString()
        }
      })
      .eq('id', body.candidateId);
    if (updateCandidateErr) throw updateCandidateErr;

    return send(res, 200, { ok: true, candidateId: body.candidateId, documentId: body.documentId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return send(res, 500, { ok: false, errorCode: 'UPSTREAM', message });
  }
}
