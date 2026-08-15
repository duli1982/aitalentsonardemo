import type { OrganizationRole } from '../contexts/AuthContext';
import type { Candidate, Job } from '../types';
import { careerSiteService } from './CareerSiteService';
import { candidateConversationPlatformService } from './CandidateConversationPlatformService';
import {
  conversationalEngagementService,
  defaultClientCriteria,
  type CandidateEngagementPreferences,
} from './ConversationalEngagementService';
import { sharedOperationsService } from './SharedOperationsService';
import { talentAttractionService } from './TalentAttractionService';
import { calculateRecruiterKpis, workforceOperatingService } from './WorkforceOperatingService';

const SHOWCASE_POOL_NAME = 'Budapest Engineering Community';
const SHOWCASE_PRO_CAMPAIGN = 'Engineering Talent Community · Budapest';
const SHOWCASE_BLUE_COLLAR_CAMPAIGN = 'Budapest Operations Hiring Day';
const SHOWCASE_SCREENING_TOKEN = 'showcase-completed-screening';
const SHOWCASE_PLAN_ID = 'showcase-engineering-engagement-plan';
const SHOWCASE_APPLICATION_EMAIL = 'maya.horvath.demo@example.com';

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const isoDaysAhead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

type SeedInput = {
  organizationId: string;
  organizationSlug: string;
  userId: string;
  role: OrganizationRole;
  jobs: Job[];
  candidates: Candidate[];
};

function addPoolHealthHistory(organizationId: string, poolId: string) {
  const key = `talentSonar:${organizationId}:workforceOperatingModel:v1`;
  try {
    const store = JSON.parse(localStorage.getItem(key) ?? '{}') as { poolHealthSnapshots?: Array<Record<string, unknown>> };
    const snapshots = Array.isArray(store.poolHealthSnapshots) ? store.poolHealthSnapshots : [];
    const history = [
      { id: 'showcase-pool-health-1', poolId, capturedAt: isoDaysAgo(42), score: 58, memberCount: 7, profileCompleteness: 71, skillCoverage: 50, availability: 71, engagement: 43, conversionToHire: 0, risk: 'watch' },
      { id: 'showcase-pool-health-2', poolId, capturedAt: isoDaysAgo(21), score: 69, memberCount: 9, profileCompleteness: 78, skillCoverage: 67, availability: 78, engagement: 56, conversionToHire: 0, risk: 'watch' },
      { id: 'showcase-pool-health-3', poolId, capturedAt: isoDaysAgo(7), score: 81, memberCount: 10, profileCompleteness: 88, skillCoverage: 83, availability: 80, engagement: 70, conversionToHire: 10, risk: 'healthy' },
    ];
    store.poolHealthSnapshots = [...history.filter((item) => !snapshots.some((snapshot) => snapshot.id === item.id)), ...snapshots];
    localStorage.setItem(key, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(`talentSonar:workforceOperatingModel:${organizationId}`));
  } catch (error) {
    console.warn('[ShowcaseStory] Could not add talent-pool health history.', error);
  }
}

