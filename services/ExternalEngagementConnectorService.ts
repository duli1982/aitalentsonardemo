import type { RecruiterCall, ScreeningSession } from './ConversationalEngagementService';

type ConnectorStatus = { communications: { twilio: boolean; meta_whatsapp: boolean }; webhookVerification: { twilio: boolean; meta_whatsapp: boolean }; calendars: { google: boolean; outlook: boolean } };
async function responseJson(response: Response) { const body = await response.json().catch(() => ({})) as { message?: string; [key: string]: unknown }; if (!response.ok) throw new Error(body.message ?? `Connector returned ${response.status}.`); return body; }

export const externalEngagementConnectorService = {
  async status(): Promise<ConnectorStatus> {
    const [communication, calendar] = await Promise.all([fetch('/api/communications').then(responseJson), fetch('/api/calendar').then(responseJson)]);
    return { communications: communication.providers as ConnectorStatus['communications'], webhookVerification: communication.webhookVerification as ConnectorStatus['webhookVerification'], calendars: calendar.providers as ConnectorStatus['calendars'] };
  },
  async sendWhatsApp(provider: 'twilio' | 'meta_whatsapp', organizationId: string, session: ScreeningSession, body: string, approvedBy: string) {
    if (!session.candidatePhone) throw new Error('Candidate phone number is required.');
    if (!session.preferences?.channels.includes('whatsapp')) throw new Error('The candidate has not selected WhatsApp as an approved channel.');
    if (!session.preferences.talentCommunityConsent) throw new Error('Talent-community consent is required.');
    return responseJson(await fetch('/api/communications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, organizationId, sessionId: session.id, candidateId: session.candidateId, to: session.candidatePhone, body, consentConfirmed: true, approvedBy }) }));
  },
  async scheduleCall(call: RecruiterCall, candidateEmail: string, approvedBy: string) {
    if (call.status !== 'approved' || !call.approvedBy) throw new Error('A recruiter call must be approved before calendar creation.');
    if (!candidateEmail) throw new Error('Candidate email is required for a calendar invitation.');
    return responseJson(await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: call.provider, callId: call.id, approvedBy, title: `Talent community conversation with ${call.candidateName}`, startsAt: call.startsAt, durationMinutes: call.durationMinutes, attendee: { name: call.candidateName, email: candidateEmail }, description: call.purpose }) }));
  },
};
