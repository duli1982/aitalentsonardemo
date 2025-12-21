import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, createSearchParams } from 'react-router-dom';
import { ProjectType, ForecastScenario, ForecastResult } from '../types/forecast';
import { demandForecastingService } from '../services/DemandForecastingService';
import { ForecastChart } from '../components/charts';
import { useData } from '../contexts/DataContext';
import { TrendingUp, Calendar, MapPin, Layers, ArrowRight, UserPlus, AlertCircle, Loader2, Briefcase } from 'lucide-react';

type ForecastTemplateId = 'pharma' | 'staffing';

const ForecastPage: React.FC = () => {
    const navigate = useNavigate();
    const { internalCandidates, pastCandidates, uploadedCandidates } = useData();

    const [templateId, setTemplateId] = useState<ForecastTemplateId>(() => {
        const saved = localStorage.getItem('forecast_templateId');
        return saved === 'staffing' ? 'staffing' : 'pharma';
    });

    const [region, setRegion] = useState('Spain');
    const [projectType, setProjectType] = useState<ProjectType>('CLINICAL_HUB');
    const [timeframeMonths, setTimeframeMonths] = useState<number>(18);

    const [clientName, setClientName] = useState('');
    const [targetHires, setTargetHires] = useState<number>(50);
    const [primaryRole, setPrimaryRole] = useState('Customer Support Agent');
    const [result, setResult] = useState<ForecastResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const allCandidates = useMemo(
        () => [...internalCandidates, ...pastCandidates, ...uploadedCandidates],
        [internalCandidates, pastCandidates, uploadedCandidates]
    );

    const projectOptions = useMemo(() => {
        return templateId === 'staffing'
            ? [
                { value: 'CLIENT_RAMP' as ProjectType, label: 'New Client Ramp' },
                { value: 'SEASONAL_SPIKE' as ProjectType, label: 'Seasonal Spike' },
                { value: 'COMPLIANCE_CHANGE' as ProjectType, label: 'Compliance Change' },
            ]
            : [
                { value: 'CLINICAL_HUB' as ProjectType, label: 'Clinical Trial Hub' },
                { value: 'MFG_EXPANSION' as ProjectType, label: 'Manufacturing Expansion' },
                { value: 'R_AND_D_CENTER' as ProjectType, label: 'R&D Center of Excellence' },
            ];
    }, [templateId]);

    const timeframeOptions = useMemo(() => {
        return templateId === 'staffing'
            ? [
                { value: 1, label: '1 Month' },
                { value: 3, label: '3 Months' },
                { value: 6, label: '6 Months' },
                { value: 12, label: '12 Months' },
            ]
            : [
                { value: 12, label: '12 Months' },
                { value: 18, label: '18 Months' },
                { value: 24, label: '24 Months' },
            ];
    }, [templateId]);

    useEffect(() => {
        localStorage.setItem('forecast_templateId', templateId);
        setResult(null);

        if (templateId === 'staffing') {
            setRegion('Budapest, Hungary');
            setProjectType('CLIENT_RAMP');
            setTimeframeMonths(3);
            setClientName('');
            setTargetHires(50);
            setPrimaryRole('Customer Support Agent');
        } else {
            setRegion('Spain');
            setProjectType('CLINICAL_HUB');
            setTimeframeMonths(18);
        }
    }, [templateId]);

    const handleSimulate = () => {
        setIsLoading(true);
        setResult(null);

        // Simulate API delay
        setTimeout(() => {
            const scenario: ForecastScenario = {
                id: Date.now().toString(),
                name: templateId === 'staffing'
                    ? `${projectOptions.find((p) => p.value === projectType)?.label ?? 'Staffing Forecast'}${clientName ? ` — ${clientName}` : ''}`
                    : 'Strategic Expansion',
                projectType,
                region,
                launchDate: new Date().toISOString(),
                timeframeMonths: timeframeMonths,
                clientName: templateId === 'staffing' ? (clientName || undefined) : undefined,
                targetHires: templateId === 'staffing' ? targetHires : undefined,
                primaryRole: templateId === 'staffing' ? primaryRole : undefined,
            };

            const data = demandForecastingService.runForecast(scenario);
            setResult(data);
            setIsLoading(false);
        }, 800);
    };

    const handleStartTalentPooling = (role: string) => {
        navigate({
            pathname: '/candidates',
            search: `?${createSearchParams({
                role: role,
                location: region
            })}`
        });
    };

    const supplySummary = useMemo(() => {
        if (templateId !== 'staffing') return null;
        const roleNeed = primaryRole.trim().toLowerCase();
        const regionNeed = region.trim().toLowerCase();
        const available = allCandidates.filter((c) => {
            const r = (c.role ?? '').toLowerCase();
            const l = (c.location ?? '').toLowerCase();
            return (!roleNeed || r.includes(roleNeed)) && (!regionNeed || l.includes(regionNeed));
        }).length;
        const coverage = targetHires > 0 ? Math.round((available / targetHires) * 100) : 0;
        return { available, coverage };
    }, [allCandidates, primaryRole, region, targetHires, templateId]);

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <TrendingUp className="text-purple-400" size={18} />
                        Forecast
                    </h2>
                    <p className="text-slate-400 text-sm">
                        {templateId === 'staffing'
                            ? 'Randstad-style demand forecasting: client ramps, seasonal spikes, and compliance events.'
                            : 'Enterprise expansion forecasting: hubs, manufacturing, and R&D build-outs.'}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Mode</span>
                    <select
                        value={templateId}
                        onChange={(e) => setTemplateId(e.target.value as ForecastTemplateId)}
                        className="bg-slate-900/40 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    >
                        <option value="pharma">Pharma / Enterprise</option>
                        <option value="staffing">Staffing (Randstad)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-1 bg-slate-800 rounded-xl border border-slate-700 p-6 h-fit">
                    <div className="flex items-center mb-6">
                        <Layers className="text-purple-400 mr-2" />
                        <h3 className="text-lg font-bold text-white">Scenario Configuration</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-xs uppercase font-bold mb-2">
                                {templateId === 'staffing' ? 'Demand Scenario' : 'Project Classification'}
                            </label>
                            <select
                                value={projectType}
                                onChange={(e) => setProjectType(e.target.value as ProjectType)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                {projectOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-400 text-xs uppercase font-bold mb-2">
                                {templateId === 'staffing' ? 'Country / City' : 'Target Region'}
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={region}
                                    onChange={(e) => setRegion(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 pl-10 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>

                        {templateId === 'staffing' && (
                            <>
                                <div>
                                    <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Client (optional)</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            value={clientName}
                                            onChange={(e) => setClientName(e.target.value)}
                                            placeholder="e.g., DHL / ING / Zalando"
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 pl-10 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Target Hires</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={targetHires}
                                            onChange={(e) => setTargetHires(Number(e.target.value))}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-xs uppercase font-bold mb-2">Primary Role</label>
                                        <input
                                            type="text"
                                            value={primaryRole}
                                            onChange={(e) => setPrimaryRole(e.target.value)}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-slate-400 text-xs uppercase font-bold mb-2">
                                {templateId === 'staffing' ? 'Planning Horizon' : 'Time Horizon'}
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <select
                                    value={timeframeMonths}
                                    onChange={(e) => setTimeframeMonths(Number(e.target.value))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 pl-10 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    {timeframeOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleSimulate}
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg mt-4 flex items-center justify-center transition-all shadow-lg disabled:opacity-50"
                        >
                            {isLoading ? (
                                <><Loader2 className="mr-2 animate-spin" size={18} /> Generating...</>
                            ) : (
                                <><TrendingUp className="mr-2" size={18} /> Generate Forecast</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {isLoading ? (
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700 border-dashed p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                            <Loader2 className="h-12 w-12 text-purple-400 mb-4 animate-spin" />
                            <h3 className="text-xl text-white font-bold mb-2">Generating Forecast</h3>
                            <p className="text-slate-400 max-w-md">Running scenario patterns and market heuristics...</p>
                        </div>
                    ) : !result ? (
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700 border-dashed p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                            <TrendingUp className="h-16 w-16 text-slate-600 mb-4" />
                            <h3 className="text-xl text-slate-400 font-semibold mb-2">Ready to Forecast</h3>
                            <p className="text-slate-500 max-w-md">Configure a business scenario to generate predictive talent demand models using market intelligence and historical patterns.</p>
                        </div>
                    ) : (
                        <div className="animate-fade-in space-y-6">
                            {/* Summary Cards */}
                            <div className="flex gap-4">
                                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-1">
                                    <p className="text-slate-400 text-xs uppercase font-bold">Total Roles Predicted</p>
                                    <p className="text-3xl font-bold text-white text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">{result.totalHeadcount}</p>
                                </div>
                                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-2">
                                    <p className="text-slate-400 text-xs uppercase font-bold mb-1">Market Intelligence</p>
                                    {result.marketInsights.map((insight, i) => (
                                        <div key={i} className="flex items-start text-sm text-slate-300">
                                            <AlertCircle size={14} className="text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                                            {insight}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                                <h3 className="text-lg font-bold text-white mb-4">Demand Curve</h3>
                                <ForecastChart
                                    data={Array.from({ length: Math.min(18, Math.max(1, timeframeMonths)) }, (_, i) => {
                                        const m = i + 1;
                                        const baseline = Math.round((result.totalHeadcount * m) / Math.max(1, timeframeMonths));
                                        return {
                                            month: `M${m}`,
                                            baseline,
                                            optimistic: Math.round(baseline * 1.12),
                                            pessimistic: Math.round(baseline * 0.88),
                                        };
                                    })}
                                    showScenarios
                                    height={260}
                                />
                                <div className="text-xs text-slate-400 mt-3">
                                    Baseline is a simple ramp across the horizon; wave details are shown below.
                                </div>
                            </div>

                            {templateId === 'staffing' && supplySummary && (
                                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                                    <h3 className="text-lg font-bold text-white mb-4">Supply Check (Current Pool)</h3>
                                    <div className="text-sm text-slate-400 mb-3">
                                        Matches candidates by role/location text from your current app pool. Connect Supabase candidates for real coverage at scale.
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                                            <div className="text-xs text-slate-500 uppercase font-semibold">Available Matches</div>
                                            <div className="text-2xl font-bold text-white">{supplySummary.available}</div>
                                        </div>
                                        <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                                            <div className="text-xs text-slate-500 uppercase font-semibold">Target Hires</div>
                                            <div className="text-2xl font-bold text-white">{targetHires}</div>
                                        </div>
                                        <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                                            <div className="text-xs text-slate-500 uppercase font-semibold">Coverage</div>
                                            <div className="text-2xl font-bold text-white">{supplySummary.coverage}%</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Attrition Risks */}
                            {result.risks && result.risks.length > 0 && (
                                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                    <h4 className="text-red-400 font-bold flex items-center mb-3">
                                        <AlertCircle className="mr-2" size={18} />
                                        Attrition Risks Detected
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {result.risks.map((risk, idx) => (
                                            <div key={idx} className="bg-slate-800/80 p-3 rounded border border-red-500/20">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-white font-semibold">{risk.role}</span>
                                                    <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded font-bold">{risk.riskLevel} RISK</span>
                                                </div>
                                                <p className="text-slate-400 text-xs mb-2">{risk.impact}</p>
                                                <div className="text-xs text-green-400 flex items-start">
                                                    <span className="font-bold mr-1">Mitigation:</span> {risk.mitigation}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Timeline Feed */}
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                                <h3 className="text-xl font-bold text-white mb-6">
                                    {templateId === 'staffing' ? 'Demand Waves (Actionable)' : 'Strategic Hiring Timeline'}
                                </h3>

                                <div className="relative border-l-2 border-slate-700 ml-4 space-y-8 pb-4">
                                    {result.demands.map((demand, idx) => (
                                        <div key={idx} className="relative pl-8">
                                            {/* Timeline Node */}
                                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-slate-900 border-2 border-purple-500"></div>

                                            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 hover:border-purple-500/50 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-purple-900/50 text-purple-300 mb-2 border border-purple-500/30">
                                                            {demand.timelineQ}
                                                        </span>
                                                        <h4 className="text-lg font-bold text-white">{demand.count}x {demand.roleTitle}</h4>
                                                    </div>
                                                    <div className={`px-2 py-1 rounded text-xs font-bold ${demand.criticality === 'HIGH' ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'}`}>
                                                        {demand.criticality} PRIORITY
                                                    </div>
                                                </div>

                                                <p className="text-slate-400 text-sm mb-3 italic">"{demand.rationale}"</p>

                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {demand.skillsRequired.map(skill => (
                                                        <span key={skill} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-600">
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => handleStartTalentPooling(demand.roleTitle)}
                                                    className="flex items-center text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                                                >
                                                    <UserPlus size={16} className="mr-2" />
                                                    Start Talent Pooling
                                                    <ArrowRight size={14} className="ml-1" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForecastPage;
