import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Inbox,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { proposedActionService } from '../services/ProposedActionService';
import { durableSourcingService, type DurableSourcingMatch, type DurableSourcingRun } from '../services/DurableSourcingService';
import { eventBus, EVENTS } from '../utils/EventBus';

const formatDate = (value?: string) => {
  if (!value) return 'Not yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not yet' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const statusStyle = (status?: DurableSourcingRun['status']) => {
  if (status === 'completed') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (status === 'failed') return 'border-red-400/30 bg-red-400/10 text-red-200';
  if (status === 'running') return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
  return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
};

const TalentCommandCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates, setSelectedJobId } = useData();
  const [runs, setRuns] = useState<DurableSourcingRun[]>([]);
  const [matches, setMatches] = useState<DurableSourcingMatch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [pendingActions, setPendingActions] = useState(() => proposedActionService.list().filter((action) => action.status === 'proposed').length);

  const refresh = useCallback(async () => {
    if (!activeOrganization) return;
    setIsRefreshing(true);
    try {
      const status = await durableSourcingService.status(activeOrganization.organizationId);
      setRuns(status.runs);
      setMatches(status.matches);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load the sourcing workspace.');
    } finally {
      setIsRefreshing(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const updateCount = () => setPendingActions(proposedActionService.list().filter((action) => action.status === 'proposed').length);
    const subscription = eventBus.on(EVENTS.PROPOSED_ACTIONS_CHANGED, updateCount);
    return () => subscription.unsubscribe();
  }, []);

  const allCandidates = useMemo(
    () => [...internalCandidates, ...pastCandidates, ...uploadedCandidates],
    [internalCandidates, pastCandidates, uploadedCandidates],
  );
  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'open'), [jobs]);
  const matchesByJob = useMemo(() => {
    const counts = new Map<string, number>();
    matches.forEach((match) => counts.set(match.job_id, (counts.get(match.job_id) ?? 0) + 1));
    return counts;
  }, [matches]);
  const rolesNeedingAttention = useMemo(
    () => openJobs.filter((job) => (matchesByJob.get(job.id) ?? 0) === 0),
    [matchesByJob, openJobs],
  );
  const latestRun = runs[0];
  const candidateById = useMemo(() => new Map(allCandidates.map((candidate) => [candidate.id, candidate])), [allCandidates]);
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const recentMatches = useMemo(() => [...matches].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 5), [matches]);
  const coveredRoles = openJobs.filter((job) => (matchesByJob.get(job.id) ?? 0) > 0).length;

  const openRole = (jobId: string) => {
    setSelectedJobId(jobId);
    navigate(`/requisitions/${jobId}`);
  };

  const queueSourcing = async () => {
    if (!activeOrganization) return;
    setIsQueueing(true);
    try {
      await durableSourcingService.enqueue(activeOrganization.organizationId);
      await refresh();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not queue the sourcing run.');
    } finally {
      setIsQueueing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-sky-300"><Sparkles className="h-4 w-4" /> {activeOrganization?.organizationName ?? 'Talent workspace'}</p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Talent Command Center</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">A focused view of the roles that need attention, the strength of your talent pool, and the next decision that will move hiring forward.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/jobs')} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"><BriefcaseBusiness className="h-4 w-4" /> Manage roles</button>
            <button type="button" onClick={() => void queueSourcing()} disabled={!activeOrganization || isQueueing} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"><Play className="h-4 w-4" /> {isQueueing ? 'Queueing…' : 'Run sourcing'}</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace overview">
        <Metric icon={<BriefcaseBusiness className="h-5 w-5" />} label="Open roles" value={openJobs.length} detail={`${jobs.length - openJobs.length} inactive or closed`} tone="sky" />
        <Metric icon={<Users className="h-5 w-5" />} label="Talent pool" value={allCandidates.length} detail="Candidates available to match" tone="violet" />
        <Metric icon={<Target className="h-5 w-5" />} label="Role coverage" value={`${coveredRoles}/${openJobs.length}`} detail="Open roles with sourced matches" tone="emerald" />
        <Metric icon={<Inbox className="h-5 w-5" />} label="Approval queue" value={pendingActions} detail="Recommendations awaiting review" tone="amber" />
      </section>

      {loadError && <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Sourcing status is unavailable</p><p className="mt-1 text-amber-200">{loadError}</p></div></div>}

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-sky-300">Priority queue</p><h2 className="mt-1 text-xl font-bold text-white">Roles needing attention</h2><p className="mt-1 text-sm text-slate-400">Open roles without a persisted sourcing match appear first.</p></div><button type="button" onClick={() => navigate('/jobs')} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200">All roles <ArrowRight className="h-4 w-4" /></button></div>
          <div className="mt-5 divide-y divide-slate-700">
            {rolesNeedingAttention.slice(0, 4).map((job) => <div key={job.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">{job.title}</p><p className="mt-1 text-sm text-slate-400">{job.department} · {job.location} · {job.requiredSkills.slice(0, 3).join(', ') || 'Skills not defined'}</p></div><button type="button" onClick={() => openRole(job.id)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700">Review role <ArrowRight className="h-4 w-4" /></button></div>)}
            {!rolesNeedingAttention.length && <EmptyState icon={<CheckCircle2 className="h-6 w-6 text-emerald-300" />} title="Every open role has sourcing coverage" description="Use the pipeline to review the candidates surfaced for each role." action="Open pipeline" onAction={() => navigate('/pipeline')} />}
            {!openJobs.length && <EmptyState icon={<BriefcaseBusiness className="h-6 w-6 text-sky-300" />} title="Add your first role" description="Create an open role to begin matching candidates and tracking hiring activity." action="Manage roles" onAction={() => navigate('/jobs')} />}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-violet-300">Automation health</p><h2 className="mt-1 text-xl font-bold text-white">Sourcing worker</h2></div><button type="button" aria-label="Refresh sourcing status" onClick={() => void refresh()} disabled={isRefreshing} className="rounded-lg p-2 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /></button></div>
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-400">Latest run</span><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle(latestRun?.status)}`}>{latestRun?.status ?? 'Not queued'}</span></div><p className="mt-3 text-lg font-semibold text-white">{latestRun?.completed_at ? 'Last completed ' + formatDate(latestRun.completed_at) : latestRun?.scheduled_for ? 'Scheduled ' + formatDate(latestRun.scheduled_for) : 'No sourcing run has been queued'}</p>{latestRun?.error_message && <p className="mt-2 text-sm text-red-300">{latestRun.error_message}</p>}</div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-900/60 p-3"><p className="text-xs text-slate-500">Persisted matches</p><p className="mt-1 text-2xl font-bold text-emerald-300">{matches.length}</p></div><div className="rounded-xl bg-slate-900/60 p-3"><p className="text-xs text-slate-500">Queued or running</p><p className="mt-1 text-2xl font-bold text-sky-300">{runs.filter((run) => run.status === 'queued' || run.status === 'running').length}</p></div></div>
          <button type="button" onClick={() => navigate('/autonomous-agents')} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-300 hover:text-violet-200"><Activity className="h-4 w-4" /> View worker details <ArrowRight className="h-4 w-4" /></button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-emerald-300">Latest evidence</p><h2 className="mt-1 text-xl font-bold text-white">Recent candidate matches</h2></div><button type="button" onClick={() => navigate('/pipeline')} className="text-sm font-medium text-sky-300 hover:text-sky-200">Open pipeline</button></div><div className="mt-5 space-y-3">{recentMatches.map((match) => <MatchRow key={`${match.job_id}:${match.candidate_id}:${match.created_at}`} match={match} candidateName={candidateById.get(match.candidate_id)?.name} jobTitle={jobById.get(match.job_id)?.title} onOpen={() => openRole(match.job_id)} />)}{!recentMatches.length && <EmptyState icon={<Users className="h-6 w-6 text-slate-400" />} title="No matches yet" description="Queue sourcing to create durable, explainable candidate matches for your open roles." action="Run sourcing" onAction={() => void queueSourcing()} />}</div></div>
        <div className="rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 p-5 sm:p-6"><p className="text-sm font-medium text-amber-300">Next best action</p><h2 className="mt-1 text-xl font-bold text-white">Keep people in the loop</h2><p className="mt-3 text-sm leading-6 text-slate-400">The system recommends actions; recruiters review and decide before changes are applied.</p><div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/60 p-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-amber-400/10 p-2 text-amber-300"><Clock3 className="h-5 w-5" /></div><div><p className="font-semibold text-white">{pendingActions} action{pendingActions === 1 ? '' : 's'} awaiting review</p><p className="text-sm text-slate-400">Review recommendations in the agent inbox.</p></div></div></div><button type="button" onClick={() => navigate('/agent-inbox')} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300"><Inbox className="h-4 w-4" /> Review inbox</button></div>
      </section>
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; tone: 'sky' | 'violet' | 'emerald' | 'amber' }> = ({ icon, label, value, detail, tone }) => {
  const tones = { sky: 'bg-sky-400/10 text-sky-300', violet: 'bg-violet-400/10 text-violet-300', emerald: 'bg-emerald-400/10 text-emerald-300', amber: 'bg-amber-400/10 text-amber-300' };
  return <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-400">{label}</p><span className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</span></div><p className="mt-4 text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
};

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string; action: string; onAction: () => void }> = ({ icon, title, description, action, onAction }) => <div className="py-8 text-center"><div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">{icon}</div><p className="font-semibold text-white">{title}</p><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-400">{description}</p><button type="button" onClick={onAction} className="mt-4 text-sm font-semibold text-sky-300 hover:text-sky-200">{action}</button></div>;

const MatchRow: React.FC<{ match: DurableSourcingMatch; candidateName?: string; jobTitle?: string; onOpen: () => void }> = ({ match, candidateName, jobTitle, onOpen }) => <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">{candidateName ?? `Candidate ${match.candidate_id.slice(0, 8)}`}</p><p className="mt-1 text-sm text-slate-400">{jobTitle ?? 'Unknown role'} · {match.matched_skills.slice(0, 3).join(', ') || 'Match evidence available'}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className="font-bold text-emerald-300">{Math.round(match.hybrid_score)}%</p><p className="text-xs text-slate-500">hybrid match</p></div><button type="button" onClick={onOpen} className="rounded-lg p-2 text-slate-300 hover:bg-slate-700 hover:text-white" aria-label="Open role"><ArrowRight className="h-4 w-4" /></button></div></div>;

export default TalentCommandCenterPage;
