import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PublishedCareerJob = {
  id: string; organizationId: string; organizationSlug: string; jobId: string; slug: string; title: string; department: string; location: string;
  type?: string; salaryRange?: string; requiredSkills: string[]; niceToHaveSkills: string[]; description: string; company?: string; headcount?: number;
  status: 'published' | 'paused' | 'closed' | 'expired'; publishedAt: string; expiresAt?: string; updatedAt: string;
  assignedRecruiter?: { userId: string; displayName: string; email?: string };
};
export type CareerApplication = {
  id: string; candidateId: string; organizationId: string; publishedJobId: string; jobId: string; jobTitle: string; recruiterUserId?: string;
  candidate: { name: string; email: string; phone?: string; role?: string; location?: string; experienceYears?: number; skills: string[]; summary: string; education: string[]; languages: Array<{ language: string; level: string }>; fileName?: string };
  answers: { eligibility?: string; availability?: string; profileUrl?: string }; consentCapturedAt: string; privacyAcceptedAt: string;
  status: 'submitted' | 'duplicate_review' | 'synced' | 'withdrawn'; duplicateApplicationId?: string; submittedAt: string; syncedAt?: string;
};
export type CareerNotification = { id: string; applicationId: string; organizationId: string; recruiterUserId?: string; jobId: string; candidateId: string; title: string; detail: string; createdAt: string; acknowledgedAt?: string };
export type CareerStore = { jobs: PublishedCareerJob[]; applications: CareerApplication[]; notifications: CareerNotification[] };
const empty = (): CareerStore => ({ jobs: [], applications: [], notifications: [] });
const directory = path.resolve(process.cwd(), process.env.TALENT_SONAR_DATA_DIR || '.talent-sonar-data');
const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'default';
const fileFor = (organizationId: string) => path.join(directory, `${safe(organizationId)}-careers.json`);
const locks = new Map<string, Promise<unknown>>();
export const careerId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const careerNow = () => new Date().toISOString();
export const careerSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'opportunity';
export async function readCareerStore(organizationId: string): Promise<CareerStore> { try { const value = JSON.parse(await readFile(fileFor(organizationId), 'utf8')) as Partial<CareerStore>; return { jobs: Array.isArray(value.jobs) ? value.jobs : [], applications: Array.isArray(value.applications) ? value.applications : [], notifications: Array.isArray(value.notifications) ? value.notifications : [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty(); throw error; } }
export async function updateCareerStore<T>(organizationId: string, mutate: (store: CareerStore) => T | Promise<T>): Promise<T> { const previous = locks.get(organizationId) ?? Promise.resolve(); let release!: () => void; const current = new Promise<void>((resolve) => { release = resolve; }); const queued = previous.then(() => current); locks.set(organizationId, queued); await previous; try { const store = await readCareerStore(organizationId); const result = await mutate(store); await mkdir(directory, { recursive: true }); const target = fileFor(organizationId); const temp = `${target}.${process.pid}.${Date.now()}.tmp`; await writeFile(temp, JSON.stringify(store, null, 2), 'utf8'); await rename(temp, target); return result; } finally { release(); if (locks.get(organizationId) === queued) locks.delete(organizationId); } }
