import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Candidate, EvidencePack, Job, PipelineStage } from '../../types';
import { X, Briefcase, MapPin, Layers, ArrowRight, UserX, Calendar, Sparkles, ExternalLink } from 'lucide-react';
import ScheduleInterviewModal from './ScheduleInterviewModal';
import { decisionArtifactService, type DecisionArtifactRecord } from '../../services/DecisionArtifactService';
import { pipelineEventService, type PipelineEventRecord } from '../../services/PipelineEventService';
import { recruitingScorecardService, type RecruitingScorecardRecord } from '../../services/RecruitingScorecardService';
import { determineNextAction } from '../../services/NextActionService';
import { autonomousScreeningAgent } from '../../services/AutonomousScreeningAgent';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import GraphExplorer from '../GraphExplorer';
import { useSupabaseCandidates } from '../../hooks/useSupabaseCandidates';
import DispositionReasonModal, { type DispositionPayload } from './DispositionReasonModal';
import PreHmTruthCheckModal from './PreHmTruthCheckModal';
import { toCandidateSnapshot, toJobSnapshot } from '../../utils/snapshots';

type DrawerTab = 'summary' | 'evidence' | 'artifacts' | 'timeline';

function formatDateTime(value: string | Date | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString();
}

function normalizeStage(value: unknown): PipelineStage | null {
  const raw = String(value || '').toLowerCase();
  const allowed: PipelineStage[] = ['sourced', 'new', 'long_list', 'screening', 'scheduling', 'interview', 'offer', 'hired', 'rejected'];
  return allowed.includes(raw as PipelineStage) ? (raw as PipelineStage) : null;
}

function stageLabel(stage: PipelineStage | null | undefined): string {
  if (!stage) return 'Not in pipeline';
  if (stage === 'long_list') return 'Long List';
  if (stage === 'sourced') return 'Sourced';
  if (stage === 'new') return 'New';
  if (stage === 'screening') return 'Screening';
  if (stage === 'scheduling') return 'Interview Scheduling';
  if (stage === 'interview') return 'Interview';
  if (stage === 'offer') return 'Offer';
  if (stage === 'hired') return 'Hired';
  if (stage === 'rejected') return 'Rejected';
  return stage;
}

function intersection(a: string[], b: string[]): string[] {
  const bSet = new Set(b.map((v) => v.toLowerCase()));
  return a.filter((v) => bSet.has(v.toLowerCase()));
}

function difference(a: string[], b: string[]): string[] {
  const bSet = new Set(b.map((v) => v.toLowerCase()));
  return a.filter((v) => !bSet.has(v.toLowerCase()));
}

function levelLabel(level: number): string {
  const l = Number(level);
  if (l >= 5) return 'Expert';
  if (l === 4) return 'Advanced';
  if (l === 3) return 'Intermediate';
  if (l === 2) return 'Working';
  return 'Beginner';
}

export interface CandidateJobDrawerProps {
  isOpen: boolean;
  candidate: Candidate | null;
  job: Job | null;
  onClose: () => void;
  onAddToPipeline: (candidate: Candidate, jobId: string, initialStage?: PipelineStage) => void;
  onUpdateCandidateStage: (candidateId: string, jobId: string, newStage: PipelineStage) => void;
  onOpenCandidateProfile?: (candidate: Candidate) => void;
}

