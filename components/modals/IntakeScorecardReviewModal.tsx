import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle, Trash2, Plus, AlertTriangle,
  Loader2, Star, Shield, User, Briefcase, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import type { IntakeScorecard, IntakeScorecardCriterion, IntakeCriterionCategory } from '../../types';
import { intakeCallService } from '../../services/IntakeCallService';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';

interface IntakeScorecardReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  onApproved?: (scorecard: IntakeScorecard) => void;
}

const CATEGORY_OPTIONS: { value: IntakeCriterionCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'technical', label: 'Technical', icon: <Briefcase className="h-3 w-3" /> },
  { value: 'experience', label: 'Experience', icon: <Star className="h-3 w-3" /> },
  { value: 'soft_skill', label: 'Soft Skill', icon: <User className="h-3 w-3" /> },
  { value: 'cultural', label: 'Cultural', icon: <Shield className="h-3 w-3" /> },
  { value: 'other', label: 'Other', icon: <Sparkles className="h-3 w-3" /> },
];

const categoryColor = (cat: IntakeCriterionCategory) => {
  switch (cat) {
    case 'technical': return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'experience': return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'soft_skill': return 'bg-green-500/15 text-green-300 border-green-500/30';
    case 'cultural': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    default: return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
};

const IntakeScorecardReviewModal: React.FC<IntakeScorecardReviewModalProps> = ({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  onApproved,
}) => {
  const { showToast } = useToast();
  const [scorecard, setScorecard] = useState<IntakeScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRedFlags, setShowRedFlags] = useState(false);
  const [showRoleContext, setShowRoleContext] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    intakeCallService.getScorecardForJob(jobId).then((sc) => {
      setScorecard(sc);
      setLoading(false);
    });
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  const updateCriterion = (
    listKey: 'mustHave' | 'niceToHave',
    idx: number,
    field: keyof IntakeScorecardCriterion,
    value: string | number
  ) => {
    if (!scorecard) return;
    const list = [...scorecard[listKey]];
    list[idx] = { ...list[idx], [field]: value };
    setScorecard({ ...scorecard, [listKey]: list });
  };

  const removeCriterion = (listKey: 'mustHave' | 'niceToHave', idx: number) => {
    if (!scorecard) return;
    setScorecard({ ...scorecard, [listKey]: scorecard[listKey].filter((_, i) => i !== idx) });
  };

  const addCriterion = (listKey: 'mustHave' | 'niceToHave') => {
    if (!scorecard) return;
    const newItem: IntakeScorecardCriterion = {
      criterion: '',
      weight: 3,
      category: 'other',
      evidenceFromCall: '',
    };
    setScorecard({ ...scorecard, [listKey]: [...scorecard[listKey], newItem] });
  };

  const resolveApprover = async (): Promise<string> => {
    if (!supabase) return 'local_user';
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      return user?.email || user?.id || 'authenticated_user';
    } catch {
      return 'authenticated_user';
    }
  };

  const handleSaveAndClose = async () => {
    if (!scorecard) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const saved = await intakeCallService.saveScorecardDraft(scorecard);
      setScorecard(saved);
      showToast('Scorecard draft saved.', 'success');
      onClose();
    } catch (err) {
      console.error('[IntakeScorecardReview] Save error:', err);
      showToast('Failed to save scorecard draft.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!scorecard) return;

    // Validate: at least 1 must-have with text
    const validMustHaves = scorecard.mustHave.filter((c) => c.criterion.trim());
    if (validMustHaves.length === 0) {
      showToast('Add at least one must-have criterion before approving.', 'warning');
      return;
    }

    setApproving(true);
    try {
      const approvedBy = await resolveApprover();
      const approved = await intakeCallService.approveScorecard(scorecard, approvedBy);
      setScorecard(approved);
      showToast('Scorecard approved! The sourcing agent will now use these criteria.', 'info');
      onApproved?.(approved);
      onClose();
    } catch (err) {
      console.error('[IntakeScorecardReview] Approve error:', err);
      showToast('Failed to approve scorecard.', 'error');
    } finally {
      setApproving(false);
    }
  };

  const renderCriteriaList = (listKey: 'mustHave' | 'niceToHave', title: string, accent: string) => {
    const items = scorecard?.[listKey] ?? [];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-sm font-semibold ${accent}`}>{title} ({items.length})</h3>
          <button
            onClick={() => addCriterion(listKey)}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {items.length === 0 && (
          <p className="text-xs text-slate-500 italic">No criteria yet. Click "Add" to create one.</p>
        )}
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 group"
            >
              <div className="flex items-start gap-2">
                {/* Criterion text */}
                <input
                  type="text"
                  value={item.criterion}
                  onChange={(e) => updateCriterion(listKey, idx, 'criterion', e.target.value)}
                  placeholder="Criterion description..."
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none border-b border-transparent focus:border-sky-500/50"
                />
                <button
                  onClick={() => removeCriterion(listKey, idx)}
                  className="text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 mt-2">
                {/* Category */}
                <select
                  value={item.category}
                  onChange={(e) => updateCriterion(listKey, idx, 'category', e.target.value)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${categoryColor(item.category)} bg-transparent focus:outline-none`}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Weight */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">Weight:</span>
                  {[1, 2, 3, 4, 5].map((w) => (
                    <button
                      key={w}
                      onClick={() => updateCriterion(listKey, idx, 'weight', w)}
                      className={`w-5 h-5 rounded text-xs font-bold transition-colors ${
                        w <= item.weight
                          ? 'bg-sky-500/30 text-sky-300'
                          : 'bg-slate-700 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Evidence */}
              {item.evidenceFromCall && (
                <p className="text-xs text-slate-500 mt-1.5 italic">
                  &ldquo;{item.evidenceFromCall}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-sky-400 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              Intake Scorecard Review
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{jobTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading && (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Loading scorecard...</p>
            </div>
          )}

          {!loading && !scorecard && (
            <div className="text-center py-12 text-slate-400">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
              <p className="text-sm">No scorecard found for this job. Start an intake call first.</p>
            </div>
          )}

          {!loading && scorecard && (
            <>
              {/* Status badge */}
              {scorecard.status === 'approved' && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-green-300 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Approved {scorecard.approvedBy && `by ${scorecard.approvedBy}`}
                  {scorecard.approvedAt && ` on ${new Date(scorecard.approvedAt).toLocaleDateString()}`}
                </div>
              )}

              {/* Summary */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Call Summary</h3>
                <textarea
                  value={scorecard.summary}
                  onChange={(e) => setScorecard({ ...scorecard, summary: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                />
              </div>

              {/* Must-Haves */}
              {renderCriteriaList('mustHave', 'Must-Have Criteria', 'text-red-300')}

              {/* Nice-to-Haves */}
              {renderCriteriaList('niceToHave', 'Nice-to-Have Criteria', 'text-amber-300')}

              {/* Ideal Profile */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Ideal Candidate Profile</h3>
                <textarea
                  value={scorecard.idealProfile}
                  onChange={(e) => setScorecard({ ...scorecard, idealProfile: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                />
              </div>

              {/* Red Flags (collapsible) */}
              <div>
                <button
                  onClick={() => setShowRedFlags((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-red-300 hover:text-red-200"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Red Flags ({scorecard.redFlags.length})
                  {showRedFlags ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showRedFlags && (
                  <div className="mt-2 space-y-1.5">
                    {scorecard.redFlags.map((flag, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={flag}
                          onChange={(e) => {
                            const updated = [...scorecard.redFlags];
                            updated[idx] = e.target.value;
                            setScorecard({ ...scorecard, redFlags: updated });
                          }}
                          className="flex-1 bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                        />
                        <button
                          onClick={() => setScorecard({ ...scorecard, redFlags: scorecard.redFlags.filter((_, i) => i !== idx) })}
                          className="text-red-400/50 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setScorecard({ ...scorecard, redFlags: [...scorecard.redFlags, ''] })}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add red flag
                    </button>
                  </div>
                )}
              </div>

              {/* Role Context (collapsible) */}
              <div>
                <button
                  onClick={() => setShowRoleContext((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-slate-200"
                >
                  <Briefcase className="h-4 w-4" />
                  Role Context
                  {showRoleContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showRoleContext && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['teamSize', 'reportingTo', 'growthPath', 'urgency', 'budgetRange', 'workModel'] as const).map((field) => (
                      <div key={field}>
                        <label className="text-xs text-slate-500 capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                        <input
                          type="text"
                          value={String(scorecard.roleContext[field] || '')}
                          onChange={(e) =>
                            setScorecard({
                              ...scorecard,
                              roleContext: { ...scorecard.roleContext, [field]: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && scorecard && scorecard.status !== 'approved' && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700">
            <button
              onClick={handleSaveAndClose}
              disabled={saving || approving}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save & Close'}
            </button>
            <button
              onClick={handleApprove}
              disabled={approving || saving}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {approving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve & Activate Sourcing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntakeScorecardReviewModal;
