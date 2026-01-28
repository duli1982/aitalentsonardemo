import { vi } from 'vitest';

// Mock EventBus for testing
export const createMockEventBus = () => {
    const listeners = new Map<string, Set<Function>>();

    return {
        on: vi.fn((event: string, handler: Function) => {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event)!.add(handler);

            return () => {
                listeners.get(event)?.delete(handler);
            };
        }),

        emit: vi.fn((event: string, payload?: any) => {
            const handlers = listeners.get(event);
            if (handlers) {
                handlers.forEach(handler => handler(payload));
            }
        }),

        off: vi.fn((event: string, handler?: Function) => {
            if (handler) {
                listeners.get(event)?.delete(handler);
            } else {
                listeners.delete(event);
            }
        }),

        // Test utilities
        getListenerCount: (event: string) => listeners.get(event)?.size || 0,
        clear: () => listeners.clear(),
        getAllEvents: () => Array.from(listeners.keys())
    };
};

// Common event types for testing
export const MOCK_EVENTS = {
    CANDIDATE_STAGED: 'candidate:staged',
    CANDIDATE_UPDATED: 'candidate:updated',
    BACKGROUND_JOBS_CHANGED: 'background:jobs:changed',
    BACKGROUND_JOB_RESULT: 'background:job:result'
};

export default createMockEventBus;
