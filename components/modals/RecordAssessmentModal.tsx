import React, { useMemo, useState } from 'react';
import { Award, X } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import type { AssessmentResult, AssessmentType } from '../../types/assessment';
import { skillsInferenceService } from '../../services/SkillsInferenceService';
import { proposeVerifiedSkillsFromAssessment } from '../../services/VerifiedSkillsService';
import { useToast } from '../../contexts/ToastContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useNavigate } from 'react-router-dom';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  job: Job | null;
};

const ASSESSMENT_TYPES: Array<{ id: AssessmentType; label: string }> = [
  { id: 'CODING_TEST', label: 'Coding test' },
  { id: 'LAB_SIMULATION', label: 'Lab simulation' },
  { id: 'CASE_STUDY', label: 'Case study' },
  { id: 'LEARNING_MODULE', label: 'Learning module' }
];

function parseSkills(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

const RecordAssessmentModal: React.FC<Props> = ({ isOpen, onClose, candidate, job }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('Skill verification');
  const [type, setType] = useState<AssessmentType>('CASE_STUDY');
  const [score, setScore] = useState<number>(80);
  const [skillsRaw, setSkillsRaw] = useState('');
  const [feedback, setFeedback] = useState('');
  const [createdProposalId, setCreatedProposalId] = useState<string | null>(null);

  useEscapeKey({ active: isOpen, onEscape: onClose });

  const skillsValidated = useMemo(() => parseSkills(skillsRaw), [skillsRaw]);

  if (!isOpen) return null;

  const canSubmit = Boolean(candidate) && skillsValidated.length > 0 && score >= 0 && score <= 100;

  const submit = () => {
    if (!candidate) return;
    if (!canSubmit) {
      showToast('Add at least 1 validated skill and a score (0–100).', 'warning');
      return;
    }

    const assessment: AssessmentResult = {
      id: `assessment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title: title.trim() || 'Skill verification',
      dateCompleted: new Date().toISOString(),
      score: Math.round(score),
      skillsValidated,
      feedback: feedback.trim()
    };

    const updated = skillsInferenceService.ingestAssessment(candidate, assessment);
    const inferred = updated.passport ?? { verifiedSkills: [], badges: [] };

    const proposal = proposeVerifiedSkillsFromAssessment({
      candidate,
      jobId: job?.id,
      assessment,
      inferred: inferred as any
    });

    if (!proposal) {
      showToast('No new verified skills to propose (already known or lower level).', 'info');
      onClose();
      return;
    }

    setCreatedProposalId(proposal.id);
    showToast('Proposal created. Review and apply from Agent Inbox.', 'success');
  };

  const handleClose = () => {
    setCreatedProposalId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <button type="button" onClick={handleClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" />

      <div className="relative w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Award className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-white truncate">Record assessment (verified skills)</div>
              <div className="text-xs text-slate-400 truncate">
                {candidate ? candidate.name : 'No candidate selected'}
                {job ? ` • ${job.title}` : ''}
              </div>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {createdProposalId ? (
          <div className="p-4 space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <div className="text-sm font-semibold text-white">Proposal created</div>
              <div className="text-xs text-slate-300 mt-1">
                Review and apply it from Agent Inbox (recommend-only).
              </div>
              <div className="text-[11px] text-slate-400 mt-2">ID: {createdProposalId}</div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/agent-inbox');
                  handleClose();
                }}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold"
              >
                Review & Apply
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Assessment type</div>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AssessmentType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                  >
                    {ASSESSMENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1">Score (0–100)</div>
                  <input
                    type="number"
                    value={score}
                    min={0}
                    max={100}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Assessment title</div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., React case study"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                />
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Validated skills (comma separated)</div>
                <input
                  type="text"
                  value={skillsRaw}
                  onChange={(e) => setSkillsRaw(e.target.value)}
                  placeholder="e.g., React, TypeScript, Node.js"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {skillsValidated.slice(0, 8).map((s) => (
                    <span key={s} className="px-2 py-1 rounded-full text-[11px] bg-slate-800 border border-slate-700 text-slate-200">
                      {s}
                    </span>
                  ))}
                  {skillsValidated.length > 8 && <span className="text-[11px] text-slate-500">+{skillsValidated.length - 8} more</span>}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Notes (optional)</div>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Any context for reviewers (what was tested, rubric, etc.)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm min-h-[90px]"
                />
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                This creates a <span className="text-slate-200 font-semibold">reviewable proposal</span> in Agent Inbox. No system-of-record data changes until you apply it.
              </div>
            </div>

            <div className="p-4 border-t border-slate-700 flex items-center justify-end gap-2 bg-slate-900/70">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Create proposal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RecordAssessmentModal;
