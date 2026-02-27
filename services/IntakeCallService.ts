/**
 * IntakeCallService
 * Orchestrates intake call sessions between hiring managers and recruiters.
 * Handles real-time transcription, AI summarization, and scorecard generation.
 */

import { Type } from '@google/genai';
import { aiService } from './AIService';
import { eventBus, EVENTS } from '../utils/EventBus';
import { pulseService } from './PulseService';
import { intakeCallPersistenceService } from './IntakeCallPersistenceService';
import type {
  IntakeCallSession,
  IntakeTranscriptLine,
  IntakeParticipant,
  IntakeScorecard,
  IntakeScorecardCriterion,
  Job,
} from '../types';

const STORAGE_KEY = 'intake_call_sessions_v1';

type SpeechRecognitionResultAlternative = { transcript?: string };
type SpeechRecognitionResultLike = { isFinal?: boolean; 0?: SpeechRecognitionResultAlternative };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionErrorEventLike = {
  error?: string;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

function generateUuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  // RFC4122-ish v4 fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateId(): string {
  return generateUuid();
}

class IntakeCallService {
  private activeSessions: Map<string, IntakeCallSession> = new Map();
  private recognition: SpeechRecognitionLike | null = null; // SpeechRecognition instance

  /**
   * Start a new intake call session for a job
   */
  startSession(job: Job, participants: IntakeParticipant[]): IntakeCallSession {
    const session: IntakeCallSession = {
      id: generateId(),
      jobId: job.id,
      jobTitle: job.title,
      participants,
      transcript: [],
      status: 'live',
      startedAt: new Date().toISOString(),
    };

    this.activeSessions.set(session.id, session);
    this.persistLocal(session);

    eventBus.emit(EVENTS.INTAKE_CALL_STARTED, {
      sessionId: session.id,
      jobId: job.id,
      jobTitle: job.title,
    });

    pulseService.addEvent({
      type: 'AGENT_ACTION',
      message: `Intake call started for "${job.title}" with ${participants.length} participant(s).`,
      severity: 'info',
      metadata: { sessionId: session.id, jobId: job.id },
    });

    console.log('[IntakeCallService] Session started:', session.id);
    return session;
  }

  /**
   * Add a transcript line (from manual input or speech-to-text)
   */
  addTranscriptLine(
    sessionId: string,
    speaker: string,
    speakerRole: IntakeParticipant['role'],
    text: string
  ): IntakeTranscriptLine | null {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'live') return null;

