import type { OrganizationRole } from '../contexts/AuthContext';

export type CampaignChannel = 'email' | 'linkedin' | 'job_board' | 'facebook' | 'out_of_home' | 'qr_landing';
export type CampaignKind = 'talent_community' | 'job_advert' | 'blue_collar';
export type CampaignStatus = 'draft' | 'pending_approval' | 'approved' | 'active' | 'completed' | 'rejected';
export type CampaignContent = { id: string; channel: CampaignChannel; locale: string; headline: string; body: string; callToAction: string; status: 'draft' | 'approved' | 'rejected'; validationIssues: string[]; nativeReview?: { reviewerUserId: string; approvedAt: string; note?: string }; updatedAt: string };
export type ChannelRecommendation = { channel: CampaignChannel; score: number; rationale: string; control: string };
export type OohRequest = { locations: string[]; format: 'billboard' | 'transit' | 'poster' | 'digital_screen'; budget?: number; requestedAt?: string; status: 'not_requested' | 'requested' | 'approved' | 'declined'; owner?: string };
export type AttractionCampaign = {
  id: string; name: string; kind: CampaignKind; objective: string; jobId?: string; talentPoolId?: string; audienceQuery?: string; audienceCandidateIds: string[]; targetSkills: string[]; location?: string;
  channels: CampaignChannel[]; targetLocales: string[]; recommendations: ChannelRecommendation[]; content: CampaignContent[]; status: CampaignStatus; ownerUserId: string; approverUserId?: string; approvalNote?: string;
  linkedinReminderAt?: string; landingSlug: string; ooh?: OohRequest; createdAt: string; updatedAt: string;
};
export type BrandProfile = { organizationName: string; voice: string; values: string[]; requiredPhrases: string[]; prohibitedPhrases: string[]; primaryColor: string; callToAction: string; legalDisclaimer: string; updatedAt: string };
export type CampaignAttributionEvent = { id: string; campaignId: string; type: 'qr_scan' | 'landing_view' | 'lead' | 'application' | 'publish'; source: CampaignChannel; occurredAt: string; candidateId?: string; metadata?: Record<string, string | number | boolean> };
type Store = { brand: BrandProfile; campaigns: AttractionCampaign[]; events: CampaignAttributionEvent[] };

const key = (organizationId: string) => `talentSonar:${organizationId}:attraction:v1`;
const eventName = (organizationId: string) => `talentSonar:attraction:${organizationId}`;
const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const defaultBrand = (): BrandProfile => ({ organizationName: 'Talent Sonar', voice: 'Clear, respectful, inclusive and practical', values: ['Opportunity', 'Transparency', 'Respect'], requiredPhrases: [], prohibitedPhrases: ['rockstar', 'ninja', 'young and energetic'], primaryColor: '#0ea5e9', callToAction: 'Explore this opportunity', legalDisclaimer: 'We welcome applicants from all backgrounds and assess candidates against role-relevant criteria.', updatedAt: now() });
const read = (organizationId: string): Store => { try { const value = JSON.parse(localStorage.getItem(key(organizationId)) ?? '{}') as Partial<Store>; const campaigns = Array.isArray(value.campaigns) ? value.campaigns.map((campaign) => ({ ...campaign, targetLocales: campaign.targetLocales?.length ? campaign.targetLocales : ['en-GB'], content: Array.isArray(campaign.content) ? campaign.content.map((content) => ({ ...content, locale: content.locale || 'en-GB' })) : [] })) : []; return { brand: value.brand ?? defaultBrand(), campaigns, events: Array.isArray(value.events) ? value.events : [] }; } catch { return { brand: defaultBrand(), campaigns: [], events: [] }; } };
const write = (organizationId: string, store: Store) => { localStorage.setItem(key(organizationId), JSON.stringify(store)); window.dispatchEvent(new CustomEvent(eventName(organizationId))); };
const canApprove = (role: OrganizationRole) => ['owner', 'admin', 'team_lead', 'sourcing_manager'].includes(role);

