import type { OrganizationRole } from '../contexts/AuthContext';
import type { Candidate, Job } from '../types';
import { canConfigureRecruiters, canGenerateTalentIntel, canManageAllocations, canShareTalentIntel, canViewTeamPerformance } from '../utils/permissions';
import type { EngagementMessage, SharedTalentPool, SharedTask } from './SharedOperationsService';
import type { ExternalJobPosting } from './JobIntelligenceService';

export type WorkforceActor = { userId: string; role: OrganizationRole };
export type RecruiterOperatingRole = 'recruiter' | 'team_lead' | 'sourcing_manager';
export type RequisitionComplexity = 1 | 2 | 3 | 4 | 5;

export type RecruiterProfile = {
  userId: string;
  displayName: string;
  email: string;
  operatingRole: RecruiterOperatingRole;
  managerUserId?: string;
  team: string;
  location: string;
  skills: string[];
  subSkills: string[];
  languages: string[];
  verticals: string[];
  weeklyCapacityHours: number;
  unavailablePercent: number;
  active: boolean;
  configurationSource: 'configured' | 'starter';
  updatedAt: string;
};

export type AllocationScoreBreakdown = {
  capacity: number;
  skillAlignment: number;
  complexityFit: number;
  historicalSuccess: number;
  locationAlignment: number;
};

export type AllocationRecommendation = {
  recruiter: RecruiterProfile;
  score: number;
  recommendedHours: number;
  complexity: RequisitionComplexity;
  remainingHours: number;
  breakdown: AllocationScoreBreakdown;
  rationale: string[];
};

export type WorkAllocation = {
  id: string;
  jobId: string;
  recruiterUserId: string;
  allocatedHours: number;
  complexity: RequisitionComplexity;
  recommendationScore: number;
  scoreBreakdown: AllocationScoreBreakdown;
  rationale: string[];
  status: 'assigned' | 'completed' | 'cancelled';
  assignedByUserId: string;
  assignedAt: string;
  updatedAt: string;
};

export type RecruiterKpiSnapshot = {
  id: string;
  recruiterUserId: string;
  capturedAt: string;
  capacityUtilization: number;
  activeRequisitions: number;
  timeToSubmitDays: number | null;
  talentPoolHealth: number | null;
  engagementSuccess: number | null;
  poolToHireConversion: number | null;
  assignmentSuccess: number | null;
};

export type TalentIntelReport = {
  id: string;
  title: string;
  jobId?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'shared';
  audience: Array<'hiring_manager' | 'talent_acquisition'>;
  summary: string;
  candidateSignals: string[];
  marketSignals: string[];
  recommendations: string[];
  sourceNote: string;
  sharedAt?: string;
};

export type TalentPoolHealthSnapshot = {
  id: string;
  poolId: string;
  capturedAt: string;
  score: number;
  memberCount: number;
  profileCompleteness: number;
  skillCoverage: number;
  availability: number;
  engagement: number | null;
  conversionToHire: number;
  risk: 'healthy' | 'watch' | 'at-risk';
};

type OperatingWorkspace = {
  profiles: RecruiterProfile[];
  allocations: WorkAllocation[];
  kpiSnapshots: RecruiterKpiSnapshot[];
  reports: TalentIntelReport[];
  poolHealthSnapshots: TalentPoolHealthSnapshot[];
};

const storageKey = (organizationId: string) => `talentSonar:${organizationId}:workforceOperatingModel:v1`;
const eventName = (organizationId: string) => `talentSonar:workforceOperatingModel:${organizationId}`;
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const normalize = (value: string) => value.trim().toLowerCase();
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(value)));

