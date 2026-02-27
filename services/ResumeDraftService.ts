import { err, ok, type Result } from '../types/result';
import { network, notConfigured, rateLimited, upstream, validation } from './errorHandling';

export type ResumeDraftUploadResult = {
  candidateId: string;
  documentId: number;
  parsedResume: unknown | null;
  parseStatus: 'PARSED' | 'PENDING_PARSE';
  retryAfterMs?: number;
  extracted: { bytes: number; sha256: string };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

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
    const json = asRecord(await res.json().catch(() => null));

    if (Object.keys(json).length === 0) return err(upstream('ResumeDraftService', 'Invalid server response.'));

    if (json.ok !== true) {
      const message = typeof json.message === 'string' ? json.message : undefined;
      const retryAfterMs = typeof json.retryAfterMs === 'number' ? json.retryAfterMs : undefined;
      if (json.errorCode === 'VALIDATION') return err(validation('ResumeDraftService', message ?? 'Invalid input.'));
      if (json.errorCode === 'RATE_LIMITED') return err(rateLimited('ResumeDraftService', message ?? 'Rate limited.', retryAfterMs), { retryAfterMs });
      return err(upstream('ResumeDraftService', message ?? 'Upload failed.'));
    }

    const extractedRecord = asRecord(json.extracted);
    return ok({
      candidateId: String(json.candidateId),
      documentId: Number(json.documentId),
      parsedResume: json.parsedResume ?? null,
      parseStatus: json.parseStatus === 'PENDING_PARSE' ? 'PENDING_PARSE' : 'PARSED',
      retryAfterMs: typeof json.retryAfterMs === 'number' ? json.retryAfterMs : undefined,
      extracted: {
        bytes: Number(extractedRecord.bytes ?? 0),
        sha256: String(extractedRecord.sha256 ?? '')
      },
    });
  } catch (e) {
    return err(network('ResumeDraftService', 'Failed to reach resume upload endpoint.', e));
  }
}

export async function retryParseResumeDraft(params: { candidateId: string; documentId: number }): Promise<Result<{ parsedResume: unknown }>> {
  try {
    const res = await fetch('/api/resume/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = asRecord(await res.json().catch(() => null));

    if (Object.keys(json).length === 0) return err(upstream('ResumeDraftService', 'Invalid server response.'));
    if (json.ok !== true) {
      const message = typeof json.message === 'string' ? json.message : undefined;
      const retryAfterMs = typeof json.retryAfterMs === 'number' ? json.retryAfterMs : undefined;
      if (json.errorCode === 'RATE_LIMITED') return err(rateLimited('ResumeDraftService', message ?? 'Rate limited.', retryAfterMs), { retryAfterMs });
      return err(upstream('ResumeDraftService', message ?? 'Parse failed.'));
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
    const json = asRecord(await res.json().catch(() => null));

    if (Object.keys(json).length === 0) return err(upstream('ResumeDraftService', 'Invalid server response.'));
    if (json.ok !== true) {
      const message = typeof json.message === 'string' ? json.message : undefined;
      const retryAfterMs = typeof json.retryAfterMs === 'number' ? json.retryAfterMs : undefined;
      if (json.errorCode === 'VALIDATION') return err(validation('ResumeDraftService', message ?? 'Invalid request.'));
      if (json.errorCode === 'RATE_LIMITED') return err(rateLimited('ResumeDraftService', message ?? 'Rate limited.', retryAfterMs), { retryAfterMs });
      return err(upstream('ResumeDraftService', message ?? 'Activation failed.'));
    }
    return ok(undefined);
  } catch (e) {
    return err(network('ResumeDraftService', 'Failed to reach resume apply endpoint.', e));
  }
}
