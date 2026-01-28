import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, Save, X } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { truthCheckService, type TruthCheckPack, type TruthCheckQuestion, type TruthCheckRubricBand } from '../../services/TruthCheckService';
import { jobContextPackService } from '../../services/JobContextPackService';
import { decisionArtifactService, type DecisionArtifactRecord } from '../../services/DecisionArtifactService';
import { pipelineEventService } from '../../services/PipelineEventService';
import { toCandidateSnapshot, toJobSnapshot } from '../../utils/snapshots';
import {
  scoreTruthCheckAnswer,
  summarizeTruthCheck,
  type TruthCheckAnswerAssessment
} from '../../services/TruthCheckAssessmentService';

type Props = {
  isOpen: boolean;
  candidate: Candidate;
  job: Job;
  existingArtifact?: DecisionArtifactRecord | null;
  onClose: () => void;
  onSaved?: () => void;
};

function parseExistingTruthCheck(artifact?: DecisionArtifactRecord | null): {
  pack: TruthCheckPack | null;
  answers: TruthCheckAnswerAssessment[];
} {
  const pack = (artifact?.details as any)?.truthCheck;
  const savedPack = pack && typeof pack === 'object' ? (pack as TruthCheckPack) : null;

  const answers = (artifact?.details as any)?.answers;
  const savedAnswers = Array.isArray(answers) ? (answers as TruthCheckAnswerAssessment[]) : [];

  // Backward compat: sometimes only `details.questions` exists.
  const questions = (artifact?.details as any)?.questions;
  const legacy = Array.isArray(questions)
    ? (questions as any[]).map((q, idx) => ({
        questionId: `tcq_${idx + 1}`,
        question: String(q.question ?? ''),
        answer: String(q.answer ?? ''),
        score: Number(q.score ?? 0) || 0,
        band: (q.band as TruthCheckRubricBand) || 'adequate',
        generic: q.generic ?? { isGeneric: false, reasons: [] }
      }))
    : [];

  return {
    pack: savedPack,
    answers: savedAnswers.length ? savedAnswers : legacy
  };
}

function bandColor(band: TruthCheckRubricBand): string {
  if (band === 'strong') return 'bg-green-500/15 border-green-500/30 text-green-200';
  if (band === 'adequate') return 'bg-sky-500/15 border-sky-500/30 text-sky-200';
  return 'bg-amber-500/15 border-amber-500/30 text-amber-200';
}