function starterProfiles(): RecruiterProfile[] {
  const updatedAt = now();
  return [
    { userId: 'local-user', displayName: 'Local user', email: 'local@talentsonar.invalid', operatingRole: 'sourcing_manager', team: 'GBS Sourcing', location: 'Budapest', skills: ['Talent Intelligence', 'Capacity Planning', 'Stakeholder Management'], subSkills: ['Work allocation', 'Hiring strategy'], languages: ['English', 'Hungarian'], verticals: ['Technology', 'Business Services'], weeklyCapacityHours: 40, unavailablePercent: 0, active: true, configurationSource: 'starter', updatedAt },
    { userId: 'recruiter-technology', displayName: 'Recruiter A', email: 'recruiter.a@local.invalid', operatingRole: 'recruiter', managerUserId: 'local-user', team: 'GBS Sourcing', location: 'Budapest', skills: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'QA Automation', 'DevOps'], subSkills: ['Engineering sourcing', 'Technical screening'], languages: ['English', 'Hungarian'], verticals: ['Technology'], weeklyCapacityHours: 40, unavailablePercent: 10, active: true, configurationSource: 'starter', updatedAt },
    { userId: 'recruiter-business', displayName: 'Recruiter B', email: 'recruiter.b@local.invalid', operatingRole: 'recruiter', managerUserId: 'local-user', team: 'GBS Sourcing', location: 'Debrecen', skills: ['Project Management', 'Marketing', 'Analytics', 'Stakeholder Engagement'], subSkills: ['Professional services', 'Campaign sourcing'], languages: ['English', 'German'], verticals: ['Marketing', 'Business Intelligence'], weeklyCapacityHours: 36, unavailablePercent: 0, active: true, configurationSource: 'starter', updatedAt },
    { userId: 'recruiter-operations', displayName: 'Recruiter C', email: 'recruiter.c@local.invalid', operatingRole: 'recruiter', managerUserId: 'local-user', team: 'GBS Sourcing', location: 'Remote', skills: ['Human Resources', 'Quality Assurance', 'Manufacturing', 'Compliance'], subSkills: ['Volume hiring', 'Regulated operations'], languages: ['English', 'French'], verticals: ['Human Resources', 'Pharma Manufacturing'], weeklyCapacityHours: 40, unavailablePercent: 20, active: true, configurationSource: 'starter', updatedAt },
  ];
}

function emptyWorkspace(): OperatingWorkspace {
  return { profiles: starterProfiles(), allocations: [], kpiSnapshots: [], reports: [], poolHealthSnapshots: [] };
}

function read(organizationId: string): OperatingWorkspace {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(organizationId)) ?? '{}') as Partial<OperatingWorkspace>;
    return {
      profiles: Array.isArray(parsed.profiles) && parsed.profiles.length ? parsed.profiles : starterProfiles(),
      allocations: Array.isArray(parsed.allocations) ? parsed.allocations : [],
      kpiSnapshots: Array.isArray(parsed.kpiSnapshots) ? parsed.kpiSnapshots : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      poolHealthSnapshots: Array.isArray(parsed.poolHealthSnapshots) ? parsed.poolHealthSnapshots : [],
    };
  } catch {
    return emptyWorkspace();
  }
}

function write(organizationId: string, value: OperatingWorkspace) {
  localStorage.setItem(storageKey(organizationId), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(eventName(organizationId)));
}

