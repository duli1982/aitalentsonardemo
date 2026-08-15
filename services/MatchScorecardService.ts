import type { CandidateSnapshot, JobSnapshot } from '../types';

export type EvidenceStrength = 'strong' | 'medium' | 'weak';
export type EvidenceSource =
  | 'profile.skills'
  | 'profile.role'
  | 'profile.summary'
  | 'profile.history'
  | 'inferred';

export interface ScorecardEvidence {
  id: string;
  title: string;
  detail: string;
  source: EvidenceSource;
  strength: EvidenceStrength;
}

export interface MatchSubscores {
  skillFit: number;
  seniorityFit: number;
  domainFit: number;
  evidenceQuality: number;
}

export interface MatchScorecard {
  overallScore: number;
  subscores: MatchSubscores;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  expectedSeniority: string;
  inferredSeniority: string;
  risks: string[];
  evidence: ScorecardEvidence[];
}

const STOPWORDS = new Set([
  'the',
  'and',
  'or',
  'to',
  'of',
  'in',
  'for',
  'with',
  'a',
  'an',
  'on',
  'at',
  'by',
  'from',
  'as',
  'is',
  'are',
  'be',
  'this',
  'that',
  'these',
  'those',
  'role',
  'position',
  'job',
  'team',
  'department'
]);

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s_-]/g, ' ')
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  if (!text) return [];
  return normalizeToken(text)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let intersection = 0;
  for (const t of aSet) {
    if (bSet.has(t)) intersection += 1;
  }
  const union = aSet.size + bSet.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

type SeniorityBand = {
  label: string;
  minYears: number;
  maxYears: number;
  keywords: string[];
};

const SENIORITY_BANDS: SeniorityBand[] = [
  { label: 'intern', minYears: 0, maxYears: 1, keywords: ['intern', 'internship'] },
  { label: 'junior', minYears: 0, maxYears: 2, keywords: ['junior', 'jr', 'associate'] },
  { label: 'mid', minYears: 2, maxYears: 5, keywords: ['mid', 'intermediate', 'ii', '2'] },
  { label: 'senior', minYears: 5, maxYears: 9, keywords: ['senior', 'sr', 'iii', '3'] },
  { label: 'lead', minYears: 7, maxYears: 30, keywords: ['lead', 'principal', 'staff', 'manager', 'head'] }
];

function inferSeniorityFromTitle(title: string): SeniorityBand | null {
  const t = normalizeToken(title);
  for (const band of SENIORITY_BANDS) {
    if (band.keywords.some((k) => t.includes(k))) return band;
  }
  return null;
}

function inferSeniorityFromYears(years: number | undefined): SeniorityBand | null {
  if (typeof years !== 'number' || !Number.isFinite(years)) return null;
  for (const band of SENIORITY_BANDS) {
    if (years >= band.minYears && years <= band.maxYears) return band;
  }
  return null;
}

function getCandidateYears(candidate: CandidateSnapshot): number | undefined {
  const years = candidate.experienceYears;
  if (typeof years !== 'number' || !Number.isFinite(years)) return undefined;
  return Math.max(0, years);
}

function computeSkillFit(candidate: CandidateSnapshot, job: JobSnapshot) {
  const requiredSkills = (job.requiredSkills || []).filter(Boolean);
  const candidateSkills = (candidate.skills || []).filter(Boolean);

  const reqLower = requiredSkills.map((s) => s.toLowerCase());
  const candLower = new Set(candidateSkills.map((s) => s.toLowerCase()));

  const matched: string[] = [];
  const missing: string[] = [];

  reqLower.forEach((req, idx) => {
    const original = requiredSkills[idx];
    if (candLower.has(req)) matched.push(original);
    else missing.push(original);
  });

  if (requiredSkills.length === 0) {
    return {
      matchedSkills: [],
      missingRequiredSkills: [],
      skillFit: 55
    };
  }

  const ratio = matched.length / requiredSkills.length;
  return {
    matchedSkills: matched,
    missingRequiredSkills: missing,
    skillFit: clamp(Math.round(ratio * 100))
  };
}

