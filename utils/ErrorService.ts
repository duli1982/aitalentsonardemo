// ErrorService - Centralized error handling, logging, and retry logic

import { AppError, NetworkError } from '../types/errors';

interface ErrorLog {
    id: string;
    error: AppError | Error;
    timestamp: string;
    handled: boolean;
}

interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
};

class ErrorService {
    private logs: ErrorLog[] = [];
    private subscribers: Set<(error: AppError | Error) => void> = new Set();

    // Log an error
    log(error: Error, handled: boolean = false): string {
        const logEntry: ErrorLog = {
            id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            error,
            timestamp: new Date().toISOString(),
            handled,
        };

        this.logs.push(logEntry);

        // Keep only last 100 errors
        if (this.logs.length > 100) {
            this.logs = this.logs.slice(-100);
        }

        // Console logging based on error type
        if (error instanceof AppError && error.isOperational) {
            console.warn(`[${error.code}] ${error.message}`, error.context);
        } else {
            console.error('[CRITICAL]', error);
        }

        // Notify subscribers
        this.subscribers.forEach(cb => cb(error));

        return logEntry.id;
    }

    // Subscribe to error events
    subscribe(callback: (error: AppError | Error) => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    // Get recent errors
    getRecent(count: number = 10): ErrorLog[] {
        return this.logs.slice(-count);
    }

    // Retry a function with exponential backoff
    async withRetry<T>(
        fn: () => Promise<T>,
        config: Partial<RetryConfig> = {}
    ): Promise<T> {
        const { maxAttempts, baseDelayMs, maxDelayMs, backoffMultiplier } = {
            ...DEFAULT_RETRY_CONFIG,
            ...config,
        };

        let lastError: Error | null = null;
        let delay = baseDelayMs;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;

                // Check if retryable
                if (error instanceof NetworkError && !error.isRetryable()) {
                    throw error; // Non-retryable, fail immediately
                }

                if (attempt < maxAttempts) {
                    console.log(`[Retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    delay = Math.min(delay * backoffMultiplier, maxDelayMs);
                }
            }
        }

        this.log(lastError!, false);
        throw lastError;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Helper to wrap async operations
    async safe<T>(
        fn: () => Promise<T>,
        fallback: T
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            this.log(error as Error, true);
            return fallback;
        }
    }

    // Clear all logs
    clear(): void {
        this.logs = [];
    }
}

export const errorService = new ErrorService();
