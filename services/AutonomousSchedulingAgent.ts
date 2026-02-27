/**
 * Autonomous Scheduling Agent
 * Automatically negotiates interview times with candidates
 * Sends emails, parses responses, books calendar slots
 */

import { backgroundJobService } from './BackgroundJobService';
import { pulseService } from './PulseService';
import { eventBus, EVENTS } from '../utils/EventBus';
import { pipelineEventService } from './PipelineEventService';
import { processingMarkerService } from './ProcessingMarkerService';
import { schedulingPersistenceService } from './SchedulingPersistenceService';
import type { AgentMode } from './AgentSettingsService';
import { proposedActionService } from './ProposedActionService';
import { TIMING } from '../config/timing';

export interface SchedulingRequest {
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    jobId: string;
    jobTitle: string;
    interviewType: 'phone' | 'video' | 'onsite';
    requestedAt: Date;
}

export type MeetingProvider = 'google_meet' | 'ms_teams';

export interface RescheduleRequest {
    interviewId: string;
    requestedBy: 'candidate' | 'hiring_manager';
    reason?: string;
    requestedAt: Date;
}

export interface RescheduleHistoryEntry {
    previousTime: Date;
    newTime: Date;
    requestedBy: 'candidate' | 'hiring_manager';
    reason?: string;
    requestedAt: Date;
    processedAt: Date;
}

export interface ScheduledInterview {
    id: string;
    candidateId: string;
    candidateName: string;
    jobId: string;
    jobTitle: string;
    interviewType: 'phone' | 'video' | 'onsite';
    scheduledTime: Date;
    meetingProvider: MeetingProvider;
    meetingLink: string;
    status: 'pending' | 'confirmed' | 'declined' | 'rescheduled';
    confirmationSentAt?: Date;
    rescheduleHistory?: RescheduleHistoryEntry[];
}

class AutonomousSchedulingAgent {
    private jobId: string | null = null;
    private schedulingQueue: SchedulingRequest[] = [];
    private rescheduleQueue: RescheduleRequest[] = [];
    private scheduledInterviews: ScheduledInterview[] = [];
    private isInitialized = false;
    private mode: AgentMode = 'recommend';
    private meetingProvider: MeetingProvider = 'google_meet';
    private readonly storageKey = 'autonomous_scheduling_interviews_v1';

