// Custom Error Types - Categorized error classes for consistent handling

export class AppError extends Error {
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly timestamp: string;
    public readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        code: string = 'ERR_UNKNOWN',
        isOperational: boolean = true,
        context?: Record<string, unknown>
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        this.context = context;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Network errors (API calls, fetch failures)
export class NetworkError extends AppError {
    public readonly statusCode?: number;
    public readonly url?: string;

    constructor(message: string, statusCode?: number, url?: string) {
        super(message, 'ERR_NETWORK', true, { statusCode, url });
        this.statusCode = statusCode;
        this.url = url;
    }

    isRetryable(): boolean {
        // 5xx errors and network timeouts are retryable
        return !this.statusCode || this.statusCode >= 500;
    }
}

// Validation errors (form input, data integrity)
export class ValidationError extends AppError {
    public readonly field?: string;
    public readonly value?: unknown;

    constructor(message: string, field?: string, value?: unknown) {
        super(message, 'ERR_VALIDATION', true, { field, value });
        this.field = field;
        this.value = value;
    }
}

// Authorization errors (permissions, roles)
export class AuthError extends AppError {
    public readonly requiredRole?: string;
    public readonly currentRole?: string;

    constructor(message: string, requiredRole?: string, currentRole?: string) {
        super(message, 'ERR_AUTH', true, { requiredRole, currentRole });
        this.requiredRole = requiredRole;
        this.currentRole = currentRole;
    }
}

// Not found errors (missing entities)
export class NotFoundError extends AppError {
    public readonly entityType: string;
    public readonly entityId: string;

    constructor(entityType: string, entityId: string) {
        super(`${entityType} with ID '${entityId}' not found`, 'ERR_NOT_FOUND', true);
        this.entityType = entityType;
        this.entityId = entityId;
    }
}

// Configuration errors (missing env vars, bad config)
export class ConfigError extends AppError {
    constructor(message: string) {
        super(message, 'ERR_CONFIG', false); // Not operational = should never happen
    }
}
