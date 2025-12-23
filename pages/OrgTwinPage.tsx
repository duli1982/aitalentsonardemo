import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, createSearchParams } from 'react-router-dom';
import { OrgUnit, CapabilityMetric, ScenarioResult } from '../types/org';
import { orgTwinService } from '../services/OrgTwinService';
import type { OrgTwinTemplateId } from '../data/orgTwinTemplates';
import { useData } from '../contexts/DataContext';
import { useOrgTwinSupabaseCandidates } from '../hooks/useOrgTwinSupabaseCandidates';
import { Building2, ChevronRight, ChevronDown, Activity, AlertOctagon, TrendingUp, Users, MapPin, Zap, ArrowRight, Globe, Layers, Database, RefreshCw } from 'lucide-react';

// --- Components ---

const OrgTreeNode: React.FC<{ node: OrgUnit; selectedId: string; onSelect: (id: string) => void; depth?: number; query?: string }> = ({ node, selectedId, onSelect, depth = 0, query }) => {
    const queryLower = (query ?? '').trim().toLowerCase();
    const hasQuery = queryLower.length > 0;

    const matches = !hasQuery || node.name.toLowerCase().includes(queryLower) || (node.location?.toLowerCase().includes(queryLower) ?? false);
    const children = node.children ?? [];
    const childMatches = children.some((c) => (c.name.toLowerCase().includes(queryLower) || (c.location?.toLowerCase().includes(queryLower) ?? false)));
    const shouldRender = matches || childMatches || (hasQuery ? children.some((c) => !!c.children?.length) : true);

    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.id === selectedId;

    if (!shouldRender && hasQuery) return null;

    return (
        <div className="select-none">
            <div
                className={`flex items-center py-2 px-2 cursor-pointer hover:bg-slate-700/50 rounded transition-colors ${isSelected ? 'bg-sky-900/40 border-l-2 border-sky-400' : ''}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={() => onSelect(node.id)}
            >
                <div className="mr-2 text-slate-400" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                    {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <div className="w-3.5" />}
                </div>
                <Building2 size={14} className={`mr-2 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                <span className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>{node.name}</span>
            </div>
            {hasChildren && expanded && (
                <div>
                    {node.children!.map(child => (
                        <OrgTreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} query={query} />
                    ))}
                </div>
            )}
        </div>
    );
};

