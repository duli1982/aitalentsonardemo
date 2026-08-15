import type { Candidate, Job } from '../types';

export type EngagementChannel = 'email' | 'whatsapp' | 'phone';
export type EngagementFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'on_demand';
export type ScreeningCategory = 'eligibility' | 'experience' | 'soft_skill' | 'availability' | 'community' | 'client_specific';
export type ScreeningSessionStatus = 'draft' | 'invited' | 'in_progress' | 'awaiting_review' | 'approved' | 'rejected' | 'withdrawn';

export type ClientPoolCriteria = {
  clientName: string;
  vertical: string;
  locations: string[];
  requiredSkills: string[];
  eligibilityRequirements: string[];
  availabilityRequirement: string;
  softSkills: string[];
};

export type CandidateEngagementPreferences = {
  channels: EngagementChannel[];
  frequency: EngagementFrequency;
  locale: string;
  language: string;
  timezone: string;
  preferredStartTime: string;
  preferredEndTime: string;
  quietDays: string[];
  talentCommunityConsent: boolean;
  consentCapturedAt?: string;
  updatedAt: string;
};

export type ScreeningQuestion = { id: string; prompt: string; category: ScreeningCategory; required: boolean; expectedEvidence: string };
export type ScreeningResponse = { questionId: string; answer: string; evidence: string[]; answeredAt: string };
export type HumanScreeningDecision = { outcome: 'approve' | 'reject' | 'follow_up'; reason: string; reviewerUserId: string; decidedAt: string };
export type ScreeningSession = {
  id: string; token: string; candidateId: string; candidateName: string; candidateEmail?: string; candidatePhone?: string; jobId?: string; jobTitle?: string; poolId?: string;
  clientCriteria: ClientPoolCriteria; questions: ScreeningQuestion[]; responses: ScreeningResponse[]; preferences?: CandidateEngagementPreferences;
  status: ScreeningSessionStatus; humanDecision?: HumanScreeningDecision; createdByUserId: string; createdAt: string; updatedAt: string; submittedAt?: string;
};

export type EngagementCadenceItem = { id: string; week: number; channel: EngagementChannel; objective: string; contentTheme: string; humanTouchpoint: boolean };
export type PoolEngagementPlan = { id: string; poolId: string; name: string; strategy: string; regionalNotes: string[]; cadence: EngagementCadenceItem[]; status: 'draft' | 'approved' | 'active' | 'paused'; approvedBy?: string; createdAt: string; updatedAt: string };
export type EngagementRoutingDecision = { id: string; candidateId: string; jobId?: string; route: 'human' | 'agent' | 'hybrid'; score: number; factors: { fit: number; engagement: number; complexity: number; availability: number; risk: number }; reasons: string[]; createdAt: string };
export type RecruiterCall = { id: string; candidateId: string; candidateName: string; sessionId?: string; provider: 'google' | 'outlook'; startsAt: string; durationMinutes: number; purpose: string; status: 'proposed' | 'approved' | 'scheduled' | 'failed'; approvedBy?: string; externalId?: string; joinUrl?: string; createdAt: string; updatedAt: string };
type Store = { sessions: ScreeningSession[]; preferences: Record<string, CandidateEngagementPreferences>; plans: PoolEngagementPlan[]; routing: EngagementRoutingDecision[]; calls: RecruiterCall[] };

const key = (organizationId: string) => `talentSonar:${organizationId}:conversational-engagement:v1`;
const eventName = (organizationId: string) => `talentSonar:conversational-engagement:${organizationId}`;
const empty = (): Store => ({ sessions: [], preferences: {}, plans: [], routing: [], calls: [] });
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const read = (organizationId: string): Store => { try { const value = JSON.parse(localStorage.getItem(key(organizationId)) ?? '{}') as Partial<Store>; return { sessions: Array.isArray(value.sessions) ? value.sessions : [], preferences: value.preferences && typeof value.preferences === 'object' ? value.preferences : {}, plans: Array.isArray(value.plans) ? value.plans : [], routing: Array.isArray(value.routing) ? value.routing : [], calls: Array.isArray(value.calls) ? value.calls : [] }; } catch { return empty(); } };
const write = (organizationId: string, value: Store) => { localStorage.setItem(key(organizationId), JSON.stringify(value)); window.dispatchEvent(new CustomEvent(eventName(organizationId))); };
const normalize = (value?: string) => String(value ?? '').trim().toLowerCase();

