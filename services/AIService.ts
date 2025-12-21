// AIService - Gemini API integration for real AI capabilities
// Provides resume parsing, candidate Q&A, and text analysis

import { GoogleGenAI } from '@google/genai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const DISABLE_AI = String(import.meta.env.VITE_DISABLE_AI || '').toLowerCase() === 'true';

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

interface AIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    retryAfterMs?: number;
}

const RATE_LIMIT_TOKENS = 20;
const TOKEN_REFRESH_MS = 60 * 1000;

class RequestGate {
    private tokens = RATE_LIMIT_TOKENS;
    private lastRefill = Date.now();
    private queue: Array<() => void> = [];

    acquire(): Promise<void> {
        this.refill();
        if (this.tokens > 0) {
            this.tokens -= 1;
            return Promise.resolve();
        }
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
            while (this.tokens > 0 && this.queue.length > 0) {
                const next = this.queue.shift();
                if (next) next();
            }
        }
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

class AIService {
    private client: GoogleGenAI | null = null;
    private model = 'gemini-2.0-flash';
    private gate = new RequestGate();
    private backoff = new BackoffTracker();
    private textCache = new Cache<string>(1000 * 60 * 5);
    private embedCache = new Cache<number[]>(1000 * 60 * 20);

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
            const prompt = `
You are a resume parser. Extract structured information from the following resume text.
Return a JSON object with these fields:
- name: string
- email: string (if found)
- phone: string (if found)
- skills: string[] (technical and soft skills)
- experience: array of {title, company, duration, description}
- education: array of {degree, institution, year}
- summary: string (2-3 sentence professional summary)

Resume text:
"""
${resumeText}
"""

Return ONLY valid JSON, no markdown or explanation.`;

            return await this.generateJson<ParsedResume>(prompt);
        } catch (error) {
            console.error('[AIService] Resume parsing failed:', error);
            return { success: false, error: String(error) };
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
            const prompt = `
Generate ${count} behavioral and technical interview questions for a ${jobRole} candidate.
The candidate has these skills: ${candidateSkills.join(', ')}.

Focus on:
- Skill verification questions
- Situational/behavioral questions (STAR format)
- Problem-solving scenarios

Return a JSON array of strings, no explanation.`;

            return await this.generateJson<string[]>(prompt);
        } catch (error) {
            console.error('[AIService] Question generation failed:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Generate free-form text from a prompt.
     * Useful for agent debriefs/summaries.
     */
    async generateText(prompt: string): Promise<AIResponse<string>> {
        if (!this.client) {
            return { success: true, data: '(Mock) AI text generation is disabled. Set VITE_GEMINI_API_KEY for real output.' };
        }

        const cached = this.textCache.get(`${this.model}:${prompt}`);
        if (cached) return { success: true, data: cached };

        await this.gate.acquire();

        if (!this.backoff.canProceed()) {
            return {
                success: false,
                error: `AI temporarily rate-limited; retry in ${Math.round(this.backoff.delayRemaining / 1000)}s`,
                retryAfterMs: this.backoff.delayRemaining
            };
        }

        try {
            const response = await this.client.models.generateContent({
                model: this.model,
                contents: prompt
            });

            const text = (response.text || '').trim();
            this.textCache.set(`${this.model}:${prompt}`, text);
            return { success: true, data: text };
        } catch (error) {
            const rate = this.handleRateLimit(error);
            if (rate) {
                if (import.meta.env.DEV) console.warn('[AIService] Text generation rate-limited:', rate.message);
                return { success: false, error: rate.message, retryAfterMs: rate.retryAfterMs };
            }
            console.error('[AIService] Text generation failed:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Generate and parse a JSON object from a prompt.
     * The prompt must instruct the model to return only valid JSON.
     */
    async generateJson<T>(prompt: string): Promise<AIResponse<T>> {
        const textResponse = await this.generateText(prompt);
        if (!textResponse.success || !textResponse.data) {
            return { success: false, error: textResponse.error || 'No response', retryAfterMs: textResponse.retryAfterMs };
        }

        try {
            const jsonStr = textResponse.data.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(jsonStr) as T;
            return { success: true, data: parsed };
        } catch (error) {
            console.error('[AIService] JSON parse failed:', error);
            return { success: false, error: String(error) };
        }
    }

    // Analyze text and extract skill signals
    async extractSkillSignals(text: string): Promise<AIResponse<{ skill: string; confidence: number; evidence: string }[]>> {
        if (!this.client) {
            return this.mockExtractSignals(text);
        }

        try {
            const prompt = `
Analyze this text and extract any knowledge signals.
...
`;
            return await this.generateJson<{ skill: string; confidence: number; evidence: string }[]>(prompt);
        } catch (error) {
            console.error('[AIService] Signal extraction failed:', error);
            return { success: false, error: String(error) };
        }
    }

    // Generate text embedding for vector search
    async embedText(text: string): Promise<AIResponse<number[]>> {
        if (!this.client) {
            // Mock 768-dim vector
            const mockVector = Array(768).fill(0).map(() => Math.random() * 0.1);
            return { success: true, data: mockVector };
        }

        const cached = this.embedCache.get(text);
        if (cached) return { success: true, data: cached };

        await this.gate.acquire();

        if (!this.backoff.canProceed()) {
            return {
                success: false,
                error: `AI temporarily rate-limited; retry in ${Math.round(this.backoff.delayRemaining / 1000)}s`,
                retryAfterMs: this.backoff.delayRemaining
            };
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
            return { success: true, data: values };
        } catch (error) {
            const rate = this.handleRateLimit(error);
            if (rate) {
                if (import.meta.env.DEV) console.warn('[AIService] Embedding rate-limited:', rate.message);
                return { success: false, error: rate.message, retryAfterMs: rate.retryAfterMs };
            }
            console.error('[AIService] Embedding failed:', error);
            return { success: false, error: String(error) };
        }
    }

    // Mock implementations for when API is not available
    private mockParseResume(text: string): AIResponse<ParsedResume> {
        const words = text.split(/\s+/);
        return {
            success: true,
            data: {
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
            }
        };
    }

    private mockGenerateQuestions(skills: string[], role: string, count: number): AIResponse<string[]> {
        const questions = [
            `Tell me about a challenging ${role} project you worked on.`,
            `How do you approach learning new technologies like ${skills[0] || 'frameworks'}?`,
            `Describe a time when you had to debug a complex issue.`,
            `How do you handle disagreements with team members?`,
            `What's your experience with ${skills[1] || 'modern development practices'}?`
        ];
        return { success: true, data: questions.slice(0, count) };
    }

    private mockExtractSignals(text: string): AIResponse<{ skill: string; confidence: number; evidence: string }[]> {
        return {
            success: true,
            data: [
                { skill: 'Communication', confidence: 75, evidence: 'Mock extraction - set API key for real analysis' }
            ]
        };
    }
}

export const aiService = new AIService();
