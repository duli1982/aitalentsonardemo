import type { IncomingMessage, ServerResponse } from 'http';
import { GeminiResumeService } from './_lib/geminiResume';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';

type ParseRequest = { candidateId: string; documentId: number };

type ParseResponse =
  | { ok: true; candidateId: string; documentId: number; parsedResume: any }
  | { ok: false; errorCode: string; message: string; retryAfterMs?: number };

function send(res: ServerResponse, status: number, body: ParseResponse) {
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
    const body = (await readJson(req)) as ParseRequest;
    if (!body?.candidateId || !body?.documentId) {
      return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: 'candidateId and documentId required.' });
    }

    const supabase = getSupabaseAdmin();
    const { data: doc, error: docErr } = await supabase
      .from('candidate_documents')
      .select('id, candidate_id, content, metadata')
      .eq('id', body.documentId)
      .single();
    if (docErr) throw docErr;
    if (String(doc.candidate_id) !== String(body.candidateId)) {
      return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: 'Document does not belong to candidate.' });
    }

    const content = typeof doc.content === 'string' ? doc.content : '';
    if (!content.trim()) {
      return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: 'Document has no content to parse.' });
    }

    const gemini = new GeminiResumeService();
    const parsed = await gemini.parseResume(content);
    if (!parsed.ok) {
      return send(res, 429, { ok: false, errorCode: parsed.errorCode, message: parsed.message, retryAfterMs: parsed.retryAfterMs });
    }

    const parsedResume = parsed.data;
    const parsedEmail = typeof parsedResume.email === 'string' ? parsedResume.email.trim().toLowerCase() : null;
    const parsedName = parsedResume.name?.trim() || 'Unknown Candidate';
    const parsedSkills = Array.isArray(parsedResume.skills) ? parsedResume.skills.map((s) => String(s)).filter(Boolean) : [];

    await supabase
      .from('candidates')
      .update({
        full_name: parsedName,
        email: parsedEmail,
        skills: parsedSkills,
        metadata: { source: 'resume_upload', draft: true, resume_parse: parsedResume },
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.candidateId);

    await supabase
      .from('candidate_documents')
      .update({
        metadata: { ...(doc.metadata as any), parsed_resume: parsedResume },
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.documentId);

    return send(res, 200, { ok: true, candidateId: body.candidateId, documentId: body.documentId, parsedResume });
  } catch (error: any) {
    return send(res, 500, { ok: false, errorCode: 'UPSTREAM', message: String(error?.message || error) });
  }
}

