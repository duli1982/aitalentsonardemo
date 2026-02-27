import React, { useState } from 'react';
import { BarChart2, TrendingUp, Zap, ChevronDown, ChevronUp, Briefcase, Users, Target } from 'lucide-react';
import { DepartmentInsight } from '../types';
import { TIMING } from '../config/timing';

interface InsightsViewProps {
    insights: DepartmentInsight[];
    source?: 'jobs' | 'candidates';
}

const InsightCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }> = ({ title, icon, children, collapsible = false, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-slate-800/70 backdrop-blur-sm shadow-xl rounded-xl overflow-hidden">
            <button
                onClick={() => collapsible && setIsOpen(!isOpen)}
                className={`w-full p-6 flex items-center justify-between ${collapsible ? 'cursor-pointer hover:bg-slate-700/30' : ''}`}
            >
                <h3 className="text-xl font-semibold text-sky-400 flex items-center">{icon}{title}</h3>
                {collapsible && (isOpen ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />)}
            </button>
            {isOpen && <div className="px-6 pb-6">{children}</div>}
        </div>
    );
};

const ChartBar: React.FC<{ label: string; value: number; maxValue: number; onClick?: () => void }> = ({ label, value, maxValue, onClick }) => {
    const percentage = (value / maxValue) * 100;
    return (
        <button
            onClick={onClick}
            className="flex items-center space-x-3 text-sm mb-2 w-full group hover:bg-slate-700/30 p-1 rounded transition-colors"
        >
            <div className="w-40 text-gray-300 truncate text-left group-hover:text-white">{label}</div>
            <div className="flex-grow bg-slate-700 rounded-full h-5 relative overflow-hidden">
                <div
                    className="bg-gradient-to-r from-sky-500 to-blue-500 h-5 rounded-full flex items-center justify-start px-2 transition-all duration-500"
                    style={{ width: `${Math.max(percentage, 10)}%` }}
                >
                    <span className="text-white text-xs font-bold">{value}</span>
                </div>
            </div>
        </button>
    );
};

const InsightsView: React.FC<InsightsViewProps> = ({ insights, source = 'jobs' }) => {
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

    const maxSkillCount = Math.max(...insights.flatMap(dept => dept.topSkills.map(s => s.count)), 1);
    const totalSkillMentions = insights.reduce((sum, dept) => sum + dept.topSkills.reduce((s, skill) => s + skill.count, 0), 0);
    const totalDepartments = insights.length;
    const topSkillOverall = insights.flatMap(d => d.topSkills).sort((a, b) => b.count - a.count)[0];

    const [platformTrends, setPlatformTrends] = useState([
        { title: 'AI/ML Integration', growth: 45, description: 'Demand for AI/ML skills in non-tech departments (Marketing, HR, Finance) is accelerating.', color: 'purple' },
        { title: 'Cloud-Native Security', growth: 38, description: 'Skills like Kubernetes Security and IaC Security show rapid growth.', color: 'blue' },
        { title: 'Data Engineering', growth: 32, description: 'Apache Spark, Databricks, and dbt skills in high demand.', color: 'green' },
    ]);

    // Simulate live market data updates
    React.useEffect(() => {
        const interval = setInterval(() => {
            setPlatformTrends(prev => prev.map(trend => ({
                ...trend,
                growth: Math.min(99, Math.max(10, trend.growth + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3)))
            })));
        }, TIMING.INSIGHTS_TRENDS_UPDATE_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-2">Market Insights</h2>
            <p className="text-lg text-gray-400 mb-8">
                {source === 'jobs'
                    ? 'Aggregated trends from your current job requisitions.'
                    : 'Aggregated trends from your candidate pool (demo + Supabase).'
                }
            </p>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center">
                    <Briefcase className="h-10 w-10 text-sky-500 mr-4" />
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-bold">Departments</p>
                        <p className="text-2xl font-bold text-white">{totalDepartments}</p>
                    </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center">
                    <Target className="h-10 w-10 text-green-500 mr-4" />
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-bold">Skill Mentions</p>
                        <p className="text-2xl font-bold text-white">{totalSkillMentions}</p>
                    </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center">
                    <TrendingUp className="h-10 w-10 text-purple-500 mr-4" />
                    <div>
                        <p className="text-slate-400 text-xs uppercase font-bold">Top Skill</p>
                        <p className="text-lg font-bold text-white truncate">{topSkillOverall?.skill || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Selected Skill Detail */}
            {selectedSkill && (
                <div className="mb-6 p-4 bg-sky-900/30 border border-sky-500/30 rounded-xl animate-fade-in">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-sky-300 font-bold">Selected: {selectedSkill}</h4>
                            <p className="text-sm text-gray-400">Found in {insights.filter(d => d.topSkills.some(s => s.skill === selectedSkill)).length} department(s)</p>
                        </div>
                        <button onClick={() => setSelectedSkill(null)} className="text-xs text-gray-400 hover:text-white">Clear</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {insights.length > 0 ? (
                    insights.map(({ department, topSkills }) => (
                        <InsightCard
                            key={department}
                            title={`${department}`}
                            icon={<BarChart2 className="mr-3 text-green-400" />}
                            collapsible
                        >
                            <div className="space-y-1">
                                {topSkills.map(s => (
                                    <ChartBar
                                        key={s.skill}
                                        label={s.skill}
                                        value={s.count}
                                        maxValue={maxSkillCount}
                                        onClick={() => setSelectedSkill(s.skill)}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-3">Click a skill to highlight across departments</p>
                        </InsightCard>
                    ))
                ) : (
                    <div className="col-span-full text-center py-10 bg-slate-800/50 rounded-lg">
                        <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                        {source === 'jobs' ? (
                            <>
                                <p className="text-lg text-gray-400">No job data available to generate insights.</p>
                                <p className="text-sm text-gray-500">Add jobs with required skills to see analysis here.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-lg text-gray-400">No candidate data available to generate insights.</p>
                                <p className="text-sm text-gray-500">Ingest candidates (demo upload or Supabase ingestion) to see analysis here.</p>
                            </>
                        )}
                    </div>
                )}

                <InsightCard title="Emerging Platform Trends" icon={<TrendingUp className="mr-3 text-purple-400" />}>
                    <ul className="space-y-4">
                        {platformTrends.map(trend => (
                            <li key={trend.title} className="flex items-start">
                                <Zap className="h-5 w-5 mr-3 text-yellow-400 mt-1 flex-shrink-0" />
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-purple-300">{trend.title}</h4>
                                        <span className={`text-xs px-2 py-0.5 rounded-full bg-${trend.color}-900/50 text-${trend.color}-300 font-bold`}>
                                            +{trend.growth}%
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400">{trend.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-gray-500 mt-4">* Illustrative platform-wide trends (demo data)</p>
                </InsightCard>
            </div>
        </div>
    );
};

export default InsightsView;
