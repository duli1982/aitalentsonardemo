import { describe, it, expect, vi, beforeEach } from 'vitest';

async function loadGraphQueryServiceWithSupabase(supabaseMock: unknown) {
  vi.resetModules();
  vi.doMock('../supabaseClient', () => ({ supabase: supabaseMock }));
  return import('../GraphQueryService');
}

describe('GraphQueryService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns not configured when supabase is unavailable', async () => {
    const { graphQueryService } = await loadGraphQueryServiceWithSupabase(null);
    const result = await graphQueryService.findCandidatesByCompany('Acme');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_CONFIGURED');
      expect(result.data).toEqual([]);
    }
  });

  it('maps candidate metadata for company query results', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        {
          candidate_id: 'cand-1',
          title: 'Senior Engineer',
          start_date: '2021-01-01',
          end_date: '2023-01-01',
          is_current: false,
          candidate_documents: { metadata: { name: 'Jane Doe', email: 'jane@example.com' } }
        }
      ],
      error: null
    });
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const { graphQueryService } = await loadGraphQueryServiceWithSupabase({ from });
    const result = await graphQueryService.findCandidatesByCompany('Acme');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].candidate_name).toBe('Jane Doe');
      expect(result.data[0].candidate_email).toBe('jane@example.com');
    }
  });

  it('intersects multi-criteria candidate sets', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'candidate_companies') {
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({ data: [{ candidate_id: 'cand-1' }, { candidate_id: 'cand-2' }] })
          })
        };
      }
      if (table === 'candidate_schools') {
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({ data: [{ candidate_id: 'cand-1' }] })
          })
        };
      }
      if (table === 'candidate_documents') {
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'cand-1',
                  metadata: { name: 'Alex', title: 'Developer', email: 'alex@example.com' }
                }
              ],
              error: null
            })
          })
        };
      }
      return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [] }) }) };
    });

    const { graphQueryService } = await loadGraphQueryServiceWithSupabase({ from });
    const result = await graphQueryService.findCandidatesByMultipleCriteria({
      companies: ['Acme'],
      schools: ['MIT']
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].candidate_id).toBe('cand-1');
      expect(result.data[0].relationship_type).toBe('multi_criteria');
    }
  });
});
