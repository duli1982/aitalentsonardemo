import { Type } from '@google/genai';
import type { Candidate, Job } from '../types';
import { aiService } from './AIService';
import { sanitizeForPrompt, sanitizeArray, sanitizeShort, buildSecurePrompt } from '../utils/promptSecurity';
import { validateFitScore } from '../utils/outputValidation';

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
    typeof candidate.experienceYears === 'number'
      ? clamp(candidate.experienceYears * 2, 0, 10)
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
  const summary = String(candidate.summary || candidate.notes || '').trim();
  return summary.slice(0, 800);
}

function getCandidateExperience(candidate: Candidate): number {
  const exp = candidate.experienceYears ?? candidate.experience ?? 0;
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

    const prompt = buildSecurePrompt({
      system: 'You are an expert recruiter. Score candidate fit for the job on a 0-100 scale based ONLY on factual skill overlap, experience, and role alignment.',
      dataBlocks: [
        {
          label: 'JOB',
          content: [
            `Title: ${sanitizeShort(job.title)}`,
            `Department: ${sanitizeShort(job.department)}`,
            `Location: ${sanitizeShort(job.location)}`,
            `Required skills: ${sanitizeArray(job.requiredSkills || []).join(', ')}`,
            `Description: ${sanitizeForPrompt((job.description || '').slice(0, 1200), 1200)}`
          ].join('\n')
        },
        {
          label: 'CANDIDATE',
          content: [
            `Name: ${sanitizeShort(candidate.name)}`,
            `Current role: ${sanitizeShort(candidate.role || '')}`,
            `Location: ${sanitizeShort(candidate.location || '')}`,
            `Experience (years): ${getCandidateExperience(candidate)}`,
            `Skills: ${sanitizeArray(candidate.skills || []).join(', ')}`,
            `Summary: ${sanitizeForPrompt(getCandidateSummary(candidate), 800)}`
          ].join('\n')
        }
      ],
      outputSpec: `Optional signal — Semantic match score (0-100): ${typeof semanticScore === 'number' ? semanticScore : 'N/A'}

Return ONLY valid JSON:
{
  "score": number,
  "rationale": string,
  "confidence": number,
  "reasons": string[]
}`
    });

    // Layer 6: Enforce structured output schema at the API level.
    const fitSchema = {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER, description: 'Fit score from 0 to 100.' },
        rationale: { type: Type.STRING, description: 'Explanation of the score.' },
        confidence: { type: Type.NUMBER, description: 'Confidence level from 0 to 1.' },
        reasons: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Key reasons supporting the score.' }
      },
      required: ['score', 'rationale', 'confidence', 'reasons']
    };

    const ai = await aiService.generateJson<{
      score: number;
      rationale: string;
      confidence?: number;
      reasons?: string[];
    }>(prompt, fitSchema);

    if (!ai.success || !ai.data) {
      return fallback;
    }

    // Layer 5: Validate AI output — clamp scores, detect leakage, flag anomalies.
    const validated = validateFitScore({
      score: ai.data.score ?? fallback.score,
      confidence: ai.data.confidence ?? 0.7,
      rationale: ai.data.rationale || fallback.rationale,
      reasons: ai.data.reasons
    });

    // If validation found critical issues, fall back to deterministic scoring.
    if (!validated.validation.valid) return fallback;

    const score = clamp(Math.round(validated.score), 0, 100);
    const confidence = validated.confidence;
    const rationale = validated.rationale || fallback.rationale;
    const reasons = validated.reasons.length > 0 ? validated.reasons : fallback.reasons;

    return { score, confidence, rationale, method: 'ai', reasons };
  }
}

export const fitAnalysisService = new FitAnalysisService();
