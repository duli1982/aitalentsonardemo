import type { Candidate } from '../types';
import { aiService } from './AIService';

export type ProfileEnrichmentResult = {
  suggestedRoleTitle: string;
  experienceSummary: string;
  inferredSkills: string[];
  method: 'deterministic' | 'ai';
};

function safeText(input: unknown, maxLen: number): string {
  const text = String(input ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function safeList(input: unknown, max = 8): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, max);
}

class ProfileEnrichmentService {
  enrichDeterministic(candidate: Candidate): ProfileEnrichmentResult {
    const skills = Array.isArray(candidate.skills) ? candidate.skills.filter(Boolean) : [];
    const suggestedRoleTitle = safeText((candidate as any).role ?? (candidate as any).currentRole ?? '', 80) || 'Candidate';
    const experienceSummary =
      safeText((candidate as any).summary ?? (candidate as any).notes ?? (candidate as any).metadata?.summary, 240) ||
      `Profile enrichment unavailable. Skills: ${skills.slice(0, 8).join(', ') || 'N/A'}.`;
    return { suggestedRoleTitle, experienceSummary, inferredSkills: [], method: 'deterministic' };
  }

  async enrich(candidate: Candidate): Promise<ProfileEnrichmentResult> {
    const fallback = this.enrichDeterministic(candidate);
    if (!aiService.isAvailable()) return fallback;

    const prompt = `
You are an expert recruiter. Enrich a partial candidate profile by inferring missing information.

Rules:
- Return ONLY valid JSON.
- Keep inferredSkills to 3-6.

Candidate:
- Name: ${candidate.name}
- Skills: ${(candidate.skills || []).join(', ')}
- Notes/Summary: ${safeText((candidate as any).summary ?? (candidate as any).notes ?? (candidate as any).careerAspirations, 900)}

Return JSON:
{
  "suggestedRoleTitle": string,
  "experienceSummary": string,
  "inferredSkills": string[]
}
`;

    const res = await aiService.generateJson<{
      suggestedRoleTitle: string;
      experienceSummary: string;
      inferredSkills: string[];
    }>(prompt);

    if (!res.success || !res.data) return fallback;

    return {
      suggestedRoleTitle: safeText(res.data.suggestedRoleTitle, 100) || fallback.suggestedRoleTitle,
      experienceSummary: safeText(res.data.experienceSummary, 600) || fallback.experienceSummary,
      inferredSkills: safeList(res.data.inferredSkills, 10),
      method: 'ai'
    };
  }
}

export const profileEnrichmentService = new ProfileEnrichmentService();

