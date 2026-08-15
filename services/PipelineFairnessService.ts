import type { Result } from '../types/result';
import { ok } from '../types/result';
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
    return ok({ status: 'INSUFFICIENT_SAMPLE', sampleSize: 0, genderKnownCount: 0, educationKnownCount: 0, genderCoveragePct: 0, educationCoveragePct: 0, genderDistribution: {}, educationDistribution: {}, alerts: [{ type: 'GENDER_IMBALANCE', severity: 'INFO', message: 'Fairness reporting needs voluntarily supplied demographic data.', suggestion: 'Collect consented demographic data before drawing conclusions.' }], diversityScore: null });
  }
}

export const pipelineFairnessService = new PipelineFairnessService();