export function recommendChannels(kind: CampaignKind, location?: string): ChannelRecommendation[] {
  const base: ChannelRecommendation[] = kind === 'blue_collar' ? [
    { channel: 'facebook', score: 92, rationale: 'Strong local reach and mobile response for location-led hourly hiring.', control: 'Manager-approved copy and configured publishing connector required.' },
    { channel: 'out_of_home', score: 88, rationale: `Builds local awareness near ${location || 'the target worksite and transit routes'}.`, control: 'Talent Marketing must approve placement, budget and artwork.' },
    { channel: 'qr_landing', score: 86, rationale: 'Creates measurable conversion from physical and social media.', control: 'QR must resolve to the campaign landing page with consent capture.' },
  ] : [
    { channel: 'linkedin', score: 90, rationale: 'High professional relevance for skill and role-led audiences.', control: 'Creates an approved post reminder; direct publishing requires configured credentials.' },
    { channel: 'email', score: 84, rationale: 'Best for consented talent-pool members and warm follow-up.', control: 'Only candidates with current contact permission may be included.' },
    { channel: 'job_board', score: 76, rationale: 'Extends reach beyond the existing community.', control: 'Requires an approved advert and configured Greenhouse or Lever adapter.' },
  ];
  return base;
}

export function validateBrandContent(content: Pick<CampaignContent, 'headline' | 'body' | 'callToAction'>, brand: BrandProfile): string[] {
  const text = `${content.headline} ${content.body} ${content.callToAction}`.toLowerCase();
  const issues = brand.prohibitedPhrases.filter((phrase) => text.includes(phrase.toLowerCase())).map((phrase) => `Prohibited phrase: “${phrase}”`);
  brand.requiredPhrases.filter(Boolean).forEach((phrase) => { if (!text.includes(phrase.toLowerCase())) issues.push(`Required phrase missing: “${phrase}”`); });
  if (!content.headline.trim()) issues.push('Headline is required.');
  if (!content.body.trim()) issues.push('Body copy is required.');
  if (!content.callToAction.trim()) issues.push('Call to action is required.');
  return issues;
}

