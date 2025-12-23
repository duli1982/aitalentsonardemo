import type { AppError, AppErrorCode, AppErrorContext } from '../types/errors';
import { createId } from '../utils/id';

function baseError(params: {
  code: AppErrorCode;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
  context?: AppErrorContext;
}): AppError {
  return {
    code: params.code,
    message: params.message,
    retryable: params.retryable,
    details: params.details,
    cause: params.cause,
    context: params.context,
    debugId: createId('dbg'),
    timestamp: new Date().toISOString()
  };
}

export function notConfigured(service: string, detail?: string, context?: AppErrorContext): AppError {
  return baseError({
    code: 'NOT_CONFIGURED',
    message: 'This feature is not configured yet.',
    retryable: false,
    details: { service, detail },
    context
  });
}

export function upstream(
  service: string,
  internalMessage: string,
  cause?: unknown,
  details?: Record<string, unknown>,
  context?: AppErrorContext
): AppError {
  return baseError({
    code: 'UPSTREAM',
    message: 'A required service is temporarily unavailable. Please try again.',
    retryable: true,
    details: { service, internalMessage, ...details },
    cause,
    context
  });
}

export function network(
  service: string,
  internalMessage: string,
  cause?: unknown,
  details?: Record<string, unknown>,
  context?: AppErrorContext
): AppError {
  return baseError({
    code: 'NETWORK',
    message: 'Network error. Check your connection and try again.',
    retryable: true,
    details: { service, internalMessage, ...details },
    cause,
    context
  });
}

export function rateLimited(
  service: string,
  internalMessage: string,
  retryAfterMs?: number,
  cause?: unknown,
  details?: Record<string, unknown>,
  context?: AppErrorContext
): AppError {
  return baseError({
    code: 'RATE_LIMITED',
    message: 'Rate limited. Please wait a moment and try again.',
    retryable: true,
    details: { service, internalMessage, retryAfterMs, ...details },
    cause,
    context
  });
}

export function validation(service: string, message: string, details?: Record<string, unknown>, context?: AppErrorContext): AppError {
  return baseError({
    code: 'VALIDATION',
    message,
    retryable: false,
    details: { service, ...details },
    context
  });
}

export function forbidden(
  service: string,
  internalMessage: string,
  cause?: unknown,
  details?: Record<string, unknown>,
  context?: AppErrorContext
): AppError {
  return baseError({
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
    retryable: false,
    details: { service, internalMessage, ...details },
    cause,
    context
  });
}

export function unknown(
  service: string,
  internalMessage: string,
  cause?: unknown,
  details?: Record<string, unknown>,
  context?: AppErrorContext
): AppError {
  return baseError({
    code: 'UNKNOWN',
    message: 'Unexpected error. Please try again.',
    retryable: false,
    details: { service, internalMessage, ...details },
    cause,
    context
  });
}