    private loadPersistedInterviews() {
        if (typeof window === 'undefined') return;

        try {
            const raw = window.localStorage.getItem(this.storageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as Array<
                Omit<ScheduledInterview, 'scheduledTime' | 'confirmationSentAt' | 'rescheduleHistory'> & {
                    scheduledTime: string;
                    confirmationSentAt?: string;
                    rescheduleHistory?: Array<Omit<RescheduleHistoryEntry, 'previousTime' | 'newTime' | 'requestedAt' | 'processedAt'> & {
                        previousTime: string;
                        newTime: string;
                        requestedAt: string;
                        processedAt: string;
                    }>;
                }
            >;

            this.scheduledInterviews = (parsed || [])
                .map((i) => ({
                    ...i,
                    scheduledTime: new Date(i.scheduledTime),
                    confirmationSentAt: i.confirmationSentAt ? new Date(i.confirmationSentAt) : undefined,
                    rescheduleHistory: i.rescheduleHistory?.map((h) => ({
                        ...h,
                        previousTime: new Date(h.previousTime),
                        newTime: new Date(h.newTime),
                        requestedAt: new Date(h.requestedAt),
                        processedAt: new Date(h.processedAt)
                    }))
                }))
                .filter((i) => i.id && i.candidateId && i.jobId);
        } catch (e) {
            console.warn('[AutonomousSchedulingAgent] Failed to load persisted interviews:', e);
        }
    }

    private persistInterviews() {
        if (typeof window === 'undefined') return;

        try {
            window.localStorage.setItem(
                this.storageKey,
                JSON.stringify(
                    this.scheduledInterviews.map((i) => ({
                        ...i,
                        scheduledTime: new Date(i.scheduledTime).toISOString(),
                        confirmationSentAt: i.confirmationSentAt ? new Date(i.confirmationSentAt).toISOString() : undefined,
                        rescheduleHistory: i.rescheduleHistory?.map((h) => ({
                            ...h,
                            previousTime: new Date(h.previousTime).toISOString(),
                            newTime: new Date(h.newTime).toISOString(),
                            requestedAt: new Date(h.requestedAt).toISOString(),
                            processedAt: new Date(h.processedAt).toISOString()
                        }))
                    }))
                )
            );
        } catch (e) {
            console.warn('[AutonomousSchedulingAgent] Failed to persist interviews:', e);
        }
    }

    /**
     * Initialize the scheduling agent
     * Runs every 2 hours to process scheduling requests
     */
    initialize(options?: { enabled?: boolean; mode?: AgentMode }) {
        if (this.isInitialized) {
            console.log('[AutonomousSchedulingAgent] Already initialized');
            return;
        }

        console.log('[AutonomousSchedulingAgent] Initializing autonomous scheduling...');
        this.loadPersistedInterviews();
        this.mode = options?.mode ?? 'recommend';

        this.jobId = backgroundJobService.registerJob({
            name: 'Autonomous Interview Scheduling',
            type: 'SCHEDULING',
            interval: 2 * 60 * 60 * 1000, // 2 hours
            enabled: options?.enabled ?? false,
            handler: async () => {
                await this.processSchedulingQueue();
            }
        });

        this.isInitialized = true;
        console.log('[AutonomousSchedulingAgent] ✓ Initialized successfully');
    }

    /**
     * Add a candidate to the scheduling queue
     */
    requestScheduling(request: SchedulingRequest) {
        const alreadyQueued = this.schedulingQueue.some(
            (q) =>
                q.candidateId === request.candidateId &&
                q.jobId === request.jobId &&
                q.interviewType === request.interviewType
        );

        if (!alreadyQueued) {
            this.schedulingQueue.push(request);
        }

        pulseService.addEvent({
            type: 'AGENT_ACTION',
            message: `🗓️ Scheduling Agent will contact ${request.candidateName} to book a ${request.interviewType} interview for ${request.jobTitle}`,
            severity: 'info',
            metadata: {
                candidateId: request.candidateId,
                jobId: request.jobId,
                agentType: 'SCHEDULING'
            }
        });

        void pipelineEventService.logEvent({
            candidateId: request.candidateId,
            candidateName: request.candidateName,
            jobId: request.jobId,
            jobTitle: request.jobTitle,
            eventType: 'SCHEDULING_REQUESTED',
            actorType: 'agent',
            actorId: 'scheduling_agent',
            toStage: 'scheduling',
            summary: `Scheduling requested for ${request.candidateName} (${request.jobTitle}).`,
            metadata: { interviewType: request.interviewType }
        });

        eventBus.emit(EVENTS.CANDIDATE_STAGED, {
            candidateId: request.candidateId,
            candidateName: request.candidateName,
            jobId: request.jobId,
            stage: 'scheduling'
        });

        console.log(`[AutonomousSchedulingAgent] Added ${request.candidateName} to scheduling queue`);
    }

    /**
     * Request a reschedule for an existing interview.
     */
    requestReschedule(request: RescheduleRequest) {
        this.rescheduleQueue.push(request);

        const who = request.requestedBy === 'hiring_manager' ? 'Hiring Manager' : 'Candidate';
        const interview = this.scheduledInterviews.find((i) => i.id === request.interviewId);

        void pipelineEventService.logEvent({
            candidateId: interview?.candidateId ?? 'unknown',
            candidateName: interview?.candidateName,
            jobId: interview?.jobId ?? 'unknown',
            jobTitle: interview?.jobTitle,
            eventType: 'RESCHEDULE_REQUESTED',
            actorType: 'agent',
            actorId: 'scheduling_agent',
            toStage: 'scheduling',
            summary: `Reschedule requested (${who}) for interview ${request.interviewId}.`,
            metadata: { interviewId: request.interviewId, requestedBy: request.requestedBy, reason: request.reason }
        });

        pulseService.addEvent({
            type: 'AGENT_ACTION',
            message: `📅 Scheduling Agent received a reschedule request (${who}). It will propose new slots shortly.`,
            severity: 'info',
            metadata: {
                interviewId: request.interviewId,
                requestedBy: request.requestedBy,
                reason: request.reason,
                agentType: 'SCHEDULING'
            }
        });
    }

    /**
     * Process all pending scheduling requests
     */
    private async processSchedulingQueue() {
        if (this.rescheduleQueue.length === 0 && this.schedulingQueue.length === 0) {
            console.log('[AutonomousSchedulingAgent] No pending scheduling work');
            return;
        }

        if (this.rescheduleQueue.length > 0) {
            console.log(`[AutonomousSchedulingAgent] Processing ${this.rescheduleQueue.length} reschedule requests...`);
            await this.processRescheduleQueue();
        }

        if (this.schedulingQueue.length === 0) return;

        console.log(`[AutonomousSchedulingAgent] Processing ${this.schedulingQueue.length} scheduling requests...`);

        for (const request of this.schedulingQueue) {
            try {
                const interviewId = `interview_${request.jobId}_${request.candidateId}_${request.interviewType}`;
                const step = `scheduling:confirm:${interviewId}:v1`;
                const shouldRun = await processingMarkerService.beginStep({
                    candidateId: request.candidateId,
                    jobId: request.jobId,
                    step,
                    ttlMs: 1000 * 60 * 10,
                    metadata: { interviewId }
                });
                if (!shouldRun) continue;

                // Simulate email sending
                await this.sendSchedulingEmail(request);

                // Simulate parsing calendar availability (in real app: check Google Calendar API)
                const proposedSlots = this.generateTimeSlots();
                const meetingLink = this.generateMeetingLink(this.meetingProvider);
                const draftInterview: ScheduledInterview = {
                    id: interviewId,
                    candidateId: request.candidateId,
                    candidateName: request.candidateName,
                    jobId: request.jobId,
                    jobTitle: request.jobTitle,
                    interviewType: request.interviewType,
                    scheduledTime: proposedSlots[0],
                    meetingProvider: this.meetingProvider,
                    meetingLink,
                    status: 'pending'
                };

                void schedulingPersistenceService.upsertInterview({
                    interview: draftInterview,
                    status: 'proposed',
                    requestedAt: request.requestedAt,
                    proposedSlots,
                    metadata: { source: 'autonomous_scheduling_agent' }
                });

                void pipelineEventService.logEvent({
                    candidateId: request.candidateId,
                    candidateName: request.candidateName,
                    jobId: request.jobId,
                    jobTitle: request.jobTitle,
                    eventType: 'SCHEDULING_PROPOSED',
                    actorType: 'agent',
                    actorId: 'scheduling_agent',
                    toStage: 'scheduling',
                    summary: `Proposed ${proposedSlots.length} interview slots for ${request.candidateName}.`,
                    metadata: { interviewId, proposedSlots: proposedSlots.map((d) => d.toISOString()) }
                });

                // Simulate candidate response (in real app: parse email replies)
                const selectedSlot = await this.simulateCandidateResponse(proposedSlots);

                // Create scheduled interview
                // meetingLink is computed above
                const interview: ScheduledInterview = {
                    id: interviewId,
                    candidateId: request.candidateId,
                    candidateName: request.candidateName,
                    jobId: request.jobId,
                    jobTitle: request.jobTitle,
                    interviewType: request.interviewType,
                    scheduledTime: selectedSlot,
                    meetingProvider: this.meetingProvider,
                    meetingLink,
                    status: 'confirmed',
                    confirmationSentAt: new Date()
                };

                this.scheduledInterviews.push(interview);
                this.persistInterviews();

                // Send confirmation
                await this.sendConfirmation(interview);

                void schedulingPersistenceService.upsertInterview({
                    interview,
                    status: 'confirmed',
                    requestedAt: request.requestedAt,
                    proposedSlots,
                    metadata: { source: 'autonomous_scheduling_agent' }
                });

                void pipelineEventService.logEvent({
                    candidateId: interview.candidateId,
                    candidateName: interview.candidateName,
                    jobId: interview.jobId,
                    jobTitle: interview.jobTitle,
                    eventType: 'RESCHEDULE_CONFIRMED',
                    actorType: 'agent',
                    actorId: 'scheduling_agent',
                    fromStage: 'scheduling',
                    toStage: 'interview',
                    summary: `Interview rescheduled for ${interview.candidateName} at ${selectedSlot.toISOString()}.`,
                    metadata: {
                        interviewId: interview.id,
                        previousTime: selectedSlot.toISOString(),
                        newTime: selectedSlot.toISOString(),
                        requestedBy: 'candidate'
                    }
                });

                if (this.mode === 'auto_write') {
                    eventBus.emit(EVENTS.CANDIDATE_STAGED, {
                        candidateId: interview.candidateId,
                        candidateName: interview.candidateName,
                        jobId: interview.jobId,
                        stage: 'interview'
                    });
                } else {
                    proposedActionService.add({
                        agentType: 'SCHEDULING',
                        title: 'Move Stage',
                        description: `${interview.candidateName} for "${interview.jobTitle}" • Interview rescheduled and ready to move to Interview stage.`,
                        candidateId: interview.candidateId,
                        jobId: interview.jobId,
                        payload: {
                            type: 'MOVE_CANDIDATE_TO_STAGE',
                            candidate: {
                                id: interview.candidateId,
                                name: interview.candidateName,
                                role: 'Candidate',
                                type: 'uploaded',
                                skills: [],
                                experience: 0,
                                location: '',
                                availability: ''
                            } as any,
                            jobId: interview.jobId,
                            stage: 'interview'
                        }
                    });

                    pulseService.addEvent({
                        type: 'AGENT_ACTION',
                        severity: 'info',
                        message: `Proposal created: Move ${interview.candidateName} → Interview stage after reschedule confirmation.`,
                        metadata: { agentType: 'SCHEDULING', candidateId: interview.candidateId, jobId: interview.jobId, actionLink: '/agent-inbox' }
                    });
                }

                void processingMarkerService.completeStep({
                    candidateId: interview.candidateId,
                    jobId: interview.jobId,
                    step,
                    metadata: { interviewId: interview.id }
                });

                void schedulingPersistenceService.upsertInterview({
                    interview,
                    status: 'confirmed',
                    requestedAt: request.requestedAt,
                    proposedSlots,
                    metadata: { source: 'autonomous_scheduling_agent' }
                });

                void pipelineEventService.logEvent({
                    candidateId: request.candidateId,
                    candidateName: request.candidateName,
                    jobId: request.jobId,
                    jobTitle: request.jobTitle,
                    eventType: 'SCHEDULING_CONFIRMED',
                    actorType: 'agent',
                    actorId: 'scheduling_agent',
                    fromStage: 'scheduling',
                    toStage: 'interview',
                    summary: `Interview scheduled for ${request.candidateName} at ${selectedSlot.toISOString()}.`,
                    metadata: { interviewId, scheduledTime: selectedSlot.toISOString(), meetingProvider: this.meetingProvider, meetingLink }
                });

                if (this.mode === 'auto_write') {
                    eventBus.emit(EVENTS.CANDIDATE_STAGED, {
                        candidateId: request.candidateId,
                        candidateName: request.candidateName,
                        jobId: request.jobId,
                        stage: 'interview'
                    });
                } else {
                    proposedActionService.add({
                        agentType: 'SCHEDULING',
                        title: 'Move Stage',
                        description: `${request.candidateName} for "${request.jobTitle}" • Interview scheduled and ready to move to Interview stage.`,
                        candidateId: request.candidateId,
                        jobId: request.jobId,
                        payload: {
                            type: 'MOVE_CANDIDATE_TO_STAGE',
                            candidate: {
                                id: request.candidateId,
                                name: request.candidateName,
                                email: request.candidateEmail,
                                role: 'Candidate',
                                type: 'uploaded',
                                skills: [],
                                experience: 0,
                                location: '',
                                availability: ''
                            } as any,
                            jobId: request.jobId,
                            stage: 'interview'
                        }
                    });

                    pulseService.addEvent({
                        type: 'AGENT_ACTION',
                        severity: 'info',
                        message: `Proposal created: Move ${request.candidateName} → Interview stage after scheduling confirmation.`,
                        metadata: { agentType: 'SCHEDULING', candidateId: request.candidateId, jobId: request.jobId, actionLink: '/agent-inbox' }
                    });
                }

                void processingMarkerService.completeStep({
                    candidateId: request.candidateId,
                    jobId: request.jobId,
                    step,
                    metadata: { interviewId }
                });

                // Notify via Pulse Feed
                pulseService.addEvent({
                    type: 'AGENT_ACTION',
                    message: `✅ Scheduled ${request.interviewType} interview with ${request.candidateName} for ${selectedSlot.toLocaleString()} (${this.meetingProvider === 'ms_teams' ? 'MS Teams' : 'Google Meet'})`,
                    severity: 'success',
                    metadata: {
                        candidateId: request.candidateId,
                        jobId: request.jobId,
                        interviewTime: selectedSlot.toISOString(),
                        meetingProvider: this.meetingProvider,
                        meetingLink,
                        agentType: 'SCHEDULING'
                    }
                });

                console.log(`[AutonomousSchedulingAgent] ✓ Scheduled interview for ${request.candidateName}`);

            } catch (error) {
                console.error(`[AutonomousSchedulingAgent] Failed to schedule ${request.candidateName}:`, error);

                pulseService.addEvent({
                    type: 'AGENT_ACTION',
                    message: `⚠️ Scheduling Agent couldn't reach ${request.candidateName}. Manual follow-up needed.`,
                    severity: 'warning',
                    metadata: {
                        candidateId: request.candidateId,
                        error: String(error),
                        agentType: 'SCHEDULING'
                    }
                });
            }
        }

        // Clear processed requests
        this.schedulingQueue = [];
        console.log('[AutonomousSchedulingAgent] ✓ Queue processing complete');
    }

    /**
     * Simulate sending scheduling email to candidate
     */
    private async processRescheduleQueue() {
        for (const request of this.rescheduleQueue) {
            const interview = this.scheduledInterviews.find((i) => i.id === request.interviewId);
            if (!interview) {
                console.warn('[AutonomousSchedulingAgent] Reschedule requested for unknown interview:', request.interviewId);
                continue;
            }

            try {
                const previousTime = new Date(interview.scheduledTime);

                const step = `scheduling:reschedule:${request.interviewId}:${new Date(request.requestedAt).toISOString()}`;
                const shouldRun = await processingMarkerService.beginStep({
                    candidateId: interview.candidateId,
                    jobId: interview.jobId,
                    step,
                    ttlMs: 1000 * 60 * 10,
                    metadata: { interviewId: request.interviewId }
                });
                if (!shouldRun) continue;

                if (this.mode === 'auto_write') {
                    eventBus.emit(EVENTS.CANDIDATE_STAGED, {
                        candidateId: interview.candidateId,
                        candidateName: interview.candidateName,
                        jobId: interview.jobId,
                        stage: 'scheduling'
                    });
                } else {
                    proposedActionService.add({
                        agentType: 'SCHEDULING',
                        title: 'Move Stage',
                        description: `${interview.candidateName} for "${interview.jobTitle}" • Reschedule requested; propose moving back to Scheduling stage.`,
                        candidateId: interview.candidateId,
                        jobId: interview.jobId,
                        payload: {
                            type: 'MOVE_CANDIDATE_TO_STAGE',
                            candidate: {
                                id: interview.candidateId,
                                name: interview.candidateName,
                                role: 'Candidate',
                                type: 'uploaded',
                                skills: [],
                                experience: 0,
                                location: '',
                                availability: ''
                            } as any,
                            jobId: interview.jobId,
                            stage: 'scheduling'
                        }
                    });

                    pulseService.addEvent({
                        type: 'AGENT_ACTION',
                        severity: 'info',
                        message: `Proposal created: Move ${interview.candidateName} → Scheduling stage for reschedule.`,
                        metadata: { agentType: 'SCHEDULING', candidateId: interview.candidateId, jobId: interview.jobId, actionLink: '/agent-inbox' }
                    });
                }

                void schedulingPersistenceService.upsertInterview({
                    interview,
                    status: 'rescheduled',
                    requestedAt: request.requestedAt,
                    proposedSlots: [],
                    metadata: { requestedBy: request.requestedBy, reason: request.reason }
                });

                const proposed = this.generateRescheduleTimeSlots(previousTime);
                const selectedSlot = await this.simulateCandidateResponse(proposed);

                const historyEntry: RescheduleHistoryEntry = {
                    previousTime,
                    newTime: selectedSlot,
                    requestedBy: request.requestedBy,
                    reason: request.reason,
                    requestedAt: request.requestedAt,
                    processedAt: new Date()
                };

                interview.scheduledTime = selectedSlot;
                interview.status = 'confirmed';
                interview.rescheduleHistory = [...(interview.rescheduleHistory || []), historyEntry];
                interview.confirmationSentAt = new Date();

                this.persistInterviews();
                await this.sendConfirmation(interview);

                pulseService.addEvent({
                    type: 'AGENT_ACTION',
                    message: `✅ Rescheduled interview with ${interview.candidateName} to ${selectedSlot.toLocaleString()} (${interview.meetingProvider === 'ms_teams' ? 'MS Teams' : 'Google Meet'})`,
                    severity: 'success',
                    metadata: {
                        interviewId: interview.id,
                        candidateId: interview.candidateId,
                        jobId: interview.jobId,
                        previousTime: previousTime.toISOString(),
                        newTime: selectedSlot.toISOString(),
                        requestedBy: request.requestedBy,
                        agentType: 'SCHEDULING'
                    }
                });
            } catch (error) {
                console.error('[AutonomousSchedulingAgent] Failed to reschedule interview:', error);
            }
        }

        this.rescheduleQueue = [];
    }

    private async sendSchedulingEmail(request: SchedulingRequest): Promise<void> {
        console.log(`[AutonomousSchedulingAgent] 📧 Sending email to ${request.candidateEmail}...`);

        // In real implementation:
        // - Use SendGrid/AWS SES/Gmail API
        // - Include calendar link (Calendly/Cal.com)
        // - Track email opens/clicks

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, TIMING.SCHEDULING_EMAIL_NETWORK_DELAY_MS));
    }

    /**
     * Generate available time slots (in real app: query Google Calendar)
     */
    private generateTimeSlots(): Date[] {
        const slots: Date[] = [];
        const now = new Date();

        // Generate 3 slots over next week
        for (let i = 1; i <= 3; i++) {
            const slot = new Date(now);
            slot.setDate(now.getDate() + i * 2);
            slot.setHours(10 + i, 0, 0, 0);
            slots.push(slot);
        }

        return slots;
    }

    private generateRescheduleTimeSlots(previousTime: Date): Date[] {
        return this.generateTimeSlots().filter((slot) => slot.getTime() !== previousTime.getTime());
    }

    /**
     * Simulate candidate selecting a time slot
     */
    private async simulateCandidateResponse(slots: Date[]): Promise<Date> {
        // Simulate 2-day response time
        await new Promise(resolve => setTimeout(resolve, TIMING.SCHEDULING_CANDIDATE_RESPONSE_DELAY_MS));

        // 80% accept first slot, 20% second slot
        return Math.random() < 0.8 ? slots[0] : slots[1];
    }

    /**
     * Send interview confirmation
     */
    private async sendConfirmation(interview: ScheduledInterview): Promise<void> {
        console.log(`[AutonomousSchedulingAgent] ✉️ Sending confirmation to ${interview.candidateName}...`);

        // In real implementation:
        // - Send calendar invite (.ics file)
        // - Include Google Meet / MS Teams link
        // - CC hiring manager
        // - Add to company calendar

        await new Promise(resolve => setTimeout(resolve, TIMING.SCHEDULING_CONFIRMATION_DELAY_MS));
    }

    private generateMeetingLink(provider: MeetingProvider): string {
        if (provider === 'ms_teams') {
            // Real Teams meeting links require Microsoft Graph / organizer context.
            // Use a stable placeholder URL that the organizer can replace with a real meeting invite link.
            return `https://teams.microsoft.com/l/meetup-join/placeholder-${Date.now()}`;
        }

        // "new" creates a meeting for signed-in users; works as a shortcut in most orgs.
        return 'https://meet.google.com/new';
    }

    /**
     * Get all scheduled interviews
     */
    getScheduledInterviews(): ScheduledInterview[] {
        return this.scheduledInterviews;
    }

    /**
     * Get upcoming interviews (next 7 days)
     */
    getUpcomingInterviews(): ScheduledInterview[] {
        const now = new Date();
        const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return this.scheduledInterviews.filter(interview => {
            const time = new Date(interview.scheduledTime);
            return time >= now && time <= oneWeekLater && interview.status === 'confirmed';
        });
    }

    /**
     * Get queue size
     */
    getQueueSize(): number {
        return this.schedulingQueue.length;
    }

    /**
     * Get agent status
     */
    getStatus() {
        if (!this.jobId) {
            return {
                initialized: false,
                enabled: false,
                queueSize: 0,
                scheduledCount: 0,
                upcomingCount: 0,
                meetingProvider: this.meetingProvider
            };
        }

        const job = backgroundJobService.getJob(this.jobId);

        return {
            initialized: this.isInitialized,
            enabled: job?.enabled || false,
            lastRun: job?.lastRun || null,
            nextRun: job?.nextRun || null,
            queueSize: this.schedulingQueue.length,
            rescheduleQueueSize: this.rescheduleQueue.length,
            scheduledCount: this.scheduledInterviews.length,
            upcomingCount: this.getUpcomingInterviews().length,
            meetingProvider: this.meetingProvider
        };
    }

    setMeetingProvider(provider: MeetingProvider) {
        this.meetingProvider = provider;
    }

    getMeetingProvider(): MeetingProvider {
        return this.meetingProvider;
    }

    /**
     * Enable/disable agent
     */
    setEnabled(enabled: boolean) {
        if (!this.jobId) {
            console.warn('[AutonomousSchedulingAgent] Not initialized yet');
            return;
        }

        backgroundJobService.setJobEnabled(this.jobId, enabled);
        console.log(`[AutonomousSchedulingAgent] Agent ${enabled ? 'enabled' : 'disabled'}`);
    }

    setMode(mode: AgentMode) {
        this.mode = mode;
    }

    /**
     * Manually trigger queue processing
     */
    async triggerProcessing() {
        if (!this.jobId) {
            throw new Error('Agent not initialized');
        }

        console.log('[AutonomousSchedulingAgent] Manual processing triggered');
        await backgroundJobService.runJob(this.jobId);
    }
}

export const autonomousSchedulingAgent = new AutonomousSchedulingAgent();