function requirePermission(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function complexityFor(job: Job): RequisitionComplexity {
  let score = 1;
  if (job.requiredSkills.length >= 4) score += 1;
  if (job.requiredSkills.length >= 7) score += 1;
  if ((job.headcount ?? 1) >= 3) score += 1;
  if (/senior|lead|principal|director|specialist/i.test(job.title)) score += 1;
  return Math.min(5, score) as RequisitionComplexity;
}

function recommendedHours(complexity: RequisitionComplexity, headcount = 1) {
  return Math.min(24, 4 + complexity * 2 + Math.max(0, headcount - 1) * 2);
}

function daysBetween(start?: string, end?: string): number | null {
  const startAt = start ? Date.parse(start) : Number.NaN;
  const endAt = end ? Date.parse(end) : Number.NaN;
  return Number.isFinite(startAt) && Number.isFinite(endAt) ? Math.max(0, Math.round((endAt - startAt) / 86_400_000)) : null;
}

function firstSubmitDate(job: Job, candidates: Candidate[]) {
  return candidates.flatMap((candidate) => candidate.pipelineHistory ?? [])
    .filter((entry) => entry.jobId === job.id && ['long_list', 'screening', 'scheduling', 'interview', 'offer', 'hired'].includes(entry.stage))
    .map((entry) => entry.timestamp).sort()[0];
}

export function calculateRecruiterKpis(profile: RecruiterProfile, jobs: Job[], candidates: Candidate[], allocations: WorkAllocation[], pools: SharedTalentPool[], poolHealth: TalentPoolHealthSnapshot[], messages: EngagementMessage[]): Omit<RecruiterKpiSnapshot, 'id' | 'capturedAt' | 'recruiterUserId'> {
  const assigned = allocations.filter((allocation) => allocation.recruiterUserId === profile.userId && allocation.status === 'assigned');
  const assignedJobs = jobs.filter((job) => assigned.some((allocation) => allocation.jobId === job.id));
  const availableHours = Math.max(1, profile.weeklyCapacityHours * (1 - profile.unavailablePercent / 100));
  const utilizedHours = assigned.reduce((sum, allocation) => sum + allocation.allocatedHours, 0);
  const submitTimes = assignedJobs.map((job) => daysBetween(job.postedDate ?? job.posted, firstSubmitDate(job, candidates))).filter((value): value is number => value !== null);
  const ownedPools = pools.filter((pool) => pool.ownerUserId === profile.userId);
  const latestPoolScores = ownedPools.map((pool) => poolHealth.filter((snapshot) => snapshot.poolId === pool.id).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]?.score).filter((score): score is number => typeof score === 'number');
  const recruiterMessages = messages.filter((message) => message.createdByUserId === profile.userId);
  const sentMessages = recruiterMessages.filter((message) => ['sent', 'delivered', 'opened', 'replied'].includes(message.status));
  const memberIds = new Set(ownedPools.flatMap((pool) => pool.candidateIds));
  const hiredMembers = candidates.filter((candidate) => memberIds.has(candidate.id) && (candidate.employmentStatus === 'hired' || Object.values(candidate.pipelineStage ?? {}).includes('hired'))).length;
  const completedAssignments = allocations.filter((allocation) => allocation.recruiterUserId === profile.userId && allocation.status === 'completed');
  const successfulAssignments = completedAssignments.filter((allocation) => candidates.some((candidate) => candidate.pipelineStage?.[allocation.jobId] === 'hired')).length;
  return {
    capacityUtilization: clamp((utilizedHours / availableHours) * 100),
    activeRequisitions: assignedJobs.filter((job) => job.status !== 'closed').length,
    timeToSubmitDays: submitTimes.length ? Math.round(submitTimes.reduce((sum, value) => sum + value, 0) / submitTimes.length) : null,
    talentPoolHealth: latestPoolScores.length ? Math.round(latestPoolScores.reduce((sum, value) => sum + value, 0) / latestPoolScores.length) : null,
    engagementSuccess: sentMessages.length ? clamp((recruiterMessages.filter((message) => message.status === 'replied').length / sentMessages.length) * 100) : null,
    poolToHireConversion: memberIds.size ? clamp((hiredMembers / memberIds.size) * 100) : null,
    assignmentSuccess: completedAssignments.length ? clamp((successfulAssignments / completedAssignments.length) * 100) : null,
  };
}