export const talentAttractionService = {
  subscribe(organizationId: string, callback: () => void) { const handler = () => callback(); window.addEventListener(eventName(organizationId), handler); return () => window.removeEventListener(eventName(organizationId), handler); },
  getBrand(organizationId: string) { return read(organizationId).brand; },
  saveBrand(organizationId: string, role: OrganizationRole, brand: BrandProfile) { if (!canApprove(role)) throw new Error('Only managers can change brand controls.'); const store = read(organizationId); store.brand = { ...brand, updatedAt: now() }; write(organizationId, store); },
  listCampaigns(organizationId: string) { return read(organizationId).campaigns.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
  getCampaign(organizationId: string, campaignId: string) { return read(organizationId).campaigns.find((campaign) => campaign.id === campaignId) ?? null; },
  createCampaign(organizationId: string, actorUserId: string, input: Pick<AttractionCampaign, 'name' | 'kind' | 'objective' | 'jobId' | 'talentPoolId' | 'audienceQuery' | 'audienceCandidateIds' | 'targetSkills' | 'location'> & { targetLocales?: string[] }) { const store = read(organizationId); const timestamp = now(); const campaign: AttractionCampaign = { ...input, targetLocales: input.targetLocales?.length ? input.targetLocales : ['en-GB'], id: id(), channels: recommendChannels(input.kind, input.location).map((item) => item.channel), recommendations: recommendChannels(input.kind, input.location), content: [], status: 'draft', ownerUserId: actorUserId, landingSlug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign'}-${Date.now().toString(36)}`, ooh: input.kind === 'blue_collar' ? { locations: input.location ? [input.location] : [], format: 'poster', status: 'not_requested' } : undefined, createdAt: timestamp, updatedAt: timestamp }; store.campaigns.unshift(campaign); write(organizationId, store); return campaign; },
  updateCampaign(organizationId: string, campaignId: string, updates: Partial<AttractionCampaign>) { const store = read(organizationId); store.campaigns = store.campaigns.map((campaign) => campaign.id === campaignId ? { ...campaign, ...updates, updatedAt: now() } : campaign); write(organizationId, store); },
  setContent(organizationId: string, campaignId: string, items: Array<Omit<CampaignContent, 'id' | 'updatedAt' | 'validationIssues' | 'status' | 'nativeReview'> & { locale?: string }>) { const store = read(organizationId); const campaign = store.campaigns.find((item) => item.id === campaignId); if (!campaign) throw new Error('Campaign not found.'); campaign.content = items.map((item) => ({ ...item, locale: item.locale || campaign.targetLocales?.[0] || 'en-GB', id: id(), status: 'draft', validationIssues: validateBrandContent(item, store.brand), updatedAt: now() })); campaign.status = 'draft'; campaign.updatedAt = now(); write(organizationId, store); },
  updateContent(organizationId: string, campaignId: string, contentId: string, updates: Pick<CampaignContent, 'headline' | 'body' | 'callToAction'>) { const store = read(organizationId); const campaign = store.campaigns.find((item) => item.id === campaignId); if (!campaign) throw new Error('Campaign not found.'); const content = campaign.content.find((item) => item.id === contentId); if (!content) throw new Error('Campaign content not found.'); Object.assign(content, updates, { status: 'draft', validationIssues: validateBrandContent(updates, store.brand), updatedAt: now() }); campaign.status = 'draft'; campaign.approverUserId = undefined; campaign.updatedAt = now(); write(organizationId, store); },
  approveLocale(organizationId: string, campaignId: string, contentId: string, reviewerUserId: string, note = '') { const store = read(organizationId); const campaign = store.campaigns.find((item) => item.id === campaignId); const content = campaign?.content.find((item) => item.id === contentId); if (!campaign || !content) throw new Error('Localized content not found.'); content.nativeReview = { reviewerUserId, approvedAt: now(), note }; content.updatedAt = now(); campaign.updatedAt = now(); write(organizationId, store); },
  submitForApproval(organizationId: string, campaignId: string) { const store = read(organizationId); const campaign = store.campaigns.find((item) => item.id === campaignId); if (!campaign) throw new Error('Campaign not found.'); if (!campaign.content.length) throw new Error('Generate campaign content before requesting approval.'); if (campaign.content.some((item) => item.validationIssues.length)) throw new Error('Resolve brand-control issues before approval.'); if (campaign.content.some((item) => !item.locale.toLowerCase().startsWith('en') && !item.nativeReview)) throw new Error('Every non-English variant requires native-speaker approval.'); campaign.status = 'pending_approval'; campaign.updatedAt = now(); write(organizationId, store); },
  decide(organizationId: string, role: OrganizationRole, userId: string, campaignId: string, approved: boolean, note = '') { if (!canApprove(role)) throw new Error('Manager approval is required.'); const store = read(organizationId); const campaign = store.campaigns.find((item) => item.id === campaignId); if (!campaign) throw new Error('Campaign not found.'); campaign.status = approved ? 'approved' : 'rejected'; campaign.approverUserId = userId; campaign.approvalNote = note; campaign.content = campaign.content.map((item) => ({ ...item, status: approved ? 'approved' : 'rejected', updatedAt: now() })); campaign.updatedAt = now(); write(organizationId, store); },
  requestOoh(organizationId: string, campaignId: string, request: OohRequest) { const store = read(organizationId); const campaign = store.campaigns.find((item) => item.id === campaignId); if (!campaign || campaign.kind !== 'blue_collar') throw new Error('Blue-collar campaign not found.'); campaign.ooh = { ...request, status: 'requested', requestedAt: now() }; campaign.updatedAt = now(); write(organizationId, store); },
  recordEvent(organizationId: string, input: Omit<CampaignAttributionEvent, 'id' | 'occurredAt'>) { const store = read(organizationId); const event = { ...input, id: id(), occurredAt: now() }; store.events.unshift(event); write(organizationId, store); return event; },
  listEvents(organizationId: string, campaignId?: string) { return read(organizationId).events.filter((event) => !campaignId || event.campaignId === campaignId); },
};