function computeSeniorityFit(candidate: CandidateSnapshot, job: JobSnapshot) {
  const expected = inferSeniorityFromTitle(job.title) ?? { label: 'unspecified', minYears: 0, maxYears: 30, keywords: [] };
  const years = getCandidateYears(candidate);
  const inferred = inferSeniorityFromYears(years ?? NaN) ?? { label: years == null ? 'unknown' : 'unspecified', minYears: 0, maxYears: 30, keywords: [] };

  if (expected.label === 'unspecified' && inferred.label === 'unknown') {
    return { expectedSeniority: expected.label, inferredSeniority: inferred.label, seniorityFit: 55 };
  }

  if (years == null) {
    // No years to judge; don’t punish too much, but mark as uncertain.
    return { expectedSeniority: expected.label, inferredSeniority: inferred.label, seniorityFit: expected.label === 'unspecified' ? 60 : 50 };
  }

  // Score based on distance from expected range.
  if (years >= expected.minYears && years <= expected.maxYears) {
    return { expectedSeniority: expected.label, inferredSeniority: inferred.label, seniorityFit: 90 };
  }

  const distance = years < expected.minYears ? expected.minYears - years : years - expected.maxYears;
  const penalty = Math.min(70, Math.round(distance * 15));
  return { expectedSeniority: expected.label, inferredSeniority: inferred.label, seniorityFit: clamp(90 - penalty) };
}

function computeDomainFit(candidate: CandidateSnapshot, job: JobSnapshot) {
  const role = String(candidate.role || '').trim();
  const jobText = [job.title, job.department, ...(job.requiredSkills || [])].filter(Boolean).join(' ');
  const candText = [role, ...(candidate.skills || [])].filter(Boolean).join(' ');

  const a = tokenize(jobText);
  const b = tokenize(candText);
  // Scale up a bit; Jaccard is often small on short texts.
  const score = clamp(Math.round(jaccard(a, b) * 180));
  const overlap = Array.from(new Set(a.filter((t) => new Set(b).has(t)))).slice(0, 8);
  return { domainFit: score, overlapKeywords: overlap };
}

function computeEvidenceQuality(candidate: CandidateSnapshot, job: JobSnapshot) {
  const hasSummary = Boolean(candidate.summary);
  const hasEmail = Boolean(candidate.email && String(candidate.email).includes('@'));
  const skillsCount = Array.isArray(candidate.skills) ? candidate.skills.length : 0;
  const years = getCandidateYears(candidate);
  const hasYears = typeof years === 'number' && Number.isFinite(years);
  const hasRequirements = Array.isArray(job.requiredSkills) && job.requiredSkills.length > 0;

  let score = 35;
  if (skillsCount >= 10) score += 20;
  else if (skillsCount >= 6) score += 12;
  else if (skillsCount >= 3) score += 6;
  if (hasSummary) score += 12;
  if (hasYears) score += 12;
  if (hasEmail) score += 5;
  if (hasRequirements) score += 4;

  return clamp(score);
}