const CapabilityHeatmap: React.FC<{ metrics: CapabilityMetric[] }> = ({ metrics }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map(metric => (
            <div key={metric.skillId} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col relative overflow-hidden">
                {metric.riskFactor === 'SINGLE_POINT_OF_FAILURE' && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl">CRITICAL RISK</div>
                )}
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-slate-200">{metric.skillName}</h4>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${metric.benchStrength === 'HIGH' ? 'bg-green-900/50 text-green-400' :
                        metric.benchStrength === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-red-900/50 text-red-400'
                        }`}>
                        {metric.benchStrength} BENCH
                    </span>
                </div>

                <div className="mt-auto">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Avg Proficiency</span>
                        <span>{metric.avgProficiency}/5.0</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mb-3">
                        <div className="bg-sky-500 h-full rounded-full" style={{ width: `${(metric.avgProficiency / 5) * 100}%` }} />
                    </div>

                    <div className="flex items-center text-xs text-slate-400">
                        <Users size={12} className="mr-1" />
                        <span className="text-white font-medium mr-1">{metric.expertCount}</span> Experts Available
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const ScenarioSimulator: React.FC<{ scenarios: { id: string; label: string; colorClass: string; description?: string }[]; onRun: (scenario: string) => void; results: ScenarioResult[]; isLoading?: boolean }> = ({ scenarios, onRun, results, isLoading }) => {
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center">
                    <TrendingUp className="text-purple-400 mr-2" />
                    <h3 className="text-lg font-semibold text-white">Scenario & Demand Forecasting</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    {scenarios.map(s => (
                        <button
                            key={s.id}
                            onClick={() => onRun(s.id)}
                            disabled={isLoading}
                            className={`hover:opacity-90 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center ${s.colorClass}`}
                            title={s.description}
                        >
                            <Zap size={12} className="mr-1" />
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-slate-400">
                    <Activity className="mx-auto h-8 w-8 mb-2 animate-pulse" />
                    <p>Running simulation...</p>
                </div>
            ) : results.length === 0 ? (
                <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-lg">
                    <Activity className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No active scenarios. Run a simulation to detect capability gaps.</p>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    {results.map((result, idx) => (
                        <div key={idx} className="bg-slate-900/50 rounded-lg border border-red-500/30 p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="text-red-300 font-bold flex items-center">
                                        <AlertOctagon size={16} className="mr-2" />
                                        Gap Detected: {result.gapName}
                                    </h4>
                                    <p className="text-slate-400 text-xs mt-1">Timeline: {result.timeFrame}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-white">{result.missingHeadcount}</div>
                                    <div className="text-xs text-slate-500 uppercase">Missing Roles</div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mb-3">
                                {result.missingSkills.map(s => (
                                    <span key={s} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">{s}</span>
                                ))}
                            </div>

                            <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded flex items-start">
                                <ArrowRight size={16} className="text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-blue-200">{result.suggestedAction}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
};

// --- Page ---

const OrgTwinPage: React.FC = () => {
    const navigate = useNavigate();
    const { jobs, internalCandidates, pastCandidates, uploadedCandidates } = useData();
    const { candidates: supabaseCandidates, isLoading: isLoadingSupabase, refresh: refreshSupabase } = useOrgTwinSupabaseCandidates({ enabled: true, limit: 7000 });

    const templates = useMemo(() => orgTwinService.listTemplates(), []);
    const [templateId, setTemplateId] = useState<OrgTwinTemplateId>(() => {
        const saved = localStorage.getItem('orgTwin_templateId');
        return (saved === 'staffing' || saved === 'pharma') ? saved : 'pharma';
    });

    const template = useMemo(() => templates.find((t) => t.id === templateId) ?? templates[0], [templates, templateId]);

    const defaultSelectedUnitId = useMemo(() => {
        return templateId === 'staffing' ? 'branch_budapest' : 'site_cork';
    }, [templateId]);

    const [selectedUnitId, setSelectedUnitId] = useState<string>(() => {
        const saved = localStorage.getItem(`orgTwin_selectedUnitId_${templateId}`);
        return saved || defaultSelectedUnitId;
    });
    const [scenarioResults, setScenarioResults] = useState<ScenarioResult[]>(() => {
        const saved = localStorage.getItem(`orgTwin_scenarioResults_${templateId}`);
        return saved ? JSON.parse(saved) : [];
    });
    const [isSimulating, setIsSimulating] = useState(false);
    const [treeQuery, setTreeQuery] = useState('');

    const orgTree = template.orgTree;

    const allCandidates = useMemo(() => {
        // Prefer Supabase system-of-record when available (trust + utility).
        if (supabaseCandidates.length > 0) return supabaseCandidates;
        return [...internalCandidates, ...pastCandidates, ...uploadedCandidates];
    }, [internalCandidates, pastCandidates, uploadedCandidates, supabaseCandidates]);

    const metrics = useMemo(() => {
        return orgTwinService.analyzeCapabilities(templateId, selectedUnitId, { candidates: allCandidates, jobs });
    }, [allCandidates, jobs, selectedUnitId, templateId]);

    const findOrgUnit = (root: OrgUnit, unitId: string): OrgUnit | null => {
        if (root.id === unitId) return root;
        for (const child of root.children ?? []) {
            const found = findOrgUnit(child, unitId);
            if (found) return found;
        }
        return null;
    };

    const selectedUnit = useMemo(() => findOrgUnit(orgTree, selectedUnitId), [orgTree, selectedUnitId]);

    const collectLocations = (root: OrgUnit): string[] => {
        const locations = new Set<string>();
        const walk = (node: OrgUnit) => {
            if (node.location) locations.add(node.location);
            for (const child of node.children ?? []) walk(child);
        };
        walk(root);
        return Array.from(locations);
    };

    const candidatesForSelectedUnit = useMemo(() => {
        if (!selectedUnit) return [];
        const locationHints = collectLocations(selectedUnit).map((l) => l.toLowerCase());
        return allCandidates.filter((c) => {
            const loc = (c.location ?? '').toLowerCase();
            return locationHints.some((hint) => hint.length > 2 && loc.includes(hint));
        });
    }, [allCandidates, selectedUnit]);

    const verifiedCoverage = useMemo(() => {
        const total = candidatesForSelectedUnit.length;
        if (!total) return { pct: 0, verified: 0, total: 0 };
        const verified = candidatesForSelectedUnit.filter((c: any) => (c.passport?.verifiedSkills?.length ?? 0) > 0).length;
        return { pct: Math.round((verified / total) * 100), verified, total };
    }, [candidatesForSelectedUnit]);

    const openJobsForSelectedUnit = useMemo(() => {
        if (!selectedUnit) return [];
        const locationHints = collectLocations(selectedUnit).map((l) => l.toLowerCase());
        return jobs.filter((j) => {
            if (j.status !== 'open') return false;
            const loc = (j.location ?? '').toLowerCase();
            return locationHints.some((hint) => hint.length > 2 && loc.includes(hint));
        });
    }, [jobs, selectedUnit]);

    const countUnitsByType = (root: OrgUnit, type: OrgUnit['type']): number => {
        let count = root.type === type ? 1 : 0;
        for (const child of root.children ?? []) count += countUnitsByType(child, type);
        return count;
    };

    const activeAlerts = useMemo(() => metrics.filter((m) => m.riskFactor !== 'NONE').length, [metrics]);

    // Persistence effects
    useEffect(() => {
        localStorage.setItem('orgTwin_templateId', templateId);
    }, [templateId]);

    useEffect(() => {
        localStorage.setItem(`orgTwin_selectedUnitId_${templateId}`, selectedUnitId);
    }, [selectedUnitId, templateId]);

    useEffect(() => {
        localStorage.setItem(`orgTwin_scenarioResults_${templateId}`, JSON.stringify(scenarioResults));
    }, [scenarioResults, templateId]);

    useEffect(() => {
        const savedUnitId = localStorage.getItem(`orgTwin_selectedUnitId_${templateId}`) || defaultSelectedUnitId;
        const savedScenarioResults = localStorage.getItem(`orgTwin_scenarioResults_${templateId}`);

        setSelectedUnitId(savedUnitId);
        setScenarioResults(savedScenarioResults ? JSON.parse(savedScenarioResults) : []);
        setTreeQuery('');
    }, [defaultSelectedUnitId, templateId]);

    const handleRunScenario = (scenarioId: string) => {
        setIsSimulating(true);
        setScenarioResults([]);
        // Note: We don't clear localStorage here immediately to avoid flickering empty state if used elsewhere, 
        // but react state update will trigger the effect.

        setTimeout(() => {
            const results = orgTwinService.runScenarioSimulation(templateId, scenarioId);
            setScenarioResults(results);
            setIsSimulating(false);
        }, 800);
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header Stat */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Layers className="text-sky-400" size={18} />
                            Org Twin
                        </h2>
                        <p className="text-slate-400 text-sm">{template.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${supabaseCandidates.length > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : 'bg-slate-900/30 border-slate-700 text-slate-300'}`}>
                            <Database className="h-4 w-4" />
                            {supabaseCandidates.length > 0 ? `DB-backed (${supabaseCandidates.length.toLocaleString()})` : 'Demo-backed'}
                        </span>
                        {supabaseCandidates.length > 0 && (
                            <button
                                type="button"
                                onClick={refreshSupabase}
                                disabled={isLoadingSupabase}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/30 text-slate-200 hover:bg-slate-900/60 text-xs font-semibold disabled:opacity-60"
                                title="Refresh candidates from Supabase"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoadingSupabase ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        )}
                        <span className="text-xs text-slate-400 uppercase font-semibold">Template</span>
                        <select
                            value={templateId}
                            onChange={(e) => setTemplateId(e.target.value as OrgTwinTemplateId)}
                            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                        >
                            {templates.map((t) => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-1 flex items-center">
                    <Globe className="h-8 w-8 text-sky-500 mr-3" />
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-bold">{template.kpis.totalLabel}</p>
                        <p className="text-2xl font-bold text-white">{orgTree.headcount.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-1 flex items-center">
                    <MapPin className="h-8 w-8 text-green-500 mr-3" />
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-bold">{template.kpis.primaryLabel}</p>
                        <p className="text-2xl font-bold text-white">{countUnitsByType(orgTree, 'SITE')}</p>
                    </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-1 flex items-center">
                    <Zap className="h-8 w-8 text-yellow-500 mr-3" />
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-bold">{template.kpis.scenarioLabel}</p>
                        <p className="text-2xl font-bold text-white">{activeAlerts} Active</p>
                    </div>
                </div>
            </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 flex-grow min-h-0">
                {/* Left: Org Tree */}
                <div className="w-full md:w-1/4 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                        <h3 className="font-semibold text-white flex items-center">
                            <Building2 className="mr-2 text-sky-400" size={18} />
                            Organization Map
                        </h3>
                        <div className="mt-3">
                            <input
                                value={treeQuery}
                                onChange={(e) => setTreeQuery(e.target.value)}
                                placeholder="Search org units..."
                                className="w-full bg-slate-900/40 border border-slate-700 text-slate-200 placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto p-2 flex-grow custom-scrollbar">
                        <OrgTreeNode node={orgTree} selectedId={selectedUnitId} onSelect={setSelectedUnitId} query={treeQuery} />
                    </div>
                </div>

                {/* Right: Analysis */}
                <div className="w-full md:w-3/4 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                    {/* Drill-down */}
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                                <div className="text-xs text-slate-400 uppercase font-semibold">Selected Unit</div>
                                <div className="text-lg font-bold text-white">{selectedUnit?.name ?? selectedUnitId}</div>
                                <div className="text-sm text-slate-400 mt-1">
                                    {selectedUnit?.type ?? '—'} {selectedUnit?.location ? `• ${selectedUnit.location}` : ''}
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const loc = selectedUnit?.location ?? '';
                                        navigate({
                                            pathname: '/candidates',
                                            search: `?${createSearchParams({ location: loc })}`
                                        });
                                    }}
                                    className="px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 text-slate-200 hover:bg-slate-900/60 text-xs font-semibold"
                                    disabled={!selectedUnit?.location}
                                    title={!selectedUnit?.location ? 'Add a location to this org unit to enable filtering' : 'Open candidates filtered by this location'}
                                >
                                    Open Candidates
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 text-slate-200 hover:bg-slate-900/60 text-xs font-semibold"
                                >
                                    Open Jobs
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-900/40 border border-slate-700 rounded-lg px-3 py-2">
                                    <div className="text-[11px] text-slate-500 uppercase font-semibold">Headcount</div>
                                    <div className="text-white font-bold">{(selectedUnit?.headcount ?? 0).toLocaleString()}</div>
                                </div>
                                <div className="bg-slate-900/40 border border-slate-700 rounded-lg px-3 py-2">
                                    <div className="text-[11px] text-slate-500 uppercase font-semibold">Candidates</div>
                                    <div className="text-white font-bold">{candidatesForSelectedUnit.length}</div>
                                </div>
                                <div className="bg-slate-900/40 border border-slate-700 rounded-lg px-3 py-2">
                                    <div className="text-[11px] text-slate-500 uppercase font-semibold">Open Jobs</div>
                                    <div className="text-white font-bold">{openJobsForSelectedUnit.length}</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-slate-300">
                                    Verified skills coverage: <span className="text-white font-semibold">{verifiedCoverage.pct}%</span>
                                    <span className="text-slate-500"> ({verifiedCoverage.verified}/{verifiedCoverage.total})</span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    Assessment-backed skills increase trust.
                                </div>
                            </div>
                            <div className="mt-2 h-2 rounded bg-slate-800 overflow-hidden border border-slate-700">
                                <div className="h-full bg-emerald-500/70" style={{ width: `${Math.max(0, Math.min(100, verifiedCoverage.pct))}%` }} />
                            </div>
                        </div>

                        {openJobsForSelectedUnit.length === 0 && candidatesForSelectedUnit.length === 0 && (
                            <div className="mt-4 text-sm text-slate-400">
                                No jobs/candidates mapped to this unit by location. Add `location` to org units that matches your jobs/candidate locations to unlock live insights.
                            </div>
                        )}
                    </div>

                    {/* Heatmap Section */}
                    <div>
                        <h3 className="text-xl font-bold text-white mb-4">
                            Capability Heatmap:{' '}
                            <span className="text-sky-400">{selectedUnit?.name ?? selectedUnitId}</span>
                        </h3>
                        <CapabilityHeatmap metrics={metrics} />
                    </div>

                    {/* Scenario Section */}
                    <ScenarioSimulator
                        scenarios={template.scenarios}
                        onRun={handleRunScenario}
                        results={scenarioResults}
                        isLoading={isSimulating}
                    />
                </div>
            </div>
        </div>
    );
};

export default OrgTwinPage;
