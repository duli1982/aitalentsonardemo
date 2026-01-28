import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ClipboardList, Save } from 'lucide-react';
import type { PipelineStage } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export type DispositionReasonCode =
  | 'skills_gap'
  | 'seniority_mismatch'
  | 'location_constraints'
  | 'timeline_unclear'
  | 'stakeholder_fit'
  | 'comp_mismatch'
  | 'candidate_withdrew'
  | 'no_response'
  | 'ready_to_offer'
  | 'pending_approval'
  | 'offer_accepted'
  | 'countered_and_accepted'
  | 'internal_transfer'
  | 'other';

export type DispositionPayload = {
  stage: PipelineStage;
  reasonCode: DispositionReasonCode;
  reasonText?: string;
  notes?: string;
  // optional “offer/hired” signals (kept light for now)
  compDelta?: string;
  competingOffer?: 'yes' | 'no' | 'unknown';
};

type Props = {
  isOpen: boolean;
  stage: PipelineStage;
  candidateName: string;
  jobTitle: string;
  onCancel: () => void;
  onSubmit: (payload: DispositionPayload) => void;
};

type Option = { code: DispositionReasonCode; label: string };

function titleForStage(stage: PipelineStage): string {
  if (stage === 'rejected') return 'Record rejection reason';
  if (stage === 'offer') return 'Record offer decision';
  if (stage === 'hired') return 'Record hire outcome';
  return 'Record disposition';
}

function optionsForStage(stage: PipelineStage): Option[] {
  if (stage === 'rejected') {
    return [
      { code: 'skills_gap', label: 'Skills gap (missing must-have)' },
      { code: 'seniority_mismatch', label: 'Seniority mismatch' },
      { code: 'location_constraints', label: 'Location/onsite mismatch' },
      { code: 'timeline_unclear', label: 'Timeline unclear (dates/ownership)' },
      { code: 'stakeholder_fit', label: 'Stakeholder/communication fit concern' },
      { code: 'comp_mismatch', label: 'Compensation mismatch' },
      { code: 'candidate_withdrew', label: 'Candidate withdrew' },
      { code: 'no_response', label: 'No response / drop-off' },
      { code: 'other', label: 'Other' }
    ];
  }

  if (stage === 'offer') {
    return [
      { code: 'ready_to_offer', label: 'Ready to offer (strong pass)' },
      { code: 'pending_approval', label: 'Offer pending approval / budget' },
      { code: 'comp_mismatch', label: 'Offer blocked by comp constraints' },
      { code: 'other', label: 'Other' }
    ];
  }

  if (stage === 'hired') {
    return [
      { code: 'offer_accepted', label: 'Offer accepted' },
      { code: 'countered_and_accepted', label: 'Countered and accepted' },
      { code: 'internal_transfer', label: 'Internal transfer' },
      { code: 'other', label: 'Other' }
    ];
  }

  return [{ code: 'other', label: 'Other' }];
}

const DispositionReasonModal: React.FC<Props> = ({ isOpen, stage, candidateName, jobTitle, onCancel, onSubmit }) => {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const [reasonCode, setReasonCode] = useState<DispositionReasonCode>('other');
  const [otherText, setOtherText] = useState('');
  const [notes, setNotes] = useState('');
  const [compDelta, setCompDelta] = useState('');
  const [competingOffer, setCompetingOffer] = useState<'yes' | 'no' | 'unknown'>('unknown');

  useEscapeKey({ active: isOpen, onEscape: onCancel });

  useEffect(() => {
    if (!isOpen) return;
    // Reset each open to avoid “sticky” reasons across candidates.
    setReasonCode(optionsForStage(stage)[0]?.code ?? 'other');
    setOtherText('');
    setNotes('');
    setCompDelta('');
    setCompetingOffer('unknown');
    setTimeout(() => confirmRef.current?.focus(), 0);
  }, [isOpen, stage]);

  const options = useMemo(() => optionsForStage(stage), [stage]);
  const isOther = reasonCode === 'other';
  const showOfferSignals = stage === 'offer' || stage === 'hired';

  if (!isOpen) return null;

  const canSubmit = Boolean(reasonCode) && (!isOther || otherText.trim().length > 0);

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4">
      <button type="button" onClick={onCancel} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" />

      <div className="relative w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <ClipboardList className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-white truncate">{titleForStage(stage)}</div>
              <div className="text-xs text-slate-400 truncate">
                {candidateName} · {jobTitle}
              </div>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs text-slate-400 mb-1">Primary reason</div>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as DispositionReasonCode)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
            >
              {options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {isOther ? (
            <div>
              <div className="text-xs text-slate-400 mb-1">Other (1 line)</div>
              <input
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Add a short reason…"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                maxLength={140}
              />
            </div>
          ) : null}

          {showOfferSignals ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Comp delta (optional)</div>
                <input
                  value={compDelta}
                  onChange={(e) => setCompDelta(e.target.value)}
                  placeholder="e.g., +10%, at band, -5%"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                  maxLength={48}
                />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Competing offer?</div>
                <select
                  value={competingOffer}
                  onChange={(e) => setCompetingOffer(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                >
                  <option value="unknown">Unknown</option>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-xs text-slate-400 mb-1">Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context for future learning (what changed the decision?)"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm min-h-[90px]"
            />
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-800/40 border border-slate-700 rounded-lg p-3">
            This stores the reason in <span className="text-slate-200 font-semibold">pipeline events</span> so weighting and risk flags can improve over time.
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex items-center justify-end gap-2 bg-slate-900/70">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                stage,
                reasonCode,
                reasonText: isOther ? otherText.trim() : undefined,
                notes: notes.trim() || undefined,
                compDelta: compDelta.trim() || undefined,
                competingOffer
              })
            }
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            Save & apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default DispositionReasonModal;

