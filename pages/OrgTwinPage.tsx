import React, { useEffect, useMemo, useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BarChart3, BriefcaseBusiness, Building2, CheckCircle2,
  ChevronDown, ChevronRight, ClipboardList, Database, GitBranch, Layers3, LockKeyhole,
  MapPin, Play, RefreshCw, Search, ShieldCheck, Sparkles, Target, TrendingUp, Users
} from 'lucide-react';
import type { Candidate } from '../types';
import type { CapabilityMetric, OrgUnit, ScenarioResult } from '../types/org';
import type { OrgTwinTemplateId } from '../data/orgTwinTemplates';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useOrgTwinLocalWorkspaceCandidates } from '../hooks/useOrgTwinLocalWorkspaceCandidates';
import { orgTwinService } from '../services/OrgTwinService';
import { sharedOperationsService } from '../services/SharedOperationsService';

type WorkspaceTab = 'overview' | 'organization' | 'capabilities' | 'scenarios' | 'actions';
type Provenance = 'live' | 'estimated' | 'demo';
type ScenarioInputs = {
  name: string;
  unitId: string;
  targetHeadcount: number;
  targetDate: string;
  skills: string;
  attritionRate: number;
  internalFillRate: number;
};
type PlanningAction = {
  id: string;
  title: string;
  detail: string;
  unitName: string;
  dueAt: string;
  owner: string;
  status: 'draft' | 'planned' | 'in_progress' | 'complete';
};

const tabs: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'organization', label: 'Organization', icon: <Building2 className="h-4 w-4" /> },
  { id: 'capabilities', label: 'Capabilities', icon: <Target className="h-4 w-4" /> },
  { id: 'scenarios', label: 'Scenarios', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'actions', label: 'Action Plans', icon: <ClipboardList className="h-4 w-4" /> },
];

const accessRoles = new Set(['owner', 'admin', 'hiring_manager']);

function findUnit(root: OrgUnit, id: string): OrgUnit | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const match = findUnit(child, id);
    if (match) return match;
  }
  return null;
}

function flattenUnits(root: OrgUnit): OrgUnit[] {
  return [root, ...(root.children ?? []).flatMap(flattenUnits)];
}

function breadcrumbFor(root: OrgUnit, id: string, trail: OrgUnit[] = []): OrgUnit[] {
  const next = [...trail, root];
  if (root.id === id) return next;
  for (const child of root.children ?? []) {
    const match = breadcrumbFor(child, id, next);
    if (match.length) return match;
  }
  return [];
}

function readActions(key: string): PlanningAction[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const ProvenanceBadge: React.FC<{ value: Provenance; label?: string }> = ({ value, label }) => {
  const styles = value === 'live'
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
    : value === 'estimated'
      ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
      : 'border-violet-400/30 bg-violet-400/10 text-violet-200';
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label ?? value}</span>;
};

const MetricCard: React.FC<{ label: string; value: React.ReactNode; detail: string; provenance: Provenance; warning?: boolean }> = ({ label, value, detail, provenance, warning }) => (
  <div className={`rounded-xl border p-4 ${warning ? 'border-amber-400/30 bg-amber-400/5' : 'border-slate-700 bg-slate-800/75'}`}>
    <div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><ProvenanceBadge value={provenance} /></div>
    <p className={`mt-3 text-3xl font-bold ${warning ? 'text-amber-200' : 'text-white'}`}>{value}</p>
    <p className="mt-1 text-xs text-slate-400">{detail}</p>
  </div>
);