async function seedAllocationsAndManagerStory(input: SeedInput, poolId: string) {
  const { organizationId, userId, role, jobs, candidates } = input;
  const actor = { userId, role };
  const assignments = [
    { jobId: 'j1', recruiterId: 'recruiter-technology' },
    { jobId: 'j2', recruiterId: 'recruiter-business' },
    { jobId: 'j3', recruiterId: 'recruiter-operations' },
  ];
  const existing = workforceOperatingService.listAllocations(organizationId, actor);
  for (const assignment of assignments) {
    if (existing.some((item) => item.jobId === assignment.jobId && item.status === 'assigned')) continue;
    const job = jobs.find((item) => item.id === assignment.jobId);
    if (!job) continue;
    const recommendations = workforceOperatingService.recommendAllocations(organizationId, actor, job, candidates);
    const selected = recommendations.find((item) => item.recruiter.userId === assignment.recruiterId);
    if (selected) workforceOperatingService.assign(organizationId, actor, job, selected);
  }

  const profiles = workforceOperatingService.listProfiles(organizationId, actor).filter((item) => item.operatingRole === 'recruiter');
  const allocations = workforceOperatingService.listAllocations(organizationId, actor);
  const pools = await sharedOperationsService.listPools(organizationId);
  const messages = await sharedOperationsService.listMessages(organizationId);
  const health = workforceOperatingService.listPoolHealth(organizationId);
  const metricOverrides: Record<string, Partial<ReturnType<typeof calculateRecruiterKpis>>> = {
    'recruiter-technology': { timeToSubmitDays: 2, talentPoolHealth: 81, engagementSuccess: 64, poolToHireConversion: 10, assignmentSuccess: 78 },
    'recruiter-business': { timeToSubmitDays: 3, talentPoolHealth: 74, engagementSuccess: 58, poolToHireConversion: 8, assignmentSuccess: 72 },
    'recruiter-operations': { timeToSubmitDays: 4, talentPoolHealth: 67, engagementSuccess: 51, poolToHireConversion: 6, assignmentSuccess: 69 },
  };
  for (const profile of profiles) {
    const calculated = calculateRecruiterKpis(profile, jobs, candidates, allocations, pools, health, messages);
    workforceOperatingService.captureKpiSnapshot(organizationId, actor, profile, { ...calculated, ...metricOverrides[profile.userId] });
  }

  const targetJob = jobs.find((item) => item.id === 'j1');
  const reports = workforceOperatingService.listReports(organizationId, actor);
  if (targetJob && !reports.some((item) => item.jobId === targetJob.id)) {
    const report = workforceOperatingService.generateReport(organizationId, actor, {
      job: targetJob,
      jobs,
      candidates,
      externalPostings: [],
      pools,
      poolHealth: workforceOperatingService.listPoolHealth(organizationId, poolId),
    });
    workforceOperatingService.shareReport(organizationId, actor, report.id);
  }
}

async function seedPoolAndOperations(input: SeedInput) {
  const { organizationId, candidates } = input;
  let pool = (await sharedOperationsService.listPools(organizationId)).find((item) => item.name === SHOWCASE_POOL_NAME);
  if (!pool) {
    const id = await sharedOperationsService.createPool(
      organizationId,
      SHOWCASE_POOL_NAME,
      'A curated community of ten engineering candidates used to demonstrate coverage, engagement and conversion trends.',
      { ownerUserId: 'recruiter-technology', targetSkills: ['React', 'Node.js', 'TypeScript', 'AWS', 'Agile', 'Microservices'], targetSize: 10 },
    );
    pool = (await sharedOperationsService.listPools(organizationId)).find((item) => item.id === id);
  }
  if (!pool) throw new Error('Showcase talent pool could not be created.');
  const candidateIds = ['p16', 'upl-17', 'upl-1', 'upl-18', 'i1', 'i8', 'i10', 'p4', 'p10', 'upl-10'].filter((id) => candidates.some((candidate) => candidate.id === id));
  await sharedOperationsService.updatePool(organizationId, pool.id, {
    name: SHOWCASE_POOL_NAME,
    description: 'A curated community of ten engineering candidates used to demonstrate coverage, engagement and conversion trends.',
    ownerUserId: 'recruiter-technology',
    targetSkills: ['React', 'Node.js', 'TypeScript', 'AWS', 'Agile', 'Microservices'],
    targetSize: 10,
    clientCriteria: { clientName: 'Demo Technology Client', vertical: 'Technology', locations: ['Budapest', 'Remote'], requiredSkills: ['React', 'Node.js', 'TypeScript', 'AWS'], eligibilityRequirements: ['Eligible to work in Hungary'], availabilityRequirement: 'available', softSkills: ['Collaboration', 'Communication', 'Adaptability'] },
  });
  await sharedOperationsService.addPoolMembers(organizationId, pool.id, candidateIds);

  const messages = await sharedOperationsService.listMessages(organizationId);
  const engagementSeeds = [
    { candidateId: 'p16', status: 'replied' as const, providerMessageId: 'showcase-replied' },
    { candidateId: 'upl-17', status: 'opened' as const, providerMessageId: 'showcase-opened' },
    { candidateId: 'i1', status: 'delivered' as const, providerMessageId: 'showcase-delivered' },
  ];
  for (const item of engagementSeeds) {
    if (messages.some((message) => message.providerMessageId === item.providerMessageId)) continue;
    await sharedOperationsService.createMessage(organizationId, { candidateId: item.candidateId, poolId: pool.id, createdByUserId: 'recruiter-technology', provider: 'showcase', providerMessageId: item.providerMessageId, subject: 'Engineering community update', body: 'A consented update about relevant engineering opportunities and community events.', status: item.status });
  }
  await workforceOperatingService.capturePoolHealth(organizationId, pool, candidates, await sharedOperationsService.listMessages(organizationId));
  addPoolHealthHistory(organizationId, pool.id);

  await sharedOperationsService.saveSlaSettings(organizationId, {
    jobId: 'j1', ownerUserId: 'recruiter-technology', ownerDisplay: 'Recruiter A', hiringManagerUserId: 'hm-technology', hiringManagerDisplay: 'Márton Fekete',
    targetStartDate: isoDaysAhead(28), coverageTarget: 5, shortlistTarget: 3, stageSlaDays: 5, feedbackSlaDays: 2,
  });
  await sharedOperationsService.upsertTasks(organizationId, [{ sourceKey: 'showcase:j1:hm-feedback', taskType: 'feedback', title: 'Hiring-manager feedback overdue', detail: 'Review the top three candidates for Senior Software Engineer (React).', jobId: 'j1', ownerUserId: 'recruiter-technology', ownerRole: 'recruiter', dueAt: isoDaysAgo(1) }]);
  return pool;
}

