import { describe, expect, it } from 'vitest';
import { createInitialCareerStore } from '../_lib/careerStore.js';

describe('local careers demo seed', () => {
  it('keeps the showcased public job link available after a serverless cold start', () => {
    const store = createInitialCareerStore('local-workspace');
    expect(store.jobs.find((job) => job.slug === 'senior-software-engineer-react')).toMatchObject({
      jobId: 'j1',
      status: 'published',
      title: 'Senior Software Engineer (React)',
    });
  });

  it('does not seed other organizations', () => {
    expect(createInitialCareerStore('another-organization').jobs).toEqual([]);
  });
});
