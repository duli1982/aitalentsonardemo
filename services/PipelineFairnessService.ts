import { supabase } from './supabaseClient';
import type { Result } from '../types/result';
import { err, ok } from '../types/result';
import { notConfigured, upstream } from './errorHandling';
import type { FairnessAlert, FairnessReportStatus, PipelineFairnessReport } from '../types/pipelineFairness';

const SERVICE = 'PipelineFairnessService';

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asStatus(value: unknown): FairnessReportStatus {
  const status = String(value || 'INSUFFICIENT_SAMPLE');
  if (status === 'OK' || status === 'INSUFFICIENT_SAMPLE' || status === 'INSUFFICIENT_COVERAGE') {
    return status;
  }
  return 'INSUFFICIENT_SAMPLE';
}

function asDistribution(value: unknown): Record<string, { count: number; pct: number }> {
  const source = asRecord(value);
  return Object.fromEntries(
    Object.entries(source).map(([key, raw]) => {
      const bucket = asRecord(raw);
      return [key, { count: asNumber(bucket.count, 0), pct: asNumber(bucket.pct, 0) }];
    })
  );
}

function asAlerts(value: unknown): FairnessAlert[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((alert) => asRecord(alert))
    .filter((alert) => typeof alert.message === 'string')
    .map((alert) => ({
      type: String(alert.type || 'GENDER_IMBALANCE') as FairnessAlert['type'],
      severity: String(alert.severity || 'INFO') as FairnessAlert['severity'],
      message: String(alert.message || ''),
      suggestion: String(alert.suggestion || '')
    }));
}

export type PipelineFairnessQuery = {
  jobId: string;
  stage: string;
  windowDays?: number;
  minSample?: number;
  minCoveragePct?: number;
};

class PipelineFairnessService {
  async getReport(params: PipelineFairnessQuery): Promise<Result<PipelineFairnessReport>> {
    if (!supabase) return err(notConfigured(SERVICE, 'Supabase is not configured.'));

    const { jobId, stage, windowDays = 30, minSample = 10, minCoveragePct = 0.3 } = params;

    try {
      const { data, error } = await supabase.rpc('get_fairness_report_by_stage', {
        job_id: jobId,
        stage,
        window_days: windowDays,
        min_sample: minSample,
        min_coverage_pct: minCoveragePct
      });

      if (error) {
        return err(upstream(SERVICE, `RPC get_fairness_report_by_stage failed: ${error.message}`, error));
      }

      const row = asRecord(Array.isArray(data) ? data[0] : data);
      const genderDistribution = asDistribution(row.gender_distribution);
      const educationDistribution = asDistribution(row.education_distribution);
      const alerts = asAlerts(row.alerts);

      return ok({
        status: asStatus(row.status),
        sampleSize: asNumber(row.sample_size, 0),
        genderKnownCount: asNumber(row.gender_known_count, 0),
        educationKnownCount: asNumber(row.education_known_count, 0),
        genderCoveragePct: asNumber(row.gender_coverage_pct, 0),
        educationCoveragePct: asNumber(row.education_coverage_pct, 0),
        genderDistribution,
        educationDistribution,
        alerts,
        diversityScore: row.diversity_score === null || row.diversity_score === undefined ? null : asNumber(row.diversity_score, 0)
      });
    } catch (e) {
      return err(upstream(SERVICE, 'RPC get_fairness_report_by_stage threw unexpectedly.', e));
    }
  }
}

export const pipelineFairnessService = new PipelineFairnessService();
