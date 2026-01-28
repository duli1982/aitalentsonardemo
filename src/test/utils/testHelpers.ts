import type { Candidate, Job } from '../../types';

// Test data factories
export const createMockCandidate = (overrides?: Partial<Candidate>): Candidate => ({
    id: 'test_cand_1',
    name: 'Test Candidate',
    email: 'test@example.com',
    type: 'uploaded',
    role: 'Software Engineer',
    skills: ['React', 'TypeScript'],
    experienceYears: 5,
    location: 'San Francisco',
    availability: 'Immediate',
    source: 'direct',
    ...overrides
});

export const createMockJob = (overrides?: Partial<Job>): Job => ({
    id: 'test_job_1',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'San Francisco',
    seniority: 'Senior',
    requiredSkills: ['React', 'TypeScript', 'Node.js'],
    description: 'We are looking for a senior frontend engineer...',
    status: 'open',
    experienceRequired: 5,
    candidateIds: [],
    ...overrides
});

// Wait utility for async tests
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Flush all promises
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Mock LocalStorage
export const createMockLocalStorage = () => {
    const store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            Object.keys(store).forEach(key => delete store[key]);
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index: number) => Object.keys(store)[index] || null
    };
};

// Setup global mocks
export const setupGlobalMocks = () => {
    // Mock window if not available
    if (typeof window === 'undefined') {
        (global as any).window = {};
    }

    // Mock localStorage
    const mockStorage = createMockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true
    });

    // Mock setImmediate if not available
    if (typeof setImmediate === 'undefined') {
        (global as any).setImmediate = (fn: Function) => setTimeout(fn, 0);
    }
};

// Reset mocks
export const resetMocks = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
    }
};

export default {
    createMockCandidate,
    createMockJob,
    waitFor,
    flushPromises,
    createMockLocalStorage,
    setupGlobalMocks,
    resetMocks
};