export const defaultClientCriteria = (job?: Job): ClientPoolCriteria => ({ clientName: job?.company ?? '', vertical: job?.department ?? '', locations: job?.location ? [job.location] : [], requiredSkills: job?.requiredSkills ?? [], eligibilityRequirements: [], availabilityRequirement: '', softSkills: [] });
export const defaultScreeningQuestions = (criteria: ClientPoolCriteria): ScreeningQuestion[] => [
  { id: uid(), category: 'eligibility', required: true, prompt: `Please confirm you meet these eligibility requirements: ${criteria.eligibilityRequirements.join(', ') || 'the role requirements discussed with the recruiter'}.`, expectedEvidence: 'Candidate confirmation with relevant constraints.' },
  { id: uid(), category: 'experience', required: true, prompt: `Describe recent evidence of using ${criteria.requiredSkills.slice(0, 4).join(', ') || 'the required capabilities'}.`, expectedEvidence: 'Specific project, responsibility, result or assessment evidence.' },
  { id: uid(), category: 'soft_skill', required: true, prompt: `Tell us about a situation where you demonstrated ${criteria.softSkills.slice(0, 3).join(', ') || 'communication, collaboration or adaptability'}.`, expectedEvidence: 'Situation, action and measurable or observable result.' },
  { id: uid(), category: 'availability', required: true, prompt: `What is your availability and are there constraints we should consider${criteria.availabilityRequirement ? ` against ${criteria.availabilityRequirement}` : ''}?`, expectedEvidence: 'Start date, notice period, shift or location constraints.' },
  { id: uid(), category: 'community', required: true, prompt: 'Would you like to join the talent community for relevant opportunities, updates and recruiter conversations?', expectedEvidence: 'Explicit preference; consent is captured separately below.' },
];

export function evaluateCandidateAgainstCriteria(candidate: Candidate, criteria: ClientPoolCriteria) {
  const matchedSkills = criteria.requiredSkills.filter((skill) => candidate.skills.some((value) => normalize(value) === normalize(skill)));
  const skillScore = criteria.requiredSkills.length ? matchedSkills.length / criteria.requiredSkills.length * 100 : 100;
  const locationMatch = !criteria.locations.length || criteria.locations.some((location) => normalize(candidate.location).includes(normalize(location)) || normalize(location).includes(normalize(candidate.location)));
  const candidateVertical = normalize(candidate.department ?? String(candidate.metadata?.vertical ?? ''));
  const verticalMatch = !criteria.vertical ? true : !candidateVertical ? null : candidateVertical.includes(normalize(criteria.vertical)) || normalize(criteria.vertical).includes(candidateVertical);
  const availabilityMatch = !criteria.availabilityRequirement || normalize(candidate.availability).includes(normalize(criteria.availabilityRequirement)) || /available|immediate/i.test(candidate.availability ?? '');
  const eligibilityValues = Array.isArray(candidate.metadata?.eligibility) ? candidate.metadata.eligibility.map(String) : [];
  const matchedEligibility = criteria.eligibilityRequirements.filter((requirement) => eligibilityValues.some((value) => normalize(value).includes(normalize(requirement))));
  const eligibilityScore = criteria.eligibilityRequirements.length ? matchedEligibility.length / criteria.eligibilityRequirements.length * 100 : 100;
  const score = Math.round(skillScore * .55 + (locationMatch ? 15 : 0) + (verticalMatch === null ? 7.5 : verticalMatch ? 15 : 0) + (availabilityMatch ? 10 : 0) + eligibilityScore * .05);
  return { candidateId: candidate.id, score: Math.max(0, Math.min(100, score)), matchedSkills, missingSkills: criteria.requiredSkills.filter((item) => !matchedSkills.includes(item)), locationMatch, verticalMatch, availabilityMatch, matchedEligibility, eligibilityUnknown: Boolean(criteria.eligibilityRequirements.length && !eligibilityValues.length) };
}

export function evaluateRouting(candidate: Candidate, job: Job | undefined, engagementScore: number, session?: ScreeningSession): Omit<EngagementRoutingDecision, 'id' | 'createdAt'> {
  const required = job?.requiredSkills ?? session?.clientCriteria.requiredSkills ?? [];
  const matched = required.filter((skill) => candidate.skills.some((value) => normalize(value) === normalize(skill))).length;
  const fit = required.length ? Math.round(matched / required.length * 100) : 50;
  const complexity = Math.min(100, 20 + required.length * 8 + (/senior|lead|principal|specialist|director/i.test(job?.title ?? '') ? 25 : 0));
  const availability = /available|immediate/i.test(candidate.availability ?? '') ? 90 : candidate.availability ? 60 : 40;
  const risk = !candidate.consent || candidate.consent.status !== 'permitted' ? 90 : session?.status === 'awaiting_review' ? 70 : engagementScore < 20 ? 55 : 20;
  const humanScore = complexity * .30 + risk * .35 + Math.max(0, 65 - fit) * .20 + Math.max(0, 40 - engagementScore) * .15;
  const route = risk >= 80 || humanScore >= 60 ? 'human' : humanScore >= 38 ? 'hybrid' : 'agent';
  const reasons = [route === 'human' ? 'Complexity or risk requires recruiter judgment.' : route === 'hybrid' ? 'AI can prepare engagement, with recruiter review before contact.' : 'Low-risk, consented engagement can be agent-assisted.', `Fit evidence ${fit}%; recorded engagement ${engagementScore}%.`, risk >= 70 ? 'Consent or screening-review risk is elevated.' : 'No high-risk consent or review blocker detected.'];
  return { candidateId: candidate.id, jobId: job?.id, route, score: Math.round(humanScore), factors: { fit, engagement: engagementScore, complexity, availability, risk }, reasons };
}

