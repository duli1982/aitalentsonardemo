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
  serviceName: string;
  operationName: string;
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

export class NetworkError extends Error {
  status?: number;
  endpoint?: string;

  constructor(message: string, status?: number, endpoint?: string) {
    super(message);
    this.name = 'NetworkError';
    this.status = status;
    this.endpoint = endpoint;
  }

  isRetryable(): boolean {
    if (typeof this.status !== 'number') return true;
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }
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
