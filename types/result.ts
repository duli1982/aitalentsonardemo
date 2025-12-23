import type { AppError } from './errors';

export type Result<T> =
  | { success: true; data: T; warnings?: AppError[] }
  | { success: false; error: AppError; retryAfterMs?: number; data?: T; warnings?: AppError[] };

export function ok<T>(data: T, warnings?: AppError[]): Result<T> {
  return warnings && warnings.length ? { success: true, data, warnings } : { success: true, data };
}

export function err<T = never>(error: AppError, params?: { retryAfterMs?: number; data?: T; warnings?: AppError[] }): Result<T> {
  return {
    success: false,
    error,
    retryAfterMs: params?.retryAfterMs,
    data: params?.data,
    warnings: params?.warnings
  };
}