export const conversationalEngagementService = {
  subscribe(organizationId: string, callback: () => void) { const handler = () => callback(); window.addEventListener(eventName(organizationId), handler); return () => window.removeEventListener(eventName(organizationId), handler); },
  listSessions(organizationId: string) { return read(organizationId).sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
  getSession(organizationId: string, sessionId: string) { return read(organizationId).sessions.find((item) => item.id === sessionId) ?? null; },
  getSessionByToken(organizationId: string, token: string) { return read(organizationId).sessions.find((item) => item.token === token) ?? null; },
  createSession(organizationId: string, actorUserId: string, candidate: Candidate, job: Job | undefined, poolId: string | undefined, clientCriteria: ClientPoolCriteria) { const store = read(organizationId); const timestamp = now(); const session: ScreeningSession = { id: uid(), token: `${uid().replace(/-/g, '')}${Date.now().toString(36)}`, candidateId: candidate.id, candidateName: candidate.name, candidateEmail: candidate.email, candidatePhone: candidate.phone, jobId: job?.id, jobTitle: job?.title, poolId, clientCriteria, questions: defaultScreeningQuestions(clientCriteria), responses: [], status: 'draft', createdByUserId: actorUserId, createdAt: timestamp, updatedAt: timestamp }; store.sessions.unshift(session); write(organizationId, store); return session; },
  updateQuestions(organizationId: string, sessionId: string, questions: ScreeningQuestion[]) { const store = read(organizationId); const session = store.sessions.find((item) => item.id === sessionId); if (!session) throw new Error('Screening session not found.'); if (!['draft', 'invited'].includes(session.status)) throw new Error('Questions cannot change after the candidate starts.'); session.questions = questions; session.updatedAt = now(); write(organizationId, store); },
  invite(organizationId: string, sessionId: string) { const store = read(organizationId); const session = store.sessions.find((item) => item.id === sessionId); if (!session) throw new Error('Screening session not found.'); session.status = 'invited'; session.updatedAt = now(); write(organizationId, store); },
  saveCandidateProgress(organizationId: string, token: string, responses: ScreeningResponse[], preferences: CandidateEngagementPreferences, submit = false) { const store = read(organizationId); const session = store.sessions.find((item) => item.token === token); if (!session) throw new Error('Screening invitation not found.'); if (['approved', 'rejected', 'withdrawn'].includes(session.status)) throw new Error('This screening session is closed.'); session.responses = responses; session.preferences = { ...preferences, consentCapturedAt: preferences.talentCommunityConsent ? preferences.consentCapturedAt ?? now() : undefined, updatedAt: now() }; session.status = submit ? 'awaiting_review' : 'in_progress'; session.submittedAt = submit ? now() : session.submittedAt; session.updatedAt = now(); store.preferences[session.candidateId] = session.preferences; write(organizationId, store); return session; },
  decide(organizationId: string, sessionId: string, decision: HumanScreeningDecision) { const store = read(organizationId); const session = store.sessions.find((item) => item.id === sessionId); if (!session) throw new Error('Screening session not found.'); session.humanDecision = decision; session.status = decision.outcome === 'approve' ? 'approved' : decision.outcome === 'reject' ? 'rejected' : 'in_progress'; session.updatedAt = now(); write(organizationId, store); },
  getPreferences(organizationId: string, candidateId: string) { return read(organizationId).preferences[candidateId] ?? null; },
  savePlan(organizationId: string, input: Omit<PoolEngagementPlan, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) { const store = read(organizationId); const timestamp = now(); const plan: PoolEngagementPlan = { ...input, id: input.id ?? uid(), createdAt: store.plans.find((item) => item.id === input.id)?.createdAt ?? timestamp, updatedAt: timestamp }; store.plans = [plan, ...store.plans.filter((item) => item.id !== plan.id)]; write(organizationId, store); return plan; },
  listPlans(organizationId: string) { return read(organizationId).plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
  approvePlan(organizationId: string, planId: string, userId: string) { const store = read(organizationId); store.plans = store.plans.map((item) => item.id === planId ? { ...item, status: 'approved', approvedBy: userId, updatedAt: now() } : item); write(organizationId, store); },
  saveRouting(organizationId: string, decision: Omit<EngagementRoutingDecision, 'id' | 'createdAt'>) { const store = read(organizationId); const value = { ...decision, id: uid(), createdAt: now() }; store.routing.unshift(value); write(organizationId, store); return value; },
  listRouting(organizationId: string) { return read(organizationId).routing.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  proposeCall(organizationId: string, input: Omit<RecruiterCall, 'id' | 'status' | 'createdAt' | 'updatedAt'>) { const store = read(organizationId); const timestamp = now(); const call: RecruiterCall = { ...input, id: uid(), status: 'proposed', createdAt: timestamp, updatedAt: timestamp }; store.calls.unshift(call); write(organizationId, store); return call; },
  updateCall(organizationId: string, callId: string, updates: Partial<RecruiterCall>) { const store = read(organizationId); store.calls = store.calls.map((item) => item.id === callId ? { ...item, ...updates, updatedAt: now() } : item); write(organizationId, store); },
  listCalls(organizationId: string) { return read(organizationId).calls.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
};
