import type { IncomingMessage, ServerResponse } from 'http';
import Busboy from 'busboy';
import { extractTextFromFile } from './_lib/textExtract';
import { GeminiResumeService } from './_lib/geminiResume';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';

type UploadResponse =
  | {
      ok: true;
      candidateId: string;
      documentId: number;
      parsedResume: any | null;
      parseStatus: 'PARSED' | 'PENDING_PARSE';
      retryAfterMs?: number;
      extracted: { bytes: number; sha256: string };
    }
  | { ok: false; errorCode: string; message: string; retryAfterMs?: number };

function send(res: ServerResponse, status: number, body: UploadResponse) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function parseMultipart(req: IncomingMessage): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  return await new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers as any,
      limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    });

    let fileName = 'resume';
    let mimeType = 'application/octet-stream';
    const chunks: Buffer[] = [];

    busboy.on('file', (_field, file, info) => {
      fileName = info.filename || fileName;
      mimeType = info.mimeType || mimeType;
      file.on('data', (d: Buffer) => chunks.push(d));
      file.on('limit', () => reject(new Error('File too large (max 15MB).')));
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (chunks.length === 0) return reject(new Error('No file uploaded.'));
      resolve({ buffer: Buffer.concat(chunks), fileName, mimeType });
    });

    req.pipe(busboy);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'POST only.' });

  try {
    const { buffer, fileName, mimeType } = await parseMultipart(req);
    const extracted = await extractTextFromFile(buffer, mimeType, fileName);

    const supabase = getSupabaseAdmin();
    const email = null;
    const fullName = 'Draft Candidate';
    const skills: string[] = [];

    const { data: candidateRow, error: candidateErr } = await supabase
      .from('candidates')
      .insert({
        full_name: fullName,
        email,
        skills,
        status: 'pending_review',
        metadata: {
          source: 'resume_upload',
          draft: true,
        },
      })
      .select('id')
      .single();

    if (candidateErr) throw candidateErr;

    const candidateId = String(candidateRow.id);

    const { data: docRow, error: docErr } = await supabase
      .from('candidate_documents')
      .insert({
        candidate_id: candidateId,
        is_active: false,
        source: 'resume_upload',
        content: extracted.text,
        metadata: {
          fileName,
          mimeType,
          sha256: extracted.sha256,
          bytes: extracted.bytes,
          status: 'pending_review',
          parsed_resume: null,
        },
      })
      .select('id')
      .single();

    if (docErr) throw docErr;

    // Best-effort parse immediately (keeps uploads durable even during rate limits).
    const gemini = new GeminiResumeService();
    const parsed = await gemini.parseResume(extracted.text);

    if (!parsed.ok) {
      return send(res, 200, {
        ok: true,
        candidateId,
        documentId: docRow.id,
        parsedResume: null,
        parseStatus: 'PENDING_PARSE',
        retryAfterMs: parsed.retryAfterMs,
        extracted: { bytes: extracted.bytes, sha256: extracted.sha256 },
      });
    }

    const parsedResume = parsed.data;
    const parsedEmail = typeof parsedResume.email === 'string' ? parsedResume.email.trim().toLowerCase() : null;
    const parsedName = parsedResume.name?.trim() || 'Unknown Candidate';
    const parsedSkills = Array.isArray(parsedResume.skills) ? parsedResume.skills.map((s) => String(s)).filter(Boolean) : [];

    // Dedupe: if this resume matches an existing candidate by email, attach the pending document there
    // and discard the temporary draft candidate.
    if (parsedEmail) {
      const existing = await supabase
        .from('candidates')
        .select('id')
        .eq('email', parsedEmail)
        .neq('id', candidateId)
        .limit(1);

      const existingId = existing.data?.[0]?.id ? String(existing.data[0].id) : null;
      if (existingId) {
        await supabase
          .from('candidate_documents')
          .update({
            candidate_id: existingId,
            metadata: {
              fileName,
              mimeType,
              sha256: extracted.sha256,
              bytes: extracted.bytes,
              status: 'pending_review',
              parsed_resume: parsedResume,
              attached_to_existing_candidate: true,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', docRow.id);

        await supabase.from('candidates').delete().eq('id', candidateId);

        return send(res, 200, {
          ok: true,
          candidateId: existingId,
          documentId: docRow.id,
          parsedResume,
          parseStatus: 'PARSED',
          extracted: { bytes: extracted.bytes, sha256: extracted.sha256 },
        });
      }
    }

    await supabase
      .from('candidates')
      .update({
        full_name: parsedName,
        email: parsedEmail,
        skills: parsedSkills,
        metadata: { source: 'resume_upload', draft: true, resume_parse: parsedResume },
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidateId);

    await supabase
      .from('candidate_documents')
      .update({
        metadata: {
          fileName,
          mimeType,
          sha256: extracted.sha256,
          bytes: extracted.bytes,
          status: 'pending_review',
          parsed_resume: parsedResume,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', docRow.id);

    return send(res, 200, {
      ok: true,
      candidateId,
      documentId: docRow.id,
      parsedResume,
      parseStatus: 'PARSED',
      extracted: { bytes: extracted.bytes, sha256: extracted.sha256 },
    });
  } catch (error: any) {
    return send(res, 500, { ok: false, errorCode: 'UPSTREAM', message: String(error?.message || error) });
  }
}
