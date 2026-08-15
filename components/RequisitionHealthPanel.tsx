import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Settings2, ShieldAlert, UserRound } from 'lucide-react';
import type { Candidate, Job } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { sharedOperationsService } from '../services/SharedOperationsService';
import CollaborationThread from './CollaborationThread';

type HealthConfig = {
  owner: string;
  hiringManager: string;
  targetStartDate: string;
  coverageTarget: number;
  shortlistTarget: number;
  stageSlaDays: number;
  feedbackSlaDays: number;
};

type HealthStatus = 'healthy' | 'watch' | 'at-risk' | 'closed';

const DEFAULT_CONFIG: HealthConfig = {
  owner: '',
  hiringManager: '',
  targetStartDate: '',
  coverageTarget: 5,
  shortlistTarget: 3,
  stageSlaDays: 5,
  feedbackSlaDays: 3,
};

const ACTIVE_STAGES = ['sourced', 'new', 'long_list', 'screening', 'scheduling', 'interview', 'offer'];
const SHORTLIST_STAGES = ['long_list', 'screening', 'scheduling', 'interview', 'offer', 'hired'];
const FEEDBACK_STAGES = ['screening', 'scheduling', 'interview', 'offer'];

function readConfig(job: Job): HealthConfig {
  const stored = job.companyContext?.requisitionHealth;
  if (!stored || typeof stored !== 'object') return DEFAULT_CONFIG;
  const value = stored as Partial<HealthConfig>;
  return {
    owner: typeof value.owner === 'string' ? value.owner : '',
    hiringManager: typeof value.hiringManager === 'string' ? value.hiringManager : '',
    targetStartDate: typeof value.targetStartDate === 'string' ? value.targetStartDate : '',
    coverageTarget: Number(value.coverageTarget) > 0 ? Number(value.coverageTarget) : 5,
    shortlistTarget: Number(value.shortlistTarget) > 0 ? Number(value.shortlistTarget) : 3,
    stageSlaDays: Number(value.stageSlaDays) > 0 ? Number(value.stageSlaDays) : 5,
    feedbackSlaDays: Number(value.feedbackSlaDays) > 0 ? Number(value.feedbackSlaDays) : 3,
  };
}

function daysSince(value?: string): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000)) : 0;
}

function latestStageDate(candidate: Candidate, jobId: string): string | undefined {
  return [...(candidate.pipelineHistory ?? [])]
    .filter((entry) => entry.jobId === jobId)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0]?.timestamp;
}

