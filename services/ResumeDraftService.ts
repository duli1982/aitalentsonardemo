import { err, ok, type Result } from '../types/result';
import { network, notConfigured, rateLimited, upstream, validation } from './errorHandling';

export type ResumeDraftUploadResult = {
  candidateId: string;
  documentId: number;
  parsedResume: any | null;
  parseStatus: 'PARSED' | 'PENDING_PARSE';
  retryAfterMs?: number;
  extracted: { bytes: number; sha256: string };
};

export async function uploadResumeToDraft(file: File): Promise<Result<ResumeDraftUploadResult>> {
  try {
    const form = new FormData();
    form.append('file', file, file.name);

    const res = await fetch('/api/resume/upload', { method: 'POST', body: form });
    if (res.status === 404) {
      return err(
        notConfigured(
          'ResumeDraftService',
          'Server-side resume upload endpoint not found. In local dev, run `vercel dev` (or deploy to Vercel) to enable /api functions.'
        )
      );
    }
    const json = (await res.json().catch(() => null)) as any;

    if (!json) return err(upstream('ResumeDraftService', 'Invalid server response.'));

    if (json.ok !== true) {
      if (json.errorCode === 'VALIDATION') return err(validation('ResumeDraftService', json.message ?? 'Invalid input.'));
      if (json.errorCode === 'RATE_LIMITED') return err(rateLimited('ResumeDraftService', json.message ?? 'Rate limited.', json.retryAfterMs), { retryAfterMs: json.retryAfterMs });
      return err(upstream('ResumeDraftService', json.message ?? 'Upload failed.'));
    }

    return ok({
      candidateId: String(json.candidateId),
      documentId: Number(json.documentId),
      parsedResume: json.parsedResume ?? null,
      parseStatus: json.parseStatus === 'PENDING_PARSE' ? 'PENDING_PARSE' : 'PARSED',
      retryAfterMs: typeof json.retryAfterMs === 'number' ? json.retryAfterMs : undefined,
      extracted: json.extracted,
    });
  } catch (e) {
    return err(network('ResumeDraftService', 'Failed to reach resume upload endpoint.', e));
  }
}

export async function retryParseResumeDraft(params: { candidateId: string; documentId: number }): Promise<Result<{ parsedResume: any }>> {
  try {
    const res = await fetch('/api/resume/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = (await res.json().catch(() => null)) as any;

    if (!json) return err(upstream('ResumeDraftService', 'Invalid server response.'));
    if (json.ok !== true) {
      if (json.errorCode === 'RATE_LIMITED') return err(rateLimited('ResumeDraftService', json.message ?? 'Rate limited.', json.retryAfterMs), { retryAfterMs: json.retryAfterMs });
      return err(upstream('ResumeDraftService', json.message ?? 'Parse failed.'));
    }
    return ok({ parsedResume: json.parsedResume });
  } catch (e) {
    return err(network('ResumeDraftService', 'Failed to reach resume parse endpoint.', e));
  }
}

export async function applyResumeDraft(params: { candidateId: string; documentId: number }): Promise<Result<void>> {
  try {
    const res = await fetch('/api/resume/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = (await res.json().catch(() => null)) as any;

    if (!json) return err(upstream('ResumeDraftService', 'Invalid server response.'));
    if (json.ok !== true) {
      if (json.errorCode === 'VALIDATION') return err(validation('ResumeDraftService', json.message ?? 'Invalid request.'));
      if (json.errorCode === 'RATE_LIMITED') return err(rateLimited('ResumeDraftService', json.message ?? 'Rate limited.', json.retryAfterMs), { retryAfterMs: json.retryAfterMs });
      return err(upstream('ResumeDraftService', json.message ?? 'Activation failed.'));
    }
    return ok(undefined);
  } catch (e) {
    return err(network('ResumeDraftService', 'Failed to reach resume apply endpoint.', e));
  }
}
