import type { Job } from '../types';

const keyFor = (organizationId: string) => `talentSonar:${organizationId}:jobs`;
const read = (organizationId: string): Job[] => {
  try { const value = JSON.parse(localStorage.getItem(keyFor(organizationId)) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
};

export class JobPersistenceService {
  isAvailable(): boolean { return typeof localStorage !== 'undefined'; }
  async getAll(organizationId: string): Promise<Job[]> { return read(organizationId); }
  async upsertJob(job: Job, organizationId: string): Promise<Job | null> {
    if (!organizationId) return null;
    const jobs = read(organizationId);
    localStorage.setItem(keyFor(organizationId), JSON.stringify([job, ...jobs.filter((item) => item.id !== job.id)]));
    return job;
  }
  async deleteJob(id: string, organizationId = 'local-workspace'): Promise<boolean> {
    localStorage.setItem(keyFor(organizationId), JSON.stringify(read(organizationId).filter((job) => job.id !== id)));
    return true;
  }
}

export const jobPersistenceService = new JobPersistenceService();
