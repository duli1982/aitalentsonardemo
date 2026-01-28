import type { CandidateSnapshot, EvidencePack, JobSnapshot, RoleContextPack } from '../types';
import { aiService } from './AIService';

export interface OutreachDraft {
  subject: string;
  body: string;
  createdAt: string;
  method: 'deterministic' | 'ai';
}

function safeText(input: unknown, maxLen: number): string {
  const text = String(input ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

class OutreachDraftService {
  buildDeterministic(params: { job: JobSnapshot; candidate: CandidateSnapshot; evidencePack?: EvidencePack | null }): OutreachDraft {
    const { job, candidate, evidencePack } = params;

    const line =
      evidencePack?.matchReasons?.[0]?.claim ||
      (candidate.skills?.length ? `Your experience with ${candidate.skills.slice(0, 2).join(' and ')} stood out.` : 'Your profile stood out.');

    const subject = `Quick question — ${job.title}`;
    const body = [
      `Hi ${candidate.name.split(' ')[0] || candidate.name},`,
      '',
      `${line}`,
      `I’m hiring for a ${job.title} role and wanted to ask:`,
      '',
      `Describe the last time you shipped something similar — what did you build and what changed because of it?`,
      '',
      `If it’s relevant, happy to share details and see if timing could make sense.`,
      '',
      `Thanks,`
    ].join('\n');

    return { subject, body, createdAt: new Date().toISOString(), method: 'deterministic' };
  }

  async build(params: {
    job: JobSnapshot;
    candidate: CandidateSnapshot;
    evidencePack?: EvidencePack | null;
    contextPack?: RoleContextPack | null;
  }): Promise<OutreachDraft> {
    const fallback = this.buildDeterministic(params);
    if (!aiService.isAvailable()) return fallback;

    const { job, candidate, evidencePack, contextPack } = params;
    const evidenceText = evidencePack ? safeText(JSON.stringify(evidencePack), 1400) : 'N/A';
    const contextText = contextPack?.answers ? safeText(JSON.stringify(contextPack.answers), 900) : 'N/A';

    const prompt = `
You are Talent Sonar. Write a short, high-signal recruiting outreach message.

Rules:
- Do NOT say “I came across your profile.”
- Ground the message in the evidence pack (specific receipts).
- Keep it under 120 words.
- Ask one concrete question.
- Return ONLY JSON: { "subject": string, "body": string }.

Job:
- Title: ${job.title}
- Location: ${job.location}

Role context pack (optional): ${contextText}

Candidate:
- Name: ${candidate.name}
- Email: ${candidate.email || ''}

Evidence pack:
${evidenceText}
`;

    const res = await aiService.generateJson<{ subject: string; body: string }>(prompt);
    if (!res.success || !res.data) return fallback;

    const subject = safeText(res.data.subject, 120) || fallback.subject;
    const body = safeText(res.data.body, 1200) || fallback.body;
    return { subject, body, createdAt: new Date().toISOString(), method: 'ai' };
  }
}

export const outreachDraftService = new OutreachDraftService();
