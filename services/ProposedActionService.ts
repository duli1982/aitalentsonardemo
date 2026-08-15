import type { Candidate, PipelineStage } from '../types';
import type { AssessmentResult, ValidatedSkill } from '../types/assessment';
import { eventBus, EVENTS } from '../utils/EventBus';

export type ProposedActionStatus = 'proposed' | 'applied' | 'dismissed';

export type ProposedActionType = 'MOVE_CANDIDATE_TO_STAGE' | 'UPDATE_VERIFIED_SKILLS' | 'ACTIVATE_RESUME_DRAFT';

export type ProposedAction = {
  id: string;
  createdAt: string; // ISO
  status: ProposedActionStatus;
  agentType: 'SOURCING' | 'SCREENING' | 'SCHEDULING' | 'INTERVIEW' | 'ANALYTICS' | 'USER';
  title: string;
  description: string;
  candidateId?: string;
  jobId?: string;
  payload:
    | {
        type: 'MOVE_CANDIDATE_TO_STAGE';
        candidate: Candidate;
        jobId: string;
        stage: PipelineStage;
      }
    | {
        type: 'UPDATE_VERIFIED_SKILLS';
        candidateId: string;
        jobId?: string;
        assessment: AssessmentResult;
        verifiedSkillsDelta: ValidatedSkill[];
        badgesAdded: string[];
        skillsAdded: string[];
      }
    | {
        type: 'ACTIVATE_RESUME_DRAFT';
        candidateId: string;
        documentId: number;
        fileName?: string;
        parsedResume?: any | null;
        parseStatus: 'PARSED' | 'PENDING_PARSE';
        retryAfterMs?: number;
      };
  evidence?: Array<{ label: string; value: string }>;
};

const STORAGE_KEY = 'talentSonar:proposedActions:v1';

function safeParse(raw: string | null): ProposedAction[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProposedAction[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: ProposedAction[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    // ignore
  }
}

class ProposedActionService {
  list(): ProposedAction[] {
    if (typeof window === 'undefined') return [];
    const raw = safeParse(window.localStorage.getItem(STORAGE_KEY));

    // Dedupe noisy agent output (e.g. SOURCING may propose "Sourced" then "New" after AI shortlist).
    // Only dedupe within status === 'proposed' so users keep applied/dismissed history intact.
    const keyFor = (a: ProposedAction): string | null => {
      if (a.status !== 'proposed') return null;
      if (a.payload.type !== 'MOVE_CANDIDATE_TO_STAGE') return null;
      if (!a.candidateId || !a.jobId) return null;
      return `${a.status}:${a.agentType}:${a.candidateId}:${a.jobId}:${a.payload.type}`;
    };

    const byKey = new Map<string, ProposedAction>();
    const passthrough: ProposedAction[] = [];

    for (const item of raw) {
      const key = keyFor(item);
      if (!key) {
        passthrough.push(item);
        continue;
      }
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        continue;
      }

      const existingTs = Date.parse(existing.createdAt);
      const nextTs = Date.parse(item.createdAt);
      const keep = Number.isFinite(nextTs) && Number.isFinite(existingTs) ? (nextTs >= existingTs ? item : existing) : item;
      byKey.set(key, keep);
    }

    return [...Array.from(byKey.values()), ...passthrough].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  upsert(action: ProposedAction): void {
    if (typeof window === 'undefined') return;
    const list = this.list();
    const idx = list.findIndex((a) => a.id === action.id);
    const next = idx >= 0 ? [...list.slice(0, idx), action, ...list.slice(idx + 1)] : [action, ...list];
    safeWrite(next);
    eventBus.emit(EVENTS.PROPOSED_ACTIONS_CHANGED, { type: idx >= 0 ? 'updated' : 'added', action });
  }

  add(action: Omit<ProposedAction, 'id' | 'createdAt' | 'status'> & { id?: string; createdAt?: string; status?: ProposedActionStatus }): ProposedAction {
    const status = action.status ?? 'proposed';

    // Auto-upsert for "proposed" move actions to avoid duplicates for the same candidate/job/agent.
    let inferredId: string | undefined = action.id;
    let inferredCreatedAt: string | undefined = action.createdAt;

    if (
      !inferredId &&
      status === 'proposed' &&
      action.payload.type === 'MOVE_CANDIDATE_TO_STAGE' &&
      action.candidateId &&
      action.jobId
    ) {
      const list = this.list();
      const match = list.find(
        (a) =>
          a.status === 'proposed' &&
          a.agentType === action.agentType &&
          a.candidateId === action.candidateId &&
          a.jobId === action.jobId &&
          a.payload.type === 'MOVE_CANDIDATE_TO_STAGE'
      );
      if (match) {
        inferredId = match.id;
        inferredCreatedAt = match.createdAt;
      }
    }

    const next: ProposedAction = {
      id: inferredId ?? `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: inferredCreatedAt ?? new Date().toISOString(),
      status,
      agentType: action.agentType,
      title: action.title,
      description: action.description,
      candidateId: action.candidateId,
      jobId: action.jobId,
      payload: action.payload,
      evidence: action.evidence
    };
    this.upsert(next);
    return next;
  }

  markStatus(id: string, status: ProposedActionStatus): void {
    const list = this.list();
    const found = list.find((a) => a.id === id);
    if (!found) return;
    this.upsert({ ...found, status });
  }

  clear(status?: ProposedActionStatus): void {
    if (typeof window === 'undefined') return;
    const list = this.list();
    const next = status ? list.filter((a) => a.status !== status) : [];
    safeWrite(next);
    eventBus.emit(EVENTS.PROPOSED_ACTIONS_CHANGED, { type: 'cleared', status });
  }
}

export const proposedActionService = new ProposedActionService();
