import type { Candidate, CandidateSnapshot, CandidateType, Job, JobSnapshot, Job as JobType } from '../types';

function safeText(input: unknown, maxLen: number): string {
  const text = String(input ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function safeList(input: unknown, max = 50): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function safeNumber(input: unknown, fallback = 0): number {
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

type CandidateLike = Pick<Candidate, 'id' | 'name' | 'skills'> &
  Partial<
    Pick<
      Candidate,
      | 'type'
      | 'email'
      | 'location'
      | 'role'
      | 'currentRole'
      | 'suggestedRoleTitle'
      | 'experienceYears'
      | 'experience'
      | 'summary'
      | 'notes'
      | 'metadata'
    >
  >;

type JobLike = Pick<JobType, 'id' | 'title' | 'requiredSkills'> &
  Partial<Pick<JobType, 'department' | 'location' | 'description' | 'status' | 'companyContext'>>;

function getMeta(candidate: CandidateLike): Record<string, unknown> {
  const meta = candidate.metadata;
  if (meta && typeof meta === 'object') return meta as Record<string, unknown>;
  return {};
}

function metaString(meta: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function metaNumber(meta: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = meta[k];
    const n = safeNumber(v, NaN);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function toCandidateSnapshot(candidate: CandidateLike, capturedAt = new Date().toISOString()): CandidateSnapshot {
  const meta = getMeta(candidate);
  const type = (candidate.type as CandidateType) || 'uploaded';

  const role =
    safeText(candidate.role, 120) ||
    safeText(candidate.currentRole, 120) ||
    safeText(candidate.suggestedRoleTitle, 120) ||
    safeText(metaString(meta, ['role', 'title', 'currentRole', 'suggestedRoleTitle']), 120) ||
    'Candidate';

  const summary =
    safeText(candidate.summary, 1200) ||
    safeText(candidate.notes, 1200) ||
    safeText(metaString(meta, ['summary', 'content', 'notes']), 1200) ||
    '';

  const email =
    safeText(candidate.email, 180) ||
    safeText(metaString(meta, ['email']), 180) ||
    '';

  const location =
    safeText(candidate.location, 120) ||
    safeText(metaString(meta, ['location', 'city']), 120) ||
    '';

  const experienceYears =
    safeNumber(candidate.experienceYears, NaN) ||
    safeNumber(candidate.experience, NaN) ||
    (metaNumber(meta, ['experienceYears', 'experience']) ?? 0);

  const skills = safeList(candidate.skills, 60);

  return {
    id: String(candidate.id),
    name: safeText(candidate.name, 120) || 'Unknown',
    type,
    email,
    location,
    role,
    experienceYears: Math.max(0, experienceYears),
    skills,
    summary,
    capturedAt
  };
}

export function toJobSnapshot(job: JobLike, capturedAt = new Date().toISOString()): JobSnapshot {
  return {
    id: String(job.id),
    title: safeText(job.title, 160) || 'Role',
    department: safeText(job.department, 120) || '',
    location: safeText(job.location, 120) || '',
    requiredSkills: safeList(job.requiredSkills, 60),
    description: safeText(job.description, 8000) || '',
    status: (job.status as JobType['status']) || 'open',
    companyContext: job.companyContext as JobType['companyContext'],
    capturedAt
  };
}
