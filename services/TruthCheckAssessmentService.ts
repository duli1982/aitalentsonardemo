import { detectGenericAnswer, type TruthCheckRubricBand } from './TruthCheckService';

export type TruthCheckAnswerAssessment = {
  questionId: string;
  question: string;
  answer: string;
  score: number; // 0-100
  band: TruthCheckRubricBand;
  generic: { isGeneric: boolean; reasons: string[] };
};

export function scoreTruthCheckAnswer(params: {
  questionId: string;
  question: string;
  answer: string;
  bandOverride?: TruthCheckRubricBand;
}): TruthCheckAnswerAssessment {
  const { questionId, question, answer, bandOverride } = params;
  const generic = detectGenericAnswer(answer);

  const text = String(answer || '').trim();
  const wordCount = text ? text.split(/\s+/).length : 0;
  const hasNumbers = /\d/.test(text);
  const mentionsTradeoff = /\b(tradeoff|constraint|decision|because)\b/i.test(text);
  const mentionsArtifact = /\b(repo|github|pull request|pr\b|doc|design doc|ticket|jira)\b/i.test(text);

  // Deterministic heuristic scoring (no AI required).
  let score = 45;
  if (wordCount >= 35) score += 10;
  if (wordCount >= 60) score += 6;
  if (hasNumbers) score += 10;
  if (mentionsTradeoff) score += 8;
  if (mentionsArtifact) score += 6;
  if (generic.isGeneric) score -= 28;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const band: TruthCheckRubricBand =
    bandOverride ??
    (generic.isGeneric || score < 60 ? 'concern' : score < 80 ? 'adequate' : 'strong');

  return {
    questionId: String(questionId),
    question: String(question || ''),
    answer: String(answer || ''),
    score,
    band,
    generic
  };
}

export function recommendationForTruthCheckScore(score: number): 'STRONG_PASS' | 'PASS' | 'BORDERLINE' | 'FAIL' {
  const s = Number(score) || 0;
  if (s >= 85) return 'STRONG_PASS';
  if (s >= 65) return 'PASS';
  if (s >= 50) return 'BORDERLINE';
  return 'FAIL';
}

export function summarizeTruthCheck(answers: TruthCheckAnswerAssessment[]): {
  avgScore: number;
  genericCount: number;
  recommendation: 'STRONG_PASS' | 'PASS' | 'BORDERLINE' | 'FAIL';
} {
  const list = Array.isArray(answers) ? answers : [];
  if (!list.length) return { avgScore: 0, genericCount: 0, recommendation: 'FAIL' };
  const avgScore = Math.round(list.reduce((sum, a) => sum + (Number(a.score) || 0), 0) / list.length);
  const genericCount = list.filter((a) => a.generic?.isGeneric).length;
  return { avgScore, genericCount, recommendation: recommendationForTruthCheckScore(avgScore) };
}

