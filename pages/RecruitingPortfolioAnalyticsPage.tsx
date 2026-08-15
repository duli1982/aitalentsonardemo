import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2, Download, Printer, ShieldCheck, Timer, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { sharedOperationsService, type RequisitionSlaSettings } from '../services/SharedOperationsService';
import type { Candidate, Job } from '../types';

type Period = '7' | '30' | '90';
type HealthStatus = 'Healthy' | 'Watch' | 'At risk' | 'Closed';
type RoleRow = {
  job: Job;
  health: HealthStatus;
  daysOpen: number;
  strong: number;
  coverageTarget: number;
  shortlist: number;
  shortlistTarget: number;
  stageBreaches: number;
  feedbackEligible: number;
  feedbackComplete: number;
};

const ACTIVE_STAGES = ['sourced', 'new', 'long_list', 'screening', 'scheduling', 'interview', 'offer'];
const SHORTLIST_STAGES = ['long_list', 'screening', 'scheduling', 'interview', 'offer', 'hired'];
const FEEDBACK_STAGES = ['screening', 'scheduling', 'interview', 'offer'];

function daysSince(value?: string): number {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000)) : 0;
}

function latestStageDate(candidate: Candidate, jobId: string): string | undefined {
  return [...(candidate.pipelineHistory ?? [])].filter((entry) => entry.jobId === jobId).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0]?.timestamp;
}

function healthConfig(job: Job, shared?: RequisitionSlaSettings) {
  if (shared) return {
    coverageTarget: shared.coverageTarget,
    shortlistTarget: shared.shortlistTarget,
    stageSlaDays: shared.stageSlaDays,
    feedbackSlaDays: shared.feedbackSlaDays,
    owner: shared.ownerDisplay,
    hiringManager: shared.hiringManagerDisplay,
    targetStartDate: shared.targetStartDate,
  };
  const stored = job.companyContext?.requisitionHealth as Record<string, unknown> | undefined;
  return {
    coverageTarget: Math.max(1, Number(stored?.coverageTarget) || 5),
    shortlistTarget: Math.max(1, Number(stored?.shortlistTarget) || 3),
    stageSlaDays: Math.max(1, Number(stored?.stageSlaDays) || 5),
    feedbackSlaDays: Math.max(1, Number(stored?.feedbackSlaDays) || 3),
    owner: typeof stored?.owner === 'string' ? stored.owner : '',
    hiringManager: typeof stored?.hiringManager === 'string' ? stored.hiringManager : '',
    targetStartDate: typeof stored?.targetStartDate === 'string' ? stored.targetStartDate : '',
  };
}

function roleRow(job: Job, candidates: Candidate[], shared?: RequisitionSlaSettings): RoleRow {
  const config = healthConfig(job, shared);
  const relevant = candidates.filter((candidate) => candidate.matchScores?.[job.id] !== undefined || candidate.pipelineStage?.[job.id]);
  const strong = relevant.filter((candidate) => (candidate.matchScores?.[job.id] ?? 0) >= 70).length;
  const shortlist = relevant.filter((candidate) => SHORTLIST_STAGES.includes(String(candidate.pipelineStage?.[job.id] ?? '').toLowerCase())).length;
  const stageBreaches = relevant.filter((candidate) => {
    const stage = String(candidate.pipelineStage?.[job.id] ?? '').toLowerCase();
    return ACTIVE_STAGES.includes(stage) && daysSince(latestStageDate(candidate, job.id)) >= config.stageSlaDays;
  }).length;
  const feedbackEligibleCandidates = relevant.filter((candidate) => FEEDBACK_STAGES.includes(String(candidate.pipelineStage?.[job.id] ?? '').toLowerCase()));
  const feedbackComplete = feedbackEligibleCandidates.filter((candidate) => candidate.feedback?.[job.id] && candidate.feedback[job.id] !== 'none').length;
  const feedbackOverdue = feedbackEligibleCandidates.filter((candidate) => !candidate.feedback?.[job.id] && daysSince(latestStageDate(candidate, job.id)) >= config.feedbackSlaDays).length;
  const daysOpen = daysSince(job.postedDate ?? job.posted);
  const targetLate = config.targetStartDate ? Date.parse(config.targetStartDate) < Date.now() : false;
  let health: HealthStatus = job.status === 'closed' ? 'Closed' : 'Healthy';
  if (job.status !== 'closed' && (targetLate || stageBreaches >= 3 || feedbackOverdue >= 2 || (daysOpen >= 14 && strong === 0))) health = 'At risk';
  else if (job.status !== 'closed' && (strong < config.coverageTarget || shortlist < config.shortlistTarget || stageBreaches > 0 || feedbackOverdue > 0 || !config.owner || !config.hiringManager)) health = 'Watch';
  return { job, health, daysOpen, strong, coverageTarget: config.coverageTarget, shortlist, shortlistTarget: config.shortlistTarget, stageBreaches, feedbackEligible: feedbackEligibleCandidates.length, feedbackComplete };
}

