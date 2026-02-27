import { describe, it, expect, vi, beforeEach } from 'vitest';

async function loadSemanticSearchService(params: {
  supabase: unknown;
  embedText?: ReturnType<typeof vi.fn>;
  isAvailable?: boolean;
}) {
  vi.resetModules();
  vi.doMock('../supabaseClient', () => ({ supabase: params.supabase }));
  vi.doMock('../AIService', () => ({
    aiService: {
      embedText: params.embedText ?? vi.fn().mockResolvedValue({ success: true, data: [0.1, 0.2] }),
      isAvailable: vi.fn(() => params.isAvailable ?? true)
    }
  }));
  return import('../SemanticSearchService');
}

describe('SemanticSearchService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns not configured when supabase is unavailable', async () => {
    const { semanticSearchService } = await loadSemanticSearchService({ supabase: null });
    const result = await semanticSearchService.search('react engineer');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_CONFIGURED');
      expect(result.data).toEqual([]);
    }
  });

  it('returns normalized semantic results from vector RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: 123,
          candidate_id: 'cand-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          type: 'uploaded',
          skills: ['React', 'TypeScript'],
          similarity: 0.91,
          content: 'profile text',
          metadata: { source: 'resume_upload' }
        }
      ],
      error: null
    });
    const supabase = { rpc };

    const { semanticSearchService } = await loadSemanticSearchService({ supabase });
    const result = await semanticSearchService.search('react engineer', { threshold: 0.6, limit: 5 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('cand-1');
      expect(result.data[0].name).toBe('Jane Doe');
      expect(result.data[0].skills).toEqual(['React', 'TypeScript']);
      expect(result.data[0].similarity).toBe(0.91);
    }
  });

  it('returns upstream error when embedding generation fails', async () => {
    const embedText = vi.fn().mockResolvedValue({
      success: false,
      error: { code: 'UPSTREAM', message: 'embedding failed' },
      retryAfterMs: 2000
    });
    const rpc = vi.fn();
    const supabase = { rpc };

    const { semanticSearchService } = await loadSemanticSearchService({ supabase, embedText });
    const result = await semanticSearchService.search('react engineer');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UPSTREAM');
      expect(result.data).toEqual([]);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
