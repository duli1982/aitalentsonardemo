import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, Eye, FileText, History, ListFilter, Search, UserPlus, Users } from 'lucide-react';
import type { Candidate, Job, PipelineStage } from '../../types';
import { hybridCandidateRankingService } from '../../services/HybridCandidateRankingService';

type WorkspaceTab = 'overview' | 'ranked' | 'pipeline' | 'activity';
type RankFilter = 'all' | 'strong' | 'in-pipeline';

interface RequisitionWorkspaceTabsProps {
  job: Job;
  candidates: Candidate[];
  readOnly: boolean;
  onViewProfile: (candidate: Candidate) => void;
  onAddToPipeline: (candidate: Candidate, jobId: string) => void;
}

const STAGE_ORDER: PipelineStage[] = ['sourced', 'new', 'long_list', 'screening', 'scheduling', 'interview', 'offer', 'hired', 'rejected'];

function stageLabel(stage?: string) {
  if (!stage) return 'Not in pipeline';
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceLabel(candidate: Candidate) {
  if (candidate.type === 'internal') return 'Internal';
  if (candidate.type === 'past') return 'Previous applicant';
  return 'Uploaded';
}

function latestStageDate(candidate: Candidate, jobId: string) {
  return [...(candidate.pipelineHistory ?? [])].filter((entry) => entry.jobId === jobId).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0]?.timestamp;
}

function stageAge(candidate: Candidate, jobId: string) {
  const timestamp = latestStageDate(candidate, jobId);
  if (!timestamp) return null;
  const elapsed = Date.now() - Date.parse(timestamp);
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 86_400_000)) : null;
}

