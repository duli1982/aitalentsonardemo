import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
export const createInitialCareerStore = (organizationId: string): CareerStore => {
  if (organizationId !== 'local-workspace' || process.env.TALENT_SONAR_DISABLE_DEMO_SEED === 'true') return { jobs: [], applications: [], notifications: [] };
  const publishedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
  // The serverless demo intentionally has no database. These deterministic
  // public snapshots keep showcase links usable after a Vercel cold start.
  const jobs: PublishedCareerJob[] = [
    {
      id: 'demo-career-j1', organizationId, organizationSlug: organizationId, jobId: 'j1', slug: 'senior-software-engineer-react',
      title: 'Senior Software Engineer (React)', department: 'Technology', location: 'Budapest, Hungary', type: 'Full-time',
      requiredSkills: ['React', 'Node.js', 'TypeScript', 'AWS', 'Agile', 'Microservices'], niceToHaveSkills: [],
      description: 'Join our dynamic tech team to build next-generation software solutions. You will contribute across the full software development lifecycle, from conception to deployment. Strong React, Node.js, TypeScript and AWS experience is important, together with practical knowledge of microservices and Agile delivery.',
      company: 'Talent Sonar', status: 'published', publishedAt, expiresAt, updatedAt: publishedAt,
      assignedRecruiter: { userId: 'recruiter-technology', displayName: 'Recruiter A', email: 'recruiter.a@local.invalid' },
    },
    {
      id: 'demo-career-j2', organizationId, organizationSlug: organizationId, jobId: 'j2', slug: 'marketing-manager',
      title: 'Marketing Manager', department: 'Marketing', location: 'Debrecen, Hungary', type: 'Full-time',
      requiredSkills: ['Digital Marketing', 'SEO/SEM', 'Content Strategy', 'Social Media Marketing', 'Analytics'], niceToHaveSkills: [],
      description: 'Lead marketing strategy and execution across acquisition, brand and community channels. This role combines campaign leadership, content strategy, analytics and close partnership with commercial and recruiting teams.',
      company: 'Talent Sonar', status: 'published', publishedAt, expiresAt, updatedAt: publishedAt,
      assignedRecruiter: { userId: 'recruiter-business', displayName: 'Recruiter B', email: 'recruiter.b@local.invalid' },
    },
  ];
  return { jobs, applications: [], notifications: [] };
};
const directory = process.env.TALENT_SONAR_DATA_DIR
  ? path.resolve(process.env.TALENT_SONAR_DATA_DIR)
  : process.env.VERCEL
    ? path.join(tmpdir(), 'talent-sonar-data')
    : path.resolve(process.cwd(), '.talent-sonar-data');
const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'default';
const fileFor = (organizationId: string) => path.join(directory, `${safe(organizationId)}-careers.json`);
const locks = new Map<string, Promise<unknown>>();
export const careerId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const careerNow = () => new Date().toISOString();
export const careerSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'opportunity';
export async function readCareerStore(organizationId: string): Promise<CareerStore> { try { const value = JSON.parse(await readFile(fileFor(organizationId), 'utf8')) as Partial<CareerStore>; return { jobs: Array.isArray(value.jobs) ? value.jobs : [], applications: Array.isArray(value.applications) ? value.applications : [], notifications: Array.isArray(value.notifications) ? value.notifications : [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return createInitialCareerStore(organizationId); throw error; } }
export async function updateCareerStore<T>(organizationId: string, mutate: (store: CareerStore) => T | Promise<T>): Promise<T> { const previous = locks.get(organizationId) ?? Promise.resolve(); let release!: () => void; const current = new Promise<void>((resolve) => { release = resolve; }); const queued = previous.then(() => current); locks.set(organizationId, queued); await previous; try { const store = await readCareerStore(organizationId); const result = await mutate(store); await mkdir(directory, { recursive: true }); const target = fileFor(organizationId); const temp = `${target}.${process.pid}.${Date.now()}.tmp`; await writeFile(temp, JSON.stringify(store, null, 2), 'utf8'); await rename(temp, target); return result; } finally { release(); if (locks.get(organizationId) === queued) locks.delete(organizationId); } }