function seedCampaigns(input: SeedInput, poolId: string) {
  const { organizationId, userId, role } = input;
  let professional = talentAttractionService.listCampaigns(organizationId).find((item) => item.name === SHOWCASE_PRO_CAMPAIGN);
  if (!professional) {
    professional = talentAttractionService.createCampaign(organizationId, userId, {
      name: SHOWCASE_PRO_CAMPAIGN, kind: 'talent_community', objective: 'Grow a consented React and cloud engineering community for priority Budapest roles.', jobId: 'j1', talentPoolId: poolId,
      audienceQuery: 'skill:(React OR TypeScript OR Node.js) AND location:(Budapest OR Remote)', audienceCandidateIds: ['p16', 'upl-17', 'upl-1', 'i1'], targetSkills: ['React', 'Node.js', 'TypeScript', 'AWS'], location: 'Budapest, Hungary', targetLocales: ['en-GB'],
    });
    talentAttractionService.setContent(organizationId, professional.id, [{ channel: 'linkedin', locale: 'en-GB', headline: 'Build the next generation of products in Budapest', body: 'Join a transparent engineering community where your React, TypeScript and cloud experience can shape future opportunities.', callToAction: 'Explore this opportunity' }]);
    talentAttractionService.submitForApproval(organizationId, professional.id);
    talentAttractionService.decide(organizationId, role, userId, professional.id, true, 'Approved for the connected showcase story.');
  }

  let blueCollar = talentAttractionService.listCampaigns(organizationId).find((item) => item.name === SHOWCASE_BLUE_COLLAR_CAMPAIGN);
  if (!blueCollar) {
    blueCollar = talentAttractionService.createCampaign(organizationId, userId, {
      name: SHOWCASE_BLUE_COLLAR_CAMPAIGN, kind: 'blue_collar', objective: 'Drive measurable registrations for an operations hiring day.', audienceQuery: 'location:Budapest AND skill:(Operations OR Quality)', audienceCandidateIds: [], targetSkills: ['Operations', 'Quality', 'Shift Work'], location: 'Budapest, Hungary', targetLocales: ['hu-HU'],
    });
    talentAttractionService.setContent(organizationId, blueCollar.id, [{ channel: 'facebook', locale: 'hu-HU', headline: 'Budapesti nyílt felvételi nap', body: 'Ismerd meg a helyi operációs és minőségbiztosítási lehetőségeket. Gyors, mobilbarát regisztráció.', callToAction: 'Explore this opportunity' }]);
    const content = talentAttractionService.getCampaign(organizationId, blueCollar.id)?.content[0];
    if (content) talentAttractionService.approveLocale(organizationId, blueCollar.id, content.id, 'native-reviewer-hu', 'Hungarian copy reviewed for clarity and regional tone.');
    talentAttractionService.submitForApproval(organizationId, blueCollar.id);
    talentAttractionService.decide(organizationId, role, userId, blueCollar.id, true, 'Approved for QR and OOH showcase use.');
    talentAttractionService.requestOoh(organizationId, blueCollar.id, { locations: ['Kelenföld station', 'Budapest hiring site'], format: 'poster', budget: 3500, owner: 'Talent Marketing Hungary', status: 'requested' });
    for (let index = 0; index < 12; index += 1) talentAttractionService.recordEvent(organizationId, { campaignId: blueCollar.id, type: 'landing_view', source: 'qr_landing' });
    for (let index = 0; index < 7; index += 1) talentAttractionService.recordEvent(organizationId, { campaignId: blueCollar.id, type: 'qr_scan', source: 'qr_landing' });
    for (let index = 0; index < 4; index += 1) talentAttractionService.recordEvent(organizationId, { campaignId: blueCollar.id, type: 'lead', source: 'qr_landing' });
  }
}

