/**
 * Background Job Service
 * Manages autonomous agents that run independently in the background
 * These agents work proactively without user interaction
 */

export type JobStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface BackgroundJob {
    id: string;
    name: string;
    type: 'SOURCING' | 'SCREENING' | 'SCHEDULING' | 'MONITORING';
    status: JobStatus;
    interval: number; // milliseconds
    lastRun?: Date;
    nextRun?: Date;
    enabled: boolean;
    handler: () => Promise<void>;
}

export interface JobResult {
    jobId: string;
    success: boolean;
    message: string;
    data?: any;
    timestamp: Date;
}

class BackgroundJobService {
    private jobs: Map<string, BackgroundJob> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private results: JobResult[] = [];
    private maxResults = 100;

    /**
     * Register a new background job
     */
    registerJob(job: Omit<BackgroundJob, 'id'>): string {
        const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const fullJob: BackgroundJob = {
            ...job,
            id,
            status: 'idle',
            lastRun: undefined,
            nextRun: job.enabled ? new Date(Date.now() + job.interval) : undefined
        };

        this.jobs.set(id, fullJob);

        if (job.enabled) {
            this.scheduleJob(id);
        }

        console.log(`[BackgroundJobService] Registered job: ${job.name} (${id})`);
        return id;
    }

    /**
     * Schedule a job to run at intervals
     */
    private scheduleJob(jobId: string) {
        const job = this.jobs.get(jobId);
        if (!job || !job.enabled) return;

        // Clear existing timer
        const existingTimer = this.timers.get(jobId);
        if (existingTimer) {
            clearInterval(existingTimer);
        }

        // Create new interval timer
        const timer = setInterval(async () => {
            await this.runJob(jobId);
        }, job.interval);

        this.timers.set(jobId, timer);

        // Also run immediately on first schedule
        this.runJob(jobId);
    }

    /**
     * Execute a job
     */
    async runJob(jobId: string): Promise<JobResult> {
        const job = this.jobs.get(jobId);

        if (!job) {
            const error: JobResult = {
                jobId,
                success: false,
                message: 'Job not found',
                timestamp: new Date()
            };
            this.addResult(error);
            return error;
        }

        if (job.status === 'running') {
            console.log(`[BackgroundJobService] Job ${job.name} already running, skipping`);
            return {
                jobId,
                success: false,
                message: 'Job already running',
                timestamp: new Date()
            };
        }

        // Update job status
        job.status = 'running';
        job.lastRun = new Date();
        job.nextRun = new Date(Date.now() + job.interval);
        this.jobs.set(jobId, job);

        console.log(`[BackgroundJobService] Running job: ${job.name}`);

        try {
            await job.handler();

            job.status = 'completed';
            this.jobs.set(jobId, job);

            const result: JobResult = {
                jobId,
                success: true,
                message: `${job.name} completed successfully`,
                timestamp: new Date()
            };

            this.addResult(result);
            return result;

        } catch (error) {
            job.status = 'failed';
            this.jobs.set(jobId, job);

            const result: JobResult = {
                jobId,
                success: false,
                message: `${job.name} failed: ${String(error)}`,
                timestamp: new Date()
            };

            this.addResult(result);
            console.error(`[BackgroundJobService] Job failed:`, error);
            return result;
        }
    }

    /**
     * Enable/disable a job
     */
    setJobEnabled(jobId: string, enabled: boolean) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.enabled = enabled;
        this.jobs.set(jobId, job);

        if (enabled) {
            this.scheduleJob(jobId);
        } else {
            const timer = this.timers.get(jobId);
            if (timer) {
                clearInterval(timer);
                this.timers.delete(jobId);
            }
            job.nextRun = undefined;
            this.jobs.set(jobId, job);
        }

        console.log(`[BackgroundJobService] Job ${job.name} ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get all registered jobs
     */
    getAllJobs(): BackgroundJob[] {
        return Array.from(this.jobs.values());
    }

    /**
     * Get job by ID
     */
    getJob(jobId: string): BackgroundJob | undefined {
        return this.jobs.get(jobId);
    }

    /**
     * Get recent job results
     */
    getResults(limit = 20): JobResult[] {
        return this.results.slice(0, limit);
    }

    /**
     * Get results for specific job
     */
    getJobResults(jobId: string, limit = 10): JobResult[] {
        return this.results
            .filter(r => r.jobId === jobId)
            .slice(0, limit);
    }

    /**
     * Store job result (with max limit)
     */
    private addResult(result: JobResult) {
        this.results.unshift(result);
        if (this.results.length > this.maxResults) {
            this.results = this.results.slice(0, this.maxResults);
        }
    }

    /**
     * Cleanup - stop all jobs
     */
    shutdown() {
        console.log('[BackgroundJobService] Shutting down all jobs');

        this.timers.forEach((timer, jobId) => {
            clearInterval(timer);
            console.log(`[BackgroundJobService] Stopped job: ${jobId}`);
        });

        this.timers.clear();
    }
}

export const backgroundJobService = new BackgroundJobService();