function downloadCsv(rows: RoleRow[], cadence: 'weekly' | 'monthly') {
  const header = ['Report cadence', 'Requisition', 'Department', 'Status', 'Health', 'Days open', 'Strong matches', 'Coverage target', 'Shortlist', 'Shortlist target', 'Stage SLA breaches', 'Feedback completed', 'Feedback eligible'];
  const body = rows.map((row) => [cadence, row.job.title, row.job.department, row.job.status, row.health, row.daysOpen, row.strong, row.coverageTarget, row.shortlist, row.shortlistTarget, row.stageBreaches, row.feedbackComplete, row.feedbackEligible]);
  const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `recruiting-portfolio-${cadence}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

const RecruitingPortfolioAnalyticsPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { activeOrganization, isDemoMode } = useAuth();
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const [period, setPeriod] = useState<Period>('30');
  const [department, setDepartment] = useState('all');
  const [sharedSla, setSharedSla] = useState<RequisitionSlaSettings[]>([]);
  const [slaError, setSlaError] = useState('');
  useEffect(() => {
    if (!activeOrganization || isDemoMode) { setSharedSla([]); setSlaError(''); return; }
    let current = true;
    const loadShared = () => { void sharedOperationsService.listSlaSettings(activeOrganization.organizationId)
      .then((values) => { if (current) { setSharedSla(values); setSlaError(''); } })
      .catch((error) => { if (current) { setSharedSla([]); setSlaError(error instanceof Error ? error.message : 'Could not load shared SLA settings.'); } }); };
    loadShared();
    const unsubscribe = sharedOperationsService.subscribe(activeOrganization.organizationId, ['requisition_sla_settings'], loadShared);
    return () => { current = false; unsubscribe(); };
  }, [activeOrganization, isDemoMode]);
  const sharedSlaByJob = useMemo(() => new Map(sharedSla.map((value) => [value.jobId, value])), [sharedSla]);
  const candidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const departments = useMemo(() => [...new Set(jobs.map((job) => job.department).filter(Boolean))].sort(), [jobs]);
  const filteredJobs = useMemo(() => jobs.filter((job) => department === 'all' || job.department === department), [department, jobs]);
  const rows = useMemo(() => filteredJobs.map((job) => roleRow(job, candidates, sharedSlaByJob.get(job.id))), [candidates, filteredJobs, sharedSlaByJob]);
  const activeRows = rows.filter((row) => row.job.status === 'open' || row.job.status === 'on hold');
  const atRisk = activeRows.filter((row) => row.health === 'At risk').length;
  const averageDaysOpen = activeRows.length ? Math.round(activeRows.reduce((sum, row) => sum + row.daysOpen, 0) / activeRows.length) : 0;
  const totalActiveCandidateStages = candidates.reduce((sum, candidate) => sum + Object.entries(candidate.pipelineStage ?? {}).filter(([jobId, stage]) => filteredJobs.some((job) => job.id === jobId) && ACTIVE_STAGES.includes(String(stage))).length, 0);
  const stageBreaches = rows.reduce((sum, row) => sum + row.stageBreaches, 0);
  const slaCompliance = totalActiveCandidateStages ? Math.round(((totalActiveCandidateStages - stageBreaches) / totalActiveCandidateStages) * 100) : null;
  const feedbackEligible = rows.reduce((sum, row) => sum + row.feedbackEligible, 0);
  const feedbackComplete = rows.reduce((sum, row) => sum + row.feedbackComplete, 0);
  const managerResponse = feedbackEligible ? Math.round((feedbackComplete / feedbackEligible) * 100) : null;

  const stageBreakdown = useMemo(() => {
    const counts = new Map<string, { count: number; age: number }>();
    candidates.forEach((candidate) => Object.entries(candidate.pipelineStage ?? {}).forEach(([jobId, stageValue]) => {
      if (!filteredJobs.some((job) => job.id === jobId)) return;
      const stage = String(stageValue).replace('_', ' ');
      const current = counts.get(stage) ?? { count: 0, age: 0 };
      current.count += 1; current.age += daysSince(latestStageDate(candidate, jobId)); counts.set(stage, current);
    }));
    return [...counts.entries()].map(([stage, value]) => ({ stage, count: value.count, averageAge: value.count ? Math.round(value.age / value.count) : 0 })).sort((a, b) => b.averageAge - a.averageAge);
  }, [candidates, filteredJobs]);

  const sourceConversion = useMemo(() => {
    const sources = ['internal', 'past', 'uploaded'] as const;
    return sources.map((source) => { const population = candidates.filter((candidate) => (candidate.type ?? 'uploaded') === source); const inPipeline = population.filter((candidate) => Object.keys(candidate.pipelineStage ?? {}).some((jobId) => filteredJobs.some((job) => job.id === jobId))).length; return { source: source === 'past' ? 'Previous applicants' : source === 'uploaded' ? 'External / uploaded' : 'Internal talent', population: population.length, inPipeline, conversion: population.length ? Math.round((inPipeline / population.length) * 100) : 0 }; });
  }, [candidates, filteredJobs]);

  const fairness = useMemo(() => {
    const withData = candidates.filter((candidate) => candidate.demographics?.gender);
    const groups = [...new Set(withData.map((candidate) => candidate.demographics!.gender))];
    return { coverage: candidates.length ? Math.round((withData.length / candidates.length) * 100) : 0, groups: groups.map((group) => { const population = withData.filter((candidate) => candidate.demographics?.gender === group); const progressed = population.filter((candidate) => Object.values(candidate.pipelineStage ?? {}).some((stage) => SHORTLIST_STAGES.includes(String(stage)))).length; return { group, population: population.length, progression: population.length ? Math.round((progressed / population.length) * 100) : 0 }; }) };
  }, [candidates]);

  const recentCutoff = Date.now() - Number(period) * 86_400_000;
  const recentActivity = candidates.flatMap((candidate) => (candidate.pipelineHistory ?? []).filter((entry) => Date.parse(entry.timestamp) >= recentCutoff).map((entry) => ({ candidate: candidate.name, job: jobs.find((job) => job.id === entry.jobId)?.title ?? 'Unknown role', stage: String(entry.stage).replace('_', ' '), timestamp: entry.timestamp }))).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return <div className="mx-auto w-full max-w-7xl space-y-6 print:bg-white print:text-black">
    {!embedded && <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 p-6 sm:p-8 print:border-slate-300 print:bg-white"><div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"><div><p className="text-sm font-medium text-sky-300">Executive recruiting view</p><h1 className="mt-1 text-3xl font-bold text-white print:text-black">Recruiting Portfolio Analytics</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 print:text-slate-700">Portfolio health, bottlenecks, SLA compliance, source conversion, fairness coverage, and hiring-manager responsiveness.</p><p className="mt-3 text-xs text-slate-500">{activeOrganization?.organizationName ?? 'Workspace'} · Live snapshot {new Date().toLocaleString()}</p></div><div className="flex flex-wrap gap-2 print:hidden"><button type="button" onClick={() => downloadCsv(rows, 'weekly')} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"><Download className="h-4 w-4" />Weekly CSV</button><button type="button" onClick={() => downloadCsv(rows, 'monthly')} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"><Download className="h-4 w-4" />Monthly CSV</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-bold text-white hover:bg-sky-400"><Printer className="h-4 w-4" />Print report</button></div></div><div className="mt-6 flex flex-wrap gap-3 print:hidden"><select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-white"><option value="all">All departments</option>{departments.map((value) => <option key={value} value={value}>{value}</option>)}</select><div className="flex rounded-lg border border-slate-600 p-1">{(['7', '30', '90'] as Period[]).map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded px-3 py-1 text-xs font-semibold ${period === value ? 'bg-sky-500 text-white' : 'text-slate-400'}`}>{value} days</button>)}</div></div></section>}
    {embedded && <section className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-white">Recruiting portfolio</h2><p className="mt-1 text-sm text-slate-400">Requisition health, pipeline bottlenecks and HM responsiveness.</p></div><div className="flex flex-wrap gap-2 print:hidden"><button type="button" onClick={() => downloadCsv(rows, 'weekly')} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200"><Download className="h-4 w-4" />Weekly CSV</button><button type="button" onClick={() => downloadCsv(rows, 'monthly')} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200"><Download className="h-4 w-4" />Monthly CSV</button></div></section>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Kpi icon={<BriefcaseBusiness className="h-5 w-5" />} label="Active requisitions" value={activeRows.length} detail={`${atRisk} at risk`} tone={atRisk ? 'red' : 'sky'} /><Kpi icon={<Timer className="h-5 w-5" />} label="Average days open" value={averageDaysOpen} detail="Active requisitions" tone={averageDaysOpen >= 30 ? 'amber' : 'sky'} /><Kpi icon={<ShieldCheck className="h-5 w-5" />} label="Stage SLA compliance" value={slaCompliance === null ? '—' : `${slaCompliance}%`} detail={`${stageBreaches} current breaches`} tone={slaCompliance !== null && slaCompliance < 80 ? 'red' : 'emerald'} /><Kpi icon={<Users className="h-5 w-5" />} label="Manager response" value={managerResponse === null ? '—' : `${managerResponse}%`} detail={`${feedbackComplete}/${feedbackEligible} feedback decisions`} tone={managerResponse !== null && managerResponse < 80 ? 'amber' : 'violet'} /><Kpi icon={<Activity className="h-5 w-5" />} label={`${period}-day activity`} value={recentActivity.length} detail="Recorded stage movements" tone="sky" /></section>

    <section className="grid gap-6 xl:grid-cols-2"><ChartPanel title="Pipeline bottlenecks" subtitle="Average days currently spent in each stage"><div className="space-y-3">{stageBreakdown.map((item) => <Bar key={item.stage} label={item.stage} value={item.averageAge} max={Math.max(1, ...stageBreakdown.map((entry) => entry.averageAge))} suffix="days" note={`${item.count} candidates`} warning={item.averageAge >= 5} />)}{!stageBreakdown.length && <Empty text="No current pipeline stages to analyze." />}</div></ChartPanel><ChartPanel title="Source effectiveness" subtitle="Share of each source population currently in a pipeline"><div className="space-y-3">{sourceConversion.map((item) => <Bar key={item.source} label={item.source} value={item.conversion} max={100} suffix="%" note={`${item.inPipeline}/${item.population} candidates`} />)}</div></ChartPanel></section>

    <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]"><ChartPanel title="Fairness monitoring" subtitle="Aggregate progression only; never use demographic data for individual ranking"><div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-sm text-slate-300">Demographic coverage: <strong className="text-white">{fairness.coverage}%</strong>{fairness.coverage < 60 && <p className="mt-1 text-xs text-amber-300">Coverage is too low for reliable comparison.</p>}</div><div className="space-y-3">{fairness.groups.map((item) => <Bar key={item.group} label={item.group} value={item.progression} max={100} suffix="%" note={`n=${item.population}`} />)}{!fairness.groups.length && <Empty text="No demographic data available. Fairness rates are intentionally not inferred." />}</div></ChartPanel><ChartPanel title="Requisition health" subtitle="Coverage, shortlist targets, and current SLA pressure"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Requisition</th><th className="pb-3">Health</th><th className="pb-3">Days</th><th className="pb-3">Coverage</th><th className="pb-3">Shortlist</th><th className="pb-3">SLA</th><th className="pb-3">HM response</th></tr></thead><tbody className="divide-y divide-slate-700">{rows.sort((a, b) => (a.health === 'At risk' ? -1 : b.health === 'At risk' ? 1 : b.daysOpen - a.daysOpen)).map((row) => <tr key={row.job.id}><td className="py-3"><p className="font-semibold text-white">{row.job.title}</p><p className="text-xs text-slate-500">{row.job.department}</p></td><td><Status value={row.health} /></td><td className="text-slate-300">{row.daysOpen}</td><td className={row.strong < row.coverageTarget ? 'text-amber-300' : 'text-emerald-300'}>{row.strong}/{row.coverageTarget}</td><td className={row.shortlist < row.shortlistTarget ? 'text-amber-300' : 'text-emerald-300'}>{row.shortlist}/{row.shortlistTarget}</td><td className={row.stageBreaches ? 'text-red-300' : 'text-emerald-300'}>{row.stageBreaches}</td><td className="text-slate-300">{row.feedbackEligible ? `${Math.round((row.feedbackComplete / row.feedbackEligible) * 100)}%` : '—'}</td></tr>)}</tbody></table></div></ChartPanel></section>

    {slaError && <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">Shared SLA settings could not be loaded. Default targets are shown until the connection is restored: {slaError}</section>}
    <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-xs leading-5 text-slate-500"><strong className="text-slate-300">Metric definitions:</strong> Days open uses the requisition posted date when available. Stage SLA compares current stage age with the organization-scoped requisition threshold. Manager response is completed feedback divided by candidates currently eligible for feedback. Source conversion is candidates with any pipeline placement divided by candidates in that source. Fairness progression is aggregate shortlist-or-later progression and is suppressed when source data is absent.</section>
  </div>;
};

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; tone: 'sky' | 'emerald' | 'amber' | 'red' | 'violet' }> = ({ icon, label, value, detail, tone }) => { const tones = { sky: 'text-sky-300 bg-sky-400/10', emerald: 'text-emerald-300 bg-emerald-400/10', amber: 'text-amber-300 bg-amber-400/10', red: 'text-red-300 bg-red-400/10', violet: 'text-violet-300 bg-violet-400/10' }; return <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-400">{label}</p><span className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</span></div><p className="mt-3 text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; };
const ChartPanel: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5"><h2 className="text-xl font-bold text-white">{title}</h2><p className="mt-1 mb-5 text-sm text-slate-400">{subtitle}</p>{children}</section>;
const Bar: React.FC<{ label: string; value: number; max: number; suffix: string; note: string; warning?: boolean }> = ({ label, value, max, suffix, note, warning }) => <div><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="capitalize text-slate-300">{label}</span><span className={warning ? 'font-bold text-amber-300' : 'font-bold text-white'}>{value}{suffix} <small className="ml-1 font-normal text-slate-500">{note}</small></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-700"><div className={`h-full rounded-full ${warning ? 'bg-amber-400' : 'bg-sky-400'}`} style={{ width: `${Math.min(100, Math.max(2, (value / max) * 100))}%` }} /></div></div>;
const Status: React.FC<{ value: HealthStatus }> = ({ value }) => <span className={`rounded-full px-2 py-1 text-xs font-bold ${value === 'Healthy' ? 'bg-emerald-400/10 text-emerald-300' : value === 'Watch' ? 'bg-amber-400/10 text-amber-300' : value === 'At risk' ? 'bg-red-400/10 text-red-300' : 'bg-slate-700 text-slate-300'}`}>{value}</span>;
const Empty: React.FC<{ text: string }> = ({ text }) => <div className="rounded-xl border border-dashed border-slate-600 p-8 text-center text-sm text-slate-400">{text}</div>;

export default RecruitingPortfolioAnalyticsPage;