const CandidateJobDrawer: React.FC<CandidateJobDrawerProps> = ({
  isOpen,
  candidate,
  job,
  onClose,
  onAddToPipeline,
  onUpdateCandidateStage,
  onOpenCandidateProfile
}) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState<DrawerTab>('summary');
  const [artifacts, setArtifacts] = useState<DecisionArtifactRecord[]>([]);
  const [events, setEvents] = useState<PipelineEventRecord[]>([]);
  const [scorecard, setScorecard] = useState<RecruitingScorecardRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [dispositionModalOpen, setDispositionModalOpen] = useState(false);
  const [pendingDispositionStage, setPendingDispositionStage] = useState<PipelineStage | null>(null);
  const [pendingDispositionFromStage, setPendingDispositionFromStage] = useState<PipelineStage | null>(null);
  const [truthCheckOpen, setTruthCheckOpen] = useState(false);

  useEscapeKey({ active: isOpen, onEscape: onClose });

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Keep Graph Insights opt-in (safe mode).
    setGraphOpen(false);
  }, [isOpen, candidate?.id, job?.id]);

  const graphCandidatesEnabled = Boolean(isOpen && tab === 'evidence' && graphOpen);

  const { candidates: graphMatches, isLoading: graphLoading } = useSupabaseCandidates(job, {
    enabled: graphCandidatesEnabled,
    limit: 50,
    threshold: 0.3
  });

  const graphCandidates = useMemo((): Candidate[] => {
    const base: Candidate[] = [];
    if (candidate) base.push(candidate);

    const fromMatches = (graphMatches || []).map((c: any) => ({
      id: String(c.id),
      name: c.name || 'Unknown',
      email: c.email || '',
      type: 'uploaded' as const,
      skills: Array.isArray(c.skills) ? c.skills : [],
      role: (c as any).role || 'Candidate',
      experience: Number((c as any).experienceYears ?? 0) || 0,
      location: (c as any).location || '',
      availability: ''
    })) as Candidate[];

    // Dedupe by id; keep current candidate first.
    const seen = new Set(base.map((c) => c.id));
    fromMatches.forEach((c) => {
      if (seen.has(c.id)) return;
      seen.add(c.id);
      base.push(c);
    });

    return base;
  }, [candidate, graphMatches]);

  const matchScore = useMemo(() => {
    if (!candidate || !job) return undefined;
    return candidate.matchScores?.[job.id];
  }, [candidate, job]);

  const latestShortlist = useMemo(() => {
    return artifacts.find((a) => a.decisionType === 'shortlist_analysis') ?? null;
  }, [artifacts]);

  const evidencePack = useMemo<EvidencePack | null>(() => {
    const pack = (latestShortlist?.details as any)?.evidencePack;
    return pack && typeof pack === 'object' ? (pack as EvidencePack) : null;
  }, [latestShortlist]);

  const currentStage = useMemo(() => {
    if (!candidate || !job) return null;
    const fromCandidate = normalizeStage((candidate as any).pipelineStage?.[job.id] || (candidate as any).stage);
    if (fromCandidate) return fromCandidate;
    const latestEvent = events.find((e) => e.jobId === job.id);
    return normalizeStage(latestEvent?.toStage) || null;
  }, [candidate, job, events]);

  const requiredSkills = useMemo(() => (job?.requiredSkills || []).filter(Boolean), [job]);
  const candidateSkills = useMemo(() => (candidate?.skills || []).filter(Boolean), [candidate]);
  const matchedSkills = useMemo(() => intersection(candidateSkills, requiredSkills).slice(0, 12), [candidateSkills, requiredSkills]);
  const missingSkills = useMemo(() => difference(requiredSkills, candidateSkills).slice(0, 12), [candidateSkills, requiredSkills]);

  const verifiedPassport = useMemo(() => {
    const fromCandidate = (candidate as any)?.passport;
    const fromMeta = (candidate as any)?.metadata?.passport;
    return fromCandidate ?? fromMeta ?? null;
  }, [candidate]);

  const verifiedSkills = useMemo(() => {
    const list = verifiedPassport?.verifiedSkills;
    return Array.isArray(list) ? list : [];
  }, [verifiedPassport]);

  const verifiedBadges = useMemo(() => {
    const list = verifiedPassport?.badges;
    return Array.isArray(list) ? list : [];
  }, [verifiedPassport]);

  const assessmentHistory = useMemo(() => {
    const list = (candidate as any)?.metadata?.assessmentHistory;
    return Array.isArray(list) ? list : [];
  }, [candidate]);

  const nextAction = useMemo(() => {
    if (!candidate || !job) return null;
    const screeningsByJob = new Map<string, { passed: boolean }[]>();
    const shortlistByJob = new Map<string, DecisionArtifactRecord[]>();
    const screening = artifacts.filter((a) => a.jobId === job.id && a.decisionType === 'screening').map((a) => ({ passed: a.decision !== 'FAIL' }));
    const shortlist = artifacts.filter((a) => a.jobId === job.id && a.decisionType === 'shortlist_analysis');
    if (screening.length) screeningsByJob.set(job.id, screening);
    if (shortlist.length) shortlistByJob.set(job.id, shortlist);

	    return determineNextAction({
	      candidateId: candidate.id,
	      pipelineStageByJobId: (candidate as any).pipelineStage || {},
	      jobMatches: [{ job, score: typeof matchScore === 'number' ? matchScore : 0 }],
	      pipelineEvents: events,
	      screeningsByJob,
	      shortlistByJob,
	      scorecards: scorecard ? { [job.id]: scorecard } : {}
	    });
  }, [artifacts, candidate, events, job, matchScore, scorecard]);

  useEffect(() => {
    if (!isOpen || !candidate || !job) return;
    let cancelled = false;

    setIsLoading(true);
    Promise.all([
      decisionArtifactService.listArtifactsForCandidate({ candidateId: candidate.id, limit: 250 }),
      pipelineEventService.listForCandidate(candidate.id, 150),
      recruitingScorecardService.listForCandidate(candidate.id, 1, 250)
    ])
      .then(([artifactRows, eventRows, scorecards]) => {
        if (cancelled) return;
        setArtifacts((artifactRows || []).filter((a) => a.jobId === job.id));
        setEvents((eventRows || []).filter((e) => e.jobId === job.id));
        setScorecard(scorecards.find((s) => s.jobId === job.id) ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [candidate, isOpen, job]);

  useEffect(() => {
    if (isOpen) setTab('summary');
  }, [isOpen]);

  if (!isOpen || !candidate || !job) return null;

  const isInPipeline = Boolean((candidate as any).pipelineStage?.[job.id] || (candidate as any).stage);

  const openDispositionCapture = (stage: PipelineStage) => {
    setPendingDispositionStage(stage);
    setPendingDispositionFromStage(currentStage);
    setDispositionModalOpen(true);
  };

  const closeDispositionCapture = () => {
    setDispositionModalOpen(false);
    setPendingDispositionStage(null);
    setPendingDispositionFromStage(null);
  };

  const handleStageChange = (nextStage: PipelineStage) => {
    if (nextStage === 'rejected' || nextStage === 'offer' || nextStage === 'hired') {
      openDispositionCapture(nextStage);
      return;
    }
    onUpdateCandidateStage(candidate.id, job.id, nextStage);
  };

  const handleDispositionSubmit = async (payload: DispositionPayload) => {
    const toStage = payload.stage;
    const fromStage = pendingDispositionFromStage ?? currentStage ?? undefined;
    const reason =
      payload.reasonCode === 'other'
        ? (payload.reasonText || '').trim() || 'other'
        : payload.reasonCode;

    await pipelineEventService.logEvent({
      candidateId: candidate.id,
      candidateName: candidate.name,
      jobId: job.id,
      jobTitle: job.title,
      eventType: 'DISPOSITION_RECORDED',
      actorType: 'user',
      fromStage: fromStage ?? undefined,
      toStage,
      summary: `${stageLabel(toStage)} — ${reason}`,
      metadata: {
        disposition: payload,
        capturedAt: new Date().toISOString()
      }
    });

    closeDispositionCapture();
    onUpdateCandidateStage(candidate.id, job.id, toStage);

    const refreshed = await pipelineEventService.listForCandidate(candidate.id, 150);
    setEvents((refreshed || []).filter((e) => e.jobId === job.id));
  };

  const handlePrimaryAction = async () => {
    if (!nextAction) return;
    if (nextAction.type === 'add_pipeline') {
      onAddToPipeline(candidate, nextAction.job.id);
      return;
    }
    if (nextAction.type === 'move_rejected') {
      openDispositionCapture('rejected');
      return;
    }
    if (nextAction.type === 'request_screening') {
      const email = candidate.email || `${candidate.id}@example.com`;
      autonomousScreeningAgent.requestScreening({
        candidateId: candidate.id,
        candidateName: candidate.name,
        candidateEmail: email,
        jobId: job.id,
        jobTitle: job.title,
        jobRequirements: job.requiredSkills || [],
        addedAt: new Date(),
        candidateSnapshot: toCandidateSnapshot(candidate),
        jobSnapshot: toJobSnapshot(job)
      });
      onUpdateCandidateStage(candidate.id, job.id, 'screening');
      return;
    }
    if (nextAction.type === 'schedule_interview') {
      setScheduleModalOpen(true);
      return;
    }
  };

  const latestArtifact = (type: DecisionArtifactRecord['decisionType']) =>
    artifacts.find((a) => a.decisionType === type) ?? null;

  const shortlistArtifact = latestArtifact('shortlist_analysis');
  const screeningArtifact = latestArtifact('screening');
  const interviewArtifact = latestArtifact('interview');
  const truthCheckArtifact = useMemo(() => {
    return artifacts.find((a) => a.decisionType === 'screening' && a.externalId === 'truth_check_v1') ?? null;
  }, [artifacts]);

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="h-full w-full sm:w-[620px] bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Candidate pipeline details: ${candidate.name}`}
      >
        <div className="p-5 border-b border-slate-700 bg-slate-900/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xl font-bold text-white truncate">{candidate.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full">
                  <Briefcase className="h-3 w-3 text-sky-400" />
                  <span className="truncate">{job.title}</span>
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full">
                  <MapPin className="h-3 w-3 text-sky-400" />
                  <span className="truncate">{job.location}</span>
                </span>
                <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full">
                  <Layers className="h-3 w-3 text-sky-400" />
                  <span>{stageLabel(currentStage)}</span>
                </span>
                {typeof matchScore === 'number' && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${matchScore >= 70 ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'}`}>
                    {matchScore}% match
                  </span>
                )}
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

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('summary')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${tab === 'summary' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:text-white'}`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setTab('evidence')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${tab === 'evidence' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:text-white'}`}
            >
              Evidence
            </button>
            <button
              type="button"
              onClick={() => setTab('artifacts')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${tab === 'artifacts' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:text-white'}`}
            >
              Artifacts
            </button>
            <button
              type="button"
              onClick={() => setTab('timeline')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${tab === 'timeline' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:text-white'}`}
            >
              Timeline
            </button>

            <div className="ml-auto flex items-center gap-2">
              {onOpenCandidateProfile && (
                <button
                  type="button"
                  onClick={() => onOpenCandidateProfile(candidate)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/30 text-slate-200 hover:bg-slate-900/60 text-xs inline-flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Profile
                </button>
              )}
            </div>
          </div>

          {nextAction && (
            <div className="mt-4 p-3 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-sky-500/10 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/25">
                <Sparkles className="h-4 w-4 text-purple-200" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{nextAction.label}</div>
                <div className="text-xs text-slate-300 truncate">{nextAction.description}</div>
              </div>
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="ml-auto px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                <span>Do it</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-5 space-y-4">
          {isLoading && <div className="text-xs text-slate-400">Loading context...</div>}

          {tab === 'summary' && (
            <>
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-100 mb-2">Recruiting Scorecard</div>
                {scorecard ? (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-3xl font-bold text-sky-300">{scorecard.overallScore}/100</div>
                      <div className="text-xs text-slate-400 mt-1">Confidence: {Math.round((scorecard.confidence ?? 0) * 100)}%</div>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1">
                      {Object.values(scorecard.dimensions || {}).map((dim) => (
                        <div key={dim.key} className="flex items-center justify-between gap-3">
                          <span className="uppercase text-[10px] text-slate-400">{dim.key.replace('_', ' ')}</span>
                          <span className="font-semibold text-slate-200">{dim.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">No scorecard saved yet. Run semantic match or screening to generate signals.</div>
                )}
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-100 mb-2">Verified Skills (Assessments)</div>
                {verifiedSkills.length === 0 ? (
                  <div className="text-xs text-slate-400">
                    No verified skills recorded yet. Record an assessment and apply the proposal from Agent Inbox.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {verifiedBadges.slice(0, 8).map((b: string) => (
                        <span
                          key={b}
                          className="inline-flex items-center px-2 py-1 rounded-full text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-200"
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {verifiedSkills
                        .slice()
                        .sort((a: any, b: any) => Number(b?.proficiencyLevel ?? 0) - Number(a?.proficiencyLevel ?? 0))
                        .slice(0, 10)
                        .map((s: any) => (
                          <div key={`${s.skillName}_${s.verifiedAt || ''}`} className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white truncate">{s.skillName}</div>
                                <div className="text-[11px] text-slate-400 mt-1">
                                  Level {Number(s.proficiencyLevel ?? 0)}/5 • {levelLabel(Number(s.proficiencyLevel ?? 0))}
                                  {s.source ? ` • ${s.source}` : ''}
                                </div>
                              </div>
                              <div className="text-right text-[11px] text-slate-400 whitespace-nowrap">
                                {formatDateTime(s.verifiedAt)}
                              </div>
                            </div>

                            {s.evidenceLink ? (
                              <a
                                href={s.evidenceLink}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-2 text-xs text-sky-300 hover:text-sky-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                                Evidence
                              </a>
                            ) : null}
                          </div>
                        ))}
                    </div>

                    {assessmentHistory.length ? (
                      <div className="pt-2 border-t border-slate-700">
                        <div className="text-xs font-semibold text-slate-200 mb-2">Recent assessments</div>
                        <div className="space-y-2">
                          {assessmentHistory.slice(0, 3).map((a: any) => (
                            <div key={a.id ?? `${a.title}_${a.dateCompleted || ''}`} className="text-[11px] text-slate-300 bg-slate-900/40 border border-slate-700 rounded-lg p-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <span className="font-semibold text-white">{a.title || 'Assessment'}</span>
                                  {typeof a.score === 'number' ? <span className="text-slate-400"> • {a.score}/100</span> : null}
                                </div>
                                <div className="text-slate-500 whitespace-nowrap">{formatDateTime(a.dateCompleted)}</div>
                              </div>
                              {Array.isArray(a.skillsValidated) && a.skillsValidated.length ? (
                                <div className="text-slate-400 mt-1 line-clamp-1">{a.skillsValidated.slice(0, 10).join(', ')}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-100 mb-2">Latest Decisions</div>
                <div className="grid grid-cols-1 gap-3">
                  {[{ label: 'Shortlist', art: shortlistArtifact }, { label: 'Screening', art: screeningArtifact }, { label: 'Interview', art: interviewArtifact }].map(({ label, art }) => (
                    <div key={label} className="flex items-start justify-between gap-3 bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{label}</div>
                        {art ? (
                          <div className="text-xs text-slate-300 mt-1">
                            <span className="font-semibold">{art.decision}</span>
                            {typeof art.score === 'number' ? <span> • {art.score}/100</span> : null}
                            <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{art.summary || 'No summary saved.'}</div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 mt-1">No artifact yet.</div>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{art ? formatDateTime(art.createdAt) : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'evidence' && (
            <div className="space-y-4">
              {evidencePack ? (
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">Evidence Pack</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Confidence: {Math.round((evidencePack.confidence ?? 0) * 100)}% · Missing: {(evidencePack.missing || []).slice(0, 3).join(' · ') || 'None'}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(evidencePack.createdAt)}</div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(evidencePack.matchReasons || []).slice(0, 3).map((r, idx) => (
                      <div key={`${idx}-${r.title}`} className="text-xs text-slate-200">
                        <span className="text-slate-400">{idx + 1}.</span> {r.claim}
                        {r.snippet?.text ? <span className="text-slate-400">{` “${r.snippet.text}”`}</span> : null}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-amber-200">
                    <span className="font-semibold text-amber-300">Risk:</span> {evidencePack.risk?.statement}{' '}
                    <span className="text-slate-300">{evidencePack.risk?.mitigation}</span>
                  </div>

                  <div className="mt-3 space-y-1">
                    {(evidencePack.truthCheckPreviewQuestions || []).slice(0, 2).map((q, idx) => (
                      <div key={`${idx}-${q}`} className="text-[11px] text-slate-300">
                        <span className="text-slate-400">Truth-check:</span> {q}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                <div className="text-sm font-semibold text-slate-100 mb-3">Semantic Evidence</div>
                <div className="text-xs text-slate-400 mb-2">Matched skills</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {matchedSkills.length ? (
                    matchedSkills.map((s) => (
                      <span key={s} className="text-[11px] px-2 py-1 rounded-full bg-green-500/10 border border-green-500/25 text-green-200">
                        {s}
                      </span>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No exact skill overlap detected.</div>
                  )}
                </div>

                <div className="text-xs text-slate-400 mb-2">Missing required skills</div>
                <div className="flex flex-wrap gap-2">
                  {missingSkills.length ? (
                    missingSkills.map((s) => (
                      <span key={s} className="text-[11px] px-2 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-200">
                        {s}
                      </span>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No gaps found against required skills.</div>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Graph Insights (Beta)</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Read-only explanation layer. Uses cached match lists when available.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGraphOpen((v) => !v)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      graphOpen
                        ? 'bg-sky-500/15 text-sky-200 border-sky-500/40'
                        : 'bg-slate-900/30 text-slate-200 border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    {graphOpen ? 'Hide' : 'Show'}
                  </button>
                </div>

                {graphOpen ? (
                  <div className="mt-4">
                    {graphLoading ? (
                      <div className="text-xs text-slate-400">Loading graph cohort…</div>
                    ) : null}
                    {job ? <GraphExplorer job={job} candidates={graphCandidates} /> : null}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500">
                    Turn this on to see relationship-based explanations alongside semantic evidence.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'artifacts' && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-100 mb-3">Artifacts (saved)</div>
              {artifacts.length ? (
                <div className="space-y-3">
                  {artifacts.map((a) => (
                    <div key={a.id} className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200">
                            {a.decisionType} • {a.decision}
                            {typeof a.score === 'number' ? ` • ${a.score}/100` : ''}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">{a.summary || 'No summary.'}</div>
                        </div>
                        <div className="text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(a.createdAt)}</div>
                      </div>
                      {a.decisionType === 'screening' && Array.isArray((a.details as any)?.questions) && (
                        <div className="mt-2 text-[11px] text-slate-300">
                          Q/A: {((a.details as any).questions as any[]).length} questions
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No artifacts stored for this job yet.</div>
              )}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-100 mb-3">Pipeline Events</div>
              {events.length ? (
                <div className="space-y-3">
                  {events.map((e) => (
                    <div key={e.id} className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-200">{e.eventType}</div>
                          <div className="text-[11px] text-slate-300 mt-1">{e.summary}</div>
                          {typeof (e.metadata as any)?.disposition === 'object' && (e.metadata as any)?.disposition ? (
                            <div className="mt-2 text-[11px] text-slate-300 space-y-1">
                              <div className="text-slate-400">
                                Reason:{' '}
                                <span className="text-slate-200">
                                  {(e.metadata as any).disposition.reasonCode === 'other'
                                    ? (e.metadata as any).disposition.reasonText || 'other'
                                    : (e.metadata as any).disposition.reasonCode}
                                </span>
                              </div>
                              {(e.metadata as any).disposition.notes ? (
                                <div className="text-slate-400">
                                  Notes: <span className="text-slate-200">{(e.metadata as any).disposition.notes}</span>
                                </div>
                              ) : null}
                              {(e.metadata as any).disposition.compDelta ? (
                                <div className="text-slate-400">
                                  Comp delta: <span className="text-slate-200">{(e.metadata as any).disposition.compDelta}</span>
                                </div>
                              ) : null}
                              {(e.metadata as any).disposition.competingOffer ? (
                                <div className="text-slate-400">
                                  Competing offer:{' '}
                                  <span className="text-slate-200">{(e.metadata as any).disposition.competingOffer}</span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {(e.fromStage || e.toStage) && (
                            <div className="text-[11px] text-slate-500 mt-1">
                              {e.fromStage || '?'} → {e.toStage || '?'} • {e.actorType}
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(e.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No pipeline events logged for this candidate + job yet.</div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-700 bg-slate-900/60 space-y-3">
          <div className="flex items-center gap-2">
            {!isInPipeline ? (
              <button
                type="button"
                onClick={() => onAddToPipeline(candidate, job.id)}
                className="flex-1 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold"
              >
                Add to Pipeline
              </button>
            ) : (
              <>
                <label className="text-xs text-slate-400">Move stage</label>
                <select
                  value={currentStage || 'new'}
                  onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="sourced">Sourced</option>
                  <option value="new">New</option>
                  <option value="long_list">Long List</option>
                  <option value="screening">Screening</option>
                  <option value="scheduling">Interview Scheduling</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="hired">Hired</option>
                  <option value="rejected">Rejected</option>
                </select>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTruthCheckOpen(true)}
              className="px-3 py-2 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-200 hover:bg-purple-600/25 text-sm font-semibold"
            >
              Pre‑HM Truth Check
            </button>
            <button
              type="button"
              onClick={() => {
                const email = candidate.email || `${candidate.id}@example.com`;
                autonomousScreeningAgent.requestScreening({
                  candidateId: candidate.id,
                  candidateName: candidate.name,
                  candidateEmail: email,
                  jobId: job.id,
                  jobTitle: job.title,
                  jobRequirements: job.requiredSkills || [],
                  addedAt: new Date(),
                  candidateSnapshot: toCandidateSnapshot(candidate),
                  jobSnapshot: toJobSnapshot(job)
                });
                onUpdateCandidateStage(candidate.id, job.id, 'screening');
              }}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-sm font-semibold"
            >
              Request Screening
            </button>
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              className="col-span-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </button>
            <button
              type="button"
              onClick={() => openDispositionCapture('rejected')}
              className="col-span-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-200 hover:bg-red-500/25 text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <UserX className="h-4 w-4" />
              Reject
            </button>
          </div>
        </div>
      </div>

      {scheduleModalOpen && (
        <ScheduleInterviewModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          candidate={candidate as any}
          job={job as any}
        />
      )}

      {pendingDispositionStage && (
        <DispositionReasonModal
          isOpen={dispositionModalOpen}
          stage={pendingDispositionStage}
          candidateName={candidate.name}
          jobTitle={job.title}
          onCancel={closeDispositionCapture}
          onSubmit={handleDispositionSubmit}
        />
      )}

      {truthCheckOpen ? (
        <PreHmTruthCheckModal
          isOpen={truthCheckOpen}
          candidate={candidate}
          job={job}
          existingArtifact={truthCheckArtifact}
          onClose={() => setTruthCheckOpen(false)}
          onSaved={async () => {
            const artifactRows = await decisionArtifactService.listArtifactsForCandidate({ candidateId: candidate.id, limit: 250 });
            setArtifacts((artifactRows || []).filter((a) => a.jobId === job.id));
          }}
        />
      ) : null}
    </div>
  );
};

export default CandidateJobDrawer;
