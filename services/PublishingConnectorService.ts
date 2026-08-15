import type { AttractionCampaign, CampaignContent } from './TalentAttractionService';

export type PublishingProvider = 'greenhouse' | 'lever' | 'facebook';
export type PublishingStatus = Record<PublishingProvider, { configured: boolean; mode: string }>;

async function responseJson(response: Response) { const body = await response.json().catch(() => ({})) as { ok?: boolean; message?: string; [key: string]: unknown }; if (!response.ok || body.ok !== true) throw new Error(body.message || 'Publishing connector failed.'); return body; }

export const publishingConnectorService = {
  async status(): Promise<PublishingStatus> { const body = await responseJson(await fetch('/api/publishing')); return body.providers as PublishingStatus; },
  async publish(provider: PublishingProvider, campaign: AttractionCampaign, content: CampaignContent, landingUrl: string) {
    if (campaign.status !== 'approved' || content.status !== 'approved' || !campaign.approverUserId) throw new Error('Manager-approved campaign content is required before publishing.');
    return responseJson(await fetch('/api/publishing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, campaignId: campaign.id, contentId: content.id, approvedBy: campaign.approverUserId, payload: { headline: content.headline, body: content.body, callToAction: content.callToAction, landingUrl, targetSkills: campaign.targetSkills, location: campaign.location } }) }));
  },
};
