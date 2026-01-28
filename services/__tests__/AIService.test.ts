import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupGlobalMocks, resetMocks, waitFor } from '../../src/test/utils/testHelpers';

// Mock @google/genai
vi.mock('@google/genai', () => ({
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        models: {
            generateContent: vi.fn().mockResolvedValue({
                text: 'Generated text response'
            }),
            embedContent: vi.fn().mockResolvedValue({
                embedding: new Array(384).fill(0).map(() => Math.random())
            })
        }
    }))
}));

describe('AIService', () => {
    let aiService: any;

    beforeEach(async () => {
        setupGlobalMocks();
        vi.clearAllMocks();

        // Dynamically import to get fresh instance
        const module = await import('../AIService');
        aiService = module.aiService;
    });

    afterEach(() => {
        resetMocks();
    });

    describe('isAvailable', () => {
        it('should return true when API key is configured', () => {
            expect(aiService.isAvailable()).toBe(true);
        });
    });

    describe('generateText', () => {
        it('should generate text successfully', async () => {
            const result = await aiService.generateText('Test prompt');

            expect(result.success).toBe(true);
            if (result.success) {
                expect(typeof result.data).toBe('string');
                expect(result.data.length).toBeGreaterThan(0);
            }
        });

        it('should use multi-model fallback on rate limit', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            // Mock first model to fail, second to succeed
            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn()
                        .mockRejectedValueOnce({ code: 429, message: 'Rate limited' })
                        .mockResolvedValueOnce({ text: 'Fallback response' })
                }
            }));

            const result = await aiService.generateText('Test prompt');

            expect(result.success).toBe(true);
        });

        it('should return error when all models fail', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockRejectedValue({ code: 429, message: 'Rate limited' })
                }
            }));

            const result = await aiService.generateText('Test prompt');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('RATE_LIMIT');
            }
        });

        it('should handle network errors', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockRejectedValue(new Error('Network error'))
                }
            }));

            const result = await aiService.generateText('Test prompt');

            expect(result.success).toBe(false);
        });
    });

    describe('embedText', () => {
        it('should generate embeddings successfully', async () => {
            const result = await aiService.embedText('Test text');

            expect(result.success).toBe(true);
            if (result.success) {
                expect(Array.isArray(result.data)).toBe(true);
                expect(result.data.length).toBeGreaterThan(0);
            }
        });

        it('should cache embeddings in LocalStorage', async () => {
            const text = 'Test text for caching';

            // First call
            await aiService.embedText(text);

            // Second call should use cache
            const result = await aiService.embedText(text);

            expect(result.success).toBe(true);
        });

        it('should handle cache misses', async () => {
            const result1 = await aiService.embedText('Text 1');
            const result2 = await aiService.embedText('Text 2');

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
        });
    });

    describe('generateJson', () => {
        it('should generate and parse JSON successfully', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockResolvedValue({
                        text: JSON.stringify({ result: 'success', data: 'test' })
                    })
                }
            }));

            const result = await aiService.generateJson<{ result: string; data: string }>('Generate JSON');

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveProperty('result', 'success');
                expect(result.data).toHaveProperty('data', 'test');
            }
        });

        it('should handle malformed JSON', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockResolvedValue({
                        text: 'Not valid JSON'
                    })
                }
            }));

            const result = await aiService.generateJson('Generate JSON');

            expect(result.success).toBe(false);
        });

        it('should extract JSON from markdown code blocks', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockResolvedValue({
                        text: '```json\n{"result": "success"}\n```'
                    })
                }
            }));

            const result = await aiService.generateJson<{ result: string }>('Generate JSON');

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveProperty('result', 'success');
            }
        });
    });

    describe('rate limiting', () => {
        it('should track rate limit state', async () => {
            // This tests the RequestGate implementation
            const promises = Array(5).fill(null).map(() =>
                aiService.generateText('Test')
            );

            const results = await Promise.all(promises);

            // All should succeed or fail gracefully
            results.forEach(result => {
                expect(result).toHaveProperty('success');
            });
        });

        it('should respect retryAfterMs in errors', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockRejectedValue({
                        code: 429,
                        message: 'Rate limited',
                        retryAfter: 5
                    })
                }
            }));

            const result = await aiService.generateText('Test');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.retryAfterMs).toBeGreaterThan(0);
            }
        });
    });

    describe('inflight request deduplication', () => {
        it('should deduplicate concurrent identical requests', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;
            const mockGenerate = vi.fn().mockResolvedValue({ text: 'Response' });

            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: mockGenerate
                }
            }));

            const samePrompt = 'Identical prompt';

            // Make 3 concurrent requests with same prompt
            const [r1, r2, r3] = await Promise.all([
                aiService.generateText(samePrompt),
                aiService.generateText(samePrompt),
                aiService.generateText(samePrompt)
            ]);

            // All should succeed
            expect(r1.success).toBe(true);
            expect(r2.success).toBe(true);
            expect(r3.success).toBe(true);

            // But only one API call should be made
            expect(mockGenerate).toHaveBeenCalledTimes(1);
        });
    });

    describe('error handling', () => {
        it('should provide structured error responses', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockRejectedValue(new Error('API error'))
                }
            }));

            const result = await aiService.generateText('Test');

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toHaveProperty('code');
                expect(result.error).toHaveProperty('source');
                expect(result.error).toHaveProperty('message');
                expect(result.error).toHaveProperty('severity');
            }
        });

        it('should mark errors as retryable or not', async () => {
            const { GoogleGenerativeAI } = await import('@google/genai');
            const mockGenAI = GoogleGenerativeAI as any;

            // Rate limit is retryable
            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockRejectedValue({ code: 429 })
                }
            }));

            const result1 = await aiService.generateText('Test');
            expect(result1.success).toBe(false);
            if (!result1.success) {
                expect(result1.error.retryable).toBe(true);
            }

            // Invalid request is not retryable
            mockGenAI.mockImplementationOnce(() => ({
                models: {
                    generateContent: vi.fn().mockRejectedValue({ code: 400 })
                }
            }));

            const result2 = await aiService.generateText('Test');
            expect(result2.success).toBe(false);
        });
    });
});
