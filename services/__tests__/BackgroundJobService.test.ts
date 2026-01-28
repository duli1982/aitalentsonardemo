import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backgroundJobService } from '../BackgroundJobService';
import { setupGlobalMocks, resetMocks, waitFor } from '../../src/test/utils/testHelpers';
import { createMockEventBus, MOCK_EVENTS } from '../../src/test/mocks/eventBusMock';

vi.mock('../../utils/EventBus', () => ({
    eventBus: createMockEventBus(),
    EVENTS: MOCK_EVENTS
}));

describe('BackgroundJobService', () => {
    beforeEach(() => {
        setupGlobalMocks();
        vi.clearAllMocks();
    });

    afterEach(() => {
        resetMocks();
    });

    describe('job registration', () => {
        it('should register a new job', () => {
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler: vi.fn()
            });

            expect(typeof jobId).toBe('string');
            expect(jobId).toContain('job_');
        });

        it('should store job configuration', () => {
            const handler = vi.fn();
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            const job = backgroundJobService.getJob(jobId);

            expect(job).toBeDefined();
            expect(job?.name).toBe('Test Job');
            expect(job?.type).toBe('SOURCING');
            expect(job?.interval).toBe(5000);
            expect(job?.enabled).toBe(true);
            expect(job?.status).toBe('idle');
        });

        it('should emit BACKGROUND_JOBS_CHANGED event on registration', () => {
            const { eventBus } = require('../../utils/EventBus');

            backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler: vi.fn()
            });

            expect(eventBus.emit).toHaveBeenCalledWith(
                MOCK_EVENTS.BACKGROUND_JOBS_CHANGED,
                expect.objectContaining({ type: 'registered' })
            );
        });
    });

    describe('job execution', () => {
        it('should execute job handler', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            await backgroundJobService.runJob(jobId);

            expect(handler).toHaveBeenCalled();
        });

        it('should update job status during execution', async () => {
            const handler = vi.fn(async () => {
                await waitFor(50);
            });

            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            const runPromise = backgroundJobService.runJob(jobId);

            // Check running status
            const jobDuringRun = backgroundJobService.getJob(jobId);
            expect(jobDuringRun?.status).toBe('running');

            await runPromise;

            // Check completed status
            const jobAfterRun = backgroundJobService.getJob(jobId);
            expect(jobAfterRun?.status).toBe('completed');
        });

        it('should handle job failures', async () => {
            const error = new Error('Job failed');
            const handler = vi.fn().mockRejectedValue(error);

            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            const result = await backgroundJobService.runJob(jobId);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeDefined();
            }

            const job = backgroundJobService.getJob(jobId);
            expect(job?.status).toBe('failed');
        });

        it('should emit events during job lifecycle', async () => {
            const { eventBus } = require('../../utils/EventBus');

            const handler = vi.fn().mockResolvedValue(undefined);
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            await backgroundJobService.runJob(jobId);

            // Should emit started event
            expect(eventBus.emit).toHaveBeenCalledWith(
                MOCK_EVENTS.BACKGROUND_JOBS_CHANGED,
                expect.objectContaining({ type: 'started' })
            );

            // Should emit completed event
            expect(eventBus.emit).toHaveBeenCalledWith(
                MOCK_EVENTS.BACKGROUND_JOBS_CHANGED,
                expect.objectContaining({ type: 'completed' })
            );

            // Should emit result event
            expect(eventBus.emit).toHaveBeenCalledWith(
                MOCK_EVENTS.BACKGROUND_JOB_RESULT,
                expect.objectContaining({ success: true })
            );
        });

        it('should update lastRun timestamp', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            const beforeRun = backgroundJobService.getJob(jobId);
            expect(beforeRun?.lastRun).toBeNull();

            await backgroundJobService.runJob(jobId);

            const afterRun = backgroundJobService.getJob(jobId);
            expect(afterRun?.lastRun).toBeInstanceOf(Date);
        });
    });

    describe('job results', () => {
        it('should store job execution results', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            await backgroundJobService.runJob(jobId);

            const results = backgroundJobService.getJobResults(jobId, 10);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should limit number of stored results', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            // Run job multiple times
            for (let i = 0; i < 5; i++) {
                await backgroundJobService.runJob(jobId);
            }

            const results = backgroundJobService.getJobResults(jobId, 3);

            expect(results.length).toBeLessThanOrEqual(3);
        });

        it('should return most recent results first', async () => {
            const handler = vi.fn().mockResolvedValue(undefined);
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            await backgroundJobService.runJob(jobId);
            await waitFor(10);
            await backgroundJobService.runJob(jobId);

            const results = backgroundJobService.getJobResults(jobId, 2);

            if (results.length >= 2) {
                const firstTimestamp = new Date(results[0].timestamp).getTime();
                const secondTimestamp = new Date(results[1].timestamp).getTime();
                expect(firstTimestamp).toBeGreaterThan(secondTimestamp);
            }
        });
    });

    describe('enable/disable jobs', () => {
        it('should enable a job', () => {
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: false,
                handler: vi.fn()
            });

            backgroundJobService.setJobEnabled(jobId, true);

            const job = backgroundJobService.getJob(jobId);
            expect(job?.enabled).toBe(true);
        });

        it('should disable a job', () => {
            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler: vi.fn()
            });

            backgroundJobService.setJobEnabled(jobId, false);

            const job = backgroundJobService.getJob(jobId);
            expect(job?.enabled).toBe(false);
        });

        it('should emit event when job is enabled/disabled', () => {
            const { eventBus } = require('../../utils/EventBus');

            const jobId = backgroundJobService.registerJob({
                name: 'Test Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: false,
                handler: vi.fn()
            });

            vi.clearAllMocks();

            backgroundJobService.setJobEnabled(jobId, true);

            expect(eventBus.emit).toHaveBeenCalledWith(
                MOCK_EVENTS.BACKGROUND_JOBS_CHANGED,
                expect.objectContaining({ type: 'enabled' })
            );
        });
    });

    describe('getAllJobs', () => {
        it('should return all registered jobs', () => {
            backgroundJobService.registerJob({
                name: 'Job 1',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler: vi.fn()
            });

            backgroundJobService.registerJob({
                name: 'Job 2',
                type: 'SCREENING',
                interval: 10000,
                enabled: false,
                handler: vi.fn()
            });

            const allJobs = backgroundJobService.getAllJobs();

            expect(Array.isArray(allJobs)).toBe(true);
            expect(allJobs.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('error handling', () => {
        it('should handle invalid job ID gracefully', async () => {
            const result = await backgroundJobService.runJob('invalid_job_id');

            expect(result.success).toBe(false);
        });

        it('should not crash on handler exceptions', async () => {
            const handler = vi.fn(() => {
                throw new Error('Handler crashed');
            });

            const jobId = backgroundJobService.registerJob({
                name: 'Crashing Job',
                type: 'SOURCING',
                interval: 5000,
                enabled: true,
                handler
            });

            const result = await backgroundJobService.runJob(jobId);

            expect(result.success).toBe(false);
            expect(backgroundJobService.getJob(jobId)?.status).toBe('failed');
        });
    });
});