export function calculatePoolHealth(pool: SharedTalentPool, candidates: Candidate[], messages: EngagementMessage[]): Omit<TalentPoolHealthSnapshot, 'id' | 'capturedAt' | 'poolId'> {
  const members = candidates.filter((candidate) => pool.candidateIds.includes(candidate.id));
  const memberIds = new Set(members.map((candidate) => candidate.id));
  const completeness = members.length ? clamp(members.reduce((sum, candidate) => sum + ([candidate.email, candidate.location, candidate.currentRole ?? candidate.role, candidate.skills.length ? 'skills' : ''].filter(Boolean).length / 4) * 100, 0) / members.length) : 0;
  const targetSkills = pool.clientCriteria?.requiredSkills?.length ? pool.clientCriteria.requiredSkills : pool.targetSkills ?? [];
  const normalizedTargets = targetSkills.map(normalize);
  const skillCoverage = !normalizedTargets.length ? (members.length ? clamp(members.reduce((sum, candidate) => sum + Math.min(100, candidate.skills.length * 12.5), 0) / members.length) : 0) : clamp((normalizedTargets.filter((skill) => members.some((candidate) => candidate.skills.some((candidateSkill) => normalize(candidateSkill) === skill))).length / normalizedTargets.length) * 100);
  const availability = members.length ? clamp((members.filter((candidate) => candidate.employmentStatus !== 'hired' && (!pool.clientCriteria?.availabilityRequirement || String(candidate.availability ?? '').toLowerCase().includes(pool.clientCriteria.availabilityRequirement.toLowerCase()) || /available|immediate/i.test(candidate.availability ?? ''))).length / members.length) * 100) : 0;
  const poolMessages = messages.filter((message) => memberIds.has(message.candidateId));
  const sentMessages = poolMessages.filter((message) => ['sent', 'delivered', 'opened', 'replied'].includes(message.status));
  const engagement = sentMessages.length ? clamp((poolMessages.filter((message) => ['opened', 'replied'].includes(message.status)).length / sentMessages.length) * 100) : null;
  const hired = members.filter((candidate) => candidate.employmentStatus === 'hired' || Object.values(candidate.pipelineStage ?? {}).includes('hired')).length;
  const conversionToHire = members.length ? clamp((hired / members.length) * 100) : 0;
  const score = clamp(completeness * 0.25 + skillCoverage * 0.35 + availability * 0.25 + (engagement ?? 50) * 0.15);
  return { score, memberCount: members.length, profileCompleteness: completeness, skillCoverage, availability, engagement, conversionToHire, risk: score >= 75 ? 'healthy' : score >= 50 ? 'watch' : 'at-risk' };
}

