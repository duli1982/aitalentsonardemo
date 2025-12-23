import type { AppError } from '../types/errors';
import { eventBus, EVENTS } from '../utils/EventBus';
import { summarizeRedactedInput } from '../utils/redact';

export type DegradedModeReport = {
  feature: string;
  error: AppError;
  whatMightBeMissing: string;
  lastUpdatedAt?: string; // ISO
  retryAfterMs?: number;
  jobId?: string;
  candidateId?: string;
  correlationId?: string;
  input?: unknown;
};

export type DegradedModeEvent = Omit<DegradedModeReport, 'input'> & {
  occurredAt: string; // ISO
  redactedInputSummary?: string;
};

class DegradedModeService {
  report(report: DegradedModeReport) {
    const payload: DegradedModeEvent = {
      ...report,
      occurredAt: new Date().toISOString(),
      redactedInputSummary: report.input === undefined ? undefined : summarizeRedactedInput(report.input)
    };
    eventBus.emit(EVENTS.APP_DEGRADED, payload);
  }

  clear(feature?: string) {
    eventBus.emit(EVENTS.APP_DEGRADED, {
      feature: feature ?? '*',
      occurredAt: new Date().toISOString(),
      error: null
    } as any);
  }
}

export const degradedModeService = new DegradedModeService();