function seedScreeningAndEngagement(input: SeedInput, poolId: string) {
  const { organizationId, userId, jobs, candidates } = input;
  const candidate = candidates.find((item) => item.id === 'p16');
  const job = jobs.find((item) => item.id === 'j1');
  if (!candidate || !job) return;
  let session = conversationalEngagementService.listSessions(organizationId).find((item) => item.token === SHOWCASE_SCREENING_TOKEN || (item.candidateId === candidate.id && item.jobId === job.id && item.status === 'approved'));
  const preferences: CandidateEngagementPreferences = { channels: ['email', 'whatsapp'], frequency: 'biweekly', locale: 'hu-HU', language: 'Hungarian', timezone: 'Europe/Budapest', preferredStartTime: '09:00', preferredEndTime: '17:00', quietDays: ['Saturday', 'Sunday'], talentCommunityConsent: true, consentCapturedAt: isoDaysAgo(5), updatedAt: isoDaysAgo(5) };
  if (!session) {
    session = conversationalEngagementService.createSession(organizationId, userId, candidate, job, poolId, { ...defaultClientCriteria(job), clientName: 'Demo Technology Client', eligibilityRequirements: ['Eligible to work in Hungary'], availabilityRequirement: 'Available within 30 days', softSkills: ['Collaboration', 'Communication', 'Adaptability'] });
    const responses = session.questions.map((question) => ({ questionId: question.id, answer: question.category === 'experience' ? 'I delivered a React and Node.js customer platform, improved deployment reliability and mentored two engineers.' : question.category === 'soft_skill' ? 'I aligned engineering and product teams around a recovery plan and delivered the release on schedule.' : question.category === 'availability' ? 'Available within four weeks and able to work hybrid in Budapest.' : question.category === 'community' ? 'Yes, I would like relevant engineering updates every two weeks.' : 'I confirm the stated eligibility requirements.', evidence: ['Recruiter-verified showcase response'], answeredAt: isoDaysAgo(4) }));
    session = conversationalEngagementService.saveCandidateProgress(organizationId, session.token, responses, preferences, true);
    conversationalEngagementService.decide(organizationId, session.id, { outcome: 'approve', reason: 'Evidence confirms relevant engineering delivery, collaboration and availability.', reviewerUserId: 'recruiter-technology', decidedAt: isoDaysAgo(3) });
  }
  if (!conversationalEngagementService.listPlans(organizationId).some((item) => item.id === SHOWCASE_PLAN_ID)) {
    conversationalEngagementService.savePlan(organizationId, { id: SHOWCASE_PLAN_ID, poolId, name: 'Budapest engineering keep-warm plan', strategy: 'Combine useful engineering content with recruiter-led checkpoints for high-fit, consented community members.', regionalNotes: ['Use Hungarian or English based on candidate preference.', 'Avoid weekends and respect the recorded contact window.'], cadence: [{ id: 'showcase-cadence-1', week: 1, channel: 'email', objective: 'Share a relevant role and market update', contentTheme: 'Engineering opportunities in Budapest', humanTouchpoint: false }, { id: 'showcase-cadence-2', week: 2, channel: 'phone', objective: 'Confirm interest and constraints', contentTheme: 'Recruiter career conversation', humanTouchpoint: true }, { id: 'showcase-cadence-3', week: 4, channel: 'whatsapp', objective: 'Invite response to community event', contentTheme: 'Technical community update', humanTouchpoint: false }], status: 'approved', approvedBy: userId });
  }
  void sharedOperationsService.setPreference(organizationId, candidate.id, true, { preferredChannels: preferences.channels, frequency: preferences.frequency, locale: preferences.locale, language: preferences.language, timezone: preferences.timezone, preferredStartTime: preferences.preferredStartTime, preferredEndTime: preferences.preferredEndTime, quietDays: preferences.quietDays, talentCommunityConsent: true });
}

