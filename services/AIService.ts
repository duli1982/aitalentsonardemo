// AIService - Gemini API integration for real AI capabilities
// Provides resume parsing, candidate Q&A, and text analysis

import { GoogleGenAI, Type } from '@google/genai';
import type { AppError } from '../types/errors';
import { err, ok, type Result } from '../types/result';
import { notConfigured, rateLimited, unknown } from './errorHandling';
import { sanitizeForPrompt, sanitizeArray, sanitizeShort, buildSecurePrompt } from '../utils/promptSecurity';
import { validateGenericOutput } from '../utils/outputValidation';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const DISABLE_AI = String(import.meta.env.VITE_DISABLE_AI || '').toLowerCase() === 'true';
const TEXT_MODELS_ENV = String(import.meta.env.VITE_GEMINI_TEXT_MODELS || '').trim();

interface ParsedResume {
    name: string;
    email?: string;
    phone?: string;
    skills: string[];
    experience: {
        title: string;
        company: string;
        duration: string;
        description: string;
    }[];
    education: {
        degree: string;
        institution: string;
        year: string;
    }[];
    summary: string;
}

type AIResponse<T> = Result<T>;

const RATE_LIMIT_TOKENS = 20;
const TOKEN_REFRESH_MS = 60 * 1000;

class RequestGate {
    private tokens = RATE_LIMIT_TOKENS;
    private lastRefill = Date.now();
    private queue: Array<() => void> = [];
    private scheduledRefill: ReturnType<typeof setTimeout> | null = null;

    acquire(): Promise<void> {
        this.refill();
        if (this.tokens > 0) {
            this.tokens -= 1;
            return Promise.resolve();
        }
        this.scheduleRefill();
        return new Promise((resolve) => {
            this.queue.push(() => {
                this.tokens -= 1;
                resolve();
            });
        });
    }

    private refill() {
        const now = Date.now();
        if (now - this.lastRefill >= TOKEN_REFRESH_MS) {
            this.tokens = RATE_LIMIT_TOKENS;
            this.lastRefill = now;
            if (this.scheduledRefill !== null) {
                clearTimeout(this.scheduledRefill);
                this.scheduledRefill = null;
            }
            while (this.tokens > 0 && this.queue.length > 0) {
                const next = this.queue.shift();
                if (next) next();
            }
        }
    }

    private scheduleRefill() {
        if (this.scheduledRefill !== null) return;
        const delay = Math.max(0, TOKEN_REFRESH_MS - (Date.now() - this.lastRefill));
        this.scheduledRefill = setTimeout(() => {
            this.scheduledRefill = null;
            this.refill();
            if (this.queue.length > 0) this.scheduleRefill();
        }, delay + 10);
    }
}

class BackoffTracker {
    private nextRetryAt = 0;

    setBackoff(ms: number) {
        this.nextRetryAt = Date.now() + ms;
    }

    canProceed() {
        return Date.now() >= this.nextRetryAt;
    }

    get delayRemaining() {
        return Math.max(0, this.nextRetryAt - Date.now());
    }
}

class Cache<T> {
    private store = new Map<string, { value: T; createdAt: number }>();
    constructor(private ttlMs: number) {}

    get(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() - entry.createdAt > this.ttlMs) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: string, value: T) {
        this.store.set(key, { value, createdAt: Date.now() });
    }
}

