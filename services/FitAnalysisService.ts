import type { Candidate, Job } from '../types';
import { aiService } from './AIService';

export type FitMethod = 'ai' | 'heuristic';

export interface FitResult {
  score: number; // 0-100
  rationale: string;
  confidence: number; // 0-1
  method: FitMethod;
  reasons?: string[];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashString(input: string): string {
  // Stable, non-crypto hash for short ids
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function jobFingerprint(job: Job): string {
  return hashString(
    JSON.stringify({
      title: job.title,
      dept: job.department,
      loc: job.location,
      skills: [...(job.requiredSkills || [])].map((s) => s.trim().toLowerCase()).sort(),
      desc: (job.description || '').slice(0, 400)
    })
  );
}

function computeHeuristicFit(job: Job, candidate: Candidate, semanticScore?: number): FitResult {
  const jobSkills = (job.requiredSkills || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const candidateSkills = (candidate.skills || []).map((s) => s.trim().toLowerCase()).filter(Boolean);

  const matchedSkills = jobSkills.length
    ? jobSkills.filter((s) => candidateSkills.includes(s))
    : [];

  const skillScore = jobSkills.length ? (matchedSkills.length / jobSkills.length) * 70 : 0;
  const semanticBoost = typeof semanticScore === 'number' ? clamp(semanticScore, 0, 100) * 0.25 : 0;
  const expBoost =
    typeof (candidate as any).experienceYears === 'number'
      ? clamp((candidate as any).experienceYears * 2, 0, 10)
      : typeof candidate.experience === 'number'
        ? clamp(candidate.experience * 2, 0, 10)
        : 0;

  const score = clamp(Math.round(skillScore + semanticBoost + expBoost), 0, 100);
  const reasons: string[] = [];
  if (matchedSkills.length > 0) reasons.push(`Matched skills: ${matchedSkills.slice(0, 6).join(', ')}`);
  if (typeof semanticScore === 'number') reasons.push(`Semantic match: ${Math.round(semanticScore)}%`);

  const rationale =
    reasons.length > 0
      ? reasons.join('. ') + '.'
      : 'Heuristic match based on available skills and metadata.';

  return { score, rationale, confidence: 0.45, method: 'heuristic', reasons };
}

function getCandidateSummary(candidate: Candidate): string {
  const summary = String((candidate as any).summary || (candidate as any).notes || '').trim();
  return summary.slice(0, 800);
}

function getCandidateExperience(candidate: Candidate): number {
  const exp = (candidate as any).experienceYears ?? candidate.experience ?? 0;
  return typeof exp === 'number' ? exp : 0;
}

class FitAnalysisService {
  getExternalIdForJob(job: Job, source: 'ui' | 'agent' = 'ui'): string {
    return `shortlist_${source}_v1:${jobFingerprint(job)}`;
  }

  decisionFromScore(score: number) {
    if (score >= 85) return 'STRONG_PASS';
    if (score >= 75) return 'PASS';
    if (score >= 60) return 'BORDERLINE';
    return 'FAIL';
  }

  async analyze(job: Job, candidate: Candidate, semanticScore?: number): Promise<FitResult> {
    const fallback = computeHeuristicFit(job, candidate, semanticScore);

    if (!aiService.isAvailable()) return fallback;

    const prompt = `
You are an expert recruiter. Score candidate fit for the job on a 0-100 scale.

Job:
- Title: ${job.title}
- Department: ${job.department}
- Location: ${job.location}
- Required skills: ${(job.requiredSkills || []).join(', ')}
- Description: ${(job.description || '').slice(0, 1200)}

Candidate:
- Name: ${candidate.name}
- Current role: ${candidate.role || ''}
- Location: ${candidate.location || ''}
- Experience (years): ${getCandidateExperience(candidate)}
- Skills: ${(candidate.skills || []).join(', ')}
- Summary: ${getCandidateSummary(candidate)}

Optional signal:
- Semantic match score (0-100): ${typeof semanticScore === 'number' ? semanticScore : 'N/A'}

Return ONLY valid JSON:
{
  "score": number,
  "rationale": string,
  "confidence": number,
  "reasons": string[]
}
`;

    const ai = await aiService.generateJson<{
      score: number;
      rationale: string;
      confidence?: number;
      reasons?: string[];
    }>(prompt);

    if (!ai.success || !ai.data) {
      return fallback;
    }

    const score = clamp(Math.round(Number(ai.data.score ?? fallback.score)), 0, 100);
    const confidence = clamp(Number(ai.data.confidence ?? 0.7), 0, 1);
    const rationale = String(ai.data.rationale || fallback.rationale || '').trim() || fallback.rationale;
    const reasons = Array.isArray(ai.data.reasons) ? ai.data.reasons.map((r) => String(r)).filter(Boolean) : fallback.reasons;

    return { score, confidence, rationale, method: 'ai', reasons };
  }
}

export const fitAnalysisService = new FitAnalysisService();

