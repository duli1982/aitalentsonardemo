import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock candidate data for testing
export const mockCandidates = [
    {
        id: 'cand_1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        skills: ['React', 'TypeScript', 'Node.js'],
        similarity: 0.85,
        metadata: {
            role: 'Senior Frontend Developer',
            experienceYears: 5,
            location: 'San Francisco',
            summary: 'Experienced React developer with TypeScript expertise'
        }
    },
    {
        id: 'cand_2',
        name: 'Bob Smith',
        email: 'bob@example.com',
        skills: ['Python', 'Django', 'PostgreSQL'],
        similarity: 0.72,
        metadata: {
            role: 'Backend Engineer',
            experienceYears: 3,
            location: 'New York',
            summary: 'Python backend developer'
        }
    }
];

// Create mock Supabase client
export const createMockSupabaseClient = () => {
    const mockFrom = vi.fn((table: string) => ({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
                limit: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            range: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null })
        }),
        delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null })
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
    }));

    const mockRpc = vi.fn((functionName: string, params?: any) => {
        if (functionName === 'match_candidates') {
            return Promise.resolve({
                data: mockCandidates,
                error: null
            });
        }
        return Promise.resolve({ data: null, error: null });
    });

    return {
        from: mockFrom,
        rpc: mockRpc,
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null })
        }
    } as unknown as SupabaseClient;
};

// Mock for successful vector search
export const mockVectorSearchSuccess = (similarity = 0.85) => {
    return {
        data: mockCandidates.map(c => ({ ...c, similarity })),
        error: null
    };
};

// Mock for failed vector search
export const mockVectorSearchError = () => {
    return {
        data: null,
        error: { message: 'Vector search failed', code: 'UPSTREAM_ERROR' }
    };
};

export default createMockSupabaseClient;
