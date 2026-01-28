import { supabase } from './supabaseClient';
import type { ScreeningResult } from './AutonomousScreeningAgent';
import type { TruthCheckPack } from './TruthCheckService';
import type { TruthCheckAnswerAssessment } from './TruthCheckAssessmentService';

export type DecisionType = 'screening' | 'interview' | 'shortlist_analysis';
export type DecisionValue = 'STRONG_PASS' | 'PASS' | 'BORDERLINE' | 'FAIL' | 'REJECTED' | 'HIRED';

export interface DecisionArtifactRecord {
  id: string;
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  decisionType: DecisionType;
  decision: DecisionValue;
  score?: number;
  confidence?: number;
  summary?: string;
  details: Record<string, unknown>;
  rubricId?: string;
  rubricVersion?: number;
  externalId?: string;
  createdAt: string;
}

class DecisionArtifactService {
  async listArtifactsForCandidate(params: {
    candidateId: string;
    decisionType?: DecisionType;
    limit?: number;
  }): Promise<DecisionArtifactRecord[]> {
    if (!supabase) return [];

    const { candidateId, decisionType, limit = 200 } = params;

    let query = supabase
      .from('decision_artifacts')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (decisionType) query = query.eq('decision_type', decisionType);

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row: any): DecisionArtifactRecord => ({
      id: row.id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name ?? undefined,
      jobId: row.job_id,
      jobTitle: row.job_title ?? undefined,
      decisionType: row.decision_type as DecisionType,
      decision: row.decision as DecisionValue,
      score: typeof row.score === 'number' ? row.score : undefined,
      confidence: typeof row.confidence === 'number' ? row.confidence : undefined,
      summary: row.summary ?? undefined,
      details: row.details ?? {},
      rubricId: row.rubric_id ?? undefined,
      rubricVersion: typeof row.rubric_version === 'number' ? row.rubric_version : undefined,
      externalId: row.external_id ?? undefined,
      createdAt: row.created_at
    }));
  }

  async listArtifactsForJob(params: {
    jobId: string;
    decisionType?: DecisionType;
    limit?: number;
  }): Promise<DecisionArtifactRecord[]> {
    if (!supabase) return [];

    const { jobId, decisionType, limit = 500 } = params;

    let query = supabase
      .from('decision_artifacts')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (decisionType) query = query.eq('decision_type', decisionType);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row: any): DecisionArtifactRecord => ({
      id: row.id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name ?? undefined,
      jobId: row.job_id,
      jobTitle: row.job_title ?? undefined,
      decisionType: row.decision_type as DecisionType,
      decision: row.decision as DecisionValue,
      score: typeof row.score === 'number' ? row.score : undefined,
      confidence: typeof row.confidence === 'number' ? row.confidence : undefined,
      summary: row.summary ?? undefined,
      details: row.details ?? {},
      rubricId: row.rubric_id ?? undefined,
      rubricVersion: typeof row.rubric_version === 'number' ? row.rubric_version : undefined,
      externalId: row.external_id ?? undefined,
      createdAt: row.created_at
    }));
  }

  async saveScreeningResult(params: {
    result: ScreeningResult;
    rubricName?: string;
    rubricVersion?: number;
    confidence?: number;
    details?: Record<string, unknown>;
  }): Promise<void> {
    if (!supabase) return;

    const { result, rubricName = 'Screening Rubric', rubricVersion = 1, confidence, details: extraDetails } = params;

    // Optional: try to resolve rubric_id by name (best-effort).
    let rubricId: string | null = null;
    try {
      const { data } = await supabase.from('rubrics').select('id').eq('name', rubricName).maybeSingle();
      rubricId = data?.id ?? null;
    } catch {
      rubricId = null;
    }

    const payload = {
      candidate_id: result.candidateId,
      candidate_name: result.candidateName ?? null,
      job_id: result.jobId,
      job_title: result.jobTitle ?? null,
      decision_type: 'screening',
      decision: result.recommendation,
      score: result.score,
      confidence: confidence ?? null,
      summary: result.summary ?? null,
      details: {
        questions: result.questions ?? [],
        passed: result.passed,
        screenedAt: new Date(result.screenedAt).toISOString(),
        ...(extraDetails ?? {})
      },
      rubric_id: rubricId,
      rubric_version: rubricVersion,
      external_id: result.id
    };

    const { error } = await supabase
      .from('decision_artifacts')
      .upsert(payload, { onConflict: 'candidate_id,job_id,decision_type,external_id' });

    if (error && import.meta.env.DEV) {
      console.warn('[DecisionArtifactService] Failed to persist screening artifact:', error);
    }
  }

  async saveTruthCheckAssessment(params: {
    candidateId: string;
    candidateName?: string;
    jobId: string;
    jobTitle?: string;
    truthCheck: TruthCheckPack;
    answers: TruthCheckAnswerAssessment[];
    score: number;
    recommendation: ScreeningResult['recommendation'];
    summary: string;
    rubricName?: string;
    rubricVersion?: number;
    externalId?: string;
  }): Promise<void> {
    if (!supabase) return;

    const {
      candidateId,
      candidateName,
      jobId,
      jobTitle,
      truthCheck,
      answers,
      score,
      recommendation,
      summary,
      rubricName = 'Truth Check Rubric',
      rubricVersion = 1,
      externalId = 'truth_check_v1'
    } = params;

    let rubricId: string | null = null;
    try {
      const { data } = await supabase.from('rubrics').select('id').eq('name', rubricName).maybeSingle();
      rubricId = data?.id ?? null;
    } catch {
      rubricId = null;
    }

    const payload = {
      candidate_id: candidateId,
      candidate_name: candidateName ?? null,
      job_id: jobId,
      job_title: jobTitle ?? null,
      decision_type: 'screening',
      decision: recommendation,
      score,
      confidence: null,
      summary: summary ?? null,
      details: {
        truthCheck,
        answers,
        questions: (answers || []).map((a) => ({ question: a.question, answer: a.answer, score: a.score })),
        capturedBy: 'recruiter',
        capturedAt: new Date().toISOString()
      },
      rubric_id: rubricId,
      rubric_version: rubricVersion,
      external_id: externalId
    };

    const { error } = await supabase
      .from('decision_artifacts')
      .upsert(payload, { onConflict: 'candidate_id,job_id,decision_type,external_id' });

    if (error && import.meta.env.DEV) {
      console.warn('[DecisionArtifactService] Failed to persist truth-check artifact:', error);
    }
  }

  async listScreeningsForCandidate(candidateId: string, limit = 100): Promise<ScreeningResult[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('decision_artifacts')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('decision_type', 'screening')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data
      .map((row: any): ScreeningResult | null => {
        const details = row.details ?? {};
        const questions = Array.isArray(details.questions) ? details.questions : [];
        const screenedAt = details.screenedAt || row.created_at;

        return {
          id: row.external_id || row.id,
          candidateId: row.candidate_id,
          candidateName: row.candidate_name || 'Candidate',
          jobId: row.job_id,
          jobTitle: row.job_title || 'Job',
          score: typeof row.score === 'number' ? row.score : 0,
          passed: Boolean(details.passed ?? (row.decision !== 'FAIL')),
          questions: questions.map((q: any) => ({
            question: String(q.question ?? ''),
            answer: String(q.answer ?? ''),
            score: Number(q.score ?? 0)
          })),
          recommendation: row.decision as ScreeningResult['recommendation'],
          summary: String(row.summary ?? ''),
          screenedAt: new Date(screenedAt)
        };
      })
      .filter(Boolean) as ScreeningResult[];
  }

  async saveShortlistAnalysis(params: {
    candidateId: string;
    candidateName?: string;
    jobId: string;
    jobTitle?: string;
    score: number;
    decision: DecisionValue;
    summary?: string;
    details?: Record<string, unknown>;
    externalId?: string;
    rubricName?: string;
    rubricVersion?: number;
    confidence?: number;
  }): Promise<void> {
    if (!supabase) return;

    const {
      candidateId,
      candidateName,
      jobId,
      jobTitle,
      score,
      decision,
      summary,
      details = {},
      externalId = 'shortlist_v1',
      rubricName = 'Shortlist Rubric',
      rubricVersion = 1,
      confidence
    } = params;

    let rubricId: string | null = null;
    try {
      const { data } = await supabase.from('rubrics').select('id').eq('name', rubricName).maybeSingle();
      rubricId = data?.id ?? null;
    } catch {
      rubricId = null;
    }

    const payload = {
      candidate_id: candidateId,
      candidate_name: candidateName ?? null,
      job_id: jobId,
      job_title: jobTitle ?? null,
      decision_type: 'shortlist_analysis',
      decision,
      score,
      confidence: confidence ?? null,
      summary: summary ?? null,
      details,
      rubric_id: rubricId,
      rubric_version: rubricVersion,
      external_id: externalId
    };

    const { error } = await supabase
      .from('decision_artifacts')
      .upsert(payload, { onConflict: 'candidate_id,job_id,decision_type,external_id' });

    if (error && import.meta.env.DEV) {
      console.warn('[DecisionArtifactService] Failed to persist shortlist artifact:', error);
    }
  }

  async saveInterviewDebrief(params: {
    candidateId: string;
    candidateName?: string;
    jobId: string;
    jobTitle?: string;
    score: number;
    decision: DecisionValue;
    summary?: string;
    details?: Record<string, unknown>;
    externalId?: string;
    rubricName?: string;
    rubricVersion?: number;
    confidence?: number;
  }): Promise<void> {
    if (!supabase) return;

    const {
      candidateId,
      candidateName,
      jobId,
      jobTitle,
      score,
      decision,
      summary,
      details = {},
      externalId = 'interview_v1',
      rubricName = 'Interview Rubric',
      rubricVersion = 1,
      confidence
    } = params;

    let rubricId: string | null = null;
    try {
      const { data } = await supabase.from('rubrics').select('id').eq('name', rubricName).maybeSingle();
      rubricId = data?.id ?? null;
    } catch {
      rubricId = null;
    }

    const payload = {
      candidate_id: candidateId,
      candidate_name: candidateName ?? null,
      job_id: jobId,
      job_title: jobTitle ?? null,
      decision_type: 'interview',
      decision,
      score,
      confidence: confidence ?? null,
      summary: summary ?? null,
      details,
      rubric_id: rubricId,
      rubric_version: rubricVersion,
      external_id: externalId
    };

    const { error } = await supabase
      .from('decision_artifacts')
      .upsert(payload, { onConflict: 'candidate_id,job_id,decision_type,external_id' });

    if (error && import.meta.env.DEV) {
      console.warn('[DecisionArtifactService] Failed to persist interview artifact:', error);
    }
  }

  async listShortlistAnalysesForCandidate(candidateId: string, limit = 200): Promise<DecisionArtifactRecord[]> {
    return this.listArtifactsForCandidate({ candidateId, decisionType: 'shortlist_analysis', limit });
  }
}

export const decisionArtifactService = new DecisionArtifactService();
