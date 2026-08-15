import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckSquare2,
  CircleAlert,
  Clock3,
  Columns3,
  Filter,
  List,
  Mail,
  MessageSquare,
  PauseCircle,
  Search,
  Undo2,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { Candidate, Job, PipelineStage } from '../types';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { pipelineEventService } from '../services/PipelineEventService';
import RequisitionHealthPanel from './RequisitionHealthPanel';
import { useCandidateJobDrawer } from '../contexts/CandidateJobDrawerContext';

type Lane = {
  id: 'review' | 'screening' | 'interview' | 'offer' | 'outcome';
  label: string;
  stages: PipelineStage[];
  nextStage?: PipelineStage;
  nextAction: string;
  tone: 'sky' | 'violet' | 'amber' | 'emerald' | 'slate';
};

type ViewMode = 'board' | 'list';
type AttentionFilter = 'all' | 'needs-action' | 'aging' | 'feedback';
type SortMode = 'priority' | 'match' | 'age';
type DecisionAction = 'advance' | 'hold' | 'release-hold' | 'reject';
type PendingDecision = { action: DecisionAction; candidates: Candidate[] };
type UndoRecord = { candidateId: string; previousStage: PipelineStage; previousHold?: NonNullable<Candidate['pipelineHolds']>[string]; stageChanged: boolean };

const LANES: Lane[] = [
  { id: 'review', label: 'Review', stages: ['sourced', 'new', 'long_list'], nextStage: 'screening', nextAction: 'Request screening', tone: 'sky' },
  { id: 'screening', label: 'Screening', stages: ['screening'], nextStage: 'scheduling', nextAction: 'Schedule interview', tone: 'violet' },
  { id: 'interview', label: 'Interview', stages: ['scheduling', 'interview'], nextStage: 'offer', nextAction: 'Prepare offer', tone: 'amber' },
  { id: 'offer', label: 'Offer', stages: ['offer'], nextStage: 'hired', nextAction: 'Mark hired', tone: 'emerald' },
  { id: 'outcome', label: 'Outcome', stages: ['hired', 'rejected'], nextAction: 'View decision', tone: 'slate' },
];

const ACTIVE_STAGES: PipelineStage[] = ['sourced', 'new', 'long_list', 'screening', 'scheduling', 'interview', 'offer'];

function normalize(value: unknown): PipelineStage {
  const stage = String(value ?? '').toLowerCase();
  if (stage === 'sourcing' || stage === 'contacted') return 'new';
  return (['sourced', 'new', 'long_list', 'screening', 'scheduling', 'interview', 'offer', 'hired', 'rejected'].includes(stage) ? stage : 'new') as PipelineStage;
}

function latestStageDate(candidate: Candidate, jobId: string) {
  return [...(candidate.pipelineHistory ?? [])]
    .filter((entry) => entry.jobId === jobId)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0]?.timestamp;
}

function stageAge(candidate: Candidate, jobId: string) {
  const timestamp = latestStageDate(candidate, jobId);
  if (!timestamp) return null;
  const elapsed = Date.now() - Date.parse(timestamp);
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 86_400_000)) : null;
}

function daysSince(value?: string) {
  if (!value) return null;
  const elapsed = Date.now() - Date.parse(value);
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 86_400_000)) : null;
}

function stageSla(job: Job) {
  const health = job.companyContext?.requisitionHealth;
  if (!health || typeof health !== 'object') return 5;
  const configured = Number((health as { stageSlaDays?: number }).stageSlaDays);
  return configured > 0 ? configured : 5;
}

function sourceLabel(candidate: Candidate) {
  if (candidate.type === 'internal') return 'Internal';
  if (candidate.type === 'past') return 'Previous applicant';
  return 'Uploaded';
}

function candidateOwner(candidate: Candidate) {
  const metadata = candidate.metadata ?? {};
  const owner = metadata.recruiterOwner ?? metadata.owner ?? metadata.assignedTo;
  return typeof owner === 'string' && owner.trim() ? owner.trim() : 'Unassigned';
}

function laneFor(candidate: Candidate, jobId: string) {
  const stage = normalize(candidate.pipelineStage?.[jobId]);
  return LANES.find((lane) => lane.stages.includes(stage)) ?? LANES[0];
}

function feedbackPending(candidate: Candidate, jobId: string) {
  const lane = laneFor(candidate, jobId);
  return (lane.id === 'screening' || lane.id === 'interview') && (!candidate.feedback?.[jobId] || candidate.feedback[jobId] === 'none');
}

function nextStageFor(candidate: Candidate, jobId: string) {
  return laneFor(candidate, jobId).nextStage;
}