    const line: IntakeTranscriptLine = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
      speaker,
      speakerRole,
      text,
    };

    session.transcript.push(line);
    this.persistLocal(session);
    return line;
  }

  /**
   * Start browser-based speech recognition (if available)
   */
  startSpeechRecognition(
    sessionId: string,
    speakerName: string,
    speakerRole: IntakeParticipant['role']
  ): boolean {
    const withRecognition = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRecognition =
      withRecognition.SpeechRecognition || withRecognition.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[IntakeCallService] SpeechRecognition not available in this browser.');
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal) {
          const text = String(result[0]?.transcript || '').trim();
          if (text) {
            this.addTranscriptLine(sessionId, speakerName, speakerRole, text);
          }
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      console.error('[IntakeCallService] Speech recognition error:', event.error);
    };

    this.recognition.start();
    console.log('[IntakeCallService] Speech recognition started for session:', sessionId);
    return true;
  }

  /**
   * Stop speech recognition
   */
  stopSpeechRecognition(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  /**
   * End the call and trigger AI summarization + scorecard generation
   */
  async endSessionAndGenerateScorecard(sessionId: string): Promise<IntakeScorecard | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn('[IntakeCallService] Session not found:', sessionId);
      return null;
    }

    this.stopSpeechRecognition();

    session.status = 'processing';
    session.endedAt = new Date().toISOString();
    session.rawTranscript = session.transcript
      .map((l) => `[${l.speaker} (${l.speakerRole})]: ${l.text}`)
      .join('\n');
    this.persistLocal(session);

    eventBus.emit(EVENTS.INTAKE_CALL_ENDED, {
      sessionId: session.id,
      jobId: session.jobId,
    });

    pulseService.addEvent({
      type: 'AGENT_ACTION',
      message: `Intake call ended for "${session.jobTitle}". Generating scorecard...`,
      severity: 'info',
      metadata: { sessionId: session.id, jobId: session.jobId },
    });

    // Generate scorecard via AI
    const scorecard = await this.generateScorecard(session);

    if (scorecard) {
      session.status = 'draft_ready';
      this.persistLocal(session);

      // Persist to Supabase
      await intakeCallPersistenceService.upsertSession(session);
      await intakeCallPersistenceService.upsertScorecard(scorecard);

      eventBus.emit(EVENTS.INTAKE_SCORECARD_READY, {
        sessionId: session.id,
        jobId: session.jobId,
        scorecardId: scorecard.id,
      });
    }

    return scorecard;
  }

  /**
   * Approve a scorecard — this triggers the sourcing agent
   */
  async approveScorecard(
    scorecard: IntakeScorecard,
    approvedBy: string
  ): Promise<IntakeScorecard> {
    scorecard.status = 'approved';
    scorecard.approvedBy = approvedBy;
    scorecard.approvedAt = new Date().toISOString();
    scorecard.updatedAt = new Date().toISOString();

    await intakeCallPersistenceService.upsertScorecard(scorecard);

    // Mark the session as approved too (works even after reload/no in-memory session).
    const inMemory = this.activeSessions.get(scorecard.sessionId);
    const session = inMemory ?? await intakeCallPersistenceService.getSessionById(scorecard.sessionId);
    if (session) {
      session.status = 'approved';
      session.endedAt = session.endedAt ?? new Date().toISOString();
      this.activeSessions.set(session.id, session);
      this.persistLocal(session);
      await intakeCallPersistenceService.upsertSession(session);
    }

    eventBus.emit(EVENTS.INTAKE_SCORECARD_APPROVED, {
      jobId: scorecard.jobId,
      scorecardId: scorecard.id,
      mustHave: scorecard.mustHave,
      niceToHave: scorecard.niceToHave,
    });

    pulseService.addEvent({
      type: 'AGENT_ACTION',
      message: `Intake scorecard approved for job "${scorecard.jobId}". Sourcing agent can now use these criteria.`,
      severity: 'info',
      metadata: { scorecardId: scorecard.id, jobId: scorecard.jobId },
    });

    console.log('[IntakeCallService] Scorecard approved:', scorecard.id);
    return scorecard;
  }

  /**
   * Save scorecard edits without approving.
   */
  async saveScorecardDraft(scorecard: IntakeScorecard): Promise<IntakeScorecard> {
    const next: IntakeScorecard = {
      ...scorecard,
      status: scorecard.status === 'approved' ? 'approved' : 'draft',
      updatedAt: new Date().toISOString()
    };
    await intakeCallPersistenceService.upsertScorecard(next);
    return next;
  }

  /**
   * Get active session by ID
   */
  getSession(sessionId: string): IntakeCallSession | null {
    return this.activeSessions.get(sessionId) ?? null;
  }

  /**
   * Get latest scorecard for a job (from Supabase or local)
   */
  async getScorecardForJob(jobId: string): Promise<IntakeScorecard | null> {
    return intakeCallPersistenceService.getScorecardByJob(jobId);
  }

  // ─── Private ──────────────────────────────────────────

  private async generateScorecard(session: IntakeCallSession): Promise<IntakeScorecard | null> {
    if (!session.rawTranscript || session.transcript.length === 0) {
      return this.generateFallbackScorecard(session);
    }

    if (!aiService.isAvailable()) {
      console.warn('[IntakeCallService] AI not available, using fallback scorecard.');
      return this.generateFallbackScorecard(session);
    }

    const prompt = `You are an expert recruiting strategist. Analyze this intake call transcript between a hiring manager and recruiter discussing a new role.

Job Title: ${session.jobTitle || 'Unknown'}
Job ID: ${session.jobId}

TRANSCRIPT:
${session.rawTranscript.slice(0, 12000)}

Based on this conversation, extract:
1. A concise summary of what was discussed
2. Must-have criteria (non-negotiable requirements discussed)
3. Nice-to-have criteria (preferred but flexible)
4. Ideal candidate profile (narrative description)
5. Red flags / deal-breakers mentioned
6. Role context (team size, reporting structure, growth path, urgency, work model, budget)

For each criterion, include:
- The criterion text
- A weight from 1-5 (importance)
- Category: technical | experience | soft_skill | cultural | other
- A direct quote or paraphrase from the transcript as evidence

Return JSON only.`;

    try {
      const scorecardSchema = {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          mustHave: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                criterion: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                category: { type: Type.STRING },
                evidenceFromCall: { type: Type.STRING },
              },
              required: ['criterion', 'weight', 'category', 'evidenceFromCall'],
            },
          },
          niceToHave: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                criterion: { type: Type.STRING },
                weight: { type: Type.NUMBER },
                category: { type: Type.STRING },
                evidenceFromCall: { type: Type.STRING },
              },
              required: ['criterion', 'weight', 'category', 'evidenceFromCall'],
            },
          },
          idealProfile: { type: Type.STRING },
          redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
          roleContext: {
            type: Type.OBJECT,
            properties: {
              teamSize: { type: Type.STRING },
              reportingTo: { type: Type.STRING },
              growthPath: { type: Type.STRING },
              urgency: { type: Type.STRING },
              budgetRange: { type: Type.STRING },
              workModel: { type: Type.STRING },
            },
          },
        },
        required: ['summary', 'mustHave', 'niceToHave', 'idealProfile', 'redFlags', 'roleContext'],
      };

      const result = await aiService.generateText(prompt, {
        schema: scorecardSchema,
      });

      if (!result.success) {
        console.error('[IntakeCallService] AI generation failed:', result.error);
        return this.generateFallbackScorecard(session);
      }

      const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      const now = new Date().toISOString();

      return {
        id: generateId(),
        sessionId: session.id,
        jobId: session.jobId,
        summary: data.summary || '',
        mustHave: this.normalizeCriteria(data.mustHave),
        niceToHave: this.normalizeCriteria(data.niceToHave),
        idealProfile: data.idealProfile || '',
        redFlags: Array.isArray(data.redFlags) ? data.redFlags : [],
        roleContext: data.roleContext || {},
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
    } catch (err) {
      console.error('[IntakeCallService] Scorecard generation error:', err);
      return this.generateFallbackScorecard(session);
    }
  }

  private normalizeCriteria(raw: unknown[]): IntakeScorecardCriterion[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
        criterion: String(row.criterion || '').trim(),
        weight: Math.max(1, Math.min(5, Number(row.weight) || 3)),
        category: (['technical', 'experience', 'soft_skill', 'cultural', 'other'].includes(String(row.category))
          ? String(row.category)
          : 'other') as IntakeScorecardCriterion['category'],
        evidenceFromCall: String(row.evidenceFromCall || '').trim(),
      }; })
      .filter((c) => c.criterion.length > 0);
  }

  private generateFallbackScorecard(session: IntakeCallSession): IntakeScorecard {
    const now = new Date().toISOString();
    // Extract basic info from transcript text via simple heuristics
    const allText = session.transcript.map((l) => l.text).join(' ');
    const words = allText.split(/\s+/);

    return {
      id: generateId(),
      sessionId: session.id,
      jobId: session.jobId,
      summary: `Intake call with ${session.participants.length} participant(s) for ${session.jobTitle || 'this role'}. ${session.transcript.length} transcript lines captured. Please review and edit the criteria below.`,
      mustHave: [
        {
          criterion: 'Review transcript and add must-have criteria',
          weight: 5,
          category: 'other',
          evidenceFromCall: 'Criteria need manual extraction — AI was unavailable.',
        },
      ],
      niceToHave: [
        {
          criterion: 'Review transcript and add nice-to-have criteria',
          weight: 3,
          category: 'other',
          evidenceFromCall: 'Criteria need manual extraction — AI was unavailable.',
        },
      ],
      idealProfile: 'Please describe the ideal candidate based on the intake call discussion.',
      redFlags: [],
      roleContext: {},
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
  }

  private persistLocal(session: IntakeCallSession): void {
    try {
      const all = this.loadLocalSessions();
      all[session.id] = session;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // ignore
    }
  }

  private loadLocalSessions(): Record<string, IntakeCallSession> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

export const intakeCallService = new IntakeCallService();
