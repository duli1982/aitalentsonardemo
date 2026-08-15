import { beforeEach, describe, expect, it } from 'vitest';
import { JobPersistenceService } from '../JobPersistenceService';
import { semanticSearchService } from '../SemanticSearchService';
import { pipelineEventService } from '../PipelineEventService';
import type { Job } from '../../types';

describe('local workspace persistence', () => {
  beforeEach(() => localStorage.clear());

  it('stores and reloads requisitions', async () => {
    const service = new JobPersistenceService();
    const job = { id: 'job-local', title: 'Local role', department: 'Technology', location: 'Budapest', requiredSkills: [], status: 'open' } as Job;
    expect(await service.upsertJob(job, 'local-workspace')).toEqual(job);
    expect(await service.getAll('local-workspace')).toEqual([job]);
  });

  it('searches the bundled candidate collection without a backend', async () => {
    const result = await semanticSearchService.search('React JavaScript', { limit: 5 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBeGreaterThan(0);
  });

  it('records candidate activity locally', async () => {
    await pipelineEventService.logEvent({ candidateId: 'candidate-1', jobId: 'job-1', eventType: 'advanced', actorType: 'user', summary: 'Advanced to screening' });
    const events = await pipelineEventService.listForCandidate('candidate-1');
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Advanced to screening');
  });
});
