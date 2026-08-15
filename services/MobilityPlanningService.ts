import type { Candidate, InternalCandidate, Job } from '../types';

export type MobilityOpportunity = {
  id: string;
  kind: 'requisition' | 'capability_gap';
  title: string;
  subtitle: string;
  targetRole: string;
  targetSkills: string[];
  location?: string;
  headcount: number;
  jobId?: string;
  demand: number;
  internalSupply: number;
};

export type MobilityReadiness = {
  candidate: InternalCandidate;
  score: number;
  readiness: 'ready_now' | 'near_ready' | 'develop';
  skillCoverage: number;
  matchedSkills: string[];
  missingSkills: string[];
  verifiedMatchedSkills: string[];
  aspirationAlignment: number;
  performanceScore: number;
  learningScore: number;
  confidence: number;
  constraints: string[];
  estimatedReadyMonths: number;
};

const normalize = (value: string) => value.trim().toLowerCase();

function hasSkill(candidate: Candidate, skill: string): boolean {
  const target = normalize(skill);
  return (candidate.skills ?? []).some((value) => {
    const candidateSkill = normalize(value);
    return candidateSkill === target || candidateSkill.includes(target) || target.includes(candidateSkill);
  });
}

function roleWords(value: string): string[] {
  return normalize(value).split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !['senior', 'junior', 'manager'].includes(word));
}

export class MobilityPlanningService {
  buildOpportunities(jobs: Job[], candidates: InternalCandidate[]): MobilityOpportunity[] {
    const openJobs = jobs.filter((job) => job.status === 'open');
    const requisitions = openJobs.map((job) => {
      const targetSkills = job.requiredSkills ?? [];
      const internalSupply = candidates.filter((candidate) => targetSkills.length > 0 && targetSkills.filter((skill) => hasSkill(candidate, skill)).length >= Math.ceil(targetSkills.length / 2)).length;
      const demand = Math.max(1, job.headcount ?? 1);
      return {
        id: `requisition:${job.id}`,
        kind: 'requisition' as const,
        title: job.title,
        subtitle: `${job.department} · ${job.location}`,
        targetRole: job.title,
        targetSkills,
        location: job.location,
        headcount: demand,
        jobId: job.id,
        demand,
        internalSupply,
      };
    });

    const skillDemand = new Map<string, { name: string; demand: number; jobs: Job[] }>();
    for (const job of openJobs) {
      for (const skill of job.requiredSkills ?? []) {
        const key = normalize(skill);
        const current = skillDemand.get(key) ?? { name: skill, demand: 0, jobs: [] };
        current.demand += Math.max(1, job.headcount ?? 1);
        current.jobs.push(job);
        skillDemand.set(key, current);
      }
    }

    const gaps = Array.from(skillDemand.entries()).flatMap(([key, value]) => {
      const internalSupply = candidates.filter((candidate) => hasSkill(candidate, value.name)).length;
      if (internalSupply >= value.demand) return [];
      const anchor = value.jobs[0];
      return [{
        id: `capability:${key}`,
        kind: 'capability_gap' as const,
        title: `${value.name} capability gap`,
        subtitle: `${value.demand} required · ${internalSupply} internal profiles · ${value.jobs.length} affected role${value.jobs.length === 1 ? '' : 's'}`,
        targetRole: anchor?.title ?? value.name,
        targetSkills: Array.from(new Set([value.name, ...(anchor?.requiredSkills ?? [])])),
        location: anchor?.location,
        headcount: Math.max(1, value.demand - internalSupply),
        jobId: anchor?.id,
        demand: value.demand,
        internalSupply,
      }];
    }).sort((left, right) => (right.demand - right.internalSupply) - (left.demand - left.internalSupply)).slice(0, 8);

    return [...requisitions, ...gaps];
  }

  rankCandidates(opportunity: MobilityOpportunity, candidates: InternalCandidate[]): MobilityReadiness[] {
    return candidates.map((candidate) => {
      const matchedSkills = opportunity.targetSkills.filter((skill) => hasSkill(candidate, skill));
      const missingSkills = opportunity.targetSkills.filter((skill) => !hasSkill(candidate, skill));
      const skillCoverage = opportunity.targetSkills.length ? Math.round((matchedSkills.length / opportunity.targetSkills.length) * 100) : 0;
      const verified = candidate.passport?.verifiedSkills ?? [];
      const verifiedMatchedSkills = matchedSkills.filter((skill) => verified.some((item) => normalize(item.skillName) === normalize(skill)));
      const aspirations = `${candidate.careerAspirations ?? ''} ${candidate.developmentGoals ?? ''}`.toLowerCase();
      const targetWords = roleWords(opportunity.targetRole);
      const aspirationAlignment = targetWords.some((word) => aspirations.includes(word)) ? 100 : aspirations.trim() ? 55 : 25;
      const performanceScore = candidate.performanceRating ? Math.min(100, candidate.performanceRating * 20) : 50;
      const learningScore = candidate.learningAgility ? Math.min(100, candidate.learningAgility * 20) : 50;
      const score = Math.round(skillCoverage * 0.55 + aspirationAlignment * 0.15 + performanceScore * 0.15 + learningScore * 0.15);
      const readiness: MobilityReadiness['readiness'] = score >= 75 && missingSkills.length <= 1 ? 'ready_now' : score >= 55 ? 'near_ready' : 'develop';
      const activePipelines = Object.values(candidate.pipelineStage ?? {}).filter((stage) => stage && !['hired', 'rejected'].includes(stage)).length;
      const constraints = [
        ...(!candidate.careerAspirations ? ['Career aspirations not recorded'] : []),
        ...(missingSkills.length ? [`${missingSkills.length} required skill gap${missingSkills.length === 1 ? '' : 's'}`] : []),
        ...(!verifiedMatchedSkills.length ? ['No matched skills are independently verified'] : []),
        ...(activePipelines ? [`Active in ${activePipelines} recruiting process${activePipelines === 1 ? '' : 'es'}`] : []),
        ...(opportunity.location && candidate.location && !normalize(opportunity.location).includes(normalize(candidate.location)) && !normalize(candidate.location).includes(normalize(opportunity.location)) ? ['Location preference needs confirmation'] : []),
      ];
      const evidenceShare = matchedSkills.length ? verifiedMatchedSkills.length / matchedSkills.length : 0;
      const confidence = Math.round(Math.min(100, 30 + evidenceShare * 50 + (candidate.profileStatus === 'complete' ? 20 : 0)));
      const estimatedReadyMonths = readiness === 'ready_now' ? Math.max(0, missingSkills.length) : readiness === 'near_ready' ? Math.max(2, missingSkills.length * 2) : Math.max(6, missingSkills.length * 3);
      return { candidate, score, readiness, skillCoverage, matchedSkills, missingSkills, verifiedMatchedSkills, aspirationAlignment, performanceScore, learningScore, confidence, constraints, estimatedReadyMonths };
    }).sort((left, right) => right.score - left.score || right.confidence - left.confidence);
  }
}

export const mobilityPlanningService = new MobilityPlanningService();
