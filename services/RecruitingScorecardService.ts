import { supabase } from './supabaseClient';
import type { DecisionArtifactRecord, DecisionValue } from './DecisionArtifactService';

export type RecruitingScorecardDimensionKey =
  | 'semantic_match'
  | 'shortlist_analysis'
  | 'screening'
  | 'engagement';

export interface RecruitingScorecardDimension {
  key: RecruitingScorecardDimensionKey;
  score: number; // 0..100
  confidence: number; // 0..1
  source: string; // e.g. "semantic_embedding", "decision_artifacts", "engagement_estimated"
  updatedAt?: string;
  artifactId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecruitingScorecardRecord {
  id?: number;
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  version: number;
  overallScore: number; // 0..100
  confidence?: number; // 0..1
  dimensions: Record<string, RecruitingScorecardDimension>;
  weights: Record<string, number>;
  provenance: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecruitingScorecardSignals {
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  semanticMatchScore?: number; // 0..100
  shortlistArtifact?: Pick<DecisionArtifactRecord, 'id' | 'score' | 'decision' | 'createdAt' | 'details' | 'externalId'>;
  screeningArtifact?: Pick<DecisionArtifactRecord, 'id' | 'score' | 'decision' | 'createdAt' | 'details' | 'externalId'>;
  engagementScore?: {
    score: number; // 0..100
    level?: string;
    mode?: 'estimated' | 'ai';
    createdAt?: string;
  };
}

const SCORECARD_VERSION = 1;

const DEFAULT_WEIGHTS: Record<RecruitingScorecardDimensionKey, number> = {
  semantic_match: 0.35,
  shortlist_analysis: 0.25,
  screening: 0.3,
  engagement: 0.1
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).filter(([, v]) => Number.isFinite(v) && v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) return {};
  return Object.fromEntries(entries.map(([k, v]) => [k, v / total]));
}

function decisionToConfidence(decision: DecisionValue | undefined, kind: RecruitingScorecardDimensionKey): number {
  if (kind === 'screening') {
    // Screening is strongest signal when it exists.
    if (decision === 'STRONG_PASS') return 0.95;
    if (decision === 'PASS') return 0.9;
    if (decision === 'BORDERLINE') return 0.75;
    if (decision === 'FAIL') return 0.85;
    return 0.8;
  }

  if (kind === 'shortlist_analysis') {
    if (decision === 'STRONG_PASS') return 0.8;
    if (decision === 'PASS') return 0.7;
    if (decision === 'BORDERLINE') return 0.55;
    if (decision === 'FAIL') return 0.65;
    return 0.6;
  }

  return 0.5;
}

function computeScorecard(signals: RecruitingScorecardSignals): Omit<RecruitingScorecardRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const computedAt = new Date().toISOString();

  const dimensions: Record<string, RecruitingScorecardDimension> = {};

  if (typeof signals.semanticMatchScore === 'number') {
    dimensions.semantic_match = {
      key: 'semantic_match',
      score: clampScore(signals.semanticMatchScore),
      confidence: 0.4,
      source: 'semantic_embedding',
      updatedAt: computedAt
    };
  }

  if (signals.shortlistArtifact && typeof signals.shortlistArtifact.score === 'number') {
    dimensions.shortlist_analysis = {
      key: 'shortlist_analysis',
      score: clampScore(signals.shortlistArtifact.score),
      confidence: decisionToConfidence(signals.shortlistArtifact.decision as DecisionValue, 'shortlist_analysis'),
      source: 'decision_artifacts',
      updatedAt: signals.shortlistArtifact.createdAt,
      artifactId: signals.shortlistArtifact.externalId ?? signals.shortlistArtifact.id,
      metadata: {
        decision: signals.shortlistArtifact.decision,
        details: signals.shortlistArtifact.details ?? {}
      }
    };
  }

  if (signals.screeningArtifact && typeof signals.screeningArtifact.score === 'number') {
    dimensions.screening = {
      key: 'screening',
      score: clampScore(signals.screeningArtifact.score),
      confidence: decisionToConfidence(signals.screeningArtifact.decision as DecisionValue, 'screening'),
      source: 'decision_artifacts',
      updatedAt: signals.screeningArtifact.createdAt,
      artifactId: signals.screeningArtifact.externalId ?? signals.screeningArtifact.id,
      metadata: {
        decision: signals.screeningArtifact.decision,
        details: signals.screeningArtifact.details ?? {}
      }
    };
  }

