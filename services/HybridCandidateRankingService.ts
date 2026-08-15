import type { Job } from '../types';

export type RankableCandidate = {
  id: string;
  name: string;
  skills?: string[];
  semanticSimilarity?: number;
  title?: string;
  location?: string;
  experienceYears?: number;
};

export type HybridRankedCandidate<T extends RankableCandidate> = T & {
  hybridScore: number;
  semanticScore: number;
  structuredScore: number;
  reasons: string[];
  matchedMustHaveSkills: string[];
  missingMustHaveSkills: string[];
};

type RankingRequirements = {
  title?: string;
  location?: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  minimumExperienceYears?: number;
};

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'with', 'the', 'in', 'of', 'to', 'developer', 'engineer', 'manager', 'senior', 'junior']);

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9+#.]/g, ' ').replace(/\s+/g, ' ');
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function overlap(required: string[], available: string[]): { matched: string[]; ratio: number } {
  if (!required.length) return { matched: [], ratio: 1 };
  const matched = required.filter((requiredSkill) => available.some((skill) => skill === requiredSkill || skill.includes(requiredSkill) || requiredSkill.includes(skill)));
  return { matched, ratio: matched.length / required.length };
}

function titleFit(expected?: string, actual?: string): number {
  if (!expected || !actual) return 0.5;
  const expectedTerms = normalize(expected).split(' ').filter((term) => term.length > 2 && !STOP_WORDS.has(term));
  if (!expectedTerms.length) return 0.5;
  const actualText = normalize(actual);
  return expectedTerms.filter((term) => actualText.includes(term)).length / expectedTerms.length;
}

function queryRequirements(query: string, candidates: RankableCandidate[]): RankingRequirements {
  const normalizedQuery = normalize(query);
  const candidateSkills = unique(candidates.flatMap((candidate) => candidate.skills || []));
  return { title: query, requiredSkills: candidateSkills.filter((skill) => normalizedQuery.includes(skill)), niceToHaveSkills: [] };
}

function jobRequirements(job: Pick<Job, 'title' | 'location' | 'requiredSkills' | 'niceToHaveSkills' | 'description'>): RankingRequirements {
  const experienceMatch = `${job.title} ${job.description}`.match(/(\d+)\s*\+?\s*years?/i);
  return {
    title: job.title,
    location: job.location,
    requiredSkills: unique(job.requiredSkills || []),
    niceToHaveSkills: unique(job.niceToHaveSkills || []),
    minimumExperienceYears: experienceMatch ? Number(experienceMatch[1]) : undefined,
  };
}

export class HybridCandidateRankingService {
  rankForJob<T extends RankableCandidate>(job: Pick<Job, 'title' | 'location' | 'requiredSkills' | 'niceToHaveSkills' | 'description'>, candidates: T[]): HybridRankedCandidate<T>[] {
    return this.rank(jobRequirements(job), candidates);
  }

  rankForQuery<T extends RankableCandidate>(query: string, candidates: T[]): HybridRankedCandidate<T>[] {
    return this.rank(queryRequirements(query, candidates), candidates);
  }

  private rank<T extends RankableCandidate>(requirements: RankingRequirements, candidates: T[]): HybridRankedCandidate<T>[] {
    return candidates.map((candidate) => {
      const skills = unique(candidate.skills || []);
      const mustHave = overlap(requirements.requiredSkills, skills);
      const niceToHave = overlap(requirements.niceToHaveSkills, skills);
      const roleFit = titleFit(requirements.title, candidate.title);
      const experienceFit = requirements.minimumExperienceYears === undefined || candidate.experienceYears === undefined ? 0.5 : clamp(candidate.experienceYears / requirements.minimumExperienceYears);
      const locationFit = !requirements.location || !candidate.location ? 0.5 : normalize(requirements.location) === normalize(candidate.location) ? 1 : 0;
      const structured = 0.60 * mustHave.ratio + 0.10 * niceToHave.ratio + 0.15 * roleFit + 0.10 * experienceFit + 0.05 * locationFit;
      const hasStructuredEvidence = skills.length > 0 || Boolean(candidate.title) || candidate.experienceYears !== undefined || Boolean(candidate.location);
      const semantic = candidate.semanticSimilarity === undefined ? undefined : clamp(candidate.semanticSimilarity);
      const hybrid = semantic === undefined ? structured : hasStructuredEvidence ? 0.45 * semantic + 0.55 * structured : semantic;
      const missingMustHaveSkills = requirements.requiredSkills.filter((skill) => !mustHave.matched.includes(skill));
      return {
        ...candidate,
        hybridScore: Math.round(hybrid * 100),
        semanticScore: Math.round((semantic ?? 0) * 100),
        structuredScore: Math.round(structured * 100),
        reasons: [`Semantic: ${Math.round((semantic ?? 0) * 100)}%`, `Required skills: ${mustHave.matched.length}/${requirements.requiredSkills.length}`, ...(mustHave.matched.length ? [`Matched: ${mustHave.matched.join(', ')}`] : []), ...(missingMustHaveSkills.length ? [`Missing: ${missingMustHaveSkills.join(', ')}`] : [])],
        matchedMustHaveSkills: mustHave.matched,
        missingMustHaveSkills,
      };
    }).sort((left, right) => right.hybridScore - left.hybridScore || right.matchedMustHaveSkills.length - left.matchedMustHaveSkills.length || right.semanticScore - left.semanticScore || compareText(normalize(left.name), normalize(right.name)) || compareText(left.id, right.id));
  }
}

export const hybridCandidateRankingService = new HybridCandidateRankingService();
