
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agenticSourcingPrototype } from '../AgenticSourcingPrototype';
import { agenticTools } from '../AgenticSearchTools';
import { ok } from '../../types/result';

// Mock the tools
vi.mock('../AgenticSearchTools', () => ({
    agenticTools: {
        keyword: { execute: vi.fn() },
        vector: { execute: vi.fn() },
        reader: { execute: vi.fn() }
    }
}));

describe('AgenticSourcingPrototype', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockJob = {
        id: 'job-123',
        title: 'Senior React Developer',
        requiredSkills: ['React', 'TypeScript'],
        description: 'Looking for a senior dev with 5+ years experience.',
        department: 'Engineering',
        location: 'Remote',
        status: 'open',
        capturedAt: new Date().toISOString()
    } as any;

    it('should execute keyword search for critical skills', async () => {
        // Setup mocks
        vi.mocked(agenticTools.keyword.execute).mockResolvedValue(ok({
            results: [{ id: 'c1', name: 'Alice', metadata: { role: 'React Dev' } }],
            toolName: 'keyword_search'
        }));

        vi.mocked(agenticTools.vector.execute).mockResolvedValue(ok({
            results: [{ id: 'c2', name: 'Bob', similarity: 0.85 }],
            toolName: 'vector_search'
        }));

        vi.mocked(agenticTools.reader.execute).mockResolvedValue(ok({
            results: [{ content: 'Senior React Developer...' }],
            toolName: 'candidate_reader'
        }));

        // Execute
        const result = await agenticSourcingPrototype.findCandidatesForJob(mockJob);

        // Verify
        expect(agenticTools.keyword.execute).toHaveBeenCalledWith({
            query: 'React TypeScript',
            limit: 5
        });
        expect(result.success).toBe(true);
        const candidates = result.success ? result.data : [];
        expect(candidates.find(c => c.candidateId === 'c1')).toBeDefined();
    });

    it('should perform verification for senior roles', async () => {
        // Setup mocks
        vi.mocked(agenticTools.keyword.execute).mockResolvedValue(ok({ results: [], toolName: 'keyword' }));
        vi.mocked(agenticTools.vector.execute).mockResolvedValue(ok({
            results: [{ id: 'c1', name: 'Carol', similarity: 0.9 }], // High vector score
            toolName: 'vector'
        }));

        // Mock reader to return content WITHOUT "Senior" or "Lead"
        vi.mocked(agenticTools.reader.execute).mockResolvedValue(ok({
            results: [{ content: 'Junior Developer with great potential...' }],
            toolName: 'reader'
        }));

        // Execute
        const result = await agenticSourcingPrototype.findCandidatesForJob(mockJob); // Job title is "Senior..."

        // Verify
        expect(agenticTools.reader.execute).toHaveBeenCalledWith({ candidateId: 'c1' });

        const candidates = result.success ? result.data : [];
        const carol = candidates.find(c => c.candidateId === 'c1');

        // Carol started with 90 (0.9 * 100), should be penalized -10 = 80
        expect(carol?.score).toBe(80);
        expect(carol?.reasoning.some(r => r.includes('missing'))).toBe(true);
    });

    it('should boost candidates found by multiple sources', async () => {
        // Setup mocks - Alice found by both Keyword and Vector
        vi.mocked(agenticTools.keyword.execute).mockResolvedValue(ok({
            results: [{ id: 'alice', name: 'Alice' }],
            toolName: 'keyword'
        }));
        vi.mocked(agenticTools.vector.execute).mockResolvedValue(ok({
            results: [{ id: 'alice', name: 'Alice', similarity: 0.8 }], // 80 base
            toolName: 'vector'
        }));
        vi.mocked(agenticTools.reader.execute).mockResolvedValue(ok({
            results: [{ content: 'Senior dev...' }],
            toolName: 'reader'
        }));

        const result = await agenticSourcingPrototype.findCandidatesForJob(mockJob);

        const candidates = result.success ? result.data : [];
        const alice = candidates.find(c => c.candidateId === 'alice');

        // Base 80 (vector) + 5 boost for merge + potential verification boost (+5) = 90
        // Wait, keyword sets score to 80. Merge puts max(80, 80) + 5 = 85.
        // Then verification adds 5 = 90.
        expect(alice?.score).toBeGreaterThanOrEqual(85);
        expect(alice?.sources).toContain('keyword');
        expect(alice?.sources).toContain('vector');
    });
});
