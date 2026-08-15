import { Type } from '@google/genai';
import { aiService } from './AIService';

export interface ExtractedJobRequirements {
  suggestedTitle: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  experienceLevel: string;
  keyResponsibilities: string[];
  suggestedDepartment: string;
  suggestedLocation: string;
  cleanedDescription: string;
  method: 'deterministic' | 'ai';
}

function safeList(input: unknown, max = 12): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function safeText(input: unknown, maxLen: number): string {
  const text = String(input ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function heuristicExtract(raw: string): Omit<ExtractedJobRequirements, 'method'> {
  const text = safeText(raw, 6000);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const titleLine = lines.find((l) => /^title[:\s]/i.test(l)) || lines[0] || '';
  const suggestedTitle = safeText(titleLine.replace(/^title[:\s]*/i, ''), 120) || 'New Role';

  const locationMatch = text.match(/\b(Remote|Hybrid|Onsite|On-site|Budapest|London|Berlin|New York|NYC)\b/i);
  const suggestedLocation = locationMatch ? locationMatch[0] : '';

  return {
    suggestedTitle,
    mustHaveSkills: [],
    niceToHaveSkills: [],
    experienceLevel: '',
    keyResponsibilities: [],
    suggestedDepartment: '',
    suggestedLocation,
    cleanedDescription: text || raw
  };
}

class JobRequirementsExtractionService {
  async extract(rawJobDescription: string): Promise<ExtractedJobRequirements> {
    const fallbackBase = heuristicExtract(rawJobDescription);
    const fallback: ExtractedJobRequirements = { ...fallbackBase, method: 'deterministic' };

    if (!aiService.isAvailable()) return fallback;

    const prompt = `
You are an expert recruiter. Extract job requirements from the raw job description.

Rules:
- Return ONLY valid JSON.
- Must-have skills are truly critical; nice-to-have can be learned.
- Keep skills to 5-10 total (across both arrays).
- Extract 3-5 key responsibilities.
- experienceLevel must be one of: entry | junior | mid-level | senior | lead | principal

Raw job description:
${safeText(rawJobDescription, 8000)}

Return JSON:
{
  "suggestedTitle": string,
  "mustHaveSkills": string[],
  "niceToHaveSkills": string[],
  "experienceLevel": "entry"|"junior"|"mid-level"|"senior"|"lead"|"principal",
  "keyResponsibilities": string[],
  "suggestedDepartment": string,
  "suggestedLocation": string,
  "cleanedDescription": string
}
`;

    // Layer 6: Enforce structured output schema at the API level.
    const jobReqSchema = {
      type: Type.OBJECT,
      properties: {
        suggestedTitle: { type: Type.STRING, description: 'Cleaned professional job title.' },
        mustHaveSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-7 critical skills.' },
        niceToHaveSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: '2-5 beneficial skills.' },
        experienceLevel: { type: Type.STRING, description: 'One of: entry, junior, mid-level, senior, lead, principal.' },
        keyResponsibilities: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-5 key responsibilities.' },
        suggestedDepartment: { type: Type.STRING, description: 'Suggested department.' },
        suggestedLocation: { type: Type.STRING, description: 'Suggested location.' },
        cleanedDescription: { type: Type.STRING, description: 'Professional, well-formatted job description.' }
      },
      required: ['suggestedTitle', 'mustHaveSkills', 'niceToHaveSkills', 'experienceLevel', 'keyResponsibilities', 'suggestedDepartment', 'suggestedLocation', 'cleanedDescription']
    };

    const res = await aiService.generateJson<{
      suggestedTitle: string;
      mustHaveSkills: string[];
      niceToHaveSkills: string[];
      experienceLevel: string;
      keyResponsibilities: string[];
      suggestedDepartment: string;
      suggestedLocation: string;
      cleanedDescription: string;
    }>(prompt, jobReqSchema);

    if (!res.success || !res.data) return fallback;

    return {
      suggestedTitle: safeText(res.data.suggestedTitle, 120) || fallback.suggestedTitle,
      mustHaveSkills: safeList(res.data.mustHaveSkills, 10),
      niceToHaveSkills: safeList(res.data.niceToHaveSkills, 10),
      experienceLevel: safeText(res.data.experienceLevel, 32),
      keyResponsibilities: safeList(res.data.keyResponsibilities, 8),
      suggestedDepartment: safeText(res.data.suggestedDepartment, 80),
      suggestedLocation: safeText(res.data.suggestedLocation, 80),
      cleanedDescription: safeText(res.data.cleanedDescription, 8000) || fallback.cleanedDescription,
      method: 'ai'
    };
  }
}

export const jobRequirementsExtractionService = new JobRequirementsExtractionService();

