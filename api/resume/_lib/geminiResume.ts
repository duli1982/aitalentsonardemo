import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';
import { getEnv, getGeminiApiKey } from './env';
import { sanitizeForPrompt, buildSecurePrompt } from '../../../utils/promptSecurity';
import { validateParsedResume } from '../../../utils/outputValidation';
import { err, ok, type Result } from '../../../types/result';
import { notConfigured, rateLimited, unknown, upstream } from '../../../services/errorHandling';

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

const inflight = new Map<string, Promise<Result<unknown>>>();
const cache = new Map<string, { value: unknown; expiresAt: number }>();

function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export class GeminiResumeService {
  private client: GoogleGenAI | null;
  private models: string[];

  constructor() {
    const key = getGeminiApiKey();
    this.client = key ? new GoogleGenAI({ apiKey: key }) : null;
    this.models = (getEnv('GEMINI_TEXT_MODELS')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3-flash',
    ]);
  }

  async parseResume(resumeText: string): Promise<Result<ParsedResume>> {
    const client = this.client;
    if (!client) {
      return err(
        notConfigured('GeminiResumeService', 'Missing Gemini API key (set GEMINI_API_KEY on server).')
      );
    }

    const key = hashKey('parse', resumeText.slice(0, 2048));
    const cached = cacheGet<ParsedResume>(key);
    if (cached) return ok(cached);

    const existingInflight = inflight.get(key);
    if (existingInflight) return (await existingInflight) as Result<ParsedResume>;

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

          const response = await client.models.generateContent({
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

          const rawText = response.text;
          if (!rawText) {
            throw new Error(`Gemini returned empty parse payload (model=${model}).`);
          }
          const parsed = JSON.parse(rawText) as ParsedResume;

          // Layer 5: Validate parsed resume output for leakage and anomalies.
          const resumeValidation = validateParsedResume(parsed);
          if (!resumeValidation.validation.valid) {
            console.warn(`[GeminiResumeService] Resume output failed validation (model=${model}).`);
          }

          cacheSet(key, parsed, 1000 * 60 * 10);
          return ok(parsed);
        } catch (error) {
          if (isRateLimited(error)) {
            const retryAfterMs = parseRetryAfterMs(error) ?? 60_000;
            return err(
              rateLimited(
                'GeminiResumeService',
                `AI rate-limited while parsing resume with model "${model}"`,
                retryAfterMs,
                error,
                { model, retryAfterMs }
              ),
              { retryAfterMs }
            );
          }
          // Try next model
        }
      }

      return err(
        upstream(
          'GeminiResumeService',
          'All configured Gemini models failed while parsing resume.',
          undefined,
          { modelsTried: this.models }
        )
      );
    })();

    inflight.set(key, run as Promise<Result<unknown>>);
    try {
      return await run;
    } finally {
      inflight.delete(key);
    }
  }

  async embed(text: string): Promise<Result<number[]>> {
    const client = this.client;
    if (!client) {
      return err(
        notConfigured('GeminiResumeService', 'Missing Gemini API key (set GEMINI_API_KEY on server).')
      );
    }

    const key = hashKey('embed', text.slice(0, 2048));
    const cached = cacheGet<number[]>(key);
    if (cached) return ok(cached);

    const existingInflight = inflight.get(key);
    if (existingInflight) return (await existingInflight) as Result<number[]>;

    const run = (async () => {
      try {
        const result = await client.models.embedContent({ model: 'text-embedding-004', contents: text });
        const response = result as {
          embeddings?: Array<{ values?: number[] }>;
          embedding?: { values?: number[] };
        };
        const values: number[] | undefined = response.embeddings?.[0]?.values || response.embedding?.values;
        if (!values) {
          return err(
            upstream('GeminiResumeService', 'No embedding values were returned by Gemini.', undefined, { model: 'text-embedding-004' })
          );
        }
        cacheSet(key, values, 1000 * 60 * 30);
        return ok(values);
      } catch (error) {
        if (isRateLimited(error)) {
          const retryAfterMs = parseRetryAfterMs(error) ?? 60_000;
          return err(
            rateLimited(
              'GeminiResumeService',
              'AI rate-limited while creating embedding.',
              retryAfterMs,
              error,
              { model: 'text-embedding-004', retryAfterMs }
            ),
            { retryAfterMs }
          );
        }
        return err(unknown('GeminiResumeService', 'Embedding failed.', error, { model: 'text-embedding-004' }));
      }
    })();

    inflight.set(key, run as Promise<Result<unknown>>);
    try {
      return await run;
    } finally {
      inflight.delete(key);
    }
  }
}