const RequisitionHealthPanel: React.FC<{ job: Job; compact?: boolean; readOnly?: boolean; onStageSlaChange?: (days: number) => void }> = ({ job, compact = false, readOnly = false, onStageSlaChange }) => {
  const { internalCandidates, pastCandidates, uploadedCandidates, setJobs } = useData();
  const { activeOrganization, isDemoMode } = useAuth();
  const canManage = Boolean(activeOrganization && ['owner', 'admin', 'recruiter'].includes(activeOrganization.role));
  const [expanded, setExpanded] = useState(!compact);
  const [editing, setEditing] = useState(false);
  const [persistedConfig, setPersistedConfig] = useState<HealthConfig>(() => readConfig(job));
  const [draft, setDraft] = useState<HealthConfig>(() => readConfig(job));
  const [saveError, setSaveError] = useState<string | null>(null);
  const candidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  useEffect(() => {
    const fallback = readConfig(job); setPersistedConfig(fallback); setDraft(fallback);
    if (!activeOrganization || isDemoMode) return;
    const loadShared = () => { void sharedOperationsService.getSlaSettings(activeOrganization.organizationId, job.id).then(async (settings) => {
      if (!settings && canManage && job.companyContext?.requisitionHealth && typeof job.companyContext.requisitionHealth === 'object') {
        await sharedOperationsService.saveSlaSettings(activeOrganization.organizationId, { jobId: job.id, ownerDisplay: fallback.owner, hiringManagerDisplay: fallback.hiringManager, targetStartDate: fallback.targetStartDate, coverageTarget: fallback.coverageTarget, shortlistTarget: fallback.shortlistTarget, stageSlaDays: fallback.stageSlaDays, feedbackSlaDays: fallback.feedbackSlaDays });
        settings = await sharedOperationsService.getSlaSettings(activeOrganization.organizationId, job.id);
      }
      if (!settings) return;
      const shared: HealthConfig = { owner: settings.ownerDisplay, hiringManager: settings.hiringManagerDisplay, targetStartDate: settings.targetStartDate, coverageTarget: settings.coverageTarget, shortlistTarget: settings.shortlistTarget, stageSlaDays: settings.stageSlaDays, feedbackSlaDays: settings.feedbackSlaDays };
      setPersistedConfig(shared); setDraft(shared);
    }).catch((cause) => setSaveError(cause instanceof Error ? cause.message : 'Could not load shared SLA settings.')); };
    loadShared();
    return sharedOperationsService.subscribe(activeOrganization.organizationId, ['requisition_sla_settings'], loadShared);
  }, [activeOrganization, canManage, isDemoMode, job]);

  useEffect(() => {
    onStageSlaChange?.(persistedConfig.stageSlaDays);
  }, [onStageSlaChange, persistedConfig.stageSlaDays]);

  const metrics = useMemo(() => {
    const relevant = candidates.filter((candidate) => candidate.matchScores?.[job.id] !== undefined || candidate.pipelineStage?.[job.id]);
    const strong = relevant.filter((candidate) => (candidate.matchScores?.[job.id] ?? 0) >= 70).length;
    const shortlisted = relevant.filter((candidate) => SHORTLIST_STAGES.includes(String(candidate.pipelineStage?.[job.id] ?? '').toLowerCase())).length;
    const aging = relevant.flatMap((candidate) => {
      const stage = String(candidate.pipelineStage?.[job.id] ?? '').toLowerCase();
      if (!ACTIVE_STAGES.includes(stage)) return [];
      const age = daysSince(latestStageDate(candidate, job.id));
      return age >= persistedConfig.stageSlaDays ? [{ candidate, stage, age }] : [];
    });
    const feedbackOverdue = relevant.flatMap((candidate) => {
      const stage = String(candidate.pipelineStage?.[job.id] ?? '').toLowerCase();
      if (!FEEDBACK_STAGES.includes(stage) || (candidate.feedback?.[job.id] && candidate.feedback[job.id] !== 'none')) return [];
      const age = daysSince(latestStageDate(candidate, job.id));
      return age >= persistedConfig.feedbackSlaDays ? [{ candidate, stage, age }] : [];
    });
    const postedAt = job.postedDate ?? job.posted;
    const daysOpen = daysSince(postedAt);
    const targetLate = persistedConfig.targetStartDate ? Date.parse(persistedConfig.targetStartDate) < Date.now() : false;
    let status: HealthStatus = job.status === 'closed' ? 'closed' : 'healthy';
    if (job.status !== 'closed' && (targetLate || aging.length >= 3 || feedbackOverdue.length >= 2 || (daysOpen >= 14 && strong === 0))) status = 'at-risk';
    else if (job.status !== 'closed' && (strong < persistedConfig.coverageTarget || shortlisted < persistedConfig.shortlistTarget || aging.length > 0 || feedbackOverdue.length > 0 || !persistedConfig.owner || !persistedConfig.hiringManager)) status = 'watch';
    return { relevant, strong, shortlisted, aging, feedbackOverdue, daysOpen, targetLate, status };
  }, [candidates, job, persistedConfig]);

  const save = async () => {
    try {
      if (readOnly) return;
      if (!isDemoMode && !canManage) return;
      if (activeOrganization && !isDemoMode) await sharedOperationsService.saveSlaSettings(activeOrganization.organizationId, { jobId: job.id, ownerDisplay: draft.owner, hiringManagerDisplay: draft.hiringManager, targetStartDate: draft.targetStartDate, coverageTarget: draft.coverageTarget, shortlistTarget: draft.shortlistTarget, stageSlaDays: draft.stageSlaDays, feedbackSlaDays: draft.feedbackSlaDays });
      else setJobs((current) => current.map((item) => item.id === job.id ? { ...item, companyContext: { ...(item.companyContext ?? {}), requisitionHealth: draft } } : item));
      setPersistedConfig(draft); setSaveError(null); setEditing(false);
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save shared SLA settings.'); }
  };

  const statusStyle = metrics.status === 'healthy' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : metrics.status === 'watch' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : metrics.status === 'at-risk' ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  const statusLabel = metrics.status === 'at-risk' ? 'At risk' : metrics.status.charAt(0).toUpperCase() + metrics.status.slice(1);

  return <section className="rounded-xl border border-slate-700 bg-slate-800/80">
    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><div className={`rounded-lg p-2 ${metrics.status === 'at-risk' ? 'bg-red-400/10 text-red-300' : metrics.status === 'watch' ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{metrics.status === 'healthy' ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">Requisition health</h3><span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusStyle}`}>{statusLabel}</span></div><p className="mt-1 text-xs text-slate-400">{persistedConfig.owner || 'Owner not assigned'} · {persistedConfig.hiringManager || 'Hiring manager not assigned'}</p></div></div>
      <div className="flex flex-wrap items-center gap-2 text-xs"><HealthMetric label="Days open" value={metrics.daysOpen} warning={metrics.daysOpen >= 30} /><HealthMetric label="Strong coverage" value={`${metrics.strong}/${persistedConfig.coverageTarget}`} warning={metrics.strong < persistedConfig.coverageTarget} /><HealthMetric label="Shortlist" value={`${metrics.shortlisted}/${persistedConfig.shortlistTarget}`} warning={metrics.shortlisted < persistedConfig.shortlistTarget} /><HealthMetric label="SLA alerts" value={metrics.aging.length + metrics.feedbackOverdue.length} warning={metrics.aging.length + metrics.feedbackOverdue.length > 0} /><button type="button" onClick={() => setExpanded((value) => !value)} className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-700" aria-label={expanded ? 'Collapse health details' : 'Expand health details'}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button></div>
    </div>
    {expanded && <div className="border-t border-slate-700 p-4"><div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Attention required</p><div className="mt-2 space-y-2">{metrics.targetLate && <Reminder tone="red" text={`Target start date ${persistedConfig.targetStartDate} has passed.`} />}{metrics.aging.slice(0, 3).map(({ candidate, stage, age }) => <Reminder key={`age-${candidate.id}`} tone="amber" text={`${candidate.name}: ${age} days in ${stage.replace('_', ' ')}.`} />)}{metrics.feedbackOverdue.slice(0, 3).map(({ candidate, age }) => <Reminder key={`feedback-${candidate.id}`} tone="violet" text={`${candidate.name}: hiring-manager feedback overdue by SLA (${age} days waiting).`} />)}{!metrics.targetLate && !metrics.aging.length && !metrics.feedbackOverdue.length && <Reminder tone="green" text="No current SLA breaches." />}</div></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Escalation ownership</p><div className="mt-2 space-y-2 text-sm text-slate-300"><p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-sky-300" />Recruiter: {persistedConfig.owner || 'Assign an owner'}</p><p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-violet-300" />Hiring manager: {persistedConfig.hiringManager || 'Assign a manager'}</p><p className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-300" />Target start: {persistedConfig.targetStartDate || 'Not set'}</p></div></div><button type="button" disabled={readOnly || (!isDemoMode && !canManage)} onClick={() => { setDraft(persistedConfig); setEditing((value) => !value); }} className="inline-flex h-fit items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"><Settings2 className="h-4 w-4" />Configure controls</button></div>{saveError && <p className="mt-3 text-xs text-red-300">{saveError}</p>}{editing && !readOnly && <div className="mt-4 grid gap-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Recruiter owner" value={draft.owner} onChange={(value) => setDraft({ ...draft, owner: value })} /><Field label="Hiring manager" value={draft.hiringManager} onChange={(value) => setDraft({ ...draft, hiringManager: value })} /><Field label="Target start date" value={draft.targetStartDate} type="date" onChange={(value) => setDraft({ ...draft, targetStartDate: value })} /><NumberField label="Strong-match target" value={draft.coverageTarget} onChange={(value) => setDraft({ ...draft, coverageTarget: value })} /><NumberField label="Shortlist target" value={draft.shortlistTarget} onChange={(value) => setDraft({ ...draft, shortlistTarget: value })} /><NumberField label="Stage SLA (days)" value={draft.stageSlaDays} onChange={(value) => setDraft({ ...draft, stageSlaDays: value })} /><NumberField label="Feedback SLA (days)" value={draft.feedbackSlaDays} onChange={(value) => setDraft({ ...draft, feedbackSlaDays: value })} /><div className="flex items-end gap-2"><button type="button" onClick={() => void save()} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-400">Save controls</button><button type="button" onClick={() => setEditing(false)} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">Cancel</button></div></div>}<div className="mt-4"><CollaborationThread entityType="job" entityId={job.id} title="Requisition discussion and mentions" /></div></div>}
  </section>;
};

const HealthMetric: React.FC<{ label: string; value: React.ReactNode; warning?: boolean }> = ({ label, value, warning }) => <div className={`rounded-lg border px-3 py-2 ${warning ? 'border-amber-400/30 bg-amber-400/10' : 'border-slate-700 bg-slate-900/40'}`}><span className="text-slate-500">{label}</span><span className={`ml-2 font-bold ${warning ? 'text-amber-200' : 'text-white'}`}>{value}</span></div>;
const Reminder: React.FC<{ text: string; tone: 'red' | 'amber' | 'violet' | 'green' }> = ({ text, tone }) => <p className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${tone === 'red' ? 'border-red-400/20 bg-red-400/10 text-red-200' : tone === 'amber' ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : tone === 'violet' ? 'border-violet-400/20 bg-violet-400/10 text-violet-200' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'}`}><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{text}</p>;
const Field: React.FC<{ label: string; value: string; type?: string; onChange: (value: string) => void }> = ({ label, value, type = 'text', onChange }) => <label className="text-xs font-semibold text-slate-400">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-400" /></label>;
const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => <Field label={label} value={String(value)} type="number" onChange={(next) => onChange(Math.max(1, Number(next) || 1))} />;

export default RequisitionHealthPanel;
