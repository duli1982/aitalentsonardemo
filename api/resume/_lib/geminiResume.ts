import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';
import { getEnv, getGeminiApiKey } from './env';
import { sanitizeForPrompt, buildSecurePrompt } from '../../../utils/promptSecurity';
import { validateParsedResume } from '../../../utils/outputValidation';

export type ParsedResume = {
  name: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: Array<{ title: string; company?: string; duration?: string; description?: string }>;
  education: Array<{ degree?: string; institution?: string; year?: string }>;
  summary: string;
};

type RateLimitResult = { retryAfterMs: number; message: string };

function isRateLimited(error: unknown): boolean {
  const anyErr = error as any;
  const code = anyErr?.status || anyErr?.code || anyErr?.error?.code;
  const rawMessage = String(anyErr?.message || anyErr?.error?.message || error);
  return code === 429 || rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429');
}

function parseRetryAfterMs(error: unknown): number | null {
  const rawMessage = String((error as any)?.message || '');
  const match = rawMessage.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  if (match?.[1]) return Math.max(1000, Number(match[1]) * 1000);
  return null;
}

function hashKey(...parts: string[]): string {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

const inflight = new Map<string, Promise<any>>();
const cache = new Map<string, { value: any; expiresAt: number }>();

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: any, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export class GeminiResumeService {
  private client: GoogleGenAI;
  private models: string[];

  constructor() {
    const key = getGeminiApiKey();
    if (!key) throw new Error('Missing Gemini API key (set GEMINI_API_KEY on server).');
    this.client = new GoogleGenAI({ apiKey: key });
    this.models = (getEnv('GEMINI_TEXT_MODELS')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3-flash',
    ]);
  }

  async parseResume(resumeText: string): Promise<
    | { ok: true; data: ParsedResume }
    | { ok: false; errorCode: 'RATE_LIMITED' | 'UPSTREAM'; message: string; retryAfterMs?: number }
  > {
    const key = hashKey('parse', resumeText.slice(0, 2048));
    const cached = cacheGet<ParsedResume>(key);
    if (cached) return { ok: true, data: cached };

    const existingInflight = inflight.get(key);
    if (existingInflight) return await existingInflight;

    const run = (async () => {
      for (const model of this.models) {
        try {
          const prompt = buildSecurePrompt({
            system: `You are a resume parser. Extract structured information from the resume text provided in the data block below.
Return a JSON object with these fields:
- name: string
- email: string (if found)
- phone: string (if found)
- skills: string[] (technical and soft skills)
- experience: array of {title, company, duration, description}
- education: array of {degree, institution, year}
- summary: string (2-3 sentence professional summary)`,
            dataBlocks: [
              { label: 'CANDIDATE_RESUME', content: sanitizeForPrompt(resumeText, 8000) }
            ],
            outputSpec: 'Return ONLY valid JSON matching the schema above. No markdown, no explanation, no extra keys.'
          });

          const response = await this.client.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  email: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                  experience: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        company: { type: Type.STRING },
                        duration: { type: Type.STRING },
                        description: { type: Type.STRING },
                      },
                      required: ['title'],
                    },
                  },
                  education: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        degree: { type: Type.STRING },
                        institution: { type: Type.STRING },
                        year: { type: Type.STRING },
                      },
                    },
                  },
                  summary: { type: Type.STRING },
                },
                required: ['name', 'skills', 'experience', 'education', 'summary'],
              },
            },
          });

          const parsed = JSON.parse(response.text) as ParsedResume;

          // Layer 5: Validate parsed resume output for leakage and anomalies.
          const resumeValidation = validateParsedResume(parsed);
          if (!resumeValidation.validation.valid) {
            console.warn(`[GeminiResumeService] Resume output failed validation (model=${model}).`);
          }

          cacheSet(key, parsed, 1000 * 60 * 10);
          return { ok: true as const, data: parsed };
        } catch (error) {
          if (isRateLimited(error)) {
            const retryAfterMs = parseRetryAfterMs(error) ?? 60_000;
            return {
              ok: false as const,
              errorCode: 'RATE_LIMITED' as const,
              message: `AI rate-limited; retry after ${Math.round(retryAfterMs / 1000)}s`,
              retryAfterMs,
            };
          }
          // Try next model
        }
      }

      return { ok: false as const, errorCode: 'UPSTREAM' as const, message: 'Failed to parse resume.' };
    })();

    inflight.set(key, run);
    try {
      return await run;
    } finally {
      inflight.delete(key);
    }
  }

  async embed(text: string): Promise<
    | { ok: true; vector: number[] }
    | { ok: false; errorCode: 'RATE_LIMITED' | 'UPSTREAM'; message: string; retryAfterMs?: number }
  > {
    const key = hashKey('embed', text.slice(0, 2048));
    const cached = cacheGet<number[]>(key);
    if (cached) return { ok: true, vector: cached };

    const existingInflight = inflight.get(key);
    if (existingInflight) return await existingInflight;

    const run = (async () => {
      try {
        const result = await this.client.models.embedContent({ model: 'text-embedding-004', contents: text });
        const response = result as any;
        const values: number[] | undefined = response.embeddings?.[0]?.values || response.embedding?.values;
        if (!values) return { ok: false as const, errorCode: 'UPSTREAM' as const, message: 'No embedding returned.' };
        cacheSet(key, values, 1000 * 60 * 30);
        return { ok: true as const, vector: values };
      } catch (error) {
        if (isRateLimited(error)) {
          const retryAfterMs = parseRetryAfterMs(error) ?? 60_000;
          return {
            ok: false as const,
            errorCode: 'RATE_LIMITED' as const,
            message: `AI rate-limited; retry after ${Math.round(retryAfterMs / 1000)}s`,
            retryAfterMs,
          };
        }
        return { ok: false as const, errorCode: 'UPSTREAM' as const, message: 'Embedding failed.' };
      }
    })();

    inflight.set(key, run);
    try {
      return await run;
    } finally {
      inflight.delete(key);
    }
  }
}