  if (signals.engagementScore && typeof signals.engagementScore.score === 'number') {
    dimensions.engagement = {
      key: 'engagement',
      score: clampScore(signals.engagementScore.score),
      confidence: signals.engagementScore.mode === 'ai' ? 0.7 : 0.5,
      source: signals.engagementScore.mode === 'ai' ? 'engagement_ai' : 'engagement_estimated',
      updatedAt: signals.engagementScore.createdAt ?? computedAt,
      metadata: {
        level: signals.engagementScore.level,
        mode: signals.engagementScore.mode ?? 'estimated'
      }
    };
  }

  const weights = normalizeWeights(
    Object.fromEntries(
      (Object.keys(dimensions) as RecruitingScorecardDimensionKey[]).map((key) => [key, DEFAULT_WEIGHTS[key] ?? 0])
    )
  );

  const weightedScore = Object.entries(weights).reduce((sum, [key, weight]) => {
    const dim = dimensions[key];
    if (!dim) return sum;
    return sum + dim.score * weight;
  }, 0);

  const weightedConfidence = Object.entries(weights).reduce((sum, [key, weight]) => {
    const dim = dimensions[key];
    if (!dim) return sum;
    return sum + dim.confidence * weight;
  }, 0);

  const fingerprint = JSON.stringify(
    Object.keys(dimensions)
      .sort()
      .map((key) => ({
        key,
        score: dimensions[key]?.score,
        artifactId: dimensions[key]?.artifactId,
        source: dimensions[key]?.source
      }))
  );

  return {
    candidateId: signals.candidateId,
    candidateName: signals.candidateName,
    jobId: signals.jobId,
    jobTitle: signals.jobTitle,
    version: SCORECARD_VERSION,
    overallScore: clampScore(weightedScore),
    confidence: clamp01(weightedConfidence),
    dimensions,
    weights,
    provenance: {
      algorithm: 'recruiting_scorecard_v1',
      computedAt,
      fingerprint,
      sources: Object.fromEntries(Object.entries(dimensions).map(([k, v]) => [k, { source: v.source, updatedAt: v.updatedAt, artifactId: v.artifactId }]))
    }
  };
}

class RecruitingScorecardService {
  compute(signals: RecruitingScorecardSignals): RecruitingScorecardRecord {
    return computeScorecard(signals);
  }

  async upsert(scorecard: RecruitingScorecardRecord): Promise<void> {
    if (!supabase) return;

    const payload = {
      candidate_id: scorecard.candidateId,
      candidate_name: scorecard.candidateName ?? null,
      job_id: scorecard.jobId,
      job_title: scorecard.jobTitle ?? null,
      version: scorecard.version,
      overall_score: scorecard.overallScore,
      confidence: typeof scorecard.confidence === 'number' ? scorecard.confidence : null,
      dimensions: scorecard.dimensions ?? {},
      weights: scorecard.weights ?? {},
      provenance: scorecard.provenance ?? {},
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('recruiting_scorecards')
      .upsert(payload, { onConflict: 'candidate_id,job_id,version' });

    if (error && import.meta.env.DEV) {
      console.warn('[RecruitingScorecardService] Failed to upsert scorecard:', error);
    }
  }

  async listForCandidate(candidateId: string, version = SCORECARD_VERSION, limit = 250): Promise<RecruitingScorecardRecord[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('recruiting_scorecards')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('version', version)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: any): RecruitingScorecardRecord => ({
      id: row.id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name ?? undefined,
      jobId: row.job_id,
      jobTitle: row.job_title ?? undefined,
      version: row.version,
      overallScore: row.overall_score,
      confidence: row.confidence ?? undefined,
      dimensions: row.dimensions ?? {},
      weights: row.weights ?? {},
      provenance: row.provenance ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

export const recruitingScorecardService = new RecruitingScorecardService();
export const RECRUITING_SCORECARD_VERSION = SCORECARD_VERSION;
