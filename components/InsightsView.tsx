import React from 'react';
import { BarChart2, TrendingUp, Zap } from 'lucide-react';
import { DepartmentInsight } from '../App';

interface InsightsViewProps {
    insights: DepartmentInsight[];
}

const InsightCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; }> = ({ title, icon, children }) => (
    <div className="bg-slate-800/70 backdrop-blur-sm shadow-xl rounded-xl p-6">
        <h3 className="text-xl font-semibold text-sky-400 mb-4 flex items-center">{icon}{title}</h3>
        {children}
    </div>
);

const ChartBar: React.FC<{ label: string; value: number; maxValue: number; }> = ({ label, value, maxValue }) => {
    const percentage = (value / maxValue) * 100;
    return (
        <div className="flex items-center space-x-3 text-sm mb-2">
            <div className="w-40 text-gray-300 truncate">{label}</div>
            <div className="flex-grow bg-slate-700 rounded-full h-5">
                <div className="bg-gradient-to-r from-sky-500 to-blue-500 h-5 rounded-full text-right px-2 text-white text-xs font-bold flex items-center justify-start" style={{ width: `${percentage}%` }}>
                    {value}
                </div>
            </div>
        </div>
    );
};


const InsightsView: React.FC<InsightsViewProps> = ({ insights }) => {
    
    const maxSkillCount = Math.max(...insights.flatMap(dept => dept.topSkills.map(s => s.count)), 1);

    return (
        <div className="w-full animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-6">Market Insights</h2>
            <p className="text-lg text-gray-400 mb-8">Aggregated trends from your current job requisitions to highlight in-demand skills.</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {insights.length > 0 ? (
                    insights.map(({ department, topSkills }) => (
                        <InsightCard key={department} title={`Top In-Demand Skills (${department})`} icon={<BarChart2 className="mr-3 text-green-400" />}>
                            <div className="space-y-2">
                                {topSkills.map(s => <ChartBar key={s.skill} label={s.skill} value={s.count} maxValue={maxSkillCount} />)}
                            </div>
                            <p className="text-xs text-gray-500 mt-3">* Based on the frequency of skills in your open and recent job requisitions.</p>
                        </InsightCard>
                    ))
                ) : (
                    <div className="col-span-full text-center py-10 bg-slate-800/50 rounded-lg">
                        <p className="text-lg text-gray-400">No job data available to generate insights.</p>
                        <p className="text-sm text-gray-500">Add some jobs with required skills to see analysis here.</p>
                    </div>
                )}

                <InsightCard title="Emerging Platform Trends" icon={<TrendingUp className="mr-3 text-purple-400" />}>
                   <ul className="space-y-3">
                       <li className="flex items-start"><Zap className="h-5 w-5 mr-3 text-yellow-400 mt-1 flex-shrink-0" /><div><h4 className="font-semibold text-purple-300">AI/ML Integration</h4><p className="text-sm text-gray-400">Illustrative: Demand for roles with AI/ML skills in non-tech departments (e.g., Marketing, HR) is up 45% quarter-over-quarter across the platform.</p></div></li>
                       <li className="flex items-start"><Zap className="h-5 w-5 mr-3 text-yellow-400 mt-1 flex-shrink-0" /><div><h4 className="font-semibold text-purple-300">Cloud-Native Security</h4><p className="text-sm text-gray-400">Illustrative: Skills like 'Kubernetes Security' and 'IaC Security' are seeing rapid growth in demand across the platform.</p></div></li>
                   </ul>
                   <p className="text-xs text-gray-500 mt-3">* This is illustrative data representing platform-wide trends.</p>
                </InsightCard>
            </div>
        </div>
    );
};

export default InsightsView;