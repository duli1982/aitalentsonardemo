import type { IncomingMessage, ServerResponse } from 'http';
import { GeminiResumeService } from './_lib/geminiResume';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';

type ApplyRequest = { candidateId: string; documentId: number };

type ApplyResponse =
  | { ok: true; candidateId: string; documentId: number }
  | { ok: false; errorCode: string; message: string; retryAfterMs?: number };

function send(res: ServerResponse, status: number, body: ApplyResponse) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'POST only.' });

  try {
    const body = (await readJson(req)) as ApplyRequest;
    if (!body?.candidateId || !body?.documentId) {
      return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: 'candidateId and documentId required.' });
    }

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
    if (embedded.ok === false) {
      const { errorCode, message, retryAfterMs } = embedded;
      return send(res, 429, { ok: false, errorCode, message, retryAfterMs });
    }

    const parsedResume = (doc.metadata as any)?.parsed_resume;
    const fullName = typeof parsedResume?.name === 'string' ? parsedResume.name.trim() : null;
    const email = typeof parsedResume?.email === 'string' ? parsedResume.email.trim().toLowerCase() : null;
    const skills = Array.isArray(parsedResume?.skills) ? parsedResume.skills.map((s: any) => String(s)).filter(Boolean) : null;

    // Ensure only one active document per candidate.
    await supabase
      .from('candidate_documents')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('candidate_id', body.candidateId)
      .neq('id', body.documentId);

    const { error: updateDocErr } = await supabase
      .from('candidate_documents')
      .update({
        embedding: embedded.vector,
        is_active: true,
        updated_at: new Date().toISOString(),
        metadata: { ...(doc.metadata as any), status: 'active' },
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
          ...(typeof candidate?.metadata === 'object' && candidate?.metadata ? (candidate.metadata as any) : {}),
          activated_from: 'resume_upload',
          activated_at: new Date().toISOString()
        }
      })
      .eq('id', body.candidateId);
    if (updateCandidateErr) throw updateCandidateErr;

    return send(res, 200, { ok: true, candidateId: body.candidateId, documentId: body.documentId });
  } catch (error: any) {
    return send(res, 500, { ok: false, errorCode: 'UPSTREAM', message: String(error?.message || error) });
  }
}
