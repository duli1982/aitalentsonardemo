import type { CareerApplication, CareerNotification, CareerStore, PublishedCareerJob } from '../api/_lib/careerStore';
import type { Job } from '../types';

async function response<T>(value: Response): Promise<T> { const body = await value.json().catch(() => ({})) as T & { ok?: boolean; message?: string }; if (!value.ok || body.ok === false) throw new Error(body.message || `Careers request failed (${value.status}).`); return body; }
async function post<T>(organizationId: string, action: string, input: Record<string, unknown>) { const body = await response<{ result: T }>(await fetch('/api/careers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, action, ...input }) })); return body.result; }
export const careerSiteService = {
  async publicJobs(organizationId: string) { return response<{ organization: { id: string; name: string }; jobs: PublishedCareerJob[] }>(await fetch(`/api/careers?organization=${encodeURIComponent(organizationId)}`)); },
  async publicJob(organizationId: string, slug: string) { return (await response<{ job: PublishedCareerJob }>(await fetch(`/api/careers?organization=${encodeURIComponent(organizationId)}&job=${encodeURIComponent(slug)}`))).job; },
  async admin(organizationId: string): Promise<CareerStore> { return (await response<{ store: CareerStore }>(await fetch(`/api/careers?organizationId=${encodeURIComponent(organizationId)}&scope=admin`))).store; },
  publish(organizationId: string, organizationSlug: string, job: Job, expiresAt?: string, assignedRecruiter?: PublishedCareerJob['assignedRecruiter']) { return post<PublishedCareerJob>(organizationId, 'publish', { organizationSlug, job, expiresAt, assignedRecruiter }); },
  unpublish(organizationId: string, jobId: string, status: 'paused' | 'closed' = 'paused') { return post<PublishedCareerJob>(organizationId, 'unpublish', { jobId, status }); },
  apply(organizationId: string, jobSlug: string, candidate: CareerApplication['candidate'], answers: CareerApplication['answers']) { return post<{ applicationId: string; candidateId: string; status: string; confirmationToken: string }>(organizationId, 'apply', { jobSlug, candidate, answers, consentConfirmed: true, privacyAccepted: true }); },
  markSynced(organizationId: string, applicationId: string) { return post<CareerApplication>(organizationId, 'mark_synced', { applicationId }); },
};
export type { PublishedCareerJob, CareerApplication, CareerNotification };
