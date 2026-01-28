/**
 * Centralized Error Logging Service
 *
 * Provides unified error tracking, monitoring, and reporting across the application.
 * Integrates with PulseService for real-time error visibility and maintains error history.
 */

import { AppError } from '../types/errors';
import { pulseService } from './PulseService';
import { createId } from '../utils/id';

export interface ErrorLogEntry {
  id: string;
  error: AppError;
  timestamp: string;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
  stackTrace?: string;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsByService: Record<string, number>;
  recentErrors: ErrorLogEntry[];
  criticalErrorsToday: number;
}

class ErrorLoggingService {
  private errorLog: ErrorLogEntry[] = [];
  private readonly MAX_LOG_SIZE = 1000;
  private readonly STORAGE_KEY = 'app_error_log';
  private sessionId: string;

  constructor() {
    this.sessionId = createId('session');
    this.loadPersistedErrors();
  }

  /**
   * Log an error with full context
   */
  logError(error: AppError, additionalContext?: {
    userId?: string;
    stackTrace?: string;
    customData?: Record<string, unknown>;
  }): void {
    const entry: ErrorLogEntry = {
      id: createId('err'),
      error,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: additionalContext?.userId,
      sessionId: this.sessionId,
      stackTrace: additionalContext?.stackTrace
    };

    // Add to in-memory log
    this.errorLog.unshift(entry);

    // Trim log if too large
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog = this.errorLog.slice(0, this.MAX_LOG_SIZE);
    }

    // Persist to localStorage
    this.persistErrors();

    // Send to PulseService for real-time visibility
    this.sendToPulse(entry);

    // Log to console in development
    if (import.meta.env.DEV) {
      this.consoleLog(entry);
    }

    // Send to external monitoring (if configured)
    this.sendToMonitoring(entry, additionalContext?.customData);
  }

  /**
   * Log a warning (non-critical error)
   */
  logWarning(error: AppError): void {
    pulseService.addEvent({
      type: 'SYSTEM',
      severity: 'warning',
      message: error.message,
      icon: '⚠️',
      metadata: {
        code: error.code,
        service: error.context?.serviceName,
        debugId: error.debugId
      }
    });

    if (import.meta.env.DEV) {
      console.warn(`[Warning] ${error.code}:`, error.message, error);
    }
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const errorsByCode: Record<string, number> = {};
    const errorsByService: Record<string, number> = {};

    let criticalErrorsToday = 0;

    this.errorLog.forEach(entry => {
      // Count by code
      errorsByCode[entry.error.code] = (errorsByCode[entry.error.code] || 0) + 1;

      // Count by service
      const service = entry.error.context?.serviceName || 'unknown';
      errorsByService[service] = (errorsByService[service] || 0) + 1;

      // Count critical errors today
      if (new Date(entry.timestamp) >= todayStart && this.isCritical(entry.error)) {
        criticalErrorsToday++;
      }
    });

    return {
      totalErrors: this.errorLog.length,
      errorsByCode,
      errorsByService,
      recentErrors: this.errorLog.slice(0, 10),
      criticalErrorsToday
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): ErrorLogEntry[] {
    return this.errorLog.slice(0, limit);
  }

  /**
   * Get errors by code
   */
  getErrorsByCode(code: string): ErrorLogEntry[] {
    return this.errorLog.filter(entry => entry.error.code === code);
  }

  /**
   * Clear error log
   */
  clearLog(): void {
    this.errorLog = [];
    localStorage.removeItem(this.STORAGE_KEY);

    pulseService.addEvent({
      type: 'SYSTEM',
      severity: 'info',
      message: 'Error log cleared',
      icon: '🧹'
    });
  }

  /**
   * Export errors for debugging
   */
  exportErrors(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }

  // Private methods

  private sendToPulse(entry: ErrorLogEntry): void {
    const severity = this.isCritical(entry.error) ? 'error' : 'warning';

    pulseService.addEvent({
      type: 'SYSTEM',
      severity,
      message: entry.error.message,
      icon: severity === 'error' ? '🚨' : '⚠️',
      metadata: {
        code: entry.error.code,
        debugId: entry.error.debugId,
        service: entry.error.context?.serviceName,
        operation: entry.error.context?.operationName,
        retryable: entry.error.retryable,
        timestamp: entry.timestamp
      }
    });
  }

  private consoleLog(entry: ErrorLogEntry): void {
    const style = this.isCritical(entry.error) ? 'color: red; font-weight: bold' : 'color: orange';

    console.group(`%c[${entry.error.code}] ${entry.error.message}`, style);
    console.log('Debug ID:', entry.error.debugId);
    console.log('Service:', entry.error.context?.serviceName);
    console.log('Operation:', entry.error.context?.operationName);
    console.log('Retryable:', entry.error.retryable);
    console.log('Details:', entry.error.details);
    if (entry.stackTrace) {
      console.log('Stack:', entry.stackTrace);
    }
    if (entry.error.cause) {
      console.log('Cause:', entry.error.cause);
    }
    console.groupEnd();
  }

  private sendToMonitoring(entry: ErrorLogEntry, customData?: Record<string, unknown>): void {
    // Integration point for external monitoring services
    // Examples: Sentry, LogRocket, DataDog, New Relic, etc.

    // Example: Send to Sentry (if configured)
    if ((window as any).Sentry) {
      (window as any).Sentry.captureException(new Error(entry.error.message), {
        tags: {
          errorCode: entry.error.code,
          service: entry.error.context?.serviceName,
          retryable: entry.error.retryable
        },
        extra: {
          debugId: entry.error.debugId,
          details: entry.error.details,
          customData
        }
      });
    }

    // Example: Send to custom analytics endpoint
    if (import.meta.env.VITE_ERROR_TRACKING_ENDPOINT) {
      fetch(import.meta.env.VITE_ERROR_TRACKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entry,
          customData
        })
      }).catch(() => {
        // Silently fail - don't want error logging to cause more errors
      });
    }
  }

  private isCritical(error: AppError): boolean {
    // Define which error codes are critical
    const criticalCodes = ['UPSTREAM', 'NETWORK', 'UNKNOWN', 'FORBIDDEN'];
    return criticalCodes.includes(error.code) || !error.retryable;
  }

  private persistErrors(): void {
    try {
      // Only persist recent errors to avoid localStorage limits
      const recentErrors = this.errorLog.slice(0, 100);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentErrors));
    } catch (error) {
      // If localStorage is full or unavailable, silently fail
      console.warn('Failed to persist error log:', error);
    }
  }

  private loadPersistedErrors(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.errorLog = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load persisted error log:', error);
      this.errorLog = [];
    }
  }
}

// Export singleton instance
export const errorLoggingService = new ErrorLoggingService();

/**
 * Convenience function to log errors from Result<T> failures
 */
export function logResultError<T>(result: { success: false; error: AppError }, context?: {
  userId?: string;
  stackTrace?: string;
  customData?: Record<string, unknown>;
}): void {
  errorLoggingService.logError(result.error, context);
}

/**
 * Wrap async functions to automatically log errors
 */
export function withErrorLogging<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: { serviceName: string; operationName: string }
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Log the error
      const appError: AppError = {
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        retryable: false,
        context,
        timestamp: new Date().toISOString(),
        debugId: createId('dbg'),
        cause: error
      };

      errorLoggingService.logError(appError, {
        stackTrace: error instanceof Error ? error.stack : undefined
      });

      // Re-throw to maintain normal error flow
      throw error;
    }
  };
}
