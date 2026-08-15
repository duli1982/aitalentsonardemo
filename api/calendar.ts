import type { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { getEnv } from './ai/_lib/env';
import { universalHandler } from './_lib/universalHandler';

const providers = ['google', 'outlook'] as const;
const schema = z.object({ provider: z.enum(providers), callId: z.string().min(1), approvedBy: z.string().min(1), title: z.string().min(1).max(300), startsAt: z.string().datetime(), durationMinutes: z.number().int().min(10).max(240), attendee: z.object({ name: z.string().min(1), email: z.string().email() }), description: z.string().max(5000) });
const send = (res: ServerResponse, status: number, body: Record<string, unknown>) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
async function json(req: IncomingMessage) { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
const config = () => ({ google: Boolean(getEnv('GOOGLE_CALENDAR_ACCESS_TOKEN')), outlook: Boolean(getEnv('OUTLOOK_CALENDAR_ACCESS_TOKEN')) });

async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') return send(res, 200, { ok: true, providers: config() });
  if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'GET or POST only.' });
  try {
    const parsed = schema.safeParse(await json(req)); if (!parsed.success) return send(res, 400, { ok: false, errorCode: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid calendar request.' });
    const data = parsed.data; if (!config()[data.provider]) return send(res, 409, { ok: false, errorCode: 'NOT_CONFIGURED', message: `${data.provider} calendar is not configured.` });
    const end = new Date(Date.parse(data.startsAt) + data.durationMinutes * 60_000).toISOString();
    if (data.provider === 'google') {
      const calendarId = getEnv('GOOGLE_CALENDAR_ID') ?? 'primary';
      const upstream = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, { method: 'POST', headers: { Authorization: `Bearer ${getEnv('GOOGLE_CALENDAR_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: data.title, description: data.description, start: { dateTime: data.startsAt }, end: { dateTime: end }, attendees: [{ email: data.attendee.email, displayName: data.attendee.name }], conferenceData: { createRequest: { requestId: data.callId, conferenceSolutionKey: { type: 'hangoutsMeet' } } } }) });
      const result = await upstream.json().catch(() => ({})) as Record<string, unknown>; if (!upstream.ok) return send(res, 502, { ok: false, errorCode: 'PROVIDER_REJECTED', message: String((result.error as { message?: string })?.message ?? `Google returned ${upstream.status}.`) });
      return send(res, 200, { ok: true, provider: data.provider, externalId: result.id, joinUrl: result.hangoutLink, scheduledAt: new Date().toISOString() });
    }
    const upstream = await fetch('https://graph.microsoft.com/v1.0/me/events', { method: 'POST', headers: { Authorization: `Bearer ${getEnv('OUTLOOK_CALENDAR_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: data.title, body: { contentType: 'text', content: data.description }, start: { dateTime: data.startsAt, timeZone: 'UTC' }, end: { dateTime: end, timeZone: 'UTC' }, attendees: [{ emailAddress: { address: data.attendee.email, name: data.attendee.name }, type: 'required' }], isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' }) });
    const result = await upstream.json().catch(() => ({})) as Record<string, unknown>; if (!upstream.ok) return send(res, 502, { ok: false, errorCode: 'PROVIDER_REJECTED', message: String((result.error as { message?: string })?.message ?? `Outlook returned ${upstream.status}.`) });
    return send(res, 200, { ok: true, provider: data.provider, externalId: result.id, joinUrl: (result.onlineMeeting as { joinUrl?: string })?.joinUrl ?? result.webLink, scheduledAt: new Date().toISOString() });
  } catch (error) { return send(res, 500, { ok: false, errorCode: 'CALENDAR_FAILED', message: error instanceof Error ? error.message : 'Calendar request failed.' }); }
}

export default universalHandler(handler);