function parseCsvModels(input: string): string[] {
    return input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function fnv1aHex(value: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

type StoredCacheEntry<T> = { v: T; t: number };

class LocalStorageCache<T> {
    constructor(
        private namespace: string,
        private ttlMs: number,
        private maxEntries: number
    ) {}

    get(key: string): T | undefined {
        try {
            const raw = localStorage.getItem(`${this.namespace}:${key}`);
            if (!raw) return undefined;
            const parsed = JSON.parse(raw) as StoredCacheEntry<T>;
            if (!parsed || typeof parsed.t !== 'number') return undefined;
            if (Date.now() - parsed.t > this.ttlMs) {
                localStorage.removeItem(`${this.namespace}:${key}`);
                return undefined;
            }
            return parsed.v;
        } catch {
            return undefined;
        }
    }

    set(key: string, value: T) {
        try {
            const storageKey = `${this.namespace}:${key}`;
            const entry: StoredCacheEntry<T> = { v: value, t: Date.now() };
            localStorage.setItem(storageKey, JSON.stringify(entry));

            const indexKey = `${this.namespace}:__index__`;
            const indexRaw = localStorage.getItem(indexKey);
            const parsed = indexRaw ? JSON.parse(indexRaw) : null;
            const index = Array.isArray(parsed) ? (parsed as Array<{ k: string; t: number }>) : [];

            const filtered = index.filter((i) => i.k !== key);
            filtered.unshift({ k: key, t: entry.t });
            const trimmed = filtered.slice(0, this.maxEntries);
            localStorage.setItem(indexKey, JSON.stringify(trimmed));

            // Evict anything beyond trimmed list
            for (const item of filtered.slice(this.maxEntries)) {
                localStorage.removeItem(`${this.namespace}:${item.k}`);
            }
        } catch {
            // Ignore quota / JSON errors
        }
    }
}

class AIService {
    private client: GoogleGenAI | null = null;
    private textModels = TEXT_MODELS_ENV
        ? parseCsvModels(TEXT_MODELS_ENV)
        : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash', 'gemini-2.0-flash'];
    private textGate = new RequestGate();
    private embedGate = new RequestGate();
    private backoff = new BackoffTracker();
    private textCache = new Cache<string>(1000 * 60 * 5);
    private embedCache = new Cache<number[]>(1000 * 60 * 20);
    private embedLocalCache = new LocalStorageCache<number[]>('ts_embed_v1', 1000 * 60 * 60 * 24, 25);
    private inflightText = new Map<string, Promise<AIResponse<string>>>();
    private inflightEmbed = new Map<string, Promise<AIResponse<number[]>>>();

    constructor() {
        if (DISABLE_AI) {
            console.warn('[AIService] AI disabled via VITE_DISABLE_AI=true; running in no-AI mode.');
            this.client = null;
        } else if (API_KEY) {
            this.client = new GoogleGenAI({ apiKey: API_KEY });
        } else {
            console.warn('[AIService] No API key found. Set VITE_GEMINI_API_KEY in .env');
        }
    }

    isAvailable(): boolean {
        return this.client !== null;
    }

    private unknownError(message: string, cause?: unknown): AppError {
        return unknown('AIService', message, cause);
    }

    private notConfiguredError(message: string): AppError {
        return notConfigured('AIService', message);
    }

    private rateLimitError(message: string, retryAfterMs: number, cause?: unknown): AppError {
        return rateLimited('AIService', message, retryAfterMs, cause);
    }

    private parseRetryAfterMs(error: unknown): number | null {
        const asAny = error as any;
        const raw =
            (typeof asAny?.message === 'string' && asAny.message) ||
            (typeof asAny === 'string' && asAny) ||
            JSON.stringify(asAny);

        const retryDelayMatch = raw.match(/\"retryDelay\"\\s*:\\s*\"([0-9.]+)s\"/i);
        if (retryDelayMatch) {
            const seconds = Number(retryDelayMatch[1]);
            if (Number.isFinite(seconds)) return Math.max(1000, Math.round(seconds * 1000));
        }

        const pleaseRetryMatch = raw.match(/Please retry in\\s+([0-9.]+)s/i);
        if (pleaseRetryMatch) {
            const seconds = Number(pleaseRetryMatch[1]);
            if (Number.isFinite(seconds)) return Math.max(1000, Math.round(seconds * 1000));
        }

        // Some ApiError objects include retry info in details
        const retryInfo = asAny?.error?.details?.find?.((d: any) => String(d?.['@type'] || '').includes('RetryInfo'));
        const retryDelay = retryInfo?.retryDelay;
        if (typeof retryDelay === 'string') {
            const seconds = Number(retryDelay.replace('s', ''));
            if (Number.isFinite(seconds)) return Math.max(1000, Math.round(seconds * 1000));
        }

        return null;
    }

    private handleRateLimit(error: unknown): { retryAfterMs: number; message: string } | null {
        const asAny = error as any;
        const code = asAny?.status || asAny?.code || asAny?.error?.code;
        const rawMessage = String(asAny?.message || asAny?.error?.message || error);
        const isRateLimited = code === 429 || rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429');
        if (!isRateLimited) return null;

        const retryAfterMs = this.parseRetryAfterMs(error) ?? 60_000;
        this.backoff.setBackoff(retryAfterMs);
        return {
            retryAfterMs,
            message: `AI rate-limited; retry after ${Math.round(retryAfterMs / 1000)}s`
        };
    }

    // Parse unstructured resume text into structured data
    async parseResume(resumeText: string): Promise<AIResponse<ParsedResume>> {
        if (!this.client) {
            return this.mockParseResume(resumeText);
        }

        try {
            const prompt = buildSecurePrompt({
                system: `You are a resume parser. Extract structured information from the resume text in the data block below.
Return a JSON object with: name, email (if found), phone (if found), skills[], experience[], education[], summary.`,
                dataBlocks: [
                    { label: 'CANDIDATE_RESUME', content: sanitizeForPrompt(resumeText, 8000) }
                ],
                outputSpec: 'Return ONLY valid JSON, no markdown or explanation.'
            });

            // Layer 6: Enforce structured output schema at the API level.
            const schema = {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'Full name of the candidate.' },
                    email: { type: Type.STRING, description: 'Email address if found.' },
                    phone: { type: Type.STRING, description: 'Phone number if found.' },
                    skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Technical and soft skills.' },
                    experience: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                company: { type: Type.STRING },
                                duration: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ['title', 'company', 'duration', 'description']
                        }
                    },
                    education: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                degree: { type: Type.STRING },
                                institution: { type: Type.STRING },
                                year: { type: Type.STRING }
                            },
                            required: ['degree', 'institution', 'year']
                        }
                    },
                    summary: { type: Type.STRING, description: '2-3 sentence professional summary.' }
                },
                required: ['name', 'skills', 'experience', 'education', 'summary']
            };

            return await this.generateJson<ParsedResume>(prompt, schema);
        } catch (error) {
            console.error('[AIService] Resume parsing failed:', error);
            return err(this.unknownError('Signal extraction failed.', error));
        }
    }

    // Generate interview questions for a candidate
    async generateInterviewQuestions(
        candidateSkills: string[],
        jobRole: string,
        count: number = 5
    ): Promise<AIResponse<string[]>> {
        if (!this.client) {
            return this.mockGenerateQuestions(candidateSkills, jobRole, count);
        }

        try {
            const prompt = buildSecurePrompt({
                system: `Generate ${count} behavioral and technical interview questions. Focus on: skill verification, situational/behavioral (STAR format), and problem-solving scenarios.`,
                dataBlocks: [
                    { label: 'CANDIDATE_CONTEXT', content: `Job Role: ${sanitizeShort(jobRole)}\nSkills: ${sanitizeArray(candidateSkills).join(', ')}` }
                ],
                outputSpec: 'Return a JSON array of strings, no explanation.'
            });

            // Layer 6: Enforce structured output schema at the API level.
            const schema = {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: 'A behavioral or technical interview question.' }
            };

            return await this.generateJson<string[]>(prompt, schema);
        } catch (error) {
            console.error('[AIService] Question generation failed:', error);
            return err(this.unknownError('AI request failed.', error));
        }
    }

    /**
     * Generate free-form text from a prompt.
     * Useful for agent debriefs/summaries.
     *
     * Layer 6: When `options.schema` is provided, the Gemini Structured Output API
     * is used (`responseMimeType: 'application/json'` + `responseSchema`), which
     * constrains the model to emit only valid JSON conforming to the schema.
     */
    async generateText(prompt: string, options?: { schema?: any }): Promise<AIResponse<string>> {
        if (!this.client) {
            return ok('(Mock) AI text generation is disabled. Set VITE_GEMINI_API_KEY for real output.');
        }

        const inflightKey = fnv1aHex(prompt);
        const cachedAny = this.textCache.get(inflightKey);
        if (cachedAny) return ok(cachedAny);

        const inflight = this.inflightText.get(inflightKey);
        if (inflight) return await inflight;

        const run = (async (): Promise<AIResponse<string>> => {
            if (!this.backoff.canProceed()) {
                const retryAfterMs = this.backoff.delayRemaining;
                return err(
                    this.rateLimitError(`AI temporarily rate-limited; retry in ${Math.round(retryAfterMs / 1000)}s`, retryAfterMs),
                    { retryAfterMs }
                );
            }

            for (const model of this.textModels) {
                const cacheKey = `${model}:${prompt}`;
                const cached = this.textCache.get(cacheKey);
                if (cached) return ok(cached);

                await this.textGate.acquire();

                try {
                    // Layer 6: Build config with structured output schema when provided.
                    const config: Record<string, any> = {};
                    if (options?.schema) {
                        config.responseMimeType = 'application/json';
                        config.responseSchema = options.schema;
                    }

                    const response = await this.client.models.generateContent({
                        model,
                        contents: prompt,
                        ...(Object.keys(config).length > 0 ? { config } : {})
                    });

                    const text = (response.text || '').trim();
                    this.textCache.set(cacheKey, text);
                    this.textCache.set(inflightKey, text);
                    return ok(text);
                } catch (error) {
                    const rate = this.handleRateLimit(error);
                    if (rate) {
                        if (import.meta.env.DEV) console.warn('[AIService] Text generation rate-limited:', rate.message);
                        // Try the next model in the list before giving up.
                        continue;
                    }
                    console.error('[AIService] Text generation failed:', error);
                    return err(this.unknownError('Text generation failed.', error));
                }
            }

            const retryAfterMs = Math.max(1000, this.backoff.delayRemaining || 10_000);
            return err(
                this.rateLimitError(`AI temporarily rate-limited; retry in ${Math.round(retryAfterMs / 1000)}s`, retryAfterMs, {
                    modelsTried: this.textModels
                }),
                { retryAfterMs }
            );
        })();

        this.inflightText.set(inflightKey, run);
        try {
            return await run;
        } finally {
            this.inflightText.delete(inflightKey);
        }
    }

    /**
     * Generate and parse a JSON object from a prompt.
     *
     * Layer 6: When `schema` is provided, the Gemini Structured Output API is used
     * to guarantee well-formed JSON at the API level. When schema is absent, the
     * model response is best-effort parsed (markdown fences stripped).
     */
    async generateJson<T>(prompt: string, schema?: any): Promise<AIResponse<T>> {
        const textResponse = await this.generateText(prompt, schema ? { schema } : undefined);
        if (!textResponse.success || !textResponse.data) {
            return err(textResponse.error, { retryAfterMs: textResponse.retryAfterMs });
        }

        try {
            // When a schema is used, the API returns pure JSON — no markdown fences.
            // Without a schema, strip markdown fences as a fallback.
            const jsonStr = schema
                ? textResponse.data.trim()
                : textResponse.data.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(jsonStr) as T;

            // Layer 5: Validate all AI JSON output for prompt leakage and injection artifacts.
            const validation = validateGenericOutput(parsed);
            if (!validation.valid) {
                console.error('[AIService] AI output failed validation — may contain leaked prompt or injection artifacts.');
                return err(this.unknownError('AI output failed security validation.'));
            }

            return ok(parsed);
        } catch (error) {
            console.error('[AIService] JSON parse failed:', error);
            return err(this.unknownError('Failed to parse AI JSON response.', error));
        }
    }

    // Analyze text and extract skill signals
    async extractSkillSignals(text: string): Promise<AIResponse<{ skill: string; confidence: number; evidence: string }[]>> {
        if (!this.client) {
            return this.mockExtractSignals(text);
        }

        try {
            const prompt = buildSecurePrompt({
                system: 'Analyze text and extract knowledge signals. Return JSON array of { skill: string, confidence: number, evidence: string }.',
                dataBlocks: [
                    { label: 'TEXT_TO_ANALYZE', content: sanitizeForPrompt(text, 4000) }
                ],
                outputSpec: 'Return ONLY a valid JSON array.'
            });

            // Layer 6: Enforce structured output schema at the API level.
            const schema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        skill: { type: Type.STRING, description: 'Identified skill or competency.' },
                        confidence: { type: Type.NUMBER, description: 'Confidence score 0-100.' },
                        evidence: { type: Type.STRING, description: 'Evidence snippet supporting this signal.' }
                    },
                    required: ['skill', 'confidence', 'evidence']
                }
            };

            return await this.generateJson<{ skill: string; confidence: number; evidence: string }[]>(prompt, schema);
        } catch (error) {
            console.error('[AIService] Signal extraction failed:', error);
            return err(this.unknownError('Signal extraction failed.', error));
        }
    }

    // Generate text embedding for vector search
    async embedText(text: string): Promise<AIResponse<number[]>> {
        if (!this.client) {
            // Mock 768-dim vector
            const mockVector = Array(768).fill(0).map(() => Math.random() * 0.1);
            return ok(mockVector);
        }

        const cached = this.embedCache.get(text);
        if (cached) return ok(cached);

        const key = fnv1aHex(text);
        const cachedLocal = this.embedLocalCache.get(key);
        if (cachedLocal) {
            this.embedCache.set(text, cachedLocal);
            return ok(cachedLocal);
        }

        const inflight = this.inflightEmbed.get(key);
        if (inflight) return await inflight;

        const run = (async (): Promise<AIResponse<number[]>> => {
            await this.embedGate.acquire();

            if (!this.backoff.canProceed()) {
                const retryAfterMs = this.backoff.delayRemaining;
                return err(
                    this.rateLimitError(`AI temporarily rate-limited; retry in ${Math.round(retryAfterMs / 1000)}s`, retryAfterMs),
                    { retryAfterMs }
                );
            }

            try {
                const result = await this.client.models.embedContent({
                    model: 'text-embedding-004',
                    contents: text,
                });

                // Handle both potential response formats
                const response = result as any;
                const values = response.embeddings?.[0]?.values || response.embedding?.values;

                if (!values) {
                    throw new Error('No embedding returned from API');
                }

                this.embedCache.set(text, values);
                this.embedLocalCache.set(key, values);
                return ok(values);
            } catch (error) {
                const rate = this.handleRateLimit(error);
                if (rate) {
                    if (import.meta.env.DEV) console.warn('[AIService] Embedding rate-limited:', rate.message);
                    return err(this.rateLimitError(rate.message, rate.retryAfterMs, error), { retryAfterMs: rate.retryAfterMs });
                }
                console.error('[AIService] Embedding failed:', error);
                return err(this.unknownError('Embedding request failed.', error));
            }
        })();

        this.inflightEmbed.set(key, run);
        try {
            return await run;
        } finally {
            this.inflightEmbed.delete(key);
        }
    }

    // Mock implementations for when API is not available
    private mockParseResume(text: string): AIResponse<ParsedResume> {
        const words = text.split(/\s+/);
        return ok({
                name: words.slice(0, 2).join(' ') || 'Unknown Candidate',
                email: 'candidate@example.com',
                skills: ['JavaScript', 'React', 'TypeScript', 'Node.js'],
                experience: [{
                    title: 'Software Engineer',
                    company: 'Tech Corp',
                    duration: '2020-2024',
                    description: 'Full-stack development'
                }],
                education: [{
                    degree: 'B.S. Computer Science',
                    institution: 'University',
                    year: '2020'
                }],
                summary: 'Experienced software engineer with strong technical skills. ' +
                    '(Mock data - set VITE_GEMINI_API_KEY for real parsing)'
            });
    }

    private mockGenerateQuestions(skills: string[], role: string, count: number): AIResponse<string[]> {
        const questions = [
            `Tell me about a challenging ${role} project you worked on.`,
            `How do you approach learning new technologies like ${skills[0] || 'frameworks'}?`,
            `Describe a time when you had to debug a complex issue.`,
            `How do you handle disagreements with team members?`,
            `What's your experience with ${skills[1] || 'modern development practices'}?`
        ];
        return ok(questions.slice(0, count));
    }

    private mockExtractSignals(text: string): AIResponse<{ skill: string; confidence: number; evidence: string }[]> {
        return ok([
            { skill: 'Communication', confidence: 75, evidence: 'Mock extraction - set API key for real analysis' }
        ]);
    }
}

export const aiService = new AIService();
