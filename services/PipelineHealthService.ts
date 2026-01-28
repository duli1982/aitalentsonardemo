import type { Candidate, Job } from '../types';
import { aiService } from './AIService';

export interface PipelineAlert {
  type: 'bottleneck' | 'risk' | 'opportunity' | 'urgent';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedCandidates: string[];
  recommendation: string;
}

export interface PipelineMetrics {
  totalCandidates: number;
  avgTimeToHire: number;
  conversionRate: number;
  atRiskCount: number;
}

export interface PipelineHealthAnalysis {
  overallHealth: number;
  healthRating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  metrics: PipelineMetrics;
  alerts: PipelineAlert[];
  insights: string[];
  recommendations: string[];
  method: 'deterministic' | 'ai';
}

function safeText(input: unknown, maxLen: number): string {
  const text = String(input ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ratingFromScore(score: number): PipelineHealthAnalysis['healthRating'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
}

function heuristicAnalysis(candidates: Candidate[], jobs: Job[]): PipelineHealthAnalysis {
  const totalCandidates = candidates.length;
  const openJobs = jobs.filter((j) => j.status === 'open').length;

  // No real pipeline timestamps here; keep intentionally conservative.
  const avgTimeToHire = 30;
  const conversionRate = totalCandidates > 0 ? clamp(Math.round((openJobs / totalCandidates) * 100), 0, 100) : 0;
  const atRiskCount = Math.round(totalCandidates * 0.15);

  const overallHealth = clamp(Math.round(70 - atRiskCount * 0.3), 0, 100);

  const analysis: PipelineHealthAnalysis = {
    overallHealth,
    healthRating: ratingFromScore(overallHealth),
    metrics: { totalCandidates, avgTimeToHire, conversionRate, atRiskCount },
    alerts:
      atRiskCount > 10
        ? [
            {
              type: 'risk',
              severity: 'medium',
              title: 'Drop-off risk building',
              description: 'A noticeable portion of candidates appear at risk of stalling without next actions.',
              affectedCandidates: [],
              recommendation: 'Prioritize screening/truth-check completion and follow-ups for the oldest pipeline items.'
            }
          ]
        : [],
    insights: ['Heuristic pipeline health (limited structured timestamps available).'],
    recommendations: ['Capture structured pipeline reasons and timestamps to improve health accuracy.'],
    method: 'deterministic'
  };

  return analysis;
}

class PipelineHealthService {
  async analyze(candidates: Candidate[], jobs: Job[]): Promise<PipelineHealthAnalysis> {
    const fallback = heuristicAnalysis(candidates, jobs);
    if (!aiService.isAvailable()) return fallback;

    const prompt = `
Analyze recruiting pipeline health.

Context:
- Candidates: ${candidates.length}
- Open jobs: ${jobs.filter((j) => j.status === 'open').length}

Return ONLY valid JSON with:
{
  "overallHealth": number,
  "healthRating": "excellent"|"good"|"fair"|"poor"|"critical",
  "metrics": { "totalCandidates": number, "avgTimeToHire": number, "conversionRate": number, "atRiskCount": number },
  "alerts": [{ "type": "bottleneck"|"risk"|"opportunity"|"urgent", "severity": "low"|"medium"|"high"|"critical", "title": string, "description": string, "affectedCandidates": string[], "recommendation": string }],
  "insights": string[],
  "recommendations": string[]
}
`;

    const res = await aiService.generateJson<Omit<PipelineHealthAnalysis, 'method'>>(prompt);
    if (!res.success || !res.data) return fallback;

    const data = res.data as any;
    const score = clamp(Math.round(Number(data.overallHealth ?? fallback.overallHealth)), 0, 100);

    return {
      overallHealth: score,
      healthRating: (data.healthRating as any) || ratingFromScore(score),
      metrics: {
        totalCandidates: Number(data.metrics?.totalCandidates ?? fallback.metrics.totalCandidates) || fallback.metrics.totalCandidates,
        avgTimeToHire: Number(data.metrics?.avgTimeToHire ?? fallback.metrics.avgTimeToHire) || fallback.metrics.avgTimeToHire,
        conversionRate: Number(data.metrics?.conversionRate ?? fallback.metrics.conversionRate) || fallback.metrics.conversionRate,
        atRiskCount: Number(data.metrics?.atRiskCount ?? fallback.metrics.atRiskCount) || fallback.metrics.atRiskCount
      },
      alerts: Array.isArray(data.alerts) ? (data.alerts as PipelineAlert[]).slice(0, 6) : fallback.alerts,
      insights: Array.isArray(data.insights) ? data.insights.map((v: any) => safeText(v, 220)).filter(Boolean).slice(0, 6) : fallback.insights,
      recommendations: Array.isArray(data.recommendations)
        ? data.recommendations.map((v: any) => safeText(v, 220)).filter(Boolean).slice(0, 6)
        : fallback.recommendations,
      method: 'ai'
    };
  }
}

export const pipelineHealthService = new PipelineHealthService();

