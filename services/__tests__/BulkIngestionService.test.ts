import { describe, it, expect, vi, beforeEach } from 'vitest';

async function loadBulkIngestionService() {
  vi.resetModules();

  const upsertProgress = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === 'bulk_ingestion_progress') {
      return {
        upsert: upsertProgress,
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
      };
    }
    return {
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockResolvedValue({ data: [], error: null })
    };
  });

  const supabase = { from, rpc: vi.fn().mockResolvedValue({ data: 1, error: null }) };
  const upsertCandidateAndActiveDocument = vi.fn().mockResolvedValue({ candidateId: 'cand-1', documentId: '1' });

  vi.doMock('../supabaseClient', () => ({ supabase }));
  vi.doMock('../AIService', () => ({
    aiService: {
      isAvailable: vi.fn(() => true),
      embedText: vi.fn().mockResolvedValue({ success: true, data: [0.1, 0.2, 0.3] })
    }
  }));
  vi.doMock('../CandidatePersistenceService', () => ({
    candidatePersistenceService: {
      upsertCandidateAndActiveDocument
    }
  }));
  vi.doMock('../../data/jobRoleTemplates', () => ({
    JOB_ROLE_TEMPLATES: [
      {
        title: 'Software Engineer',
        skills: ['TypeScript', 'React', 'Node.js', 'SQL', 'Testing'],
        educationLevels: ["Bachelor's in Computer Science - MIT"],
        locations: ['Remote'],
        industries: ['Technology'],
        experienceRange: [3, 5],
        category: 'Engineering'
      }
    ],
    FIRST_NAMES: ['Jane'],
    LAST_NAMES: ['Doe'],
    COMPANIES: ['Acme'],
    UNIVERSITIES: ['MIT'],
    getRandomItem: <T,>(items: T[]) => items[0],
    getRandomItems: <T,>(items: T[], count: number) => items.slice(0, count)
  }));

  const mod = await import('../BulkIngestionService');
  return {
    bulkIngestionService: mod.bulkIngestionService,
    upsertCandidateAndActiveDocument
  };
}

describe('BulkIngestionService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('ingests a small batch and reports completion', async () => {
    const { bulkIngestionService, upsertCandidateAndActiveDocument } = await loadBulkIngestionService();

    const createGraphSpy = vi
      .spyOn(
        bulkIngestionService as unknown as { createGraphRelationships: (candidateId: string, profile: unknown) => Promise<void> },
        'createGraphRelationships'
      )
      .mockResolvedValue(undefined);

    const progress = await bulkIngestionService.startBulkIngestion(
      {
        targetCount: 2,
        batchSize: 1,
        parallelism: 1,
        checkpointInterval: 1
      }
    );

    expect(progress.status).toBe('completed');
    expect(progress.completed).toBe(2);
    expect(progress.failed).toBe(0);
    expect(upsertCandidateAndActiveDocument).toHaveBeenCalledTimes(2);
    expect(createGraphSpy).toHaveBeenCalledTimes(2);
  });

  it('pauses/stops job state flags', async () => {
    const { bulkIngestionService } = await loadBulkIngestionService();
    bulkIngestionService.pause();
    bulkIngestionService.stop();
    expect(bulkIngestionService.isJobRunning()).toBe(false);
  });
});