function buildEvidence(params: {
  candidate: CandidateSnapshot;
  job: JobSnapshot;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  expectedSeniority: string;
  inferredSeniority: string;
  overlapKeywords: string[];
}): ScorecardEvidence[] {
  const { candidate, job, matchedSkills, missingRequiredSkills, expectedSeniority, inferredSeniority, overlapKeywords } = params;

  const evidence: ScorecardEvidence[] = [];

  matchedSkills.slice(0, 10).forEach((skill) => {
    evidence.push({
      id: `skill:${skill.toLowerCase()}`,
      title: `Skill match: ${skill}`,
      detail: `Candidate lists "${skill}" and it appears in required skills for "${job.title}".`,
      source: 'profile.skills',
      strength: 'medium'
    });
  });

  if (missingRequiredSkills.length > 0) {
    evidence.push({
      id: 'risk:missing-required',
      title: 'Missing required skills',
      detail: `Missing: ${missingRequiredSkills.slice(0, 8).join(', ')}${missingRequiredSkills.length > 8 ? '…' : ''}.`,
      source: 'profile.skills',
      strength: 'weak'
    });
  }

  const years = getCandidateYears(candidate);
  if (typeof years === 'number') {
    evidence.push({
      id: 'seniority:years',
      title: 'Experience signal',
      detail: `Profile indicates ~${years} years of experience; expected seniority for this role is "${expectedSeniority}".`,
      source: 'profile.history',
      strength: expectedSeniority === 'unspecified' ? 'medium' : 'strong'
    });
  } else {
    evidence.push({
      id: 'seniority:unknown',
      title: 'Experience signal',
      detail: 'No explicit years-of-experience found on profile; seniority fit is inferred with lower confidence.',
      source: 'inferred',
      strength: 'weak'
    });
  }

  const role = String(candidate.role || '').trim();
  if (role) {
    evidence.push({
      id: 'role:title',
      title: 'Role/title signal',
      detail: `Candidate role/title: "${role}". Inferred seniority: "${inferredSeniority}".`,
      source: 'profile.role',
      strength: 'medium'
    });
  }

  if (overlapKeywords.length > 0) {
    evidence.push({
      id: 'domain:overlap',
      title: 'Domain overlap',
      detail: `Shared keywords between job and profile: ${overlapKeywords.join(', ')}.`,
      source: 'inferred',
      strength: 'medium'
    });
  }

  const summary = String(candidate.summary || '').trim();
  if (summary) {
    evidence.push({
      id: 'summary:present',
      title: 'Summary available',
      detail: 'Profile contains a summary/notes section used for explainability (not shown as a direct quote here).',
      source: 'profile.summary',
      strength: 'weak'
    });
  }

  return evidence;
}

function buildRisks(params: {
  missingRequiredSkills: string[];
  expectedSeniority: string;
  inferredSeniority: string;
  seniorityFit: number;
  evidenceQuality: number;
  candidateSkillsCount: number;
}): string[] {
  const { missingRequiredSkills, expectedSeniority, inferredSeniority, seniorityFit, evidenceQuality, candidateSkillsCount } = params;
  const risks: string[] = [];

  if (missingRequiredSkills.length > 0) {
    risks.push(`Missing ${missingRequiredSkills.length} required skill${missingRequiredSkills.length === 1 ? '' : 's'}.`);
  }

  if (expectedSeniority !== 'unspecified' && inferredSeniority !== 'unknown' && expectedSeniority !== inferredSeniority && seniorityFit < 70) {
    risks.push(`Possible seniority mismatch (expected "${expectedSeniority}", inferred "${inferredSeniority}").`);
  }

  if (evidenceQuality < 55) {
    risks.push('Low evidence quality (profile is sparse or missing key fields).');
  }

  if (candidateSkillsCount < 4) {
    risks.push('Very small skill list; match confidence may be overstated.');
  }

  return risks;
}

export function computeMatchScorecard(params: { candidate: CandidateSnapshot; job: JobSnapshot }): MatchScorecard {
  const { candidate, job } = params;

  const { matchedSkills, missingRequiredSkills, skillFit } = computeSkillFit(candidate, job);
  const { expectedSeniority, inferredSeniority, seniorityFit } = computeSeniorityFit(candidate, job);
  const { domainFit, overlapKeywords } = computeDomainFit(candidate, job);
  const evidenceQuality = computeEvidenceQuality(candidate, job);

  const overallScore = clamp(
    Math.round(skillFit * 0.45 + seniorityFit * 0.25 + domainFit * 0.2 + evidenceQuality * 0.1)
  );

  const evidence = buildEvidence({
    candidate,
    job,
    matchedSkills,
    missingRequiredSkills,
    expectedSeniority,
    inferredSeniority,
    overlapKeywords
  });

  const risks = buildRisks({
    missingRequiredSkills,
    expectedSeniority,
    inferredSeniority,
    seniorityFit,
    evidenceQuality,
    candidateSkillsCount: Array.isArray(candidate.skills) ? candidate.skills.length : 0
  });

  return {
    overallScore,
    subscores: {
      skillFit,
      seniorityFit,
      domainFit,
      evidenceQuality
    },
    matchedSkills,
    missingRequiredSkills,
    expectedSeniority,
    inferredSeniority,
    risks,
    evidence
  };
}