const RecruiterPipelineWorkspace: React.FC<{
  job?: Job;
  onUpdateCandidateStage: (candidateId: string, jobId: string, stage: PipelineStage) => void;
  onUpdateCandidate: (candidateId: string, updatedData: Partial<Candidate>) => void;
}> = ({ job, onUpdateCandidateStage, onUpdateCandidate }) => {
  const navigate = useNavigate();
  const drawerContext = useCandidateJobDrawer();
  const { showToast } = useToast();
  const { internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const [slaDays, setSlaDays] = useState(() => job ? stageSla(job) : 5);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [query, setQuery] = useState('');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);
  const [undoBatch, setUndoBatch] = useState<{ label: string; records: UndoRecord[]; expiresAt: number } | null>(null);
  const handleStageSlaChange = useCallback((days: number) => setSlaDays(days), []);
  const allCandidates = useMemo(
    () => [...internalCandidates, ...pastCandidates, ...uploadedCandidates],
    [internalCandidates, pastCandidates, uploadedCandidates],
  );

  const laneCandidates = useMemo(() => {
    const result = new Map<Lane['id'], Candidate[]>();
    LANES.forEach((lane) => result.set(lane.id, []));
    if (!job) return result;

    allCandidates.forEach((candidate) => {
      if (candidate.matchScores?.[job.id] === undefined && !candidate.pipelineStage?.[job.id]) return;
      const current = normalize(candidate.pipelineStage?.[job.id]);
      const lane = LANES.find((item) => item.stages.includes(current)) ?? LANES[0];
      result.get(lane.id)?.push(candidate);
    });
    result.forEach((candidates) => candidates.sort((a, b) => (b.matchScores?.[job.id] ?? 0) - (a.matchScores?.[job.id] ?? 0)));
    return result;
  }, [allCandidates, job]);

  useEffect(() => {
    setSlaDays(job ? stageSla(job) : 5);
    setSelectedIds(new Set());
    setPendingDecision(null);
  }, [job]);

  useEffect(() => {
    if (!undoBatch) return;
    const timeout = window.setTimeout(() => setUndoBatch(null), Math.max(0, undoBatch.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [undoBatch]);

  if (!job) {
    return <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/60 p-10 text-center">
      <BriefcaseBusiness className="h-9 w-9 text-slate-500" />
      <h2 className="mt-4 text-xl font-bold text-white">Choose a requisition</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">Select a role to review pipeline health, stage aging, and the next recruiter decision.</p>
    </div>;
  }

  const candidates = Array.from(laneCandidates.values()).flat();
  const total = candidates.length;
  const readOnly = job.status !== 'open';
  const agingCount = candidates.filter((candidate) => {
    const stage = normalize(candidate.pipelineStage?.[job.id]);
    const age = stageAge(candidate, job.id);
    return ACTIVE_STAGES.includes(stage) && age !== null && age >= slaDays;
  }).length;
  const activeCount = candidates.filter((candidate) => ACTIVE_STAGES.includes(normalize(candidate.pipelineStage?.[job.id]))).length;
  const scoredCandidates = candidates.filter((candidate) => candidate.matchScores?.[job.id] !== undefined);
  const averageMatch = scoredCandidates.length
    ? Math.round(scoredCandidates.reduce((sum, candidate) => sum + (candidate.matchScores?.[job.id] ?? 0), 0) / scoredCandidates.length)
    : null;
  const daysOpen = daysSince(job.postedDate ?? job.posted);
  const lastActivity = candidates
    .map((candidate) => latestStageDate(candidate, job.id))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  const ownerOptions = [...new Set(candidates.map(candidateOwner))].sort();
  const visibleCandidates = candidates.filter((candidate) => {
    const searchable = `${candidate.name} ${candidate.currentRole ?? candidate.role ?? ''} ${candidate.location ?? ''} ${(candidate.skills ?? []).join(' ')}`.toLowerCase();
    const age = stageAge(candidate, job.id);
    const lane = laneFor(candidate, job.id);
    const isAging = age !== null && age >= slaDays && lane.id !== 'outcome';
    const isFeedbackPending = feedbackPending(candidate, job.id);
    const needsAction = !candidate.pipelineHolds?.[job.id] && lane.id !== 'outcome' && (isAging || isFeedbackPending || age === null);
    if (query.trim() && !searchable.includes(query.trim().toLowerCase())) return false;
    if (attentionFilter === 'needs-action' && !needsAction) return false;
    if (attentionFilter === 'aging' && !isAging) return false;
    if (attentionFilter === 'feedback' && !isFeedbackPending) return false;
    if (sourceFilter !== 'all' && candidate.type !== sourceFilter) return false;
    if (stageFilter !== 'all' && lane.id !== stageFilter) return false;
    if (ownerFilter !== 'all' && candidateOwner(candidate) !== ownerFilter) return false;
    return true;
  }).sort((a, b) => {
    const ageA = stageAge(a, job.id) ?? -1;
    const ageB = stageAge(b, job.id) ?? -1;
    if (sortMode === 'age') return ageB - ageA;
    if (sortMode === 'match') return (b.matchScores?.[job.id] ?? 0) - (a.matchScores?.[job.id] ?? 0);
    const priority = (candidate: Candidate, age: number) => (age >= slaDays ? 100 : 0) + (feedbackPending(candidate, job.id) ? 60 : 0) + (candidate.pipelineHolds?.[job.id] ? -30 : 0) + Math.max(0, age);
    return priority(b, ageB) - priority(a, ageA) || (b.matchScores?.[job.id] ?? 0) - (a.matchScores?.[job.id] ?? 0);
  });
  const visibleByLane = new Map<Lane['id'], Candidate[]>();
  LANES.forEach((lane) => visibleByLane.set(lane.id, visibleCandidates.filter((candidate) => laneFor(candidate, job.id).id === lane.id)));
  const selectedCandidates = visibleCandidates.filter((candidate) => selectedIds.has(candidate.id));
  const allVisibleSelected = visibleCandidates.length > 0 && visibleCandidates.every((candidate) => selectedIds.has(candidate.id));

  const openCandidate = (candidate: Candidate) => {
    if (drawerContext) drawerContext.openCandidateJobDrawer(candidate, job);
    else navigate(`/candidates/${candidate.id}`);
  };

  const toggleSelected = (candidateId: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(candidateId)) next.delete(candidateId);
    else next.add(candidateId);
    return next;
  });

  const toggleAllVisible = () => setSelectedIds((current) => {
    const next = new Set(current);
    if (allVisibleSelected) visibleCandidates.forEach((candidate) => next.delete(candidate.id));
    else visibleCandidates.forEach((candidate) => next.add(candidate.id));
    return next;
  });

  const logRequest = (targets: Candidate[], type: 'CONTACT' | 'FEEDBACK') => {
    if (readOnly || !targets.length) return;
    targets.forEach((candidate) => void pipelineEventService.logEvent({
      candidateId: candidate.id,
      candidateName: candidate.name,
      jobId: job.id,
      jobTitle: job.title,
      eventType: `RECRUITER_${type}_REQUESTED`,
      actorType: 'user',
      summary: type === 'CONTACT' ? 'Recruiter initiated candidate outreach.' : 'Recruiter requested hiring-manager feedback.',
    }));
    showToast(type === 'CONTACT' ? `Outreach recorded for ${targets.length} candidate${targets.length === 1 ? '' : 's'}.` : `Feedback requested for ${targets.length} candidate${targets.length === 1 ? '' : 's'}.`, 'success');
    if (type === 'CONTACT') {
      const emails = targets.map((candidate) => candidate.email).filter((email): email is string => Boolean(email));
      if (emails.length) window.location.href = emails.length === 1 ? `mailto:${emails[0]}` : `mailto:?bcc=${encodeURIComponent(emails.join(','))}`;
    }
  };

  const requestDecision = (action: DecisionAction, targets: Candidate[]) => {
    if (readOnly || !targets.length) return;
    const eligible = action === 'advance' ? targets.filter((candidate) => Boolean(nextStageFor(candidate, job.id)) && !candidate.pipelineHolds?.[job.id]) : targets;
    if (!eligible.length) {
      showToast('No selected candidates can be advanced from their current stage.', 'warning');
      return;
    }
    setPendingDecision({ action, candidates: eligible });
  };

  const applyDecision = (reason: string) => {
    if (!pendingDecision) return;
    const records: UndoRecord[] = [];
    pendingDecision.candidates.forEach((candidate) => {
      const previousStage = normalize(candidate.pipelineStage?.[job.id]);
      const previousHold = candidate.pipelineHolds?.[job.id];
      records.push({ candidateId: candidate.id, previousStage, previousHold, stageChanged: pendingDecision.action === 'advance' || pendingDecision.action === 'reject' });

      if (pendingDecision.action === 'hold' || pendingDecision.action === 'release-hold') {
        const holds = { ...(candidate.pipelineHolds ?? {}) };
        if (pendingDecision.action === 'hold') holds[job.id] = { heldAt: new Date().toISOString(), reason, actorType: 'user' };
        else delete holds[job.id];
        onUpdateCandidate(candidate.id, { pipelineHolds: holds });
      } else {
        const toStage = pendingDecision.action === 'reject' ? 'rejected' : nextStageFor(candidate, job.id);
        if (!toStage) return;
        onUpdateCandidateStage(candidate.id, job.id, toStage);
      }

      const toStage = pendingDecision.action === 'reject' ? 'rejected' : pendingDecision.action === 'advance' ? nextStageFor(candidate, job.id) : previousStage;
      void pipelineEventService.logEvent({
        candidateId: candidate.id,
        candidateName: candidate.name,
        jobId: job.id,
        jobTitle: job.title,
        eventType: pendingDecision.action === 'advance' ? 'RECRUITER_STAGE_ADVANCED' : pendingDecision.action === 'reject' ? 'RECRUITER_REJECTED' : pendingDecision.action === 'hold' ? 'RECRUITER_HOLD_PLACED' : 'RECRUITER_HOLD_RELEASED',
        actorType: 'user',
        fromStage: previousStage,
        toStage,
        summary: `${pendingDecision.action.replace('-', ' ')} confirmed: ${reason}`,
        metadata: { reason },
      });
    });
    const label = `${pendingDecision.action.replace('-', ' ')} applied to ${pendingDecision.candidates.length} candidate${pendingDecision.candidates.length === 1 ? '' : 's'}`;
    setUndoBatch({ label, records, expiresAt: Date.now() + 10_000 });
    setSelectedIds(new Set());
    setPendingDecision(null);
    showToast(label, pendingDecision.action === 'reject' ? 'info' : 'success');
  };

  const undoLastDecision = () => {
    if (!undoBatch) return;
    undoBatch.records.forEach((record) => {
      const candidate = candidates.find((item) => item.id === record.candidateId);
      if (!candidate) return;
      if (record.stageChanged) onUpdateCandidateStage(candidate.id, job.id, record.previousStage);
      const holds = { ...(candidate.pipelineHolds ?? {}) };
      if (record.previousHold) holds[job.id] = record.previousHold;
      else delete holds[job.id];
      onUpdateCandidate(candidate.id, { pipelineHolds: holds });
      void pipelineEventService.logEvent({ candidateId: candidate.id, candidateName: candidate.name, jobId: job.id, jobTitle: job.title, eventType: 'RECRUITER_DECISION_UNDONE', actorType: 'user', toStage: record.previousStage, summary: 'Recruiter undid the previous pipeline decision.' });
    });
    setUndoBatch(null);
    showToast('Previous pipeline decision reverted.', 'info');
  };

  return <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/70">
    <header className="shrink-0 border-b border-slate-700 bg-slate-900/40 p-4 lg:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-300">Pipeline operations</p>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize ${job.status === 'open' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : job.status === 'on hold' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-slate-500/30 bg-slate-500/10 text-slate-300'}`}>{job.status}</span>
          </div>
          <h1 className="mt-1 truncate text-2xl font-bold text-white">{job.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{job.department} · {job.location}{daysOpen !== null ? ` · ${daysOpen} days open` : ''}{lastActivity ? ` · Last activity ${new Date(lastActivity).toLocaleDateString()}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate(`/requisitions/${job.id}`)} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-bold text-white hover:bg-sky-400"><Search className="h-4 w-4" />Find talent</button>
          <button type="button" onClick={() => navigate(`/requisitions/${job.id}`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700">Open requisition <ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <OperatingMetric label="Pipeline" value={total} detail="total candidates" />
        <OperatingMetric label="Active" value={activeCount} detail="awaiting outcome" />
        <OperatingMetric label="Stage aging" value={agingCount} detail={`at or beyond ${slaDays}d`} warning={agingCount > 0} />
        <OperatingMetric label="Average match" value={averageMatch === null ? '—' : `${averageMatch}%`} detail="scored candidates" />
      </div>

      {readOnly && <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div><p className="font-bold">Pipeline movement is paused</p><p className="mt-0.5 text-xs text-amber-200/80">This requisition is {job.status}. Candidate records remain available, but stage changes and outreach actions are read-only.</p></div>
      </div>}
    </header>

    {undoBatch && <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sky-400/20 bg-sky-400/10 px-4 py-2.5">
      <p className="text-sm text-sky-100"><span className="font-bold capitalize">{undoBatch.label}.</span> You can reverse this decision for 10 seconds.</p>
      <div className="flex items-center gap-2"><button type="button" onClick={undoLastDecision} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300/30 px-3 py-1.5 text-xs font-bold text-sky-100 hover:bg-sky-300/10"><Undo2 className="h-3.5 w-3.5" />Undo</button><button type="button" onClick={() => setUndoBatch(null)} className="rounded p-1.5 text-sky-200/70 hover:bg-sky-300/10 hover:text-white" aria-label="Dismiss undo"><X className="h-4 w-4" /></button></div>
    </div>}

    <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
      <RequisitionHealthPanel job={job} compact readOnly={readOnly} onStageSlaChange={handleStageSlaChange} />

      {total === 0 ? <EmptyPipeline job={job} readOnly={readOnly} onFindTalent={() => navigate(`/requisitions/${job.id}`)} onBrowseTalent={() => navigate('/candidates')} onImport={() => navigate('/ingest')} /> : <>
        <PipelineTriageToolbar
          query={query}
          onQueryChange={setQuery}
          attentionFilter={attentionFilter}
          onAttentionChange={setAttentionFilter}
          sourceFilter={sourceFilter}
          onSourceChange={setSourceFilter}
          stageFilter={stageFilter}
          onStageChange={setStageFilter}
          ownerFilter={ownerFilter}
          onOwnerChange={setOwnerFilter}
          ownerOptions={ownerOptions}
          sortMode={sortMode}
          onSortChange={setSortMode}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          visibleCount={visibleCandidates.length}
          totalCount={total}
        />

        {selectedCandidates.length > 0 && <BulkActionBar
          count={selectedCandidates.length}
          readOnly={readOnly}
          held={selectedCandidates.every((candidate) => Boolean(candidate.pipelineHolds?.[job.id]))}
          onContact={() => logRequest(selectedCandidates, 'CONTACT')}
          onFeedback={() => logRequest(selectedCandidates, 'FEEDBACK')}
          onAdvance={() => requestDecision('advance', selectedCandidates)}
          onHold={() => requestDecision(selectedCandidates.every((candidate) => Boolean(candidate.pipelineHolds?.[job.id])) ? 'release-hold' : 'hold', selectedCandidates)}
          onReject={() => requestDecision('reject', selectedCandidates)}
          onClear={() => setSelectedIds(new Set())}
        />}

        {!visibleCandidates.length ? <FilteredEmpty onClear={() => { setQuery(''); setAttentionFilter('all'); setSourceFilter('all'); setStageFilter('all'); setOwnerFilter('all'); }} /> : viewMode === 'board' ? <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {LANES.map((lane) => <PipelineLane
            key={lane.id}
            lane={lane}
            candidates={visibleByLane.get(lane.id) ?? []}
            job={job}
            readOnly={readOnly}
            slaDays={slaDays}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onAdvance={(candidate) => requestDecision('advance', [candidate])}
            onReject={(candidate) => requestDecision('reject', [candidate])}
            onContact={(candidate) => logRequest([candidate], 'CONTACT')}
            onFeedback={(candidate) => logRequest([candidate], 'FEEDBACK')}
            onOpen={openCandidate}
          />)}
        </div> : <PipelineCandidateList candidates={visibleCandidates} job={job} readOnly={readOnly} slaDays={slaDays} selectedIds={selectedIds} allSelected={allVisibleSelected} onToggleSelected={toggleSelected} onToggleAll={toggleAllVisible} onOpen={openCandidate} onAdvance={(candidate) => requestDecision('advance', [candidate])} onReject={(candidate) => requestDecision('reject', [candidate])} />}
      </>}
    </div>

    <PipelineDecisionModal pending={pendingDecision} job={job} onCancel={() => setPendingDecision(null)} onConfirm={applyDecision} />
  </section>;
};

const PipelineTriageToolbar: React.FC<{
  query: string;
  onQueryChange: (value: string) => void;
  attentionFilter: AttentionFilter;
  onAttentionChange: (value: AttentionFilter) => void;
  sourceFilter: string;
  onSourceChange: (value: string) => void;
  stageFilter: string;
  onStageChange: (value: string) => void;
  ownerFilter: string;
  onOwnerChange: (value: string) => void;
  ownerOptions: string[];
  sortMode: SortMode;
  onSortChange: (value: SortMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  visibleCount: number;
  totalCount: number;
}> = ({ query, onQueryChange, attentionFilter, onAttentionChange, sourceFilter, onSourceChange, stageFilter, onStageChange, ownerFilter, onOwnerChange, ownerOptions, sortMode, onSortChange, viewMode, onViewModeChange, visibleCount, totalCount }) => <section className="mt-4 rounded-xl border border-slate-700 bg-slate-900/35 p-3">
  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
    <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search candidate, role, location or skill" className="w-full rounded-lg border border-slate-600 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label>
    <div className="flex flex-wrap gap-2">
      <SelectControl label="Attention" value={attentionFilter} onChange={(value) => onAttentionChange(value as AttentionFilter)} options={[['all', 'All candidates'], ['needs-action', 'Needs action'], ['aging', 'Beyond SLA'], ['feedback', 'Feedback overdue']]} />
      <SelectControl label="Source" value={sourceFilter} onChange={onSourceChange} options={[['all', 'All sources'], ['internal', 'Internal'], ['past', 'Previous applicant'], ['uploaded', 'Uploaded']]} />
      <SelectControl label="Stage" value={stageFilter} onChange={onStageChange} options={[['all', 'All stages'], ...LANES.map((lane) => [lane.id, lane.label])]} />
      <SelectControl label="Owner" value={ownerFilter} onChange={onOwnerChange} options={[['all', 'All owners'], ...ownerOptions.map((owner) => [owner, owner])]} />
      <SelectControl label="Sort" value={sortMode} onChange={(value) => onSortChange(value as SortMode)} options={[['priority', 'Needs action first'], ['age', 'Oldest stage first'], ['match', 'Highest match first']]} />
    </div>
    <div className="flex items-center justify-between gap-3 xl:justify-end">
      <p className="whitespace-nowrap text-xs text-slate-500"><span className="font-bold text-slate-200">{visibleCount}</span> of {totalCount}</p>
      <div className="flex rounded-lg border border-slate-600 bg-slate-950 p-1" aria-label="Pipeline view">
        <button type="button" onClick={() => onViewModeChange('board')} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold ${viewMode === 'board' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}><Columns3 className="h-3.5 w-3.5" />Board</button>
        <button type="button" onClick={() => onViewModeChange('list')} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold ${viewMode === 'list' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}><List className="h-3.5 w-3.5" />List</button>
      </div>
    </div>
  </div>
</section>;

const SelectControl: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: string[][] }> = ({ label, value, onChange, options }) => <label className="relative"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-950 py-2 pl-3 pr-8 text-xs font-medium text-slate-300 outline-none focus:border-sky-400">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;

const BulkActionBar: React.FC<{ count: number; readOnly: boolean; held: boolean; onContact: () => void; onFeedback: () => void; onAdvance: () => void; onHold: () => void; onReject: () => void; onClear: () => void }> = ({ count, readOnly, held, onContact, onFeedback, onAdvance, onHold, onReject, onClear }) => <div className="sticky top-0 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-400/25 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
  <div className="mr-2 inline-flex items-center gap-2 text-sm font-bold text-white"><CheckSquare2 className="h-4 w-4 text-sky-300" />{count} selected</div>
  <button type="button" disabled={readOnly} onClick={onContact} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-35"><Mail className="h-3.5 w-3.5" />Contact</button>
  <button type="button" disabled={readOnly} onClick={onFeedback} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-35"><MessageSquare className="h-3.5 w-3.5" />Request feedback</button>
  <button type="button" disabled={readOnly} onClick={onAdvance} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500"><ArrowRight className="h-3.5 w-3.5" />Advance</button>
  <button type="button" disabled={readOnly} onClick={onHold} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-35"><PauseCircle className="h-3.5 w-3.5" />{held ? 'Release hold' : 'Hold'}</button>
  <button type="button" disabled={readOnly} onClick={onReject} className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/25 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-35"><CircleAlert className="h-3.5 w-3.5" />Reject</button>
  <button type="button" onClick={onClear} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Clear selection"><X className="h-4 w-4" /></button>
</div>;

const FilteredEmpty: React.FC<{ onClear: () => void }> = ({ onClear }) => <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-12 text-center"><Filter className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 font-bold text-white">No candidates match these filters</p><p className="mt-1 text-sm text-slate-500">Clear the triage filters to return to the full pipeline.</p><button type="button" onClick={onClear} className="mt-4 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700">Clear filters</button></div>;

const PipelineCandidateList: React.FC<{ candidates: Candidate[]; job: Job; readOnly: boolean; slaDays: number; selectedIds: Set<string>; allSelected: boolean; onToggleSelected: (id: string) => void; onToggleAll: () => void; onOpen: (candidate: Candidate) => void; onAdvance: (candidate: Candidate) => void; onReject: (candidate: Candidate) => void }> = ({ candidates, job, readOnly, slaDays, selectedIds, allSelected, onToggleSelected, onToggleAll, onOpen, onAdvance, onReject }) => <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700">
  <table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-12 px-4 py-3"><button type="button" onClick={onToggleAll} className={`flex h-5 w-5 items-center justify-center rounded border ${allSelected ? 'border-sky-400 bg-sky-500 text-white' : 'border-slate-600'}`} aria-label={allSelected ? 'Clear visible selection' : 'Select visible candidates'}>{allSelected && <Check className="h-3.5 w-3.5" />}</button></th><th className="px-3 py-3">Candidate</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Stage age</th><th className="px-3 py-3">Match</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Attention</th><th className="px-3 py-3 text-right">Decision</th></tr></thead>
    <tbody className="divide-y divide-slate-700">{candidates.map((candidate) => { const age = stageAge(candidate, job.id); const overdue = age !== null && age >= slaDays && laneFor(candidate, job.id).id !== 'outcome'; const held = candidate.pipelineHolds?.[job.id]; const nextStage = nextStageFor(candidate, job.id); return <tr key={candidate.id} className="hover:bg-slate-700/25"><td className="px-4 py-3"><button type="button" onClick={() => onToggleSelected(candidate.id)} className={`flex h-5 w-5 items-center justify-center rounded border ${selectedIds.has(candidate.id) ? 'border-sky-400 bg-sky-500 text-white' : 'border-slate-600'}`} aria-label={`Select ${candidate.name}`}>{selectedIds.has(candidate.id) && <Check className="h-3.5 w-3.5" />}</button></td><td className="px-3 py-3"><button type="button" onClick={() => onOpen(candidate)} className="font-bold text-white hover:text-sky-300">{candidate.name}</button><p className="mt-1 text-xs text-slate-500">{sourceLabel(candidate)} · {candidate.currentRole ?? candidate.role ?? 'Candidate'}</p></td><td className="px-3 py-3 font-medium text-slate-200">{laneFor(candidate, job.id).label}</td><td className={`px-3 py-3 font-bold ${overdue ? 'text-amber-200' : 'text-slate-300'}`}>{age === null ? 'Not recorded' : `${age} days`}</td><td className="px-3 py-3 font-bold text-emerald-300">{candidate.matchScores?.[job.id] ?? '—'}{candidate.matchScores?.[job.id] !== undefined ? '%' : ''}</td><td className="px-3 py-3 text-slate-300">{candidateOwner(candidate)}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{held && <StatusChip tone="slate" label="On hold" />}{overdue && <StatusChip tone="amber" label="Beyond SLA" />}{feedbackPending(candidate, job.id) && <StatusChip tone="violet" label="Feedback" />}{!held && !overdue && !feedbackPending(candidate, job.id) && <StatusChip tone="green" label="On track" />}</div></td><td className="px-3 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => onOpen(candidate)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Quick view</button>{nextStage && <button type="button" disabled={readOnly || Boolean(held)} onClick={() => onAdvance(candidate)} className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500">Advance</button>}{laneFor(candidate, job.id).id !== 'outcome' && <button type="button" disabled={readOnly} onClick={() => onReject(candidate)} className="rounded-lg p-2 text-slate-400 hover:bg-red-400/10 hover:text-red-300 disabled:opacity-35" aria-label={`Reject ${candidate.name}`}><CircleAlert className="h-4 w-4" /></button>}</div></td></tr>; })}</tbody>
  </table>
</div>;

const StatusChip: React.FC<{ tone: 'slate' | 'amber' | 'violet' | 'green'; label: string }> = ({ tone, label }) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone === 'amber' ? 'bg-amber-400/10 text-amber-200' : tone === 'violet' ? 'bg-violet-400/10 text-violet-200' : tone === 'green' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{label}</span>;

const PipelineDecisionModal: React.FC<{ pending: PendingDecision | null; job: Job; onCancel: () => void; onConfirm: (reason: string) => void }> = ({ pending, job, onCancel, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { setReason(''); setNotes(''); }, [pending]);
  if (!pending) return null;
  const labels: Record<DecisionAction, { title: string; description: string; options: string[]; tone: string }> = {
    advance: { title: 'Confirm stage advancement', description: 'Advance the selected candidates to the next stage in their individual workflows.', options: ['Evidence supports progression', 'Screening criteria met', 'Hiring manager approved', 'Interview outcome supports progression', 'Other'], tone: 'sky' },
    hold: { title: 'Place candidates on hold', description: 'Keep their current stage but pause further pipeline movement.', options: ['Awaiting hiring-manager decision', 'Candidate availability', 'Budget or headcount review', 'Role requirements changing', 'Other'], tone: 'amber' },
    'release-hold': { title: 'Release candidate hold', description: 'Return the selected candidates to active pipeline triage.', options: ['Decision received', 'Candidate available', 'Budget or headcount approved', 'Requirements confirmed', 'Other'], tone: 'emerald' },
    reject: { title: 'Confirm candidate rejection', description: 'Move the selected candidates to Outcome and retain the reason in the audit trail.', options: ['Skills gap', 'Seniority mismatch', 'Location constraints', 'Compensation mismatch', 'Candidate withdrew', 'No response', 'Other'], tone: 'red' },
  };
  const config = labels[pending.action];
  const finalReason = reason === 'Other' ? notes.trim() : notes.trim() ? `${reason}: ${notes.trim()}` : reason;
  return <div className="fixed inset-0 z-[180] flex items-center justify-center p-4"><button type="button" onClick={onCancel} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close decision confirmation" /><div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"><div className="flex items-start justify-between gap-3 border-b border-slate-700 p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-sky-300">Recorded decision · {job.title}</p><h2 className="mt-1 text-xl font-bold text-white">{config.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{config.description}</p></div><button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button></div><div className="space-y-4 p-5"><div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3"><p className="text-sm font-bold text-white">{pending.candidates.length} candidate{pending.candidates.length === 1 ? '' : 's'}</p><p className="mt-1 line-clamp-2 text-xs text-slate-400">{pending.candidates.map((candidate) => candidate.name).join(', ')}</p></div><label className="block text-xs font-bold text-slate-400">Required reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400"><option value="">Select a reason</option>{config.options.map((option) => <option key={option}>{option}</option>)}</select></label><label className="block text-xs font-bold text-slate-400">{reason === 'Other' ? 'Reason details (required)' : 'Decision note (optional)'}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add evidence or context for the audit trail" className="mt-1 block w-full resize-none rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400" /></label></div><div className="flex justify-end gap-2 border-t border-slate-700 bg-slate-950/30 p-4"><button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancel</button><button type="button" disabled={!reason || (reason === 'Other' && !notes.trim())} onClick={() => onConfirm(finalReason)} className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${config.tone === 'red' ? 'bg-red-500 hover:bg-red-400' : config.tone === 'amber' ? 'bg-amber-500 hover:bg-amber-400' : config.tone === 'emerald' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-sky-500 hover:bg-sky-400'}`}>Confirm decision</button></div></div></div>;
};

const OperatingMetric: React.FC<{ label: string; value: React.ReactNode; detail: string; warning?: boolean }> = ({ label, value, detail, warning }) => <div className={`rounded-xl border px-3 py-2.5 ${warning ? 'border-amber-400/30 bg-amber-400/10' : 'border-slate-700 bg-slate-950/35'}`}>
  <div className="flex items-baseline justify-between gap-2"><p className="text-xs font-semibold text-slate-400">{label}</p><p className={`text-lg font-bold ${warning ? 'text-amber-200' : 'text-white'}`}>{value}</p></div>
  <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>
</div>;

const EmptyPipeline: React.FC<{ job: Job; readOnly: boolean; onFindTalent: () => void; onBrowseTalent: () => void; onImport: () => void }> = ({ job, readOnly, onFindTalent, onBrowseTalent, onImport }) => <div className="mt-4 flex min-h-[330px] items-center justify-center rounded-2xl border border-dashed border-slate-600 bg-slate-900/25 p-6 text-center">
  <div className="max-w-xl">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300"><Users className="h-6 w-6" /></div>
    <h2 className="mt-4 text-xl font-bold text-white">No candidates in this pipeline</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{readOnly ? `This requisition is ${job.status}. Review its details before sourcing or moving candidates.` : 'Start with ranked talent, browse the candidate database, or import new profiles for this requisition.'}</p>
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      <button type="button" onClick={onFindTalent} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400"><Search className="h-4 w-4" />{readOnly ? 'Review requisition' : 'Find ranked talent'}</button>
      {!readOnly && <button type="button" onClick={onBrowseTalent} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"><UserPlus className="h-4 w-4" />Browse talent</button>}
      {!readOnly && <button type="button" onClick={onImport} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-700 hover:text-white">Import candidates</button>}
    </div>
  </div>
</div>;

const PipelineLane: React.FC<{
  lane: Lane;
  candidates: Candidate[];
  job: Job;
  readOnly: boolean;
  slaDays: number;
  selectedIds: Set<string>;
  onToggleSelected: (candidateId: string) => void;
  onAdvance: (candidate: Candidate) => void;
  onReject: (candidate: Candidate) => void;
  onContact: (candidate: Candidate) => void;
  onFeedback: (candidate: Candidate) => void;
  onOpen: (candidate: Candidate) => void;
}> = ({ lane, candidates, job, readOnly, slaDays, selectedIds, onToggleSelected, onAdvance, onReject, onContact, onFeedback, onOpen }) => {
  const aging = candidates.filter((candidate) => {
    const age = stageAge(candidate, job.id);
    return age !== null && age >= slaDays && lane.id !== 'outcome';
  }).length;

  const tone = lane.tone === 'sky' ? 'bg-sky-400/10 text-sky-200' : lane.tone === 'violet' ? 'bg-violet-400/10 text-violet-200' : lane.tone === 'amber' ? 'bg-amber-400/10 text-amber-200' : lane.tone === 'emerald' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300';

  return <section className="min-w-0 rounded-xl border border-slate-700 bg-slate-900/40">
    <header className="flex items-start justify-between gap-2 border-b border-slate-700 p-3">
      <div><p className="font-bold text-white">{lane.label}</p><p className="mt-0.5 text-xs text-slate-500">{lane.nextAction}</p>{aging > 0 && <p className="mt-1 text-[11px] font-semibold text-amber-300">{aging} beyond SLA</p>}</div>
      <span className={`rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{candidates.length}</span>
    </header>
    <div className="space-y-3 p-2.5">
      {candidates.map((candidate) => <CandidateStageCard key={candidate.id} candidate={candidate} job={job} lane={lane} readOnly={readOnly} slaDays={slaDays} selected={selectedIds.has(candidate.id)} onToggleSelected={onToggleSelected} onAdvance={onAdvance} onReject={onReject} onContact={onContact} onFeedback={onFeedback} onOpen={onOpen} />)}
      {!candidates.length && <div className="rounded-lg border border-dashed border-slate-700 px-3 py-5 text-center"><p className="text-xs font-medium text-slate-500">No candidates</p><p className="mt-1 text-[11px] text-slate-600">Candidates appear here after a stage decision.</p></div>}
    </div>
  </section>;
};

const CandidateStageCard: React.FC<{
  candidate: Candidate;
  job: Job;
  lane: Lane;
  readOnly: boolean;
  slaDays: number;
  selected: boolean;
  onToggleSelected: (candidateId: string) => void;
  onAdvance: (candidate: Candidate) => void;
  onReject: (candidate: Candidate) => void;
  onContact: (candidate: Candidate) => void;
  onFeedback: (candidate: Candidate) => void;
  onOpen: (candidate: Candidate) => void;
}> = ({ candidate, job, lane, readOnly, slaDays, selected, onToggleSelected, onAdvance, onReject, onContact, onFeedback, onOpen }) => {
  const age = stageAge(candidate, job.id);
  const overdue = age !== null && age >= slaDays && lane.id !== 'outcome';
  const match = candidate.matchScores?.[job.id];
  const feedbackPending = (lane.id === 'screening' || lane.id === 'interview') && (!candidate.feedback?.[job.id] || candidate.feedback[job.id] === 'none');
  const held = candidate.pipelineHolds?.[job.id];

  return <article className={`rounded-xl border bg-slate-800 p-3 ${selected ? 'border-sky-400 ring-1 ring-sky-400/30' : overdue ? 'border-amber-400/35' : 'border-slate-700'}`}>
    <div className="flex justify-between gap-2">
      <div className="flex min-w-0 gap-2"><button type="button" onClick={() => onToggleSelected(candidate.id)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-sky-400 bg-sky-500 text-white' : 'border-slate-600 text-transparent hover:border-sky-400'}`} aria-label={`Select ${candidate.name}`}>{selected && <Check className="h-3.5 w-3.5" />}</button><div className="min-w-0"><button type="button" onClick={() => onOpen(candidate)} className="block max-w-full truncate text-left font-semibold text-sky-300 hover:text-sky-200">{candidate.name}</button><p className="mt-1 truncate text-xs text-slate-400">{candidate.currentRole ?? candidate.role ?? 'Candidate'}</p></div></div>
      <div className="shrink-0 text-right"><p className={`font-bold ${match !== undefined && match >= 70 ? 'text-emerald-300' : 'text-slate-200'}`}>{match ?? '—'}{match !== undefined ? '%' : ''}</p><p className="text-[10px] text-slate-500">Match</p></div>
    </div>

    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
      <span className="rounded bg-slate-700 px-2 py-1 text-slate-300">{sourceLabel(candidate)}</span>
      {held && <span className="rounded bg-amber-400/10 px-2 py-1 font-bold text-amber-200">On hold</span>}
      {candidate.location && <span className="max-w-full truncate rounded bg-slate-700 px-2 py-1 text-slate-300">{candidate.location}</span>}
    </div>

    <div className={`mt-3 rounded-lg border p-2 ${overdue ? 'border-amber-400/20 bg-amber-400/10' : 'border-slate-700 bg-slate-900/35'}`}>
      <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-slate-400">Time in stage</span><span className={`inline-flex items-center gap-1 text-xs font-bold ${overdue ? 'text-amber-200' : 'text-slate-200'}`}><Clock3 className="h-3.5 w-3.5" />{age === null ? 'Not recorded' : `${age}d`}</span></div>
      {overdue && <p className="mt-1 text-[10px] text-amber-300">SLA is {slaDays} days · action required</p>}
      {feedbackPending && <p className="mt-1 text-[10px] text-violet-300">Hiring-manager feedback pending</p>}
      <p className="mt-1 text-[10px] text-slate-500">Owner: {candidateOwner(candidate)}</p>
    </div>

    <div className="mt-3 flex items-center gap-1.5 border-t border-slate-700 pt-3">
      {lane.id === 'review' && <button type="button" disabled={readOnly} onClick={() => onContact(candidate)} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Contact ${candidate.name}`} title="Contact candidate"><Mail className="h-4 w-4" /></button>}
      {(lane.id === 'screening' || lane.id === 'interview') && <button type="button" disabled={readOnly} onClick={() => onFeedback(candidate)} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Request feedback for ${candidate.name}`} title="Request feedback"><MessageSquare className="h-4 w-4" /></button>}
      <button type="button" onClick={() => onOpen(candidate)} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label={`Open ${candidate.name} Candidate 360`} title="Open Candidate 360"><UserRound className="h-4 w-4" /></button>
      {lane.nextStage && <button type="button" disabled={readOnly || Boolean(held)} onClick={() => onAdvance(candidate)} className="ml-auto inline-flex min-w-0 items-center gap-1 rounded bg-sky-500 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500" title={held ? 'Release the candidate hold before advancing' : lane.nextAction}><span className="truncate">{lane.nextAction}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" /></button>}
      {lane.id !== 'outcome' && <button type="button" disabled={readOnly} onClick={() => onReject(candidate)} className="rounded p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Reject ${candidate.name}`} title="Reject candidate"><CircleAlert className="h-4 w-4" /></button>}
    </div>
  </article>;
};

export default RecruiterPipelineWorkspace;