const PreHmTruthCheckModal: React.FC<Props> = ({ isOpen, candidate, job, existingArtifact, onClose, onSaved }) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pack, setPack] = useState<TruthCheckPack | null>(null);
  const [answers, setAnswers] = useState<TruthCheckAnswerAssessment[]>([]);
  const [expandedRubrics, setExpandedRubrics] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEscapeKey({ active: isOpen, onEscape: onClose });

  const existing = useMemo(() => parseExistingTruthCheck(existingArtifact), [existingArtifact]);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setSaveError(null);
    setSavedAt(null);
    setIsLoading(true);

    const seed = async () => {
      const contextPack = await jobContextPackService.get(String(job.id));
      const built = await truthCheckService.build({
        job: toJobSnapshot(job),
        candidate: toCandidateSnapshot(candidate),
        contextPack
      });

      const effectivePack = existing.pack ?? built;
      const effectiveQuestions = effectivePack.questions || [];

      const initialAnswers: TruthCheckAnswerAssessment[] = effectiveQuestions.map((q) => {
        const found = (existing.answers || []).find((a) => a.questionId === q.id || a.question === q.question);
        const assessment = scoreTruthCheckAnswer({
          questionId: q.id,
          question: q.question,
          answer: found?.answer ?? '',
          bandOverride: found?.band
        });

        // Preserve any previously saved score if present and answer unchanged.
        if (found && typeof found.score === 'number' && String(found.answer || '') === String(assessment.answer || '')) {
          return { ...assessment, score: found.score, generic: found.generic ?? assessment.generic };
        }

        return assessment;
      });

      if (cancelled) return;
      setPack(effectivePack);
      setAnswers(initialAnswers);
    };

    seed()
      .catch((e) => {
        if (!cancelled) setSaveError(String((e as any)?.message ?? e ?? 'Failed to load truth-check.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [candidate, existing.answers, existing.pack, isOpen, job]);

  const summary = useMemo(() => summarizeTruthCheck(answers), [answers]);

  if (!isOpen) return null;

  const questions: TruthCheckQuestion[] = pack?.questions || [];

  const updateAnswer = (questionId: string, nextAnswer: string) => {
    setAnswers((prev) =>
      prev.map((a) => {
        if (a.questionId !== questionId) return a;
        return scoreTruthCheckAnswer({
          questionId: a.questionId,
          question: a.question,
          answer: nextAnswer,
          bandOverride: a.band
        });
      })
    );
  };

  const updateBand = (questionId: string, band: TruthCheckRubricBand) => {
    setAnswers((prev) =>
      prev.map((a) => {
        if (a.questionId !== questionId) return a;
        return scoreTruthCheckAnswer({
          questionId: a.questionId,
          question: a.question,
          answer: a.answer,
          bandOverride: band
        });
      })
    );
  };

  const toggleRubric = (questionId: string) => {
    setExpandedRubrics((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const canSave = Boolean(pack && questions.length === 5);

  const handleSave = async () => {
    if (!pack) return;
    setSaveError(null);

    const capturedAt = new Date().toISOString();
    const summaryLine = `Truth check: ${summary.recommendation} (${summary.avgScore}/100). Generic flagged: ${summary.genericCount}/5.`;

    await decisionArtifactService.saveTruthCheckAssessment({
      candidateId: String(candidate.id),
      candidateName: candidate.name,
      jobId: String(job.id),
      jobTitle: job.title,
      truthCheck: pack,
      answers,
      score: summary.avgScore,
      recommendation: summary.recommendation,
      summary: summaryLine,
      externalId: 'truth_check_v1'
    });

    // Best-effort: record as a pipeline event so the timeline shows it.
    void pipelineEventService.logEvent({
      candidateId: String(candidate.id),
      candidateName: candidate.name,
      jobId: String(job.id),
      jobTitle: job.title,
      eventType: 'TRUTH_CHECK_CAPTURED',
      actorType: 'user',
      summary: summaryLine,
      metadata: {
        avgScore: summary.avgScore,
        recommendation: summary.recommendation,
        genericCount: summary.genericCount,
        capturedAt
      }
    });

    setSavedAt(capturedAt);
    onSaved?.();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" />

      <div className="relative w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-100 font-semibold">
              <ClipboardCheck className="h-4 w-4 text-purple-300" />
              Pre‑HM Truth Check
            </div>
            <div className="text-xs text-slate-400 mt-1 truncate">
              {candidate.name} • {job.title} • 5 role-tailored proof questions
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-lg border border-slate-700 bg-slate-900/30 text-slate-200 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 max-h-[75vh] overflow-y-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-3">
            <div className="text-xs text-slate-300">
              <span className="text-slate-400">Overall:</span>{' '}
              <span className="font-semibold text-slate-100">{summary.recommendation}</span>{' '}
              <span className="text-slate-400">•</span> {summary.avgScore}/100{' '}
              <span className="text-slate-400">•</span> Generic flagged: {summary.genericCount}/5
            </div>
            <div className="text-[11px] text-slate-500">
              {savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : pack ? `Questions: ${pack.method}` : 'Loading…'}
            </div>
          </div>

          {saveError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{saveError}</div>
          ) : null}

          {isLoading ? (
            <div className="text-xs text-slate-400">Building truth-check questions…</div>
          ) : null}

          {!isLoading && questions.length !== 5 ? (
            <div className="text-xs text-slate-400">Truth-check questions unavailable (expected 5).</div>
          ) : null}

          {questions.map((q) => {
            const a = answers.find((x) => x.questionId === q.id);
            const expanded = Boolean(expandedRubrics[q.id]);
            const generic = a?.generic;

            return (
              <div key={q.id} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200">{q.question}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full border text-[11px] ${bandColor(a?.band ?? 'adequate')}`}>
                        {String(a?.band ?? 'adequate').toUpperCase()}
                      </span>
                      <span className="text-[11px] text-slate-400">Score: {a?.score ?? 0}/100</span>
                      {generic?.isGeneric ? (
                        <span className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
                          Generic detected
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleRubric(q.id)}
                    className="text-[11px] text-slate-300 hover:text-white border border-slate-700 bg-slate-900/30 px-2 py-1 rounded-md"
                  >
                    {expanded ? 'Hide rubric' : 'Show rubric'}
                  </button>
                </div>

                {expanded ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                    <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                      <div className="font-semibold text-green-200 mb-1">Strong</div>
                      <ul className="text-green-100/80 space-y-1">
                        {(q.rubric?.strong || []).slice(0, 5).map((t, idx) => (
                          <li key={idx} className="leading-snug">
                            • {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
                      <div className="font-semibold text-sky-200 mb-1">Adequate</div>
                      <ul className="text-sky-100/80 space-y-1">
                        {(q.rubric?.adequate || []).slice(0, 5).map((t, idx) => (
                          <li key={idx} className="leading-snug">
                            • {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                      <div className="font-semibold text-amber-200 mb-1">Concern</div>
                      <ul className="text-amber-100/80 space-y-1">
                        {(q.rubric?.concern || []).slice(0, 5).map((t, idx) => (
                          <li key={idx} className="leading-snug">
                            • {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                  <div className="sm:col-span-2">
                    <textarea
                      value={a?.answer ?? ''}
                      onChange={(e) => updateAnswer(q.id, e.target.value)}
                      rows={4}
                      placeholder="Paste the candidate’s answer. Aim for a specific last-time example with measurable impact."
                      className="w-full rounded-lg bg-slate-900/40 border border-slate-700 text-slate-200 text-xs p-3 focus:outline-none focus:ring-2 focus:ring-purple-500/60"
                    />
                    {generic?.isGeneric && generic.reasons?.length ? (
                      <div className="mt-2 text-[11px] text-amber-200">
                        <div className="text-amber-300 font-semibold mb-1">Why it looks generic</div>
                        <ul className="space-y-1 text-amber-100/80">
                          {generic.reasons.slice(0, 4).map((r, idx) => (
                            <li key={idx}>• {r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-3">
                    <div className="text-[11px] text-slate-400 mb-2">Recruiter rating</div>
                    <div className="space-y-2">
                      {(['strong', 'adequate', 'concern'] as TruthCheckRubricBand[]).map((b) => (
                        <label key={b} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="radio"
                            name={`band_${q.id}`}
                            checked={(a?.band ?? 'adequate') === b}
                            onChange={() => updateBand(q.id, b)}
                          />
                          <span className="capitalize">{b}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500">
                      Tip: if generic is flagged, push for a “last time” example (when/what/impact).
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-sm font-semibold"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/30 disabled:text-slate-300 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Truth Check
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreHmTruthCheckModal;
