export type AppErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UPSTREAM'
  | 'INTERNAL'
  | 'UNKNOWN';

export type AppErrorContext = Partial<{
  feature: string;
  jobId: string;
  candidateId: string;
  correlationId: string;
}>;

export interface AppError {
  code: AppErrorCode;
  message: string; // safe to show to users
  debugId: string;
  timestamp: string; // ISO string
  retryable?: boolean;
  details?: Record<string, unknown>; // safe structured fields for the Details drawer
  context?: AppErrorContext;
  cause?: unknown; // admin-only
}

export function formatError(error: AppError | string | unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (typeof (error as any)?.message === 'string') return String((error as any).message);
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

