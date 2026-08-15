import React, { useMemo, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2, Search, ShieldAlert, Target, UserRound, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Candidate, Job } from '../types';
import type { ExternalJobPosting } from '../services/JobIntelligenceService';

type CoverageStatus = 'critical' | 'watch' | 'covered' | 'supply-only';
type DepartmentStatus = 'healthy' | 'watch' | 'at-risk';

type SkillIntelligence = {
  key: string;
  skill: string;
  demand: number;
  internalDemand: number;
  marketDemand: number;
  supply: number;
  gap: number;
  coverage: number | null;
  status: CoverageStatus;
  departments: string[];
  locations: string[];
  jobs: Job[];
  marketPostings: ExternalJobPosting[];
  candidates: Candidate[];
};

type DepartmentIntelligence = {
  department: string;
  status: DepartmentStatus;
  jobs: Job[];
  candidates: Candidate[];
  internalSupply: number;
  externalSupply: number;
  coverageTarget: number;
  coverage: number;
  criticalSkills: SkillIntelligence[];
  demandedSkillCount: number;
};

function normalizeSkill(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function statusFor(demand: number, supply: number): CoverageStatus {
  if (demand === 0) return 'supply-only';
  const coverage = supply / demand;
  if (coverage < 0.5) return 'critical';
  if (coverage < 1) return 'watch';
  return 'covered';
}

function buildSkillIntelligence(jobs: Job[], candidates: Candidate[], externalPostings: ExternalJobPosting[]): SkillIntelligence[] {
  const records = new Map<string, { label: string; jobs: Map<string, Job>; marketPostings: Map<string, ExternalJobPosting>; candidates: Map<string, Candidate>; departments: Set<string>; locations: Set<string> }>();
  const ensure = (rawSkill: string) => {
    const key = normalizeSkill(rawSkill);
    if (!key) return null;
    if (!records.has(key)) records.set(key, { label: rawSkill.trim(), jobs: new Map(), marketPostings: new Map(), candidates: new Map(), departments: new Set(), locations: new Set() });
    return records.get(key)!;
  };

  jobs.filter((job) => job.status === 'open').forEach((job) => {
    [...new Set(job.requiredSkills.map(normalizeSkill))].forEach((key) => {
      const display = job.requiredSkills.find((skill) => normalizeSkill(skill) === key) ?? key;
      const record = ensure(display);
      if (!record) return;
      record.jobs.set(job.id, job);
      if (job.department) record.departments.add(job.department);
      if (job.location) record.locations.add(job.location);
    });
  });

  externalPostings.forEach((posting) => {
    [...new Set((posting.skills ?? []).map(normalizeSkill))].forEach((key) => {
      const display = posting.skills?.find((skill) => normalizeSkill(skill) === key) ?? key;
      const record = ensure(display);
      if (!record) return;
      record.marketPostings.set(`${posting.provider}:${posting.external_job_id}`, posting);
      if (posting.department) record.departments.add(posting.department);
      if (posting.location) record.locations.add(posting.location);
    });
  });

  candidates.filter((candidate) => candidate.employmentStatus !== 'hired').forEach((candidate) => {
    const skills = [...(candidate.skills ?? []), ...(candidate.inferredSkills ?? []), ...(candidate.passport?.verifiedSkills.map((skill) => skill.skillName) ?? [])];
    [...new Set(skills.map(normalizeSkill))].forEach((key) => {
      const display = skills.find((skill) => normalizeSkill(skill) === key) ?? key;
      const record = ensure(display);
      if (!record) return;
      record.candidates.set(candidate.id, candidate);
    });
  });

  return Array.from(records.entries()).map(([key, record]) => {
    const internalDemand = record.jobs.size;
    const marketDemand = record.marketPostings.size;
    const demand = internalDemand + marketDemand;
    const supply = record.candidates.size;
    return {
      key,
      skill: record.label,
      demand,
      internalDemand,
      marketDemand,
      supply,
      gap: Math.max(0, demand - supply),
      coverage: demand ? Math.round((supply / demand) * 100) : null,
      status: statusFor(demand, supply),
      departments: [...record.departments].sort(),
      locations: [...record.locations].sort(),
      jobs: [...record.jobs.values()],
      marketPostings: [...record.marketPostings.values()],
      candidates: [...record.candidates.values()],
    };
  });
}

function candidateSkills(candidate: Candidate) {
  return new Set([...(candidate.skills ?? []), ...(candidate.inferredSkills ?? []), ...(candidate.passport?.verifiedSkills.map((skill) => skill.skillName) ?? [])].map(normalizeSkill));
}

function jobCoverageTarget(job: Job) {
  const health = job.companyContext?.requisitionHealth;
  if (!health || typeof health !== 'object') return 5;
  const target = Number((health as { coverageTarget?: number }).coverageTarget);
  return target > 0 ? target : 5;
}

function isRelevantForJob(candidate: Candidate, job: Job) {
  const required = [...new Set(job.requiredSkills.map(normalizeSkill))];
  if (!required.length) return false;
  const available = candidateSkills(candidate);
  const matches = required.filter((skill) => available.has(skill)).length;
  return matches >= Math.max(1, Math.ceil(required.length / 2));
}

function buildDepartmentIntelligence(jobs: Job[], candidates: Candidate[], skills: SkillIntelligence[]): DepartmentIntelligence[] {
  const searchable = candidates.filter((candidate) => candidate.employmentStatus !== 'hired');
  const grouped = new Map<string, Job[]>();
  jobs.filter((job) => job.status === 'open').forEach((job) => grouped.set(job.department || 'Unknown', [...(grouped.get(job.department || 'Unknown') ?? []), job]));

  return [...grouped.entries()].map(([department, departmentJobs]) => {
    const relevant = searchable.filter((candidate) => departmentJobs.some((job) => isRelevantForJob(candidate, job)));
    const coverageTarget = departmentJobs.reduce((sum, job) => sum + jobCoverageTarget(job), 0);
    const coverage = coverageTarget ? Math.round((relevant.length / coverageTarget) * 100) : 0;
    const criticalSkills = skills.filter((skill) => skill.departments.includes(department) && skill.demand > 0 && skill.status !== 'covered').sort((left, right) => right.gap - left.gap || left.coverage! - right.coverage!);
    const demandedSkillCount = skills.filter((skill) => skill.departments.includes(department) && skill.demand > 0).length;
    const status: DepartmentStatus = coverage < 50 || criticalSkills.filter((skill) => skill.status === 'critical').length >= 3 ? 'at-risk' : coverage < 100 || criticalSkills.length > 0 ? 'watch' : 'healthy';
    return {
      department,
      status,
      jobs: departmentJobs,
      candidates: relevant,
      internalSupply: relevant.filter((candidate) => candidate.type === 'internal').length,
      externalSupply: relevant.filter((candidate) => candidate.type !== 'internal').length,
      coverageTarget,
      coverage,
      criticalSkills,
      demandedSkillCount,
    };
  }).sort((left, right) => {
    const weight: Record<DepartmentStatus, number> = { 'at-risk': 3, watch: 2, healthy: 1 };
    return weight[right.status] - weight[left.status] || left.coverage - right.coverage || right.jobs.length - left.jobs.length;
  });
}

const SkillsSupplyDemandView: React.FC<{ jobs: Job[]; candidates: Candidate[]; externalPostings?: ExternalJobPosting[] }> = ({ jobs, candidates, externalPostings = [] }) => {
  const navigate = useNavigate();
  const [analysisView, setAnalysisView] = useState<'skills' | 'departments'>('skills');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState<'all' | CoverageStatus>('all');
  const [selectedSkill, setSelectedSkill] = useState<SkillIntelligence | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentIntelligence | null>(null);
  const intelligence = useMemo(() => buildSkillIntelligence(jobs, candidates, externalPostings), [candidates, externalPostings, jobs]);
  const departmentIntelligence = useMemo(() => buildDepartmentIntelligence(jobs, candidates, intelligence), [candidates, intelligence, jobs]);
  const departments = useMemo(() => [...new Set(intelligence.flatMap((item) => item.departments))].sort(), [intelligence]);
  const visible = useMemo(() => intelligence.filter((item) => {
    if (query && !`${item.skill} ${item.departments.join(' ')} ${item.locations.join(' ')}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (department !== 'all' && !item.departments.includes(department)) return false;
    if (status !== 'all' && item.status !== status) return false;
    return true;
  }).sort((left, right) => {
    const statusWeight: Record<CoverageStatus, number> = { critical: 4, watch: 3, covered: 2, 'supply-only': 1 };
    return statusWeight[right.status] - statusWeight[left.status] || right.gap - left.gap || right.demand - left.demand || right.supply - left.supply;
  }), [department, intelligence, query, status]);

  const openJobs = jobs.filter((job) => job.status === 'open').length;
  const searchableCandidates = candidates.filter((candidate) => candidate.employmentStatus !== 'hired').length;
  const demandedSkills = intelligence.filter((item) => item.demand > 0);
  const criticalGaps = demandedSkills.filter((item) => item.status === 'critical').length;
  const coveredSkills = demandedSkills.filter((item) => item.status === 'covered').length;

  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <Metric icon={<BriefcaseBusiness className="h-5 w-5" />} label="Open roles" value={openJobs} detail="included in demand" tone="sky" />
      <Metric icon={<Building2 className="h-5 w-5" />} label="Market postings" value={externalPostings.length} detail={externalPostings.length ? 'Greenhouse / Lever' : 'No market source connected'} tone="sky" />
      <Metric icon={<Users className="h-5 w-5" />} label="Talent profiles" value={searchableCandidates} detail="included in supply" tone="violet" />
      <Metric icon={<Target className="h-5 w-5" />} label="Critical gaps" value={criticalGaps} detail="coverage below 50%" tone="red" />
      <Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Covered skills" value={coveredSkills} detail={`of ${demandedSkills.length} demanded`} tone="green" />
    </section>

    <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/35 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-white">Coverage analysis</p><p className="mt-0.5 text-xs text-slate-500">Move from individual capability gaps to department-level action planning.</p></div><div className="flex rounded-lg border border-slate-600 bg-slate-950 p-1"><button type="button" onClick={() => setAnalysisView('skills')} className={`rounded px-3 py-2 text-xs font-bold ${analysisView === 'skills' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}>Skill gaps</button><button type="button" onClick={() => setAnalysisView('departments')} className={`rounded px-3 py-2 text-xs font-bold ${analysisView === 'departments' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}>Department coverage</button></div></div>

    {analysisView === 'skills' ? <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/65">
      <div className="flex flex-col gap-4 border-b border-slate-700 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div><h2 className="text-lg font-bold text-white">Skills supply versus demand</h2><p className="mt-1 text-sm text-slate-400">Demand combines open requisitions with skills inferred from synced Greenhouse/Lever postings. Supply counts unique, non-hired profiles.</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skill, department or location" className="w-full rounded-lg border border-slate-600 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></label>
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-300"><option value="all">All departments</option>{departments.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | CoverageStatus)} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-300"><option value="all">All coverage</option><option value="critical">Critical gap</option><option value="watch">Watch</option><option value="covered">Covered</option><option value="supply-only">Supply only</option></select>
        </div>
      </div>

      <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-slate-950/55 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Skill</th><th className="px-4 py-3 text-center">Internal</th><th className="px-4 py-3 text-center">Market</th><th className="px-4 py-3 text-center">Supply</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3 text-center">Gap</th><th className="px-4 py-3">Departments</th><th className="px-5 py-3 text-right">Evidence</th></tr></thead><tbody className="divide-y divide-slate-700">{visible.map((item) => <tr key={item.key} className="group hover:bg-slate-700/25"><td className="px-5 py-4"><button type="button" onClick={() => setSelectedSkill(item)} className="font-bold text-white group-hover:text-sky-300">{item.skill}</button><div className="mt-1"><CoverageBadge status={item.status} /></div></td><td className="px-4 py-4 text-center"><span className="text-lg font-bold text-sky-200">{item.internalDemand}</span><p className="text-[10px] text-slate-500">open roles</p></td><td className="px-4 py-4 text-center"><span className="text-lg font-bold text-cyan-200">{item.marketDemand}</span><p className="text-[10px] text-slate-500">postings</p></td><td className="px-4 py-4 text-center"><span className="text-lg font-bold text-violet-200">{item.supply}</span><p className="text-[10px] text-slate-500">profiles</p></td><td className="px-4 py-4"><CoverageBar coverage={item.coverage} status={item.status} /></td><td className="px-4 py-4 text-center"><span className={`inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs font-bold ${item.gap > 0 ? 'bg-red-400/10 text-red-200' : 'bg-emerald-400/10 text-emerald-200'}`}>{item.gap}</span></td><td className="max-w-72 px-4 py-4"><p className="truncate text-slate-300">{item.departments.length ? item.departments.join(', ') : 'No active demand'}</p><p className="mt-1 truncate text-xs text-slate-500">{item.locations.join(', ')}</p></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelectedSkill(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">View evidence <ArrowRight className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table></div>
      {!visible.length && <div className="p-12 text-center"><Search className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 font-bold text-white">No skills match these filters</p><button type="button" onClick={() => { setQuery(''); setDepartment('all'); setStatus('all'); }} className="mt-3 text-sm font-semibold text-sky-300 hover:text-sky-200">Clear filters</button></div>}
    </section> : <DepartmentCoverageTable departments={departmentIntelligence} onOpen={setSelectedDepartment} onOpenJob={(job) => navigate(`/requisitions/${job.id}`)} onFindTalent={() => navigate('/candidates')} onCreatePool={() => navigate('/talent-pools')} />}

    {selectedSkill && <SkillEvidenceDrawer insight={selectedSkill} onClose={() => setSelectedSkill(null)} onOpenJob={(job) => navigate(`/requisitions/${job.id}`)} onOpenCandidate={(candidate) => navigate(`/candidates/${candidate.id}`)} onViewTalent={() => navigate('/candidates')} onCreatePool={() => navigate('/talent-pools')} />}
    {selectedDepartment && <DepartmentEvidenceDrawer insight={selectedDepartment} onClose={() => setSelectedDepartment(null)} onOpenJob={(job) => navigate(`/requisitions/${job.id}`)} onOpenCandidate={(candidate) => navigate(`/candidates/${candidate.id}`)} onFindTalent={() => navigate('/candidates')} onCreatePool={() => navigate('/talent-pools')} />}
  </div>;
};

const DepartmentCoverageTable: React.FC<{ departments: DepartmentIntelligence[]; onOpen: (insight: DepartmentIntelligence) => void; onOpenJob: (job: Job) => void; onFindTalent: () => void; onCreatePool: () => void }> = ({ departments, onOpen, onOpenJob, onFindTalent, onCreatePool }) => <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/65">
  <div className="border-b border-slate-700 p-4"><h2 className="text-lg font-bold text-white">Department coverage and action planning</h2><p className="mt-1 text-sm text-slate-400">Talent supply requires at least half of a role's required skills. Targets come from requisition health controls.</p></div>
  <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-slate-950/55 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Department</th><th className="px-4 py-3 text-center">Open roles</th><th className="px-4 py-3">Talent supply</th><th className="px-4 py-3">Coverage target</th><th className="px-4 py-3">Critical skills</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-700">{departments.map((item) => <tr key={item.department} className="group hover:bg-slate-700/25"><td className="px-5 py-4"><button type="button" onClick={() => onOpen(item)} className="font-bold text-white group-hover:text-sky-300">{item.department}</button><div className="mt-1"><DepartmentHealthBadge status={item.status} /></div></td><td className="px-4 py-4 text-center"><span className="text-lg font-bold text-sky-200">{item.jobs.length}</span><p className="text-[10px] text-slate-500">requisitions</p></td><td className="px-4 py-4"><p className="font-bold text-white">{item.candidates.length} profiles</p><div className="mt-1 flex gap-2 text-xs"><span className="text-emerald-300">{item.internalSupply} internal</span><span className="text-violet-300">{item.externalSupply} external</span></div></td><td className="px-4 py-4"><DepartmentCoverageBar coverage={item.coverage} supply={item.candidates.length} target={item.coverageTarget} status={item.status} /></td><td className="max-w-80 px-4 py-4"><div className="flex flex-wrap gap-1">{item.criticalSkills.slice(0, 3).map((skill) => <span key={skill.key} className={`rounded px-2 py-1 text-xs ${skill.status === 'critical' ? 'bg-red-400/10 text-red-200' : 'bg-amber-400/10 text-amber-200'}`}>{skill.skill}</span>)}{item.criticalSkills.length > 3 && <span className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300">+{item.criticalSkills.length - 3}</span>}{!item.criticalSkills.length && <span className="text-xs text-emerald-300">No current skill gaps</span>}</div><p className="mt-1 text-[10px] text-slate-500">{item.demandedSkillCount} demanded skills</p></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={onFindTalent} className="rounded-lg border border-slate-600 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Find talent</button><button type="button" onClick={onCreatePool} className="rounded-lg border border-slate-600 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Create pool</button>{item.jobs[0] && <button type="button" onClick={() => onOpenJob(item.jobs[0])} className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-700" aria-label={`Open ${item.department} requisition`} title="Open affected requisition"><BriefcaseBusiness className="h-4 w-4" /></button>}<button type="button" onClick={() => onOpen(item)} className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-400">Plan <ArrowRight className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table></div>
  {!departments.length && <div className="p-12 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-bold text-white">No open department demand</p><p className="mt-1 text-sm text-slate-500">Open requisitions will appear here when department and required-skill data are available.</p></div>}
</section>;

const DepartmentHealthBadge: React.FC<{ status: DepartmentStatus }> = ({ status }) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status === 'at-risk' ? 'bg-red-400/10 text-red-200' : status === 'watch' ? 'bg-amber-400/10 text-amber-200' : 'bg-emerald-400/10 text-emerald-200'}`}>{status === 'at-risk' ? 'At risk' : status}</span>;

const DepartmentCoverageBar: React.FC<{ coverage: number; supply: number; target: number; status: DepartmentStatus }> = ({ coverage, supply, target, status }) => <div className="min-w-44"><div className="flex items-center justify-between gap-2"><span className={`font-bold ${status === 'at-risk' ? 'text-red-200' : status === 'watch' ? 'text-amber-200' : 'text-emerald-200'}`}>{coverage}%</span><span className="text-[10px] text-slate-500">{supply}/{target} profiles</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700"><div className={`h-full rounded-full ${status === 'at-risk' ? 'bg-red-400' : status === 'watch' ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, coverage)}%` }} /></div></div>;

const DepartmentEvidenceDrawer: React.FC<{ insight: DepartmentIntelligence; onClose: () => void; onOpenJob: (job: Job) => void; onOpenCandidate: (candidate: Candidate) => void; onFindTalent: () => void; onCreatePool: () => void }> = ({ insight, onClose, onOpenJob, onOpenCandidate, onFindTalent, onCreatePool }) => <div className="fixed inset-0 z-[170]"><button type="button" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-label="Close department plan" /><aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"><header className="border-b border-slate-700 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-sky-300">Department action plan</p><h2 className="mt-1 text-2xl font-bold text-white">{insight.department}</h2><div className="mt-2"><DepartmentHealthBadge status={insight.status} /></div></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><DrawerMetric label="Open roles" value={insight.jobs.length} /><DrawerMetric label="Talent supply" value={insight.candidates.length} /><DrawerMetric label="Target" value={insight.coverageTarget} /><DrawerMetric label="Coverage" value={`${insight.coverage}%`} warning={insight.status === 'at-risk'} /></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3"><p className="text-xl font-bold text-emerald-200">{insight.internalSupply}</p><p className="text-xs text-emerald-300/75">Internal supply</p></div><div className="rounded-lg border border-violet-400/20 bg-violet-400/10 p-3"><p className="text-xl font-bold text-violet-200">{insight.externalSupply}</p><p className="text-xs text-violet-300/75">External supply</p></div></div></header><div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 custom-scrollbar"><section><h3 className="flex items-center gap-2 font-bold text-white"><ShieldAlert className="h-4 w-4 text-amber-300" />Critical skills <span className="text-xs text-slate-500">{insight.criticalSkills.length}</span></h3><div className="mt-3 divide-y divide-slate-700 rounded-xl border border-slate-700">{insight.criticalSkills.map((skill) => <div key={skill.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 p-3"><div><p className="font-semibold text-white">{skill.skill}</p><CoverageBadge status={skill.status} /></div><div className="text-right"><p className="font-bold text-sky-200">{skill.demand}</p><p className="text-[10px] text-slate-500">demand</p></div><div className="text-right"><p className="font-bold text-violet-200">{skill.supply}</p><p className="text-[10px] text-slate-500">supply</p></div></div>)}{!insight.criticalSkills.length && <p className="p-4 text-sm text-emerald-300">Every demanded skill currently has sufficient profile coverage.</p>}</div></section><section><h3 className="flex items-center gap-2 font-bold text-white"><BriefcaseBusiness className="h-4 w-4 text-sky-300" />Affected requisitions <span className="text-xs text-slate-500">{insight.jobs.length}</span></h3><div className="mt-3 divide-y divide-slate-700 rounded-xl border border-slate-700">{insight.jobs.map((job) => <button key={job.id} type="button" onClick={() => onOpenJob(job)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-800"><div><p className="font-semibold text-white">{job.title}</p><p className="mt-1 text-xs text-slate-400">{job.location} · Coverage target {jobCoverageTarget(job)}</p></div><ArrowRight className="h-4 w-4 text-slate-500" /></button>)}</div></section><section><h3 className="flex items-center gap-2 font-bold text-white"><Users className="h-4 w-4 text-violet-300" />Relevant talent <span className="text-xs text-slate-500">{insight.candidates.length}</span></h3><p className="mt-1 text-xs text-slate-500">Profiles matching at least half of one affected role's required skills.</p><div className="mt-3 divide-y divide-slate-700 rounded-xl border border-slate-700">{insight.candidates.slice(0, 12).map((candidate) => <button key={candidate.id} type="button" onClick={() => onOpenCandidate(candidate)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-800"><div><p className="font-semibold text-white">{candidate.name}</p><p className="mt-1 text-xs text-slate-400">{candidate.currentRole ?? candidate.role ?? 'Candidate'}{candidate.location ? ` · ${candidate.location}` : ''}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${candidate.type === 'internal' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-violet-400/10 text-violet-200'}`}>{candidate.type === 'internal' ? 'Internal' : 'External'}</span></button>)}{!insight.candidates.length && <p className="p-4 text-sm text-slate-500">No profiles currently meet the department relevance threshold.</p>}</div></section></div><footer className="flex flex-wrap gap-2 border-t border-slate-700 bg-slate-950/50 p-4"><button type="button" onClick={onFindTalent} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400"><Search className="h-4 w-4" />Find talent</button><button type="button" onClick={onCreatePool} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"><Users className="h-4 w-4" />Create talent pool</button>{insight.jobs[0] && <button type="button" onClick={() => onOpenJob(insight.jobs[0])} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"><BriefcaseBusiness className="h-4 w-4" />Open requisition</button>}</footer></aside></div>;

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: number; detail: string; tone: 'sky' | 'violet' | 'red' | 'green' }> = ({ icon, label, value, detail, tone }) => <div className="rounded-xl border border-slate-700 bg-slate-800/75 p-4"><div className={`inline-flex rounded-lg p-2 ${tone === 'sky' ? 'bg-sky-400/10 text-sky-300' : tone === 'violet' ? 'bg-violet-400/10 text-violet-300' : tone === 'red' ? 'bg-red-400/10 text-red-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{icon}</div><div className="mt-3 flex items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><p className="text-2xl font-bold text-white">{value}</p></div></div>;

const CoverageBadge: React.FC<{ status: CoverageStatus }> = ({ status }) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status === 'critical' ? 'bg-red-400/10 text-red-200' : status === 'watch' ? 'bg-amber-400/10 text-amber-200' : status === 'covered' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>{status === 'supply-only' ? 'Supply only' : status}</span>;

const CoverageBar: React.FC<{ coverage: number | null; status: CoverageStatus }> = ({ coverage, status }) => coverage === null ? <div><p className="font-semibold text-slate-300">Supply only</p><p className="mt-1 text-xs text-slate-500">No open-role demand</p></div> : <div className="min-w-36"><div className="flex items-center justify-between"><span className={`font-bold ${status === 'critical' ? 'text-red-200' : status === 'watch' ? 'text-amber-200' : 'text-emerald-200'}`}>{coverage}%</span><span className="text-[10px] text-slate-500">{coverage >= 100 ? 'covered' : 'of demand'}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700"><div className={`h-full rounded-full ${status === 'critical' ? 'bg-red-400' : status === 'watch' ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, coverage)}%` }} /></div></div>;

const SkillEvidenceDrawer: React.FC<{ insight: SkillIntelligence; onClose: () => void; onOpenJob: (job: Job) => void; onOpenCandidate: (candidate: Candidate) => void; onViewTalent: () => void; onCreatePool: () => void }> = ({ insight, onClose, onOpenJob, onOpenCandidate, onViewTalent, onCreatePool }) => <div className="fixed inset-0 z-[170]"><button type="button" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-label="Close skill evidence" /><aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"><header className="border-b border-slate-700 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-sky-300">Skill evidence</p><h2 className="mt-1 text-2xl font-bold text-white">{insight.skill}</h2><div className="mt-2"><CoverageBadge status={insight.status} /></div></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></div><div className="mt-5 grid grid-cols-4 gap-2"><DrawerMetric label="Demand" value={insight.demand} /><DrawerMetric label="Supply" value={insight.supply} /><DrawerMetric label="Coverage" value={insight.coverage === null ? '—' : `${insight.coverage}%`} /><DrawerMetric label="Gap" value={insight.gap} warning={insight.gap > 0} /></div></header><div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 custom-scrollbar"><section><h3 className="flex items-center gap-2 font-bold text-white"><BriefcaseBusiness className="h-4 w-4 text-sky-300" />Open-role demand <span className="text-xs text-slate-500">{insight.jobs.length}</span></h3><div className="mt-3 divide-y divide-slate-700 rounded-xl border border-slate-700">{insight.jobs.map((job) => <button key={job.id} type="button" onClick={() => onOpenJob(job)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-800"><div className="min-w-0"><p className="truncate font-semibold text-white">{job.title}</p><p className="mt-1 truncate text-xs text-slate-400">{job.department} · {job.location}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-500" /></button>)}{!insight.jobs.length && <p className="p-4 text-sm text-slate-500">No open requisitions currently require this skill.</p>}</div></section><section><h3 className="flex items-center gap-2 font-bold text-white"><UserRound className="h-4 w-4 text-violet-300" />Available talent <span className="text-xs text-slate-500">{insight.candidates.length}</span></h3><div className="mt-3 divide-y divide-slate-700 rounded-xl border border-slate-700">{insight.candidates.slice(0, 12).map((candidate) => <button key={candidate.id} type="button" onClick={() => onOpenCandidate(candidate)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-800"><div className="min-w-0"><p className="truncate font-semibold text-white">{candidate.name}</p><p className="mt-1 truncate text-xs text-slate-400">{candidate.currentRole ?? candidate.role ?? 'Candidate'}{candidate.location ? ` · ${candidate.location}` : ''}</p></div><span className="rounded-full bg-slate-700 px-2 py-1 text-[10px] font-bold capitalize text-slate-300">{candidate.type ?? 'candidate'}</span></button>)}{!insight.candidates.length && <p className="p-4 text-sm text-slate-500">No searchable candidate currently lists this skill.</p>}</div>{insight.candidates.length > 12 && <p className="mt-2 text-xs text-slate-500">Showing 12 of {insight.candidates.length} profiles.</p>}</section></div><footer className="flex flex-wrap gap-2 border-t border-slate-700 bg-slate-950/50 p-4"><button type="button" onClick={onViewTalent} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400"><Search className="h-4 w-4" />Find talent</button><button type="button" onClick={onCreatePool} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"><Users className="h-4 w-4" />Create talent pool</button></footer></aside></div>;

const DrawerMetric: React.FC<{ label: string; value: React.ReactNode; warning?: boolean }> = ({ label, value, warning }) => <div className={`rounded-lg border p-2 text-center ${warning ? 'border-red-400/25 bg-red-400/10' : 'border-slate-700 bg-slate-950/50'}`}><p className={`text-lg font-bold ${warning ? 'text-red-200' : 'text-white'}`}>{value}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{label}</p></div>;

export default SkillsSupplyDemandView;