const Panel: React.FC<{ title: string; eyebrow?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, eyebrow, children, action }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/70">
    <header className="flex flex-col gap-3 border-b border-slate-700 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>{eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-sky-300">{eyebrow}</p>}<h2 className="mt-0.5 text-lg font-bold text-white">{title}</h2></div>
      {action}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const OrgTreeNode: React.FC<{ node: OrgUnit; selectedId: string; onSelect: (id: string) => void; query: string; depth?: number }> = ({ node, selectedId, onSelect, query, depth = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  const children = node.children ?? [];
  const queryValue = query.trim().toLowerCase();
  const visible = !queryValue || `${node.name} ${node.location ?? ''}`.toLowerCase().includes(queryValue) || flattenUnits(node).some((unit) => `${unit.name} ${unit.location ?? ''}`.toLowerCase().includes(queryValue));
  if (!visible) return null;
  const selected = node.id === selectedId;
  return <div>
    <div className={`flex cursor-pointer items-center rounded-lg py-2 pr-2 text-sm transition ${selected ? 'bg-sky-400/10 text-sky-100 ring-1 ring-sky-400/30' : 'text-slate-300 hover:bg-slate-700/60'}`} style={{ paddingLeft: `${depth * 14 + 8}px` }} onClick={() => onSelect(node.id)}>
      <button type="button" className="mr-1 rounded p-1 text-slate-500 hover:text-white" onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }} aria-label={expanded ? 'Collapse unit' : 'Expand unit'}>{children.length ? (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="block h-3.5 w-3.5" />}</button>
      <Building2 className={`mr-2 h-4 w-4 ${selected ? 'text-sky-300' : 'text-slate-500'}`} /><span className="truncate font-medium">{node.name}</span>
    </div>
    {expanded && children.map((child) => <OrgTreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} query={query} depth={depth + 1} />)}
  </div>;
};

const MappingEmptyState: React.FC<{ unit: OrgUnit; onOrganization: () => void }> = ({ unit, onOrganization }) => (
  <div className="rounded-xl border border-dashed border-amber-400/35 bg-amber-400/5 px-6 py-10 text-center">
    <MapPin className="mx-auto h-9 w-9 text-amber-300" />
    <h3 className="mt-3 font-bold text-white">No live workforce records mapped to {unit.name}</h3>
    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">Capability scores are intentionally hidden. Add an explicit org-unit ID to records or align their location with this unit before using the data for planning.</p>
    <button type="button" onClick={onOrganization} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"><GitBranch className="h-4 w-4" />Review organization mapping</button>
  </div>
);

const OrgTwinPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeOrganization, isDemoMode } = useAuth();
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const { candidates: localStoreCandidates, isLoading: isLoadingLocalWorkspace, refresh: refreshLocalWorkspace } = useOrgTwinLocalWorkspaceCandidates({ enabled: true, limit: 7000 });
  const templates = useMemo(() => orgTwinService.listTemplates(), []);
  const [templateId, setTemplateId] = useState<OrgTwinTemplateId>(() => localStorage.getItem('orgTwin_templateId') === 'staffing' ? 'staffing' : 'pharma');
  const template = useMemo(() => templates.find((item) => item.id === templateId) ?? templates[0], [templateId, templates]);
  const orgTree = template.orgTree;
  const defaultUnitId = templateId === 'staffing' ? 'branch_budapest' : 'site_cork';
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [selectedUnitId, setSelectedUnitId] = useState(defaultUnitId);
  const [treeQuery, setTreeQuery] = useState('');
  const [scenarioResults, setScenarioResults] = useState<ScenarioResult[]>([]);
  const [scenarioConfidence, setScenarioConfidence] = useState(0);
  const [notice, setNotice] = useState('');
  const actionStorageKey = `talentSonar:${activeOrganization?.organizationId ?? 'demo'}:workforceActions`;
  const [actions, setActions] = useState<PlanningAction[]>(() => readActions(actionStorageKey));
  const [scenario, setScenario] = useState<ScenarioInputs>({ name: '', unitId: defaultUnitId, targetHeadcount: 10, targetDate: '', skills: '', attritionRate: 5, internalFillRate: 30 });

  const allCandidates = useMemo<Candidate[]>(() => localStoreCandidates.length ? localStoreCandidates : [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, localStoreCandidates, uploadedCandidates]);
  const selectedUnit = useMemo(() => findUnit(orgTree, selectedUnitId) ?? orgTree, [orgTree, selectedUnitId]);
  const candidatesForUnit = useMemo(() => orgTwinService.candidatesForUnit(selectedUnit, allCandidates), [allCandidates, selectedUnit]);
  const jobsForUnit = useMemo(() => orgTwinService.jobsForUnit(selectedUnit, jobs), [jobs, selectedUnit]);
  const metrics = useMemo(() => orgTwinService.analyzeCapabilities(templateId, selectedUnit.id, { candidates: allCandidates, jobs }), [allCandidates, jobs, selectedUnit.id, templateId]);
  const breadcrumbs = useMemo(() => breadcrumbFor(orgTree, selectedUnit.id), [orgTree, selectedUnit.id]);
  const candidateSource: Provenance = localStoreCandidates.length ? 'live' : 'demo';
  const demandSource: Provenance = isDemoMode ? 'demo' : 'live';
  const verifiedCount = candidatesForUnit.filter((candidate) => (candidate.passport?.verifiedSkills?.length ?? 0) > 0).length;
  const verifiedCoverage = candidatesForUnit.length ? Math.round((verifiedCount / candidatesForUnit.length) * 100) : 0;
  const hasMappedData = candidatesForUnit.length > 0 || jobsForUnit.length > 0;
  const canAccess = Boolean(activeOrganization && accessRoles.has(activeOrganization.role));

  const unitHealth = useMemo(() => flattenUnits(orgTree).filter((unit) => unit.type === 'SITE' || unit.type === 'DEPARTMENT').map((unit) => {
    const candidates = orgTwinService.candidatesForUnit(unit, allCandidates);
    const openJobs = orgTwinService.jobsForUnit(unit, jobs);
    const unitMetrics = orgTwinService.analyzeCapabilities(templateId, unit.id, { candidates: allCandidates, jobs });
    const gaps = unitMetrics.filter((metric) => (metric.demandCount ?? 0) > (metric.supplyCount ?? 0)).length;
    const status = !candidates.length && !openJobs.length ? 'unmapped' : gaps > 0 ? 'at-risk' : 'covered';
    return { unit, candidates: candidates.length, openJobs: openJobs.length, gaps, status };
  }), [allCandidates, jobs, orgTree, templateId]);

  const atRiskUnits = unitHealth.filter((item) => item.status === 'at-risk').length;
  const unmappedUnits = unitHealth.filter((item) => item.status === 'unmapped').length;
  const demandedSkills = metrics.filter((metric) => (metric.demandCount ?? 0) > 0);
  const criticalSkills = demandedSkills.filter((metric) => (metric.supplyCount ?? 0) < (metric.demandCount ?? 0)).length;

  useEffect(() => { localStorage.setItem('orgTwin_templateId', templateId); }, [templateId]);
  useEffect(() => {
    setSelectedUnitId(defaultUnitId);
    setScenario((value) => ({ ...value, unitId: defaultUnitId, name: '', skills: '' }));
    setScenarioResults([]);
    setTreeQuery('');
  }, [defaultUnitId]);
  useEffect(() => { localStorage.setItem(actionStorageKey, JSON.stringify(actions)); }, [actionStorageKey, actions]);

  const selectUnit = (id: string, nextTab?: WorkspaceTab) => {
    setSelectedUnitId(id);
    setScenario((value) => ({ ...value, unitId: id }));
    if (nextTab) setActiveTab(nextTab);
  };

  const applyPreset = (scenarioId: string) => {
    const presets: Record<string, Partial<ScenarioInputs>> = {
      IRELAND_EXPANSION: { name: 'Ireland Biologics Launch', unitId: 'site_cork', targetHeadcount: 12, skills: 'Downstream Processing, Chromatography, Bioreactor Operation', attritionRate: 6, internalFillRate: 30 },
      APAC_SCALE: { name: 'APAC Scale-Up', targetHeadcount: 8, skills: 'NMPA Regulations, Japanese PMDA, Mandarin', attritionRate: 8, internalFillRate: 20 },
      DIGITAL_TRANSFORM: { name: 'Digital Transformation', targetHeadcount: 15, skills: 'Industrial IoT, Digital Twin, MES Systems, Python', attritionRate: 5, internalFillRate: 40 },
      CLIENT_RAMP: { name: 'New Client Ramp', targetHeadcount: 50, skills: 'High-volume Screening, Candidate Outreach, Client SLA Management', attritionRate: 5, internalFillRate: 20 },
      SEASONAL_SPIKE: { name: 'Seasonal Spike', targetHeadcount: 200, skills: 'Structured Interviews, Assessment Review, ATS Workflow', attritionRate: 10, internalFillRate: 15 },
      COMPLIANCE_CHANGE: { name: 'Compliance Change', targetHeadcount: 4, skills: 'Compliance Review, Document Validation', attritionRate: 3, internalFillRate: 50 },
    };
    const next = { ...scenario, ...presets[scenarioId] };
    setScenario(next);
    if (next.unitId) selectUnit(next.unitId);
    setScenarioResults([]);
  };

  const runScenario = () => {
    const unit = findUnit(orgTree, scenario.unitId) ?? selectedUnit;
    const unitCandidates = orgTwinService.candidatesForUnit(unit, allCandidates);
    const internal = unitCandidates.filter((candidate) => candidate.type === 'internal');
    const requiredSkills = scenario.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
    const retainedInternal = Math.floor(internal.length * (1 - scenario.attritionRate / 100));
    const internalCapacity = Math.floor(retainedInternal * (scenario.internalFillRate / 100));
    const missingHeadcount = Math.max(0, scenario.targetHeadcount - internalCapacity);
    const targetPerSkill = Math.max(1, Math.ceil(scenario.targetHeadcount / Math.max(1, requiredSkills.length)));
    const missingSkills = requiredSkills.filter((skill) => {
      const key = skill.toLowerCase();
      const supply = internal.filter((candidate) => candidate.skills.some((value) => value.toLowerCase() === key)).length;
      return Math.floor(supply * (1 - scenario.attritionRate / 100)) < targetPerSkill;
    });
    const confidence = unitCandidates.length ? Math.round((unitCandidates.filter((candidate) => (candidate.passport?.verifiedSkills?.length ?? 0) > 0).length / unitCandidates.length) * 100) : 0;
    setScenarioConfidence(confidence);
    setSelectedUnitId(unit.id);
    setScenarioResults([{
      gapName: scenario.name || `${unit.name} capacity plan`,
      missingHeadcount,
      missingSkills,
      suggestedAction: missingHeadcount > 0
        ? `Plan ${Math.min(internalCapacity, scenario.targetHeadcount)} internal moves and open capacity for ${missingHeadcount} external hires. Validate the ${missingSkills.length} uncovered skill areas before approval.`
        : 'Current internal capacity covers the headcount assumption. Validate skill evidence and confirm mobility availability before approval.',
      impactLevel: missingHeadcount > Math.max(5, scenario.targetHeadcount / 2) ? 'CRITICAL' : missingHeadcount > 0 ? 'HIGH' : 'LOW',
      timeFrame: scenario.targetDate || 'Target date not set',
    }]);
  };

  const createActionPlan = async () => {
    const result = scenarioResults[0];
    if (!result) return;
    const unit = findUnit(orgTree, scenario.unitId) ?? selectedUnit;
    const action: PlanningAction = {
      id: `workforce-${Date.now()}`,
      title: `Close ${result.gapName}`,
      detail: result.suggestedAction,
      unitName: unit.name,
      dueAt: scenario.targetDate,
      owner: activeOrganization?.role === 'hiring_manager' ? 'Hiring manager' : 'Workforce planning team',
      status: 'draft',
    };
    setActions((current) => [action, ...current]);
    if (!isDemoMode && activeOrganization) {
      try {
        await sharedOperationsService.upsertTasks(activeOrganization.organizationId, [{ sourceKey: `workforce-plan:${action.id}`, taskType: 'custom', title: action.title, detail: `${action.unitName} · ${action.detail}`, ownerRole: 'admin', dueAt: action.dueAt || undefined }]);
        setNotice('Action plan added to the shared task workspace.');
      } catch {
        setNotice('Draft saved locally, but the shared task could not be created.');
      }
    } else {
      setNotice('Draft action plan saved in this demo workspace.');
    }
    setActiveTab('actions');
  };

  const openCandidates = () => navigate({ pathname: '/candidates', search: `?${createSearchParams({ location: selectedUnit.location ?? '', orgUnitId: selectedUnit.id })}` });
  const openJobs = () => jobsForUnit.length === 1 ? navigate(`/requisitions/${jobsForUnit[0].id}`) : navigate({ pathname: '/jobs', search: `?${createSearchParams({ location: selectedUnit.location ?? '', orgUnitId: selectedUnit.id })}` });

  if (!canAccess) return <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center"><div className="w-full rounded-2xl border border-slate-700 bg-slate-800/70 p-8 text-center"><LockKeyhole className="mx-auto h-10 w-10 text-amber-300" /><h1 className="mt-4 text-2xl font-bold text-white">Workforce Planning is restricted</h1><p className="mt-2 text-sm leading-6 text-slate-400">This strategic workspace is available to organization owners, administrators, and hiring managers. Recruiters can use Insights, Requisitions, and Talent Pools for operational work.</p><button type="button" onClick={() => navigate('/insights')} className="mt-5 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400">Open Insights</button></div></div>;

  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 p-5 sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex gap-4"><div className="h-fit rounded-xl bg-sky-400/15 p-3 text-sky-300"><Layers3 className="h-7 w-7" /></div><div><p className="text-sm font-semibold text-sky-300">Strategic intelligence</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Workforce Planning</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Connect organization structure, workforce supply, requisition demand, and accountable plans without presenting demo assumptions as live facts.</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><ProvenanceBadge value="demo" label="Organization template" /><ProvenanceBadge value={candidateSource} label={`${candidateSource} talent supply`} /><ProvenanceBadge value={demandSource} label={`${demandSource} job demand`} />{localStoreCandidates.length > 0 && <button type="button" onClick={refreshLocalWorkspace} disabled={isLoadingLocalWorkspace} className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-700 disabled:opacity-50" aria-label="Refresh workforce data"><RefreshCw className={`h-4 w-4 ${isLoadingLocalWorkspace ? 'animate-spin' : ''}`} /></button>}</div>
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-slate-700/80 pt-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Planning model</p><select value={templateId} onChange={(event) => setTemplateId(event.target.value as OrgTwinTemplateId)} className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-white">{templates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="flex items-center gap-2 text-xs text-slate-400"><Database className="h-4 w-4 text-sky-300" />Data refreshed this session · role: <span className="font-semibold capitalize text-slate-200">{activeOrganization?.role.replace('_', ' ')}</span></div></div>
    </section>

    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/70 p-1" role="tablist" aria-label="Workforce planning workspace">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex min-w-max items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{tab.icon}{tab.label}{tab.id === 'actions' && actions.length > 0 && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{actions.length}</span>}</button>)}</nav>

    {activeTab === 'overview' && <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="At-risk units" value={atRiskUnits} detail={`${unmappedUnits} units still need data mapping`} provenance="estimated" warning={atRiskUnits > 0} /><MetricCard label="Critical capabilities" value={criticalSkills} detail="Demand exceeds mapped supply" provenance={hasMappedData ? 'estimated' : 'demo'} warning={criticalSkills > 0} /><MetricCard label={template.kpis.totalLabel} value={orgTree.headcount.toLocaleString()} detail="Provided by the selected planning template" provenance="demo" /><MetricCard label="Evidence coverage" value={`${verifiedCoverage}%`} detail={`${verifiedCount} of ${candidatesForUnit.length} mapped profiles verified`} provenance={candidateSource} warning={hasMappedData && verifiedCoverage < 50} /></div>
      <Panel title="Units needing attention" eyebrow="Prioritized planning queue" action={<button type="button" onClick={() => setActiveTab('organization')} className="inline-flex items-center gap-2 text-sm font-semibold text-sky-300 hover:text-sky-200">Explore organization <ArrowRight className="h-4 w-4" /></button>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Unit</th><th className="pb-3">Status</th><th className="pb-3 text-right">Mapped talent</th><th className="pb-3 text-right">Open roles</th><th className="pb-3 text-right">Skill gaps</th><th className="pb-3 text-right">Next step</th></tr></thead><tbody className="divide-y divide-slate-700">{[...unitHealth].sort((a, b) => (a.status === 'at-risk' ? -1 : a.status === 'unmapped' ? 0 : 1) - (b.status === 'at-risk' ? -1 : b.status === 'unmapped' ? 0 : 1)).map((item) => <tr key={item.unit.id} className="hover:bg-slate-700/25"><td className="py-3"><p className="font-semibold text-white">{item.unit.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.unit.location ?? item.unit.type}</p></td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === 'at-risk' ? 'bg-red-400/10 text-red-200' : item.status === 'unmapped' ? 'bg-amber-400/10 text-amber-200' : 'bg-emerald-400/10 text-emerald-200'}`}>{item.status === 'at-risk' ? 'At risk' : item.status === 'unmapped' ? 'Needs mapping' : 'Covered'}</span></td><td className="py-3 text-right font-semibold text-slate-200">{item.candidates}</td><td className="py-3 text-right font-semibold text-slate-200">{item.openJobs}</td><td className="py-3 text-right font-semibold text-slate-200">{item.gaps}</td><td className="py-3 text-right"><button type="button" onClick={() => selectUnit(item.unit.id, item.status === 'unmapped' ? 'organization' : 'capabilities')} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Review</button></td></tr>)}</tbody></table></div>
      </Panel>
    </div>}

    {activeTab === 'organization' && <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Panel title="Organization" eyebrow="Planning hierarchy"><div className="relative mb-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={treeQuery} onChange={(event) => setTreeQuery(event.target.value)} placeholder="Search units or locations" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-600" /></div><div className="max-h-[580px] overflow-y-auto pr-1 custom-scrollbar"><OrgTreeNode node={orgTree} selectedId={selectedUnit.id} onSelect={selectUnit} query={treeQuery} /></div></Panel>
      <div className="space-y-6"><Panel title={selectedUnit.name} eyebrow="Selected organizational unit" action={<ProvenanceBadge value="demo" label="Template structure" />}><div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">{breadcrumbs.map((unit, index) => <React.Fragment key={unit.id}>{index > 0 && <ChevronRight className="h-3 w-3" />}<button type="button" onClick={() => selectUnit(unit.id)} className="hover:text-sky-300">{unit.name}</button></React.Fragment>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><MetricCard label="Template headcount" value={selectedUnit.headcount.toLocaleString()} detail="Planning-model value" provenance="demo" /><MetricCard label="Mapped talent" value={candidatesForUnit.length} detail={`${verifiedCount} profiles with verified skills`} provenance={candidateSource} /><MetricCard label="Open requisitions" value={jobsForUnit.length} detail="Matched to this unit" provenance={demandSource} /></div><div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={!selectedUnit.location} onClick={openCandidates} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-40"><Users className="h-4 w-4" />Open mapped talent</button><button type="button" onClick={openJobs} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"><BriefcaseBusiness className="h-4 w-4" />{jobsForUnit.length === 1 ? 'Open requisition' : 'Open requisitions'}</button><button type="button" onClick={() => setActiveTab('scenarios')} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"><Sparkles className="h-4 w-4" />Plan a scenario</button></div></Panel>
        <Panel title="Data mapping and trust" eyebrow="Before making a workforce decision"><div className="grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4"><div className="flex items-center justify-between"><p className="font-semibold text-white">Organization structure</p><ProvenanceBadge value="demo" /></div><p className="mt-2 text-sm text-slate-400">Selected from a planning template. Connect an HRIS before treating headcount as authoritative.</p></div><div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4"><div className="flex items-center justify-between"><p className="font-semibold text-white">Talent supply</p><ProvenanceBadge value={candidateSource} /></div><p className="mt-2 text-sm text-slate-400">Mapped by explicit org-unit metadata first, then normalized city and country tokens.</p></div><div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4"><div className="flex items-center justify-between"><p className="font-semibold text-white">Requisition demand</p><ProvenanceBadge value={demandSource} /></div><p className="mt-2 text-sm text-slate-400">Only open requisitions are counted. Headcount and required skills drive demand.</p></div></div>{!hasMappedData && <div className="mt-4"><MappingEmptyState unit={selectedUnit} onOrganization={() => undefined} /></div>}</Panel></div>
    </div>}

    {activeTab === 'capabilities' && <Panel title={`${selectedUnit.name} capability coverage`} eyebrow="Supply versus requisition demand" action={<div className="flex items-center gap-2"><ProvenanceBadge value={candidateSource} label="Supply" /><ProvenanceBadge value={demandSource} label="Demand" /></div>}>
      {!metrics.length ? <MappingEmptyState unit={selectedUnit} onOrganization={() => setActiveTab('organization')} /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Capability</th><th className="pb-3 text-right">Supply</th><th className="pb-3 text-right">Demand</th><th className="pb-3 text-right">Gap</th><th className="pb-3">Evidence</th><th className="pb-3">Risk</th><th className="pb-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-700">{metrics.map((metric) => { const gap = Math.max(0, (metric.demandCount ?? 0) - (metric.supplyCount ?? 0)); const evidence = metric.verifiedCount ? `${metric.verifiedCount} verified · ${metric.avgProficiency}/5 avg` : 'Profile-listed only'; return <tr key={metric.skillId} className="hover:bg-slate-700/25"><td className="py-4 font-bold text-white">{metric.skillName}</td><td className="py-4 text-right font-semibold text-violet-200">{metric.supplyCount ?? 0}</td><td className="py-4 text-right font-semibold text-sky-200">{metric.demandCount ?? 0}</td><td className={`py-4 text-right font-bold ${gap ? 'text-red-300' : 'text-emerald-300'}`}>{gap ? `-${gap}` : 'Covered'}</td><td className="py-4 text-slate-400">{evidence}</td><td className="py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${metric.riskFactor === 'NONE' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-red-400/10 text-red-200'}`}>{metric.riskFactor === 'SINGLE_POINT_OF_FAILURE' ? 'Single point of failure' : metric.riskFactor === 'ATTRITION_RISK' ? 'Coverage risk' : 'Healthy'}</span></td><td className="py-4 text-right"><button type="button" onClick={() => { setScenario((value) => ({ ...value, skills: metric.skillName, name: `${metric.skillName} coverage plan`, unitId: selectedUnit.id, targetHeadcount: Math.max(1, gap) })); setActiveTab('scenarios'); }} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Plan response</button></td></tr>; })}</tbody></table></div>}
    </Panel>}

    {activeTab === 'scenarios' && <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel title="Build a scenario" eyebrow="Explicit assumptions"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Start from a planning pattern</p><div className="mt-2 flex flex-wrap gap-2">{template.scenarios.map((item) => <button key={item.id} type="button" onClick={() => applyPreset(item.id)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-200">{item.label}</button>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-sm font-medium text-slate-300">Scenario name<input value={scenario.name} onChange={(event) => setScenario({ ...scenario, name: event.target.value })} placeholder="e.g. Cork biologics launch" className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="text-sm font-medium text-slate-300">Organizational unit<select value={scenario.unitId} onChange={(event) => { setScenario({ ...scenario, unitId: event.target.value }); setSelectedUnitId(event.target.value); }} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white">{flattenUnits(orgTree).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="text-sm font-medium text-slate-300">Target date<input type="date" value={scenario.targetDate} onChange={(event) => setScenario({ ...scenario, targetDate: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="text-sm font-medium text-slate-300">Required headcount<input type="number" min="1" value={scenario.targetHeadcount} onChange={(event) => setScenario({ ...scenario, targetHeadcount: Math.max(1, Number(event.target.value)) })} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="text-sm font-medium text-slate-300">Expected attrition (%)<input type="number" min="0" max="100" value={scenario.attritionRate} onChange={(event) => setScenario({ ...scenario, attritionRate: Math.min(100, Math.max(0, Number(event.target.value))) })} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="text-sm font-medium text-slate-300">Internal fill assumption (%)<input type="number" min="0" max="100" value={scenario.internalFillRate} onChange={(event) => setScenario({ ...scenario, internalFillRate: Math.min(100, Math.max(0, Number(event.target.value))) })} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white" /></label><label className="sm:col-span-2 text-sm font-medium text-slate-300">Required capabilities<textarea value={scenario.skills} onChange={(event) => setScenario({ ...scenario, skills: event.target.value })} placeholder="Comma-separated skills" rows={3} className="mt-1.5 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white" /></label></div><button type="button" disabled={!scenario.name.trim() || !scenario.skills.trim()} onClick={runScenario} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 text-sm font-bold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"><Play className="h-4 w-4" />Calculate scenario</button></Panel>
      <Panel title="Baseline versus scenario" eyebrow="Decision support" action={<ProvenanceBadge value="estimated" />}>
        {!scenarioResults.length ? <div className="py-14 text-center"><TrendingUp className="mx-auto h-9 w-9 text-slate-600" /><h3 className="mt-3 font-bold text-white">Define assumptions to calculate the gap</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">Results are derived from the current mapped workforce records and the inputs on the left. Presets only populate inputs; they do not generate fixed answers.</p></div> : scenarioResults.map((result) => <div key={result.gapName} className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Mapped internal supply" value={candidatesForUnit.filter((candidate) => candidate.type === 'internal').length} detail="Before attrition and fill assumptions" provenance={candidateSource} /><MetricCard label="External capacity needed" value={result.missingHeadcount} detail={`of ${scenario.targetHeadcount} target roles`} provenance="estimated" warning={result.missingHeadcount > 0} /><MetricCard label="Evidence confidence" value={`${scenarioConfidence}%`} detail="Profiles with verified skill evidence" provenance="estimated" warning={scenarioConfidence < 50} /></div><div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4"><div className="flex items-start gap-3">{result.missingHeadcount > 0 ? <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />}<div><h3 className="font-bold text-white">{result.gapName}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{result.suggestedAction}</p></div></div>{result.missingSkills.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{result.missingSkills.map((skill) => <span key={skill} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">Gap · {skill}</span>)}</div>}</div><div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4 text-xs leading-5 text-slate-400"><strong className="text-slate-200">Assumptions:</strong> {scenario.attritionRate}% attrition, {scenario.internalFillRate}% internal fill, target {scenario.targetDate || 'not set'}. This estimate does not confirm employee mobility, availability, compensation, or hiring-market supply.</div><button type="button" onClick={() => void createActionPlan()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-400"><ClipboardList className="h-4 w-4" />Create action plan</button></div>)}
      </Panel>
    </div>}

    {activeTab === 'actions' && <Panel title="Workforce action plans" eyebrow="Turn insight into accountable work" action={<button type="button" onClick={() => setActiveTab('scenarios')} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-400"><Sparkles className="h-4 w-4" />New plan</button>}>
      {notice && <div className="mb-4 rounded-lg border border-sky-400/25 bg-sky-400/10 p-3 text-sm text-sky-200">{notice}</div>}{!actions.length ? <div className="py-12 text-center"><ClipboardList className="mx-auto h-9 w-9 text-slate-600" /><h3 className="mt-3 font-bold text-white">No workforce plans yet</h3><p className="mt-2 text-sm text-slate-400">Run a scenario or respond to a capability gap to create the first accountable plan.</p></div> : <div className="space-y-3">{actions.map((action) => <article key={action.id} className="rounded-xl border border-slate-700 bg-slate-900/35 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-3"><div className="h-fit rounded-lg bg-emerald-400/10 p-2 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">{action.title}</h3><span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{action.status.replace('_', ' ')}</span></div><p className="mt-1 text-sm text-slate-400">{action.unitName} · {action.detail}</p><p className="mt-2 text-xs text-slate-500">Owner: {action.owner} · Due: {action.dueAt || 'not assigned'}</p></div></div><div className="flex gap-2"><select value={action.status} onChange={(event) => setActions((current) => current.map((item) => item.id === action.id ? { ...item, status: event.target.value as PlanningAction['status'] } : item))} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="draft">Draft</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select><button type="button" onClick={() => navigate('/follow-ups')} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Open tasks</button></div></div></article>)}</div>}
    </Panel>}
  </div>;
};

export default OrgTwinPage;
