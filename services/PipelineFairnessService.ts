import { supabase } from './supabaseClient';
import type { Result } from '../types/result';
import { err, ok } from '../types/result';
import { notConfigured, upstream } from './errorHandling';
import type { PipelineFairnessReport } from '../types/pipelineFairness';

const SERVICE = 'PipelineFairnessService';

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
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
    if (!supabase) return err(notConfigured(SERVICE, 'Supabase is not configured.'), { data: null as any });

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
        return err(upstream(SERVICE, `RPC get_fairness_report_by_stage failed: ${error.message}`, error), { data: null as any });
      }

      const row = Array.isArray(data) ? data[0] : data;
      const genderDistribution = asRecord(row?.gender_distribution);
      const educationDistribution = asRecord(row?.education_distribution);
      const alerts = Array.isArray(row?.alerts) ? row.alerts : [];

      return ok({
        status: String(row?.status || 'INSUFFICIENT_SAMPLE') as any,
        sampleSize: asNumber(row?.sample_size, 0),
        genderKnownCount: asNumber(row?.gender_known_count, 0),
        educationKnownCount: asNumber(row?.education_known_count, 0),
        genderCoveragePct: asNumber(row?.gender_coverage_pct, 0),
        educationCoveragePct: asNumber(row?.education_coverage_pct, 0),
        genderDistribution,
        educationDistribution,
        alerts,
        diversityScore: row?.diversity_score === null || row?.diversity_score === undefined ? null : asNumber(row?.diversity_score, 0)
      });
    } catch (e) {
      return err(upstream(SERVICE, 'RPC get_fairness_report_by_stage threw unexpectedly.', e), { data: null as any });
    }
  }
}

export const pipelineFairnessService = new PipelineFairnessService();

