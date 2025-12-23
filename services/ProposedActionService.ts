import type { Candidate, PipelineStage } from '../types';
import type { AssessmentResult, ValidatedSkill } from '../types/assessment';
import { eventBus, EVENTS } from '../utils/EventBus';

export type ProposedActionStatus = 'proposed' | 'applied' | 'dismissed';

export type ProposedActionType = 'MOVE_CANDIDATE_TO_STAGE' | 'UPDATE_VERIFIED_SKILLS';

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
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
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
    const next: ProposedAction = {
      id: action.id ?? `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: action.createdAt ?? new Date().toISOString(),
      status: action.status ?? 'proposed',
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
