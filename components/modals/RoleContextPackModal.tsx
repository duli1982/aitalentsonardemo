import React, { useEffect, useMemo, useState } from 'react';
import { X, ClipboardList, Save } from 'lucide-react';
import type { Job, RoleContextAnswer, RoleContextPack, RoleContextQuestionId } from '../../types';
import { jobContextPackService, ROLE_CONTEXT_QUESTION_IDS } from '../../services/JobContextPackService';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useToast } from '../../contexts/ToastContext';

type Props = {
  isOpen: boolean;
  job: Job | null;
  onClose: () => void;
  onSaved?: (pack: RoleContextPack) => void;
};

type QuestionDef = {
  id: RoleContextQuestionId;
  title: string;
  description?: string;
  options: string[];
  maxSelections: number;
};

const QUESTIONS: QuestionDef[] = [
  {
    id: 'success_90_days',
    title: 'What does success look like in 90 days?',
    options: ['Shipped core deliverable', 'Stabilized/operationalized systems', 'Built stakeholder alignment', 'Hired and ramped team capacity', 'Other']
    ,
    maxSelections: 2
  },
  {
    id: 'must_haves_top3',
    title: 'Top 3 must-haves?',
    description: 'Pick the closest bucket; add a 1-line “other” if needed.',
    options: ['Core technical skills', 'Domain experience', 'Leadership/seniority', 'Strong communication', 'Other']
    ,
    maxSelections: 3
  },
  {
    id: 'nice_signals_top2',
    title: 'Top 2 “nice” signals?',
    options: ['Brand-name companies', 'Open source / portfolio', 'Startup/0→1 experience', 'Stakeholder-facing', 'Other']
    ,
    maxSelections: 2
  },
  {
    id: 'dealbreakers',
    title: 'Dealbreakers?',
    options: ['Missing a core skill', 'Wrong seniority', 'Location constraints', 'Unstable tenure', 'Other']
    ,
    maxSelections: 3
  },
  {
    id: 'location_reality',
    title: 'Location reality?',
    options: ['Onsite only', 'Hybrid', 'Remote (same country)', 'Remote (global)', 'Other']
    ,
    maxSelections: 1
  },
  {
    id: 'reject_even_if_skills_match',
    title: 'What would make you reject a candidate even if skills match?',
    options: ['Weak communication', 'Poor ownership/initiative signals', 'No measurable outcomes', 'Cultural/team fit concerns', 'Other']
    ,
    maxSelections: 2
  }
];

function emptyAnswers(): Record<RoleContextQuestionId, RoleContextAnswer> {
  return ROLE_CONTEXT_QUESTION_IDS.reduce((acc, id) => {
    acc[id] = { choices: [] };
    return acc;
  }, {} as Record<RoleContextQuestionId, RoleContextAnswer>);
}

