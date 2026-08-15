type GatewayErrorPayload = { ok?: false; message?: string; errorCode?: string; retryAfterMs?: number };

export class AIGatewayClientError extends Error {
  constructor(message: string, public readonly code?: string, public readonly retryAfterMs?: number) {
    super(message);
    this.name = 'AIGatewayClientError';
  }
}

async function headers(organizationId: string): Promise<Record<string, string>> {
  if (!organizationId) throw new AIGatewayClientError('An active organization is required.');
  return { 'X-Talent-Sonar-Organization-Id': organizationId, 'Content-Type': 'application/json' };
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || body.ok !== true) {
    const error = (body || {}) as GatewayErrorPayload;
    throw new AIGatewayClientError(error.message || 'AI gateway request failed.', error.errorCode, error.retryAfterMs);
  }
  return body;
}

export async function generateWithAIGateway(params: {
  organizationId: string;
  purpose: 'analysis' | 'interview' | 'search' | 'summary' | 'resume_parse';
  prompt: string;
  responseSchema?: Record<string, unknown>;
}): Promise<string> {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: await headers(params.organizationId),
    body: JSON.stringify({ purpose: params.purpose, prompt: params.prompt, responseSchema: params.responseSchema }),
  });
  const body = await readResponse(response);
  return String(body.text || '');
}

export type ParsedResumeGatewayDraft = {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  location?: string;
  experienceYears?: number;
  skills: string[];
  summary: string;
  education: string[];
  languages: Array<{ language: string; level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'native' | 'unknown' }>;
};

export async function parseResumeWithAIGateway(params: { organizationId: string; file: File }): Promise<ParsedResumeGatewayDraft> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AIGatewayClientError('The selected file could not be read.'));
    reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
    reader.readAsDataURL(params.file);
  });
  const response = await fetch('/api/ai/parse-resume', {
    method: 'POST',
    headers: await headers(params.organizationId),
    body: JSON.stringify({ fileName: params.file.name, mimeType: params.file.type || 'application/octet-stream', base64 }),
  });
  return (await readResponse(response)).candidate as ParsedResumeGatewayDraft;
}

export async function embedWithAIGateway(params: {
  organizationId: string;
  purpose: 'candidate_search' | 'job_match' | 'candidate_document';
  text: string;
}): Promise<number[]> {
  const response = await fetch('/api/ai/embed', {
    method: 'POST',
    headers: await headers(params.organizationId),
    body: JSON.stringify({ purpose: params.purpose, text: params.text }),
  });
  const body = await readResponse(response);
  const embedding = body.embedding;
  if (!Array.isArray(embedding) || !embedding.every((value) => typeof value === 'number')) {
    throw new AIGatewayClientError('AI gateway returned an invalid embedding.');
  }
  return embedding;
}
