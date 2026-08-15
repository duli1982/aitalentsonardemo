import { beforeEach, describe, expect, it } from 'vitest';
import { recommendChannels, talentAttractionService, validateBrandContent } from '../TalentAttractionService';

describe('TalentAttractionService', () => {
  const organizationId = 'org-attraction-test';

  beforeEach(() => localStorage.clear());

  it('recommends tracked local channels for blue-collar campaigns', () => {
    expect(recommendChannels('blue_collar', 'Budapest').map((item) => item.channel)).toEqual(['facebook', 'out_of_home', 'qr_landing']);
  });

  it('blocks prohibited brand language before approval', () => {
    const brand = talentAttractionService.getBrand(organizationId);
    expect(validateBrandContent({ headline: 'Hiring a rockstar', body: 'Join us.', callToAction: 'Apply' }, brand)).toContain('Prohibited phrase: “rockstar”');
    const campaign = talentAttractionService.createCampaign(organizationId, 'recruiter-1', { name: 'Quality hiring', kind: 'job_advert', objective: 'Attract quality specialists', audienceCandidateIds: [], targetSkills: ['Quality'], jobId: undefined, talentPoolId: undefined, audienceQuery: undefined, location: 'Budapest' });
    talentAttractionService.setContent(organizationId, campaign.id, [{ channel: 'job_board', headline: 'Hiring a rockstar', body: 'Join us.', callToAction: 'Apply' }]);
    expect(() => talentAttractionService.submitForApproval(organizationId, campaign.id)).toThrow(/Resolve brand-control issues/);
  });

  it('requires a manager role to approve and records attribution', () => {
    const campaign = talentAttractionService.createCampaign(organizationId, 'recruiter-1', { name: 'Operator community', kind: 'blue_collar', objective: 'Build local operator supply', audienceCandidateIds: [], targetSkills: ['Machine operation'], jobId: undefined, talentPoolId: undefined, audienceQuery: undefined, location: 'Győr' });
    talentAttractionService.setContent(organizationId, campaign.id, [{ channel: 'facebook', headline: 'Machine operator opportunities', body: 'Explore practical local roles.', callToAction: 'Join the community' }]);
    talentAttractionService.submitForApproval(organizationId, campaign.id);
    expect(() => talentAttractionService.decide(organizationId, 'recruiter', 'recruiter-1', campaign.id, true)).toThrow(/Manager approval/);
    talentAttractionService.decide(organizationId, 'sourcing_manager', 'manager-1', campaign.id, true);
    expect(talentAttractionService.getCampaign(organizationId, campaign.id)?.status).toBe('approved');
    talentAttractionService.recordEvent(organizationId, { campaignId: campaign.id, type: 'qr_scan', source: 'qr_landing' });
    expect(talentAttractionService.listEvents(organizationId, campaign.id)).toHaveLength(1);
  });

  it('returns edited copy to draft and re-runs brand validation', () => {
    const campaign = talentAttractionService.createCampaign(organizationId, 'recruiter-1', { name: 'Community', kind: 'talent_community', objective: 'Keep talent warm', audienceCandidateIds: [], targetSkills: ['Analytics'], jobId: undefined, talentPoolId: undefined, audienceQuery: undefined, location: undefined });
    talentAttractionService.setContent(organizationId, campaign.id, [{ channel: 'linkedin', headline: 'Analytics community', body: 'Stay connected.', callToAction: 'Explore opportunities' }]);
    const content = talentAttractionService.getCampaign(organizationId, campaign.id)!.content[0];
    talentAttractionService.updateContent(organizationId, campaign.id, content.id, { headline: 'Analytics ninja', body: 'Stay connected.', callToAction: 'Explore opportunities' });
    const updated = talentAttractionService.getCampaign(organizationId, campaign.id)!;
    expect(updated.status).toBe('draft');
    expect(updated.content[0].validationIssues[0]).toMatch(/Prohibited phrase/);
  });
});
