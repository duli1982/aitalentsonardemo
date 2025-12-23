import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Inbox, XCircle } from 'lucide-react';
import { proposedActionService, type ProposedAction, type ProposedActionStatus } from '../services/ProposedActionService';
import { eventBus, EVENTS } from '../utils/EventBus';
import type { PipelineStage } from '../types';
import ConfirmModal from '../components/modals/ConfirmModal';
import { applyVerifiedSkillsProposal } from '../services/VerifiedSkillsService';
import { useToast } from '../contexts/ToastContext';

const statusLabel: Record<ProposedActionStatus, string> = {
  proposed: 'Proposed',
  applied: 'Applied',
  dismissed: 'Dismissed'
};

function stageLabel(stage: PipelineStage): string {
  return String(stage).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

const AgentInboxPage: React.FC = () => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<ProposedActionStatus>('proposed');
  const [items, setItems] = useState<ProposedAction[]>(() => proposedActionService.list());
  const [confirmAction, setConfirmAction] = useState<ProposedAction | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setItems(proposedActionService.list());
    const sub = eventBus.on(EVENTS.PROPOSED_ACTIONS_CHANGED, () => {
      setItems(proposedActionService.list());
    });
    return () => sub.unsubscribe();
  }, []);

  const counts = useMemo(() => {
    const next: Record<ProposedActionStatus, number> = { proposed: 0, applied: 0, dismissed: 0 };
    items.forEach((i) => next[i.status]++);
    return next;
  }, [items]);

  const filtered = useMemo(() => items.filter((i) => i.status === status), [items, status]);

  const apply = (action: ProposedAction) => {
    setConfirmAction(action);
  };

  const confirmApply = async (action: ProposedAction): Promise<boolean> => {
    if (action.payload.type === 'MOVE_CANDIDATE_TO_STAGE') {
      const { candidate, jobId, stage } = action.payload;
      eventBus.emit(EVENTS.CANDIDATE_STAGED, {
        candidateId: String(candidate.id),
        candidateName: candidate.name,
        jobId,
        stage,
        source: `agent:${action.agentType.toLowerCase()}`,
        candidate
      });
      proposedActionService.markStatus(action.id, 'applied');
      return true;
    }

    if (action.payload.type === 'UPDATE_VERIFIED_SKILLS') {
      const res = await applyVerifiedSkillsProposal(action);
      if (!res.success) {
        showToast(res.error.message, 'warning');
        return false;
      }
      proposedActionService.markStatus(action.id, 'applied');
      showToast('Verified skills applied to system-of-record.', 'success');
      return true;
    }

    return false;
  };

  const dismiss = (action: ProposedAction) => {
    proposedActionService.markStatus(action.id, 'dismissed');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <ConfirmModal
        isOpen={confirmAction !== null}
        title="Apply this agent proposal?"
        message={
          confirmAction?.payload.type === 'MOVE_CANDIDATE_TO_STAGE' ? (
            <div className="space-y-2">
              <div className="text-slate-200">
                Apply the following change to your pipeline?
              </div>
              <div className="text-sm bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                <div className="font-semibold text-white">{confirmAction.payload.candidate.name}</div>
                <div className="text-xs text-slate-400 mt-1">
                  → <span className="text-sky-300">{stageLabel(confirmAction.payload.stage)}</span> (job {confirmAction.payload.jobId})
                </div>
              </div>
              <div className="text-xs text-slate-400">
                This is a write action. You can dismiss instead if you want the agent to stop proposing this.
              </div>
            </div>
          ) : confirmAction?.payload.type === 'UPDATE_VERIFIED_SKILLS' ? (
            <div className="space-y-2">
              <div className="text-slate-200">
                Apply this verified-skill update to the system-of-record?
              </div>
              <div className="text-sm bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-white">Candidate {confirmAction.payload.candidateId}</div>
                {confirmAction.payload.jobId ? (
                  <div className="text-xs text-slate-400">Job {confirmAction.payload.jobId}</div>
                ) : null}
                <div className="text-xs text-slate-300">
                  Assessment: <span className="text-white font-semibold">{confirmAction.payload.assessment.title}</span> • {confirmAction.payload.assessment.score}/100
                </div>
                {confirmAction.payload.skillsAdded.length ? (
                  <div className="text-xs text-slate-300">
                    Skills added: <span className="text-sky-300">{confirmAction.payload.skillsAdded.slice(0, 8).join(', ')}</span>
                    {confirmAction.payload.skillsAdded.length > 8 ? ` +${confirmAction.payload.skillsAdded.length - 8} more` : ''}
                  </div>
                ) : null}
              </div>
              <div className="text-xs text-slate-400">
                This is a write action. It will update `candidates.skills` and store proof in candidate metadata (passport + assessment history).
              </div>
            </div>
          ) : null
        }
        confirmLabel="Apply"
        cancelLabel="Cancel"
        isConfirming={isApplying}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction || isApplying) return;
          setIsApplying(true);
          void (async () => {
            const ok = await confirmApply(confirmAction);
            setIsApplying(false);
            if (ok) setConfirmAction(null);
          })();
        }}
      />
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-lg">
              <Inbox className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Agent Inbox</h1>
              <p className="text-slate-400">
                Review agent proposals before applying changes (recommend-only by default).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['proposed', 'applied', 'dismissed'] as ProposedActionStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                status === s
                  ? 'bg-sky-600/30 border-sky-500/50 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {statusLabel[s]} <span className="text-slate-400">({counts[s]})</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-10 text-center text-slate-400">
            No {statusLabel[status].toLowerCase()} actions.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((action) => (
              <div key={action.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">
                      {new Date(action.createdAt).toLocaleString()} • {action.agentType} agent
                    </div>
                    <div className="text-lg font-semibold text-white mt-1">{action.title}</div>
                    <div className="text-sm text-slate-300 mt-1">{action.description}</div>
                    {action.evidence?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {action.evidence.slice(0, 6).map((e, idx) => (
                          <span
                            key={`${action.id}_ev_${idx}`}
                            className="px-2 py-1 rounded border border-slate-700 bg-slate-900/40 text-xs text-slate-200"
                          >
                            <span className="text-slate-400 mr-1">{e.label}:</span>
                            {e.value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      {action.candidateId && (
                        <button
                          type="button"
                          onClick={() => {
                            eventBus.emit(EVENTS.PULSE_NAVIGATE, { to: 'candidates', candidateId: action.candidateId, jobId: action.jobId });
                          }}
                          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                        >
                          Open Candidate
                        </button>
                      )}
                      {action.jobId && (
                        <button
                          type="button"
                          onClick={() => {
                            eventBus.emit(EVENTS.PULSE_NAVIGATE, { to: 'pipeline', jobId: action.jobId });
                          }}
                          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                        >
                          Open Pipeline
                        </button>
                      )}
                    </div>

                    {action.status === 'proposed' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => dismiss(action)}
                          className="px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 hover:bg-slate-900/60 text-slate-200 text-xs font-semibold inline-flex items-center gap-2"
                        >
                          <XCircle className="h-4 w-4" /> Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() => apply(action)}
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" /> Apply
                        </button>
                      </div>
                    )}

                    {action.status !== 'proposed' && (
                      <div className="text-xs text-slate-400">
                        Status: <span className="text-white font-semibold">{statusLabel[action.status]}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentInboxPage;