async function seedDurableCandidateExperience(input: SeedInput) {
  const { organizationId, userId, candidates } = input;
  const candidate = candidates.find((item) => item.id === 'upl-3');
  if (!candidate) return;
  let snapshot = await candidateConversationPlatformService.snapshot(organizationId);
  if (!snapshot.store.assessments.some((item) => item.candidateId === candidate.id && item.status === 'awaiting_review')) {
    const assessment = await candidateConversationPlatformService.createAssessment(organizationId, userId, { candidateId: candidate.id, candidateName: candidate.name, candidateEmail: candidate.email, language: 'en', requestedLevel: 'C1' });
    await candidateConversationPlatformService.submitAssessment(organizationId, { token: assessment.token, scores: { reading: 88, writing: 82, listening: 91, speaking: 86, overall: 87, cefr: 'C1' }, evidence: ['Completed multilingual provider-style assessment.', 'Business presentation and stakeholder scenario recorded.'] });
    snapshot = await candidateConversationPlatformService.snapshot(organizationId);
  }
  if (!snapshot.store.journeys.some((item) => item.candidateId === 'p16' && ['draft', 'active'].includes(item.status))) {
    const journey = await candidateConversationPlatformService.createJourney(organizationId, userId, { candidateId: 'p16', candidateName: 'Bence Vincze', channel: 'email', locale: 'hu-HU', timezone: 'Europe/Budapest', preferredStartTime: '09:00', preferredEndTime: '17:00', quietDays: ['Saturday', 'Sunday'], consentConfirmed: true, nextRunAt: isoDaysAhead(7), message: 'A new engineering community briefing is available. Reply if you would like Recruiter A to discuss the Senior Software Engineer opportunity.' });
    await candidateConversationPlatformService.approveJourney(organizationId, userId, journey.id);
  }
}

async function seedPublicCareers(input: SeedInput) {
  const { organizationId, organizationSlug, jobs } = input;
  const job = jobs.find((item) => item.id === 'j2');
  if (!job) return;
  const published = await careerSiteService.publish(organizationId, organizationSlug, job, isoDaysAhead(45), { userId: 'recruiter-business', displayName: 'Recruiter B', email: 'recruiter.b@local.invalid' });
  const store = await careerSiteService.admin(organizationId);
  if (!store.applications.some((item) => item.candidate.email.toLowerCase() === SHOWCASE_APPLICATION_EMAIL)) {
    await careerSiteService.apply(organizationId, published.slug, { name: 'Maya Horváth', email: SHOWCASE_APPLICATION_EMAIL, phone: '+36 30 555 0147', role: 'Digital Marketing Specialist', location: 'Debrecen, Hungary', experienceYears: 6, skills: ['Digital Marketing', 'SEO/SEM', 'Content Strategy', 'Google Analytics', 'Social Media Marketing'], summary: 'Multichannel marketing specialist with measurable acquisition and community-growth experience.', education: ['BA Marketing Communications'], languages: [{ language: 'Hungarian', level: 'native' }, { language: 'English', level: 'C1' }], fileName: 'Maya_Horvath_Marketing_CV.pdf' }, { eligibility: 'Eligible to work in Hungary', availability: 'Available in four weeks', profileUrl: 'https://www.linkedin.com/in/maya-horvath-demo' });
  }
  window.dispatchEvent(new Event('talentSonar:career-application-created'));
}

export async function seedConnectedShowcaseStory(input: SeedInput) {
  if (input.organizationId !== 'local-workspace' || !['owner', 'admin', 'team_lead', 'sourcing_manager'].includes(input.role)) return;
  const pool = await seedPoolAndOperations(input);
  await seedAllocationsAndManagerStory(input, pool.id);
  seedCampaigns(input, pool.id);
  seedScreeningAndEngagement(input, pool.id);
  await seedDurableCandidateExperience(input);
  await seedPublicCareers(input);
  localStorage.setItem(`talentSonar:${input.organizationId}:connectedShowcaseStory:v1`, new Date().toISOString());
  window.dispatchEvent(new CustomEvent('talentSonar:showcase-story-ready'));
}
