import { vi } from 'vitest';
import type { Result } from '../../types/result';
import { ok, err } from '../../services/errorHandling';

// Mock AI responses
export const mockAIResponses = {
    fitAnalysis: {
        score: 85,
        rationale: 'Strong candidate with relevant React and TypeScript experience. Good communication skills.',
        method: 'gemini-2.5-flash',
        confidence: 0.85,
        reasons: [
            'Matches 4 out of 5 required skills',
            'Has 5+ years experience in similar role',
            'Located in same timezone'
        ]
    },
    interviewQuestions: [
        'Tell me about your experience with React Hooks',
        'Describe a challenging technical problem you solved recently',
        'How do you approach code review?',
        'What is your experience with TypeScript?',
        'Describe your testing strategy',
        'How do you stay updated with frontend trends?',
        'Tell me about a time you improved performance',
        'What are your salary expectations?'
    ],
    screeningSummary: 'Candidate demonstrated strong technical knowledge and clear communication. Recommended for technical interview.',
    evidencePack: {
        version: 1,
        snippets: [
            {
                content: 'Led React migration for enterprise application',
                source: 'resume',
                evidenceType: 'experience',
                relevance: 0.9
            },
            {
                content: 'Expert in TypeScript, React, and Node.js',
                source: 'profile',
                evidenceType: 'skill',
                relevance: 0.85
            }
        ],
        truthCheckPreview: [
            'Can you walk me through the last time you debugged a React performance issue?',
            'Tell me about a TypeScript feature you used to improve code quality'
        ],
        overallConfidence: 0.85,
        risks: [],
        matchScore: 85
    }
};

// Create mock AI service
export const createMockAIService = () => {
    return {
        isAvailable: vi.fn().mockReturnValue(true),

        generateText: vi.fn().mockImplementation(async (prompt: string): Promise<Result<string>> => {
            return ok(mockAIResponses.screeningSummary);
        }),

        generateJson: vi.fn().mockImplementation(async <T>(prompt: string): Promise<Result<T>> => {
            if (prompt.includes('interview')) {
                return ok(mockAIResponses.fitAnalysis as any);
            }
            return ok(mockAIResponses.evidencePack as any);
        }),

        embedText: vi.fn().mockImplementation(async (text: string): Promise<Result<number[]>> => {
            // Return mock embedding vector (384 dimensions)
            const mockEmbedding = new Array(384).fill(0).map(() => Math.random());
            return ok(mockEmbedding);
        }),

        generateInterviewQuestions: vi.fn().mockImplementation(async (
            skills: string[],
            jobTitle: string,
            count: number
        ): Promise<Result<string[]>> => {
            return ok(mockAIResponses.interviewQuestions.slice(0, count));
        }),

        // Simulate rate limit error
        simulateRateLimit: vi.fn().mockImplementation(async (): Promise<Result<string>> => {
            return err(
                {
                    code: 'RATE_LIMIT',
                    source: 'AIService',
                    message: 'Rate limit exceeded',
                    severity: 'warning',
                    retryable: true
                },
                { retryAfterMs: 5000 }
            );
        }),

        // Simulate network error
        simulateNetworkError: vi.fn().mockImplementation(async (): Promise<Result<string>> => {
            return err({
                code: 'UPSTREAM_ERROR',
                source: 'AIService',
                message: 'Network error',
                severity: 'error',
                retryable: true
            });
        })
    };
};

export default createMockAIService;
