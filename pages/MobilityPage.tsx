import React, { useMemo, useState } from 'react';
import { careerPathService } from '../services/CareerPathService';
import { CareerPath, BuildVsBuyMetrics } from '../types/career';
import { useData } from '../contexts/DataContext';
import { ArrowRight, Clock, DollarSign, TrendingUp, Users, Map, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const MobilityPage: React.FC = () => {
    const { internalCandidates } = useData();

    const [domain, setDomain] = useState<'pharma' | 'staffing'>(() => {
        const saved = localStorage.getItem('mobility_domain');
        return saved === 'staffing' ? 'staffing' : 'pharma';
    });

    const [selectedRole, setSelectedRole] = useState('QC Analyst');
    const [targetRole, setTargetRole] = useState('Data Analyst');
    const [path, setPath] = useState<CareerPath | null>(null);
    const [metrics, setMetrics] = useState<BuildVsBuyMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [urgency, setUrgency] = useState<1 | 2 | 3 | 4 | 5>(3);
    const [targetHires, setTargetHires] = useState<number>(50);

    const roleOptions = useMemo(() => {
        if (domain === 'staffing') {
            return {
                from: ['Recruiting Coordinator', 'Sourcer', 'Recruiter (Desk)', 'Candidate Care Specialist'],
                to: ['Recruiter (Desk)', 'Senior Recruiter', 'Account Manager', 'Compliance Specialist']
            };
        }

        return {
            from: ['QC Analyst', 'Lab Technician', 'Process Engineer'],
            to: ['Data Analyst', 'Senior QC', 'Quality Person (QP)']
        };
    }, [domain]);

    const title = domain === 'staffing' ? 'Redeployment & Upskilling Designer' : 'Career Route & Mobility Designer';
    const subtitle = domain === 'staffing'
        ? 'Design pathways to redeploy recruiters/consultants across desks and client ramps.'
        : 'Design internal pathways and evaluate "Build vs Buy" strategies.';

    const handleDesignPath = () => {
        setIsLoading(true);
        setPath(null);
        setMetrics(null);

        setTimeout(() => {
            localStorage.setItem('mobility_domain', domain);
            setPath(careerPathService.generatePath(selectedRole, targetRole, domain));
            setMetrics(careerPathService.analyzeBuildVsBuy(targetRole, domain, { urgency, targetHires: domain === 'staffing' ? targetHires : 1 }));
            setIsLoading(false);
        }, 1200);
    };

    const internalMatches = useMemo(() => {
        const target = targetRole.toLowerCase();
        const targetSkills = target.includes('data')
            ? ['python', 'sql', 'analytics']
            : target.includes('recruit')
                ? ['screen', 'sourcing', 'stakeholder']
                : target.includes('compliance')
                    ? ['compliance', 'documentation']
                    : target.includes('account')
                        ? ['client', 'stakeholder', 'negotiation']
                        : [];

        if (targetSkills.length === 0) return [];

        return internalCandidates
            .map((c) => {
                const skills = (c.skills ?? []).map((s) => s.toLowerCase());
                const hits = targetSkills.filter((s) => skills.some((k) => k.includes(s))).length;
                const score = Math.round((hits / targetSkills.length) * 100);
                return { candidate: c, score };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }, [internalCandidates, targetRole]);

    return (
        <div className="h-[calc(100vh-80px)] overflow-y-auto p-6 space-y-8 custom-scrollbar">

            {/* Header */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div className="flex items-center mb-4">
                    <Map className="text-pink-400 mr-3" size={24} />
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">{title}</h1>
                            <select
                                value={domain}
                                onChange={(e) => {
                                    const next = e.target.value as 'pharma' | 'staffing';
                                    setDomain(next);
                                    setPath(null);
                                    setMetrics(null);
                                    if (next === 'staffing') {
                                        setSelectedRole('Recruiting Coordinator');
                                        setTargetRole('Recruiter (Desk)');
                                    } else {
                                        setSelectedRole('QC Analyst');
                                        setTargetRole('Data Analyst');
                                    }
                                }}
                                className="bg-slate-900/40 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/40"
                            >
                                <option value="pharma">Pharma / Enterprise</option>
                                <option value="staffing">Staffing (Randstad)</option>
                            </select>
                        </div>
                        <p className="text-slate-400">{subtitle}</p>
                    </div>
                </div>

                <div className="flex items-end gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                    <div>
                        <label className="block text-xs text-slate-500 font-bold uppercase mb-1">From Role</label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 w-64 focus:border-pink-500 outline-none"
                        >
                            {roleOptions.from.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pb-2 text-slate-500">
                        <ArrowRight />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-500 font-bold uppercase mb-1">To Target Role</label>
                        <select
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value)}
                            className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 w-64 focus:border-pink-500 outline-none"
                        >
                            {roleOptions.to.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    <div className="ml-auto flex items-end gap-4">
                        <div className="min-w-[180px]">
                            <label className="block text-xs text-slate-500 font-bold uppercase mb-1">Urgency (1–5)</label>
                            <input
                                type="range"
                                min={1}
                                max={5}
                                step={1}
                                value={urgency}
                                onChange={(e) => setUrgency(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                                className="w-full"
                            />
                            <div className="text-xs text-slate-400">Current: {urgency}/5</div>
                        </div>

                        {domain === 'staffing' && (
                            <div className="min-w-[160px]">
                                <label className="block text-xs text-slate-500 font-bold uppercase mb-1">Target Hires</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={targetHires}
                                    onChange={(e) => setTargetHires(Number(e.target.value))}
                                    className="bg-slate-800 text-white border border-slate-600 rounded px-3 py-2 w-full focus:border-pink-500 outline-none"
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleDesignPath}
                        disabled={isLoading}
                        className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-colors ml-auto flex items-center"
                    >
                        {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <TrendingUp size={16} className="mr-2" />}
                        {isLoading ? 'Designing Path...' : 'Design Route'}
                    </button>
                </div>
            </div>

            {path && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Path Visualizer */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-bold text-white flex items-center">
                            <Map className="text-pink-400 mr-2" size={20} />
                            Recommended Internal Path
                            <span className="ml-3 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">
                                {path.feasibilityScore}% Feasible
                            </span>
                        </h2>

                        <div className="relative border-l-2 border-slate-700 ml-4 space-y-8 pl-8 py-2">
                            {/* Start Node */}
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-600 border-2 border-slate-900"></div>

                            {path.steps.map((step, idx) => (
                                <div key={idx} className="relative bg-slate-800 rounded-lg p-5 border border-slate-700 hover:border-pink-500/50 transition-colors">
                                    <div className="absolute -left-[41px] top-6 w-4 h-4 rounded-full bg-pink-500 border-4 border-slate-900"></div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-white">{step.roleTitle}</h3>
                                        <span className="text-xs font-mono bg-slate-900 text-slate-300 px-2 py-1 rounded">
                                            {step.durationMonths} Months
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-400 mb-3">{step.description}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {step.requiredSkills.map(skill => (
                                            <span key={skill} className="text-xs bg-slate-700 text-pink-200 px-2 py-1 rounded-full border border-slate-600">
                                                + {skill}
                                            </span>
                                        ))}
                                    </div>
                                    <span className="absolute top-2 right-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                        Step {idx + 1} • {step.type}
                                    </span>
                                </div>
                            ))}

                            {/* End Node */}
                            <div className="absolute -left-[9px] bottom-0 w-4 h-4 rounded-full bg-green-500 border-2 border-slate-900"></div>
                            <div className="text-slate-400 text-sm italic pt-2">Goal Reached: {path.targetRole} after {path.totalDurationMonths} months</div>
                        </div>
                    </div>

                    {/* Decision Engine Widget */}
                    <div className="space-y-6">
                        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                            <h2 className="text-lg font-bold text-white mb-3 flex items-center">
                                <Users className="text-sky-400 mr-2" size={18} />
                                Internal Mobility Supply (Fast Check)
                            </h2>
                            <p className="text-slate-400 text-sm mb-4">
                                Best-effort: checks your internal pool for skill overlap with the target role.
                            </p>
                            {internalMatches.length === 0 ? (
                                <div className="text-slate-500 text-sm">No internal matches found with the current heuristic.</div>
                            ) : (
                                <div className="space-y-2">
                                    {internalMatches.map(({ candidate, score }) => (
                                        <div key={candidate.id} className="bg-slate-900/40 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                                            <div>
                                                <div className="text-white font-semibold">{candidate.name}</div>
                                                <div className="text-xs text-slate-400">{candidate.role} • {candidate.location}</div>
                                            </div>
                                            <div className="text-sm font-bold text-sky-300">{score}%</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {metrics && (
                            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                                    <DollarSign className="text-green-400 mr-2" size={20} />
                                    Decision Simulator: Build vs Buy
                                </h2>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className={`p-4 rounded-lg border ${metrics.recommendation === 'BUILD' ? 'bg-green-500/10 border-green-500 text-green-100' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                                        <div className="text-xs font-bold uppercase mb-2">Build (Internal Move)</div>
                                        <div className="text-2xl font-bold mb-1">${metrics.build.cost.toLocaleString()}</div>
                                        <div className="text-xs opacity-70 mb-2">Est. Cost</div>
                                        <div className="flex items-center text-xs">
                                            <Clock size={12} className="mr-1" /> {metrics.build.timeMonths} Months
                                        </div>
                                        <div className="flex items-center text-xs mt-1 text-green-300">
                                            <CheckCircle size={12} className="mr-1" /> {Math.round(metrics.build.retentionProb * 100)}% Retention
                                        </div>
                                        {metrics.build.notes && metrics.build.notes.length > 0 && (
                                            <div className="text-xs text-slate-300 mt-2 space-y-1">
                                                {metrics.build.notes.map((n) => <div key={n}>• {n}</div>)}
                                            </div>
                                        )}
                                    </div>

                                    <div className={`p-4 rounded-lg border ${metrics.recommendation === 'BUY' ? 'bg-green-500/10 border-green-500 text-green-100' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                                        <div className="text-xs font-bold uppercase mb-2">Buy (External Hire)</div>
                                        <div className="text-2xl font-bold mb-1">${metrics.buy.cost.toLocaleString()}</div>
                                        <div className="text-xs opacity-70 mb-2">Est. Cost</div>
                                        <div className="flex items-center text-xs">
                                            <Clock size={12} className="mr-1" /> {metrics.buy.timeMonths} Months
                                        </div>
                                        <div className="flex items-center text-xs mt-1 text-red-300">
                                            <AlertTriangle size={12} className="mr-1" /> {Math.round(metrics.buy.retentionProb * 100)}% Retention
                                        </div>
                                        {metrics.buy.notes && metrics.buy.notes.length > 0 && (
                                            <div className="text-xs text-slate-300 mt-2 space-y-1">
                                                {metrics.buy.notes.map((n) => <div key={n}>• {n}</div>)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-900 p-4 rounded border border-slate-600">
                                    <h3 className="font-bold text-white text-sm mb-1">Recommendation</h3>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        Data suggests <strong>{metrics.recommendation}ING</strong> is optimal.
                                        {metrics.recommendation === 'BUILD'
                                            ? " While slower, upskilling provides significantly better long-term retention and culture fit."
                                            : metrics.recommendation === 'BUY'
                                                ? " External hiring is recommended due to urgency and limited near-ready internal talent."
                                                : " Use a blended approach: build internal capability while buying capacity for immediate demand."}
                                    </p>
                                    {metrics.assumptions && metrics.assumptions.length > 0 && (
                                        <div className="mt-3 text-xs text-slate-400">
                                            <div className="font-semibold text-slate-300 mb-1">Assumptions</div>
                                            <ul className="list-disc pl-5 space-y-1">
                                                {metrics.assumptions.map((a) => <li key={a}>{a}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
};

export default MobilityPage;
