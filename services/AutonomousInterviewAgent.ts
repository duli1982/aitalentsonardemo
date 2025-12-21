/**
 * Autonomous Interview Agent
 * Joins interview calls (Meet/Teams), transcribes in real-time, nudges when key questions are missed,
 * and generates debrief documents.
 *
 * In this demo implementation, we simulate the call "join" and support:
 * - live transcript capture (manual + optional SpeechRecognition if available)
 * - question coverage tracking
 * - debrief generation (Gemini if configured; otherwise a mock summary)
 */

import type { Candidate, Job } from '../types';
import { backgroundJobService } from './BackgroundJobService';
import { pulseService } from './PulseService';
import { aiService } from './AIService';
import type { MeetingProvider, ScheduledInterview } from './AutonomousSchedulingAgent';
import { pipelineEventService } from './PipelineEventService';
import { processingMarkerService } from './ProcessingMarkerService';
import { decisionArtifactService } from './DecisionArtifactService';
import { interviewSessionPersistenceService } from './InterviewSessionPersistenceService';

export interface InterviewTranscriptLine {
    id: string;
    timestamp: Date;
    speaker: 'interviewer' | 'candidate' | 'system';
    text: string;
}

export interface InterviewDebrief {
    summary: string;
    strengths: string[];
    concerns: string[];
    recommendedNextSteps: string[];
    suggestedFollowUps: string[];
}

export interface InterviewSession {
    id: string;
    interviewId?: string;
    candidateId: string;
    candidateName: string;
    jobId: string;
    jobTitle: string;
    meetingProvider: MeetingProvider;
    meetingLink: string;
    startedAt: Date;
    endedAt?: Date;
    questions: string[];
    transcript: InterviewTranscriptLine[];
    missingQuestions: string[];
    debrief?: InterviewDebrief;
}

class AutonomousInterviewAgent {
    private jobId: string | null = null;
    private isInitialized = false;
    private sessions: InterviewSession[] = [];

    private readonly sessionsKey = 'autonomous_interview_sessions_v1';
    private readonly maxSessions = 200;

    initialize() {
        if (this.isInitialized) {
            return;
        }

        this.loadPersistedSessions();

        this.jobId = backgroundJobService.registerJob({
            name: 'Autonomous Interview Agent',
            type: 'MONITORING',
            interval: 60 * 60 * 1000, // 1 hour
            enabled: true,
            handler: async () => {
                // In a real implementation, this would monitor calendar events and ensure the agent is ready.
                // Keep as a heartbeat.
                pulseService.addEvent({
                    type: 'AGENT_ACTION',
                    message: 'Interview Agent heartbeat: monitoring upcoming interviews and transcripts.',
                    severity: 'info',
                    metadata: { agentType: 'INTERVIEW' }
                });
            }
        });

        this.isInitialized = true;
    }