export const workforceOperatingService = {
  subscribe(organizationId: string, onChange: () => void) {
    const handler = () => onChange();
    const storage = (event: StorageEvent) => { if (event.key === storageKey(organizationId)) onChange(); };
    window.addEventListener(eventName(organizationId), handler);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(eventName(organizationId), handler); window.removeEventListener('storage', storage); };
  },

  listProfiles(organizationId: string, actor: WorkforceActor) {
    const profiles = read(organizationId).profiles.filter((profile) => profile.active);
    return canViewTeamPerformance(actor.role) ? profiles : profiles.filter((profile) => profile.userId === actor.userId);
  },

  getOwnProfile(organizationId: string, actor: WorkforceActor) {
    return read(organizationId).profiles.find((profile) => profile.userId === actor.userId) ?? null;
  },

  saveProfile(organizationId: string, actor: WorkforceActor, profile: RecruiterProfile) {
    requirePermission(canConfigureRecruiters(actor.role), 'Only sourcing managers and administrators can configure recruiter operating profiles.');
    const store = read(organizationId);
    store.profiles = [...store.profiles.filter((item) => item.userId !== profile.userId), { ...profile, configurationSource: 'configured', updatedAt: now() }];
    write(organizationId, store);
  },

  listAllocations(organizationId: string, actor: WorkforceActor) {
    const allocations = read(organizationId).allocations;
    return canViewTeamPerformance(actor.role) ? allocations : allocations.filter((allocation) => allocation.recruiterUserId === actor.userId);
  },

  recommendAllocations(organizationId: string, actor: WorkforceActor, job: Job, candidates: Candidate[]): AllocationRecommendation[] {
    requirePermission(canManageAllocations(actor.role), 'Only team leads and sourcing managers can generate allocation recommendations.');
    const store = read(organizationId);
    const complexity = complexityFor(job);
    const hours = recommendedHours(complexity, job.headcount);
    const required = new Set(job.requiredSkills.map(normalize));
    return store.profiles.filter((profile) => profile.active && profile.operatingRole === 'recruiter').map((profile) => {
      const active = store.allocations.filter((allocation) => allocation.recruiterUserId === profile.userId && allocation.status === 'assigned');
      const available = Math.max(1, profile.weeklyCapacityHours * (1 - profile.unavailablePercent / 100));
      const remaining = Math.max(0, available - active.reduce((sum, allocation) => sum + allocation.allocatedHours, 0));
      const expertise = new Set([...profile.skills, ...profile.subSkills, ...profile.verticals].map(normalize));
      const matched = [...required].filter((skill) => expertise.has(skill));
      const skillAlignment = required.size ? clamp((matched.length / required.size) * 100) : 60;
      const capacity = clamp((remaining / Math.max(hours, 1)) * 100);
      const assignedJobIds = new Set(store.allocations.filter((allocation) => allocation.recruiterUserId === profile.userId).map((allocation) => allocation.jobId));
      const assignedCandidates = candidates.filter((candidate) => Object.keys(candidate.pipelineStage ?? {}).some((jobId) => assignedJobIds.has(jobId)));
      const hired = assignedCandidates.filter((candidate) => Object.values(candidate.pipelineStage ?? {}).includes('hired')).length;
      const historicalSuccess = assignedCandidates.length ? clamp((hired / assignedCandidates.length) * 100) : 55;
      const complexityFit = clamp(45 + Math.min(40, profile.subSkills.length * 8) + (complexity <= 3 ? 15 : 0));
      const locationAlignment = /remote/i.test(profile.location) || normalize(job.location).includes(normalize(profile.location)) ? 100 : 60;
      const breakdown = { capacity, skillAlignment, complexityFit, historicalSuccess, locationAlignment };
      const score = clamp(capacity * 0.35 + skillAlignment * 0.30 + complexityFit * 0.15 + historicalSuccess * 0.15 + locationAlignment * 0.05);
      const rationale = [
        `${remaining.toFixed(0)} of ${available.toFixed(0)} weekly hours remain`,
        required.size ? `${matched.length}/${required.size} required skills align` : 'No required skills were defined',
        `${profile.verticals.join(', ') || 'Generalist'} vertical experience`,
      ];
      return { recruiter: profile, score, recommendedHours: hours, complexity, remainingHours: Math.round(remaining), breakdown, rationale };
    }).sort((left, right) => right.score - left.score || right.remainingHours - left.remainingHours);
  },

  assign(organizationId: string, actor: WorkforceActor, job: Job, recommendation: AllocationRecommendation) {
    requirePermission(canManageAllocations(actor.role), 'Only team leads and sourcing managers can assign requisitions.');
    const store = read(organizationId);
    const timestamp = now();
    store.allocations = store.allocations.map((allocation) => allocation.jobId === job.id && allocation.status === 'assigned' ? { ...allocation, status: 'cancelled', updatedAt: timestamp } : allocation);
    store.allocations.unshift({ id: createId(), jobId: job.id, recruiterUserId: recommendation.recruiter.userId, allocatedHours: recommendation.recommendedHours, complexity: recommendation.complexity, recommendationScore: recommendation.score, scoreBreakdown: recommendation.breakdown, rationale: recommendation.rationale, status: 'assigned', assignedByUserId: actor.userId, assignedAt: timestamp, updatedAt: timestamp });
    write(organizationId, store);
  },

  completeAllocation(organizationId: string, actor: WorkforceActor, allocationId: string) {
    const store = read(organizationId);
    const allocation = store.allocations.find((item) => item.id === allocationId);
    requirePermission(Boolean(allocation && (canManageAllocations(actor.role) || allocation.recruiterUserId === actor.userId)), 'You cannot update this allocation.');
    store.allocations = store.allocations.map((item) => item.id === allocationId ? { ...item, status: 'completed', updatedAt: now() } : item);
    write(organizationId, store);
  },

  captureKpiSnapshot(organizationId: string, actor: WorkforceActor, profile: RecruiterProfile, metrics: Omit<RecruiterKpiSnapshot, 'id' | 'capturedAt' | 'recruiterUserId'>) {
    requirePermission(canViewTeamPerformance(actor.role) || actor.userId === profile.userId, 'You cannot capture metrics for this recruiter.');
    const store = read(organizationId);
    const today = new Date().toISOString().slice(0, 10);
    const existing = store.kpiSnapshots.find((snapshot) => snapshot.recruiterUserId === profile.userId && snapshot.capturedAt.startsWith(today));
    if (existing && existing.capacityUtilization === metrics.capacityUtilization && existing.activeRequisitions === metrics.activeRequisitions && existing.timeToSubmitDays === metrics.timeToSubmitDays && existing.talentPoolHealth === metrics.talentPoolHealth && existing.engagementSuccess === metrics.engagementSuccess && existing.poolToHireConversion === metrics.poolToHireConversion && existing.assignmentSuccess === metrics.assignmentSuccess) return existing;
    const snapshot: RecruiterKpiSnapshot = { id: existing?.id ?? createId(), recruiterUserId: profile.userId, capturedAt: now(), ...metrics };
    store.kpiSnapshots = [snapshot, ...store.kpiSnapshots.filter((item) => item.id !== snapshot.id)].slice(0, 1500);
    write(organizationId, store);
    return snapshot;
  },

  listKpiSnapshots(organizationId: string, actor: WorkforceActor, recruiterUserId?: string) {
    const target = recruiterUserId ?? actor.userId;
    requirePermission(canViewTeamPerformance(actor.role) || target === actor.userId, 'You can only view your own performance history.');
    return read(organizationId).kpiSnapshots.filter((snapshot) => snapshot.recruiterUserId === target).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  },

  capturePoolHealth(organizationId: string, pool: SharedTalentPool, candidates: Candidate[], messages: EngagementMessage[]) {
    const store = read(organizationId);
    const today = new Date().toISOString().slice(0, 10);
    const existing = store.poolHealthSnapshots.find((snapshot) => snapshot.poolId === pool.id && snapshot.capturedAt.startsWith(today));
    const metrics = calculatePoolHealth(pool, candidates, messages);
    if (existing && existing.score === metrics.score && existing.memberCount === metrics.memberCount && existing.profileCompleteness === metrics.profileCompleteness && existing.skillCoverage === metrics.skillCoverage && existing.availability === metrics.availability && existing.engagement === metrics.engagement && existing.conversionToHire === metrics.conversionToHire && existing.risk === metrics.risk) return existing;
    const snapshot: TalentPoolHealthSnapshot = { id: existing?.id ?? createId(), poolId: pool.id, capturedAt: now(), ...metrics };
    store.poolHealthSnapshots = [snapshot, ...store.poolHealthSnapshots.filter((item) => item.id !== snapshot.id)].slice(0, 2500);
    write(organizationId, store);
    return snapshot;
  },

  listPoolHealth(organizationId: string, poolId?: string) {
    return read(organizationId).poolHealthSnapshots.filter((snapshot) => !poolId || snapshot.poolId === poolId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  },

  listReports(organizationId: string, actor: WorkforceActor) {
    const reports = read(organizationId).reports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return canViewTeamPerformance(actor.role) ? reports : reports.filter((report) => report.createdByUserId === actor.userId || report.status === 'shared');
  },

  generateReport(organizationId: string, actor: WorkforceActor, input: { job?: Job; jobs: Job[]; candidates: Candidate[]; externalPostings: ExternalJobPosting[]; pools: SharedTalentPool[]; poolHealth: TalentPoolHealthSnapshot[] }) {
    requirePermission(canGenerateTalentIntel(actor.role), 'You do not have permission to generate talent-intelligence reports.');
    const relevantJobs = input.job ? [input.job] : input.jobs.filter((job) => job.status === 'open');
    const requiredSkills = [...new Set(relevantJobs.flatMap((job) => job.requiredSkills))];
    const available = input.candidates.filter((candidate) => candidate.employmentStatus !== 'hired');
    const skillSupply = requiredSkills.map((skill) => ({ skill, count: available.filter((candidate) => candidate.skills.some((value) => normalize(value) === normalize(skill))).length })).sort((a, b) => a.count - b.count);
    const relatedMarket = input.externalPostings.filter((posting) => !input.job || [posting.title, posting.department, posting.location].filter(Boolean).join(' ').toLowerCase().includes(input.job.department.toLowerCase()) || input.job.title.toLowerCase().split(/\W+/).some((token) => token.length > 3 && posting.title.toLowerCase().includes(token)));
    const latestPoolHealth = input.pools.map((pool) => ({ pool, health: input.poolHealth.filter((snapshot) => snapshot.poolId === pool.id).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0] })).filter((item) => item.health);
    const timestamp = now();
    const report: TalentIntelReport = {
      id: createId(),
      title: input.job ? `${input.job.title} talent-intelligence brief` : 'Workforce talent-intelligence brief',
      jobId: input.job?.id,
      createdByUserId: actor.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'draft',
      audience: ['hiring_manager', 'talent_acquisition'],
      summary: `${relevantJobs.length} active role${relevantJobs.length === 1 ? '' : 's'} compared with ${available.length} available candidate profiles and ${relatedMarket.length} relevant external postings.`,
      candidateSignals: skillSupply.slice(0, 5).map((item) => `${item.skill}: ${item.count} available profiles`),
      marketSignals: relatedMarket.length ? [`${relatedMarket.length} related Greenhouse/Lever postings are currently synced.`, ...[...new Set(relatedMarket.map((posting) => posting.location).filter(Boolean))].slice(0, 4).map((location) => `External demand observed in ${location}.`)] : ['No relevant external postings are connected; market comparison is incomplete.'],
      recommendations: [skillSupply[0] ? `Prioritize sourcing for ${skillSupply[0].skill}, the lowest-covered required skill.` : 'Define required skills before selecting a sourcing strategy.', latestPoolHealth.some((item) => item.health!.risk === 'at-risk') ? 'Refresh at-risk talent pools before relying on current coverage.' : 'Use the healthiest saved pools for initial outreach.', relatedMarket.length ? 'Review external posting concentration with the hiring manager before confirming location strategy.' : 'Connect a Greenhouse or Lever source before making market-availability claims.'],
      sourceNote: 'Candidate signals use current local workspace profiles. Market signals use synced Greenhouse/Lever public postings only; they do not represent total labor-market supply, compensation, or LinkedIn availability.',
    };
    const store = read(organizationId);
    store.reports.unshift(report);
    write(organizationId, store);
    return report;
  },

  shareReport(organizationId: string, actor: WorkforceActor, reportId: string) {
    requirePermission(canShareTalentIntel(actor.role), 'A team lead or sourcing manager must approve and share this report.');
    const store = read(organizationId);
    store.reports = store.reports.map((report) => report.id === reportId ? { ...report, status: 'shared', sharedAt: now(), updatedAt: now() } : report);
    write(organizationId, store);
  },

  getTasksForRecruiter(tasks: SharedTask[], recruiterUserId: string) {
    return tasks.filter((task) => task.ownerUserId === recruiterUserId && task.status !== 'completed' && task.status !== 'dismissed');
  },
};