const RequisitionWorkspaceTabs: React.FC<RequisitionWorkspaceTabsProps> = ({ job, candidates, readOnly, onViewProfile, onAddToPipeline }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('ranked');
  const [query, setQuery] = useState('');
  const [rankFilter, setRankFilter] = useState<RankFilter>('all');

  const ranked = useMemo(() => hybridCandidateRankingService.rankForJob(job, candidates.map((candidate) => ({
    ...candidate,
    title: candidate.currentRole ?? candidate.role ?? candidate.title,
    experienceYears: candidate.experienceYears ?? candidate.experience,
    semanticSimilarity: typeof candidate.matchScores?.[job.id] === 'number' ? candidate.matchScores[job.id] / 100 : undefined,
  }))), [candidates, job]);

  const pipelineCandidates = useMemo(() => ranked.filter((candidate) => Boolean(candidate.pipelineStage?.[job.id])), [job.id, ranked]);
  const strongCount = ranked.filter((candidate) => candidate.hybridScore >= 70).length;
  const shortlistCount = pipelineCandidates.filter((candidate) => ['long_list', 'screening', 'scheduling', 'interview', 'offer', 'hired'].includes(String(candidate.pipelineStage?.[job.id]))).length;

  const visibleRanked = useMemo(() => ranked.filter((candidate) => {
    const searchText = `${candidate.name} ${candidate.title ?? ''} ${candidate.location ?? ''} ${(candidate.skills ?? []).join(' ')}`.toLowerCase();
    if (query.trim() && !searchText.includes(query.trim().toLowerCase())) return false;
    if (rankFilter === 'strong') return candidate.hybridScore >= 70;
    if (rankFilter === 'in-pipeline') return Boolean(candidate.pipelineStage?.[job.id]);
    return true;
  }), [job.id, query, rankFilter, ranked]);

  const activity = useMemo(() => candidates.flatMap((candidate) => (candidate.pipelineHistory ?? [])
    .filter((entry) => entry.jobId === job.id)
    .map((entry) => ({ candidate, entry })))
    .sort((a, b) => Date.parse(b.entry.timestamp) - Date.parse(a.entry.timestamp)), [candidates, job.id]);

  const tabs: Array<{ id: WorkspaceTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'ranked', label: 'Ranked Talent', count: ranked.length },
    { id: 'pipeline', label: 'Pipeline', count: pipelineCandidates.length },
    { id: 'activity', label: 'Activity', count: activity.length },
  ];

  return <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 px-4 pt-2" role="tablist" aria-label="Requisition workspace">
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}>
        {tab.label}{tab.count !== undefined && <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.id ? 'bg-sky-400/15 text-sky-200' : 'bg-slate-700 text-slate-400'}`}>{tab.count}</span>}
        {activeTab === tab.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sky-400" />}
      </button>)}
      {readOnly && <span className="ml-auto mb-2 rounded-full border border-slate-600 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-300">Read-only requisition</span>}
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-5">
      {activeTab === 'overview' && <OverviewTab job={job} strongCount={strongCount} shortlistCount={shortlistCount} pipelineCount={pipelineCandidates.length} />}
      {activeTab === 'ranked' && <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="text-lg font-bold text-white">Ranked talent</h3><p className="mt-1 text-sm text-slate-400">Compare fit evidence, pipeline state, and the next recruiter action in one view.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates or skills" className="w-full rounded-lg border border-slate-600 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-400 sm:w-64" /></label><label className="relative"><ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><select value={rankFilter} onChange={(event) => setRankFilter(event.target.value as RankFilter)} className="rounded-lg border border-slate-600 bg-slate-900 py-2 pl-9 pr-8 text-sm text-slate-200"><option value="all">All candidates</option><option value="strong">Strong fit (70+)</option><option value="in-pipeline">In pipeline</option></select></label></div>
        </div>
        <RankedTalentTable job={job} candidates={visibleRanked} readOnly={readOnly} onViewProfile={onViewProfile} onAddToPipeline={onAddToPipeline} />
      </div>}
      {activeTab === 'pipeline' && <PipelineTab job={job} candidates={pipelineCandidates} readOnly={readOnly} onViewProfile={onViewProfile} />}
      {activeTab === 'activity' && <ActivityTab job={job} activity={activity} />}
    </div>
  </section>;
};

const OverviewTab: React.FC<{ job: Job; strongCount: number; shortlistCount: number; pipelineCount: number }> = ({ job, strongCount, shortlistCount, pipelineCount }) => <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
  <div className="space-y-5"><Panel title="Role summary" icon={<FileText className="h-5 w-5" />}><p className="text-sm leading-6 text-slate-300">{job.description || 'No job description has been provided.'}</p></Panel><Panel title="Requirements" icon={<CheckCircle2 className="h-5 w-5" />}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Required</p><div className="flex flex-wrap gap-2">{job.requiredSkills.length ? job.requiredSkills.map((skill) => <span key={skill} className="rounded-full bg-sky-400/10 px-3 py-1.5 text-sm text-sky-200">{skill}</span>) : <span className="text-sm text-slate-500">No required skills recorded.</span>}</div>{Boolean(job.niceToHaveSkills?.length) && <><p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Nice to have</p><div className="flex flex-wrap gap-2">{job.niceToHaveSkills!.map((skill) => <span key={skill} className="rounded-full border border-slate-600 px-3 py-1.5 text-sm text-slate-300">{skill}</span>)}</div></>}</Panel></div>
  <div className="space-y-5"><Panel title="Recruiting snapshot" icon={<Users className="h-5 w-5" />}><div className="grid grid-cols-2 gap-3"><Metric label="Strong matches" value={strongCount} /><Metric label="In pipeline" value={pipelineCount} /><Metric label="Shortlisted" value={shortlistCount} /><Metric label="Applicants" value={job.applicants ?? '—'} /></div></Panel><Panel title="Role details" icon={<FileText className="h-5 w-5" />}><dl className="space-y-3 text-sm"><Detail label="Department" value={job.department} /><Detail label="Location" value={job.location} /><Detail label="Employment" value={job.type ?? 'Full-time'} /><Detail label="Headcount" value={job.headcount ?? 1} /><Detail label="Posted" value={job.postedDate ?? job.posted ? new Date(job.postedDate ?? job.posted!).toLocaleDateString() : 'Not recorded'} /></dl></Panel></div>
</div>;

const RankedTalentTable: React.FC<{ job: Job; candidates: ReturnType<typeof hybridCandidateRankingService.rankForJob<Candidate>>; readOnly: boolean; onViewProfile: (candidate: Candidate) => void; onAddToPipeline: (candidate: Candidate, jobId: string) => void }> = ({ job, candidates, readOnly, onViewProfile, onAddToPipeline }) => <div className="overflow-x-auto rounded-xl border border-slate-700">
  <table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-14 px-4 py-3 text-center">Rank</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Fit</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3 text-right">Next action</th></tr></thead><tbody className="divide-y divide-slate-700 bg-slate-800/40">{candidates.map((candidate, index) => { const stage = candidate.pipelineStage?.[job.id]; const age = stageAge(candidate, job.id); return <tr key={candidate.id} className="group hover:bg-slate-700/35"><td className="px-4 py-4 text-center"><span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold ${index < 3 ? 'bg-sky-400/15 text-sky-200' : 'bg-slate-700 text-slate-300'}`}>{index + 1}</span></td><td className="px-4 py-4"><button type="button" onClick={() => onViewProfile(candidate)} className="font-bold text-white hover:text-sky-300">{candidate.name}</button><p className="mt-1 max-w-60 truncate text-xs text-slate-400">{candidate.currentRole ?? candidate.role ?? candidate.title ?? 'Role not recorded'}{candidate.location ? ` · ${candidate.location}` : ''}</p></td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-2 w-20 overflow-hidden rounded-full bg-slate-700"><div className={`h-full rounded-full ${candidate.hybridScore >= 70 ? 'bg-emerald-400' : candidate.hybridScore >= 50 ? 'bg-amber-400' : 'bg-slate-500'}`} style={{ width: `${candidate.hybridScore}%` }} /></div><span className={`font-bold ${candidate.hybridScore >= 70 ? 'text-emerald-300' : candidate.hybridScore >= 50 ? 'text-amber-300' : 'text-slate-300'}`}>{candidate.hybridScore}%</span></div><p className="mt-1 text-xs text-slate-500">Structured {candidate.structuredScore}%{candidate.semanticScore ? ` · Semantic ${candidate.semanticScore}%` : ''}</p></td><td className="max-w-72 px-4 py-4"><div className="flex flex-wrap gap-1">{candidate.matchedMustHaveSkills.slice(0, 3).map((skill) => <span key={skill} className="rounded bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">{skill}</span>)}{candidate.missingMustHaveSkills.slice(0, 1).map((skill) => <span key={skill} className="rounded bg-amber-400/10 px-2 py-1 text-xs text-amber-200">Missing {skill}</span>)}{!candidate.matchedMustHaveSkills.length && !candidate.missingMustHaveSkills.length && <span className="text-xs text-slate-500">General profile evidence</span>}</div></td><td className="px-4 py-4"><span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">{sourceLabel(candidate)}</span></td><td className="px-4 py-4"><p className="font-medium text-slate-200">{stageLabel(stage)}</p>{age !== null && <p className={`mt-1 text-xs ${age >= 5 ? 'text-amber-300' : 'text-slate-500'}`}>{age} days in stage</p>}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => onViewProfile(candidate)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"><Eye className="h-3.5 w-3.5" />Review</button><button type="button" disabled={readOnly || Boolean(stage)} onClick={() => onAddToPipeline(candidate, job.id)} title={readOnly ? 'Closed requisitions are read-only' : stage ? 'Candidate is already in this pipeline' : 'Add candidate to shortlist'} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"><UserPlus className="h-3.5 w-3.5" />{stage ? 'In pipeline' : readOnly ? 'Read only' : 'Shortlist'}</button></div></td></tr>; })}</tbody></table>
  {!candidates.length && <div className="p-12 text-center"><Search className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 font-semibold text-white">No candidates match these filters</p><p className="mt-1 text-sm text-slate-500">Clear the search or select another talent filter.</p></div>}
</div>;

const PipelineTab: React.FC<{ job: Job; candidates: Candidate[]; readOnly: boolean; onViewProfile: (candidate: Candidate) => void }> = ({ job, candidates, readOnly, onViewProfile }) => {
  const counts = STAGE_ORDER.map((stage) => ({ stage, count: candidates.filter((candidate) => candidate.pipelineStage?.[job.id] === stage).length })).filter((item) => item.count > 0);
  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-bold text-white">Pipeline</h3><p className="mt-1 text-sm text-slate-400">Current stage, aging, and candidate ownership for this requisition.</p></div>{readOnly && <span className="inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200"><AlertTriangle className="h-4 w-4" />Stage changes are disabled because the role is closed.</span>}</div><div className="flex flex-wrap gap-2">{counts.map((item) => <span key={item.stage} className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-300"><b className="text-white">{item.count}</b> {stageLabel(item.stage)}</span>)}</div><div className="divide-y divide-slate-700 rounded-xl border border-slate-700">{candidates.map((candidate) => { const stage = candidate.pipelineStage?.[job.id]; const age = stageAge(candidate, job.id); return <button key={candidate.id} type="button" onClick={() => onViewProfile(candidate)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-slate-700/30"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-slate-200">{candidate.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="font-semibold text-white">{candidate.name}</p><p className="truncate text-xs text-slate-400">{candidate.currentRole ?? candidate.role ?? 'Candidate'} · {sourceLabel(candidate)}</p></div><div className="text-right"><p className="font-semibold text-sky-200">{stageLabel(stage)}</p><p className={`mt-1 text-xs ${age !== null && age >= 5 ? 'text-amber-300' : 'text-slate-500'}`}>{age === null ? 'Age unavailable' : `${age} days`}</p></div><ChevronRight className="h-4 w-4 text-slate-500" /></button>; })}{!candidates.length && <EmptyState title="Pipeline is empty" detail={readOnly ? 'No candidates were added before this requisition was closed.' : 'Shortlist a candidate from Ranked Talent to begin the pipeline.'} />}</div></div>;
};

const ActivityTab: React.FC<{ job: Job; activity: Array<{ candidate: Candidate; entry: NonNullable<Candidate['pipelineHistory']>[number] }> }> = ({ job, activity }) => <div className="space-y-5"><div><h3 className="text-lg font-bold text-white">Activity</h3><p className="mt-1 text-sm text-slate-400">Recorded pipeline changes and recruiter decisions for this requisition.</p></div><div className="rounded-xl border border-slate-700"><div className="flex gap-3 border-b border-slate-700 p-4"><div className="rounded-lg bg-sky-400/10 p-2 text-sky-300"><FileText className="h-4 w-4" /></div><div><p className="font-semibold text-white">Requisition {job.status}</p><p className="mt-1 text-xs text-slate-500">Current role status · {job.postedDate ?? job.posted ? `posted ${new Date(job.postedDate ?? job.posted!).toLocaleDateString()}` : 'posted date unavailable'}</p></div></div>{activity.map(({ candidate, entry }, index) => <div key={`${candidate.id}-${entry.timestamp}-${index}`} className="flex gap-3 border-b border-slate-700 p-4 last:border-0"><div className="rounded-lg bg-violet-400/10 p-2 text-violet-300"><History className="h-4 w-4" /></div><div className="min-w-0"><p className="font-semibold text-white">{candidate.name} moved to {stageLabel(entry.stage)}</p><p className="mt-1 text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}{entry.reason ? ` · ${entry.reason}` : ''}{entry.actorType ? ` · ${entry.actorType}` : ''}</p></div></div>)}{!activity.length && <EmptyState title="No recorded candidate activity" detail="Pipeline changes for this role will appear here." />}</div></div>;

const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => <section className="rounded-xl border border-slate-700 bg-slate-900/35 p-5"><div className="mb-4 flex items-center gap-2 text-sky-300">{icon}<h3 className="font-bold text-white">{title}</h3></div>{children}</section>;
const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value}</p></div>;
const Detail: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-200">{value}</dd></div>;
const EmptyState: React.FC<{ title: string; detail: string }> = ({ title, detail }) => <div className="p-12 text-center"><Clock3 className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 font-semibold text-white">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>;

export default RequisitionWorkspaceTabs;