    startSession(params: {
        interview?: ScheduledInterview;
        candidate: Candidate;
        job: Job;
    }): InterviewSession {
        const meetingProvider: MeetingProvider =
            params.interview?.meetingProvider || 'google_meet';

        const meetingLink =
            params.interview?.meetingLink || (meetingProvider === 'ms_teams'
                ? `https://teams.microsoft.com/l/meetup-join/placeholder-${Date.now()}`
                : 'https://meet.google.com/new');

        const questions = this.buildBaselineQuestions(params.job, params.candidate);

        const session: InterviewSession = {
            id: `int_session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            interviewId: params.interview?.id,
            candidateId: String(params.candidate.id),
            candidateName: params.candidate.name,
            jobId: params.job.id,
            jobTitle: params.job.title,
            meetingProvider,
            meetingLink,
            startedAt: new Date(),
            questions,
            transcript: [],
            missingQuestions: questions
        };

        this.sessions.unshift(session);
        this.sessions = this.sessions.slice(0, this.maxSessions);
        this.persistSessions();
        void interviewSessionPersistenceService.upsertSession(session, { source: 'autonomous_interview_agent', status: 'started' });
        void pipelineEventService.logEvent({
            candidateId: session.candidateId,
            candidateName: session.candidateName,
            jobId: session.jobId,
            jobTitle: session.jobTitle,
            eventType: 'INTERVIEW_STARTED',
            actorType: 'agent',
            actorId: 'interview_agent',
            fromStage: 'interview',
            toStage: 'interview',
            summary: `Interview started for ${session.candidateName} (${session.jobTitle}).`,
            metadata: { sessionId: session.id, interviewId: session.interviewId ?? null, meetingProvider: session.meetingProvider }
        });

        pulseService.addEvent({
            type: 'AGENT_ACTION',
            message: `Interview Agent started session for ${session.candidateName} (${session.jobTitle}).`,
            severity: 'success',
            metadata: {
                agentType: 'INTERVIEW',
                candidateId: session.candidateId,
                jobId: session.jobId,
                sessionId: session.id
            }
        });

        return session;
    }

    addTranscriptLine(sessionId: string, line: Omit<InterviewTranscriptLine, 'id' | 'timestamp'> & { timestamp?: Date }) {
        const session = this.getSessionById(sessionId);
        if (!session) return;

        const entry: InterviewTranscriptLine = {
            id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            timestamp: line.timestamp ? new Date(line.timestamp) : new Date(),
            speaker: line.speaker,
            text: line.text
        };

        session.transcript.push(entry);
        session.missingQuestions = this.computeMissingQuestions(session.questions, session.transcript);

        this.persistSessions();
    }

    async generateQuestionSet(sessionId: string, candidate: Candidate, job: Job) {
        const session = this.getSessionById(sessionId);
        if (!session) return;

        const response = await aiService.generateInterviewQuestions(candidate.skills || [], job.title, 8);
        if (response.success && response.data && Array.isArray(response.data)) {
            session.questions = response.data;
            session.missingQuestions = this.computeMissingQuestions(session.questions, session.transcript);
            this.persistSessions();
        }
    }

    async endSession(sessionId: string): Promise<void> {
        const session = this.getSessionById(sessionId);
        if (!session) return;
        if (session.endedAt) return;

        session.endedAt = new Date();
        session.missingQuestions = this.computeMissingQuestions(session.questions, session.transcript);

        const debriefStep = `interview:debrief:${session.id}:v1`;
        const shouldGenerate = await processingMarkerService.beginStep({
            candidateId: session.candidateId,
            jobId: session.jobId,
            step: debriefStep,
            ttlMs: 1000 * 60 * 60 // 1 hour
        });

        if (shouldGenerate) {
            session.debrief = await this.generateDebrief(session);
            void processingMarkerService.completeStep({
                candidateId: session.candidateId,
                jobId: session.jobId,
                step: debriefStep,
                metadata: { sessionId: session.id }
            });
        }

        this.persistSessions();
        void interviewSessionPersistenceService.upsertSession(session, { source: 'autonomous_interview_agent', status: 'completed' });

        // Simple scoring heuristic: penalize missing questions.
        const baseScore = 85;
        const penalty = Math.min(40, (session.missingQuestions?.length || 0) * 8);
        const score = Math.max(0, Math.min(100, baseScore - penalty));
        const decision =
            score >= 85 ? 'STRONG_PASS' :
            score >= 75 ? 'PASS' :
            score >= 60 ? 'BORDERLINE' :
            'FAIL';

        void decisionArtifactService.saveInterviewDebrief({
            candidateId: session.candidateId,
            candidateName: session.candidateName,
            jobId: session.jobId,
            jobTitle: session.jobTitle,
            score,
            decision: decision as any,
            summary: session.debrief?.summary ?? `Interview completed for ${session.candidateName}.`,
            details: {
                sessionId: session.id,
                interviewId: session.interviewId ?? null,
                meetingProvider: session.meetingProvider,
                meetingLink: session.meetingLink,
                questions: session.questions ?? [],
                missingQuestions: session.missingQuestions ?? [],
                transcript: session.transcript ?? [],
                debrief: session.debrief ?? {}
            },
            externalId: session.id,
            rubricName: 'Interview Rubric',
            rubricVersion: 1,
            confidence: decision === 'PASS' || decision === 'STRONG_PASS' ? 0.75 : 0.65
        });

        void pipelineEventService.logEvent({
            candidateId: session.candidateId,
            candidateName: session.candidateName,
            jobId: session.jobId,
            jobTitle: session.jobTitle,
            eventType: 'INTERVIEW_COMPLETED',
            actorType: 'agent',
            actorId: 'interview_agent',
            fromStage: 'interview',
            toStage: 'interview',
            summary: `Interview completed for ${session.candidateName} (${session.jobTitle}) — ${decision} (${score}/100).`,
            metadata: { sessionId: session.id, interviewId: session.interviewId ?? null, decision, score }
        });

        pulseService.addEvent({
            type: 'AGENT_ACTION',
            message: `Interview Agent generated a debrief for ${session.candidateName} (${session.jobTitle}).`,
            severity: 'success',
            metadata: {
                agentType: 'INTERVIEW',
                candidateId: session.candidateId,
                jobId: session.jobId,
                sessionId: session.id
            }
        });
    }

    getSessionById(id: string): InterviewSession | undefined {
        return this.sessions.find((s) => s.id === id);
    }

    getSessions(): InterviewSession[] {
        return [...this.sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }

    getSessionsForCandidate(candidateId: string): InterviewSession[] {
        return this.getSessions().filter((s) => s.candidateId === String(candidateId));
    }

    getSessionsForJob(jobId: string): InterviewSession[] {
        return this.getSessions().filter((s) => s.jobId === jobId);
    }

    getStatus() {
        if (!this.jobId) {
            return {
                initialized: false,
                enabled: false,
                totalSessions: this.sessions.length
            };
        }

        const job = backgroundJobService.getJob(this.jobId);
        return {
            initialized: this.isInitialized,
            enabled: job?.enabled || false,
            lastRun: job?.lastRun || null,
            nextRun: job?.nextRun || null,
            totalSessions: this.sessions.length
        };
    }

    setEnabled(enabled: boolean) {
        if (!this.jobId) return;
        backgroundJobService.setJobEnabled(this.jobId, enabled);
    }

    private buildBaselineQuestions(job: Job, candidate: Candidate): string[] {
        const questions: string[] = [];

        (job.requiredSkills || []).slice(0, 4).forEach((skill) => {
            questions.push(`Tell me about your experience with ${skill}.`);
        });

        questions.push('Walk me through a recent project you’re proud of.');
        questions.push('What’s a difficult problem you solved recently, and how did you approach it?');
        questions.push('What are you looking for in your next role?');
        questions.push('Do you have any questions for us?');

        // Add candidate-skill follow-ups if job skills are sparse
        if (questions.length < 6 && (candidate.skills || []).length > 0) {
            questions.push(`How have you used ${candidate.skills[0]} in production?`);
        }

        return questions;
    }

    private computeMissingQuestions(questions: string[], transcript: InterviewTranscriptLine[]): string[] {
        const joined = transcript.map((t) => t.text).join(' ').toLowerCase();
        return questions.filter((q) => {
            const key = this.extractQuestionKey(q);
            if (!key) return false;
            return !joined.includes(key.toLowerCase());
        });
    }

    private extractQuestionKey(question: string): string {
        // Heuristic: for “experience with X”, key on X; else use 2-3 significant words.
        const match = /experience with\s+(.+?)\./i.exec(question);
        if (match?.[1]) return match[1].trim();

        const cleaned = question
            .replace(/[^\w\s]/g, '')
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length >= 4 && !['what', 'when', 'that', 'this', 'your', 'have', 'with', 'tell', 'about', 'walk', 'through'].includes(w));

        return cleaned.slice(0, 3).join(' ');
    }

    private async generateDebrief(session: InterviewSession): Promise<InterviewDebrief> {
        const transcriptText = session.transcript.map((t) => `[${t.speaker}] ${t.text}`).join('\n');

        const prompt = `You are an interview assistant. Create a concise debrief for the interview.
Job: ${session.jobTitle}
Candidate: ${session.candidateName}
Key questions asked (may be incomplete): ${session.questions.join(' | ')}
Missing questions (not covered): ${session.missingQuestions.join(' | ') || 'None'}

Transcript:
${transcriptText || '(no transcript)'}

Return JSON with:
{
  "summary": string,
  "strengths": string[],
  "concerns": string[],
  "recommendedNextSteps": string[],
  "suggestedFollowUps": string[]
}
Return ONLY valid JSON.`;

        const response = await aiService.generateJson<InterviewDebrief>(prompt);
        if (response.success && response.data) return response.data;

        return {
            summary: `Interview completed for ${session.candidateName} (${session.jobTitle}). Missing questions: ${session.missingQuestions.length}.`,
            strengths: ['(Mock) Communicates clearly', '(Mock) Relevant experience signals'],
            concerns: session.missingQuestions.length ? ['Some key topics were not covered'] : [],
            recommendedNextSteps: ['Schedule technical interview', 'Collect references'],
            suggestedFollowUps: session.missingQuestions.slice(0, 3).length ? session.missingQuestions.slice(0, 3) : ['Ask for examples of past work']
        };
    }

    private loadPersistedSessions() {
        if (typeof window === 'undefined') return;

        try {
            const raw = window.localStorage.getItem(this.sessionsKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as any[];

            this.sessions = (parsed || []).map((s) => ({
                ...s,
                startedAt: new Date(s.startedAt),
                endedAt: s.endedAt ? new Date(s.endedAt) : undefined,
                transcript: (s.transcript || []).map((t: any) => ({
                    ...t,
                    timestamp: new Date(t.timestamp)
                }))
            }));
        } catch (e) {
            console.warn('[AutonomousInterviewAgent] Failed to load sessions:', e);
        }
    }

    private persistSessions() {
        if (typeof window === 'undefined') return;

        try {
            const trimmed = this.sessions.slice(0, this.maxSessions);
            window.localStorage.setItem(
                this.sessionsKey,
                JSON.stringify(
                    trimmed.map((s) => ({
                        ...s,
                        startedAt: new Date(s.startedAt).toISOString(),
                        endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : undefined,
                        transcript: (s.transcript || []).map((t) => ({
                            ...t,
                            timestamp: new Date(t.timestamp).toISOString()
                        }))
                    }))
                )
            );
        } catch (e) {
            console.warn('[AutonomousInterviewAgent] Failed to persist sessions:', e);
        }
    }
}

export const autonomousInterviewAgent = new AutonomousInterviewAgent();