const RoleContextPackModal: React.FC<Props> = ({ isOpen, job, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<RoleContextQuestionId, RoleContextAnswer>>(emptyAnswers);
  const [notes, setNotes] = useState('');

  useEscapeKey({ active: isOpen, onEscape: onClose });

  useEffect(() => {
    if (!isOpen || !job) return;
    let cancelled = false;

    setIsLoading(true);
    jobContextPackService
      .get(job.id)
      .then((pack) => {
        if (cancelled) return;
        if (pack) {
          setAnswers({ ...emptyAnswers(), ...(pack.answers || {}) });
          setNotes(pack.notes || '');
        } else {
          setAnswers(emptyAnswers());
          setNotes('');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, job?.id]);

  const canSave = useMemo(() => {
    // Optional overall, but we require at least one selection or a note to avoid saving empty packs.
    return (
      Object.values(answers).some((a) => Array.isArray(a.choices) && a.choices.length > 0) || notes.trim().length > 0
    );
  }, [answers, notes]);

  if (!isOpen || !job) return null;

  const updateChoice = (id: RoleContextQuestionId, choice: string) => {
    // Backwards-compatible single-select setter (used only for maxSelections=1).
    setAnswers((prev) => ({
      ...prev,
      [id]: { choices: [choice], otherText: prev[id]?.otherText }
    }));
  };

  const updateOther = (id: RoleContextQuestionId, otherText: string) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { choices: [] }), otherText }
    }));
  };

  const toggleChoice = (id: RoleContextQuestionId, choice: string, maxSelections: number) => {
    setAnswers((prev) => {
      const current = prev[id] || { choices: [] };
      const choices = Array.isArray(current.choices) ? [...current.choices] : [];
      const idx = choices.indexOf(choice);
      if (idx >= 0) {
        choices.splice(idx, 1);
      } else {
        if (maxSelections > 0 && choices.length >= maxSelections) return prev;
        choices.push(choice);
      }
      return {
        ...prev,
        [id]: { choices, otherText: current.otherText }
      };
    });
  };

  const save = async () => {
    if (!canSave) {
      showToast('Add at least one answer or a short note before saving.', 'warning');
      return;
    }

    const pack: RoleContextPack = {
      jobId: job.id,
      jobTitle: job.title,
      answers,
      notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    setIsLoading(true);
    try {
      const saved = await jobContextPackService.upsert(pack);
      showToast('Role Context Pack saved.', 'success');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save Role Context Pack.';
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" />

      <div className="relative w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <ClipboardList className="h-5 w-5 text-sky-300" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-white truncate">Role Context Pack (optional)</div>
              <div className="text-xs text-slate-400 truncate">
                {job.title} · {job.department} · {job.location}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-auto custom-scrollbar space-y-5">
          <div className="text-xs text-slate-400 bg-slate-800/40 border border-slate-700 rounded-lg p-3">
            Leave this empty if you haven’t had intake yet. Add it later to improve evidence, truth-check questions, and confidence.
          </div>

          {QUESTIONS.map((q) => {
            const current = answers[q.id] || { choices: [] };
            const selected = Array.isArray(current.choices) ? current.choices : [];
            const showOther = selected.includes('Other');
            const atLimit = q.maxSelections > 0 && selected.length >= q.maxSelections;

            return (
              <div key={q.id} className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                <div className="text-sm font-semibold text-slate-100">{q.title}</div>
                {q.description ? <div className="text-xs text-slate-400 mt-1">{q.description}</div> : null}

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer ${
                        selected.includes(opt)
                          ? 'border-sky-500/50 bg-sky-500/10 text-sky-200'
                          : 'border-slate-700 bg-slate-900/20 text-slate-200 hover:bg-slate-900/40'
                      }`}
                    >
                      <input
                        type={q.maxSelections === 1 ? 'radio' : 'checkbox'}
                        name={q.id}
                        value={opt}
                        checked={selected.includes(opt)}
                        disabled={q.maxSelections !== 1 && !selected.includes(opt) && atLimit}
                        onChange={() => {
                          if (q.maxSelections === 1) updateChoice(q.id, opt);
                          else toggleChoice(q.id, opt, q.maxSelections);
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>

                {showOther ? (
                  <div className="mt-3">
                    <div className="text-[11px] text-slate-400 mb-1">Other (1 line)</div>
                    <input
                      type="text"
                      value={current.otherText || ''}
                      onChange={(e) => updateOther(q.id, e.target.value)}
                      placeholder="Add a quick note…"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm"
                      maxLength={120}
                    />
                  </div>
                ) : null}

                {q.maxSelections > 1 ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Selected {selected.length}/{q.maxSelections}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
            <div className="text-sm font-semibold text-slate-100">Intake notes (optional)</div>
            <div className="text-xs text-slate-400 mt-1">Short context that improves weighting, risks, and outreach tone.</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., HM cares most about stakeholder-facing work; reject if timelines are vague; location is hybrid 2 days onsite…"
              className="mt-3 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm min-h-[110px]"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex items-center justify-end gap-2 bg-slate-900/70">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-700 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isLoading || !canSave}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleContextPackModal;
