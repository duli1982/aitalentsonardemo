import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, Copy, FileText, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { Candidate, Job } from '../types';
import { canShareTalentIntel } from '../utils/permissions';
import { sharedOperationsService, type SharedTalentPool } from '../services/SharedOperationsService';
import type { ExternalJobPosting } from '../services/JobIntelligenceService';
import { workforceOperatingService, type TalentIntelReport, type TalentPoolHealthSnapshot } from '../services/WorkforceOperatingService';
import JobIntelligenceControl from './JobIntelligenceControl';

const TalentIntelligenceReports: React.FC<{ jobs: Job[]; candidates: Candidate[]; externalPostings: ExternalJobPosting[]; onMarketSourcesChanged: (postings: ExternalJobPosting[]) => void }> = ({ jobs, candidates, externalPostings, onMarketSourcesChanged }) => {
  const { user, activeOrganization } = useAuth();
  const { showToast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState('portfolio');
  const [reports, setReports] = useState<TalentIntelReport[]>([]);
  const [pools, setPools] = useState<SharedTalentPool[]>([]);
  const [poolHealth, setPoolHealth] = useState<TalentPoolHealthSnapshot[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const actor = useMemo(() => ({ userId: user.id, role: activeOrganization.role }), [activeOrganization.role, user.id]);
  const canShare = canShareTalentIntel(activeOrganization.role);

  const load = useCallback(async () => {
    const organizationId = activeOrganization.organizationId;
    const [nextPools, messages] = await Promise.all([sharedOperationsService.listPools(organizationId), sharedOperationsService.listMessages(organizationId)]);
    nextPools.forEach((pool) => workforceOperatingService.capturePoolHealth(organizationId, pool, candidates, messages));
    const nextReports = workforceOperatingService.listReports(organizationId, actor);
    setPools(nextPools);
    setPoolHealth(workforceOperatingService.listPoolHealth(organizationId));
    setReports(nextReports);
    setSelectedReportId((current) => nextReports.some((report) => report.id === current) ? current : nextReports[0]?.id ?? '');
  }, [activeOrganization.organizationId, actor, candidates]);

  useEffect(() => { void load(); }, [load]);

  const generate = () => {
    const job = jobs.find((item) => item.id === selectedJobId);
    const report = workforceOperatingService.generateReport(activeOrganization.organizationId, actor, { job, jobs, candidates, externalPostings, pools, poolHealth });
    setSelectedReportId(report.id);
    void load();
    showToast('Talent-intelligence draft generated for review.', 'success');
  };

  const share = (reportId: string) => {
    try {
      workforceOperatingService.shareReport(activeOrganization.organizationId, actor, reportId);
      void load();
      showToast('Report approved and shared with HM/TA audiences.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The report could not be shared.', 'warning');
    }
  };

  const selected = reports.find((report) => report.id === selectedReportId);
  const copy = async () => {
    if (!selected) return;
    const content = [selected.title, selected.summary, 'Candidate intelligence', ...selected.candidateSignals.map((value) => `- ${value}`), 'Market intelligence', ...selected.marketSignals.map((value) => `- ${value}`), 'Sourcing recommendations', ...selected.recommendations.map((value) => `- ${value}`), selected.sourceNote].join('\n');
    await navigator.clipboard.writeText(content);
    showToast('Report copied to the clipboard.', 'success');
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-violet-300">HM / TA advisory</p><h2 className="mt-1 text-xl font-bold text-white">Generate a talent-intelligence report</h2><p className="mt-1 max-w-2xl text-sm text-slate-400">Combine current candidate supply, requisition demand, saved-pool health, and connected public job postings into a controlled briefing.</p></div><div className="flex flex-col gap-2 sm:flex-row"><select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="portfolio">All active requisitions</option>{jobs.filter((job) => job.status === 'open').map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select><button type="button" onClick={generate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-400"><FileText className="h-4 w-4" />Generate draft</button></div></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-sky-400/10 px-3 py-1 text-sky-200">{jobs.filter((job) => job.status === 'open').length} active roles</span><span className="rounded-full bg-violet-400/10 px-3 py-1 text-violet-200">{candidates.length} candidate profiles</span><span className={`rounded-full px-3 py-1 ${externalPostings.length ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{externalPostings.length} connected market postings</span><span className="rounded-full bg-pink-400/10 px-3 py-1 text-pink-200">{pools.length} saved talent pools</span></div></section>

    <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]"><div className="rounded-2xl border border-slate-700 bg-slate-800/65 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">Report library</h3><button type="button" onClick={() => void load()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700"><RefreshCw className="h-4 w-4" /></button></div><div className="mt-3 space-y-2">{reports.map((report) => <button key={report.id} type="button" onClick={() => setSelectedReportId(report.id)} className={`w-full rounded-xl border p-3 text-left ${selectedReportId === report.id ? 'border-violet-400/40 bg-violet-400/10' : 'border-slate-700 bg-slate-900/35 hover:bg-slate-800'}`}><div className="flex items-start justify-between gap-2"><p className="font-semibold text-white">{report.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${report.status === 'shared' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{report.status}</span></div><p className="mt-2 text-xs text-slate-500">{new Date(report.updatedAt).toLocaleString()}</p></button>)}{!reports.length && <div className="rounded-xl border border-dashed border-slate-600 p-8 text-center text-sm text-slate-500">No reports generated yet.</div>}</div></div>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/65 p-5">{!selected ? <div className="py-16 text-center"><FileText className="mx-auto h-9 w-9 text-slate-600" /><p className="mt-3 font-semibold text-white">Select or generate a report</p></div> : <><div className="flex flex-col gap-4 border-b border-slate-700 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold text-white">{selected.title}</h3>{selected.status === 'shared' ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Shared</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-200"><ShieldAlert className="h-3.5 w-3.5" />Manager review required</span>}</div><p className="mt-2 text-sm leading-6 text-slate-300">{selected.summary}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"><Copy className="h-3.5 w-3.5" />Copy</button>{selected.status === 'draft' && canShare && <button type="button" onClick={() => share(selected.id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-400"><Send className="h-3.5 w-3.5" />Approve & share</button>}</div></div><div className="mt-5 grid gap-5 lg:grid-cols-3"><ReportSection title="Candidate intelligence" items={selected.candidateSignals} tone="violet" /><ReportSection title="Market intelligence" items={selected.marketSignals} tone="sky" /><ReportSection title="Sourcing strategy" items={selected.recommendations} tone="emerald" /></div><p className="mt-5 rounded-lg border border-slate-700 bg-slate-950/35 p-3 text-xs leading-5 text-slate-500"><strong className="text-slate-300">Source and limitation:</strong> {selected.sourceNote}</p></>}</div>
    </section>

    <JobIntelligenceControl onSynced={onMarketSourcesChanged} />
  </div>;
};

const ReportSection: React.FC<{ title: string; items: string[]; tone: 'violet' | 'sky' | 'emerald' }> = ({ title, items, tone }) => <section><h4 className={`flex items-center gap-2 text-sm font-bold ${tone === 'violet' ? 'text-violet-300' : tone === 'sky' ? 'text-sky-300' : 'text-emerald-300'}`}>{tone === 'sky' ? <BriefcaseBusiness className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{title}</h4><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="rounded-lg bg-slate-900/45 p-3 text-sm leading-5 text-slate-300">{item}</li>)}</ul></section>;

export default TalentIntelligenceReports;
