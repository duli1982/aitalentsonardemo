import React, { useMemo, useState } from 'react';
import InsightsView from '../components/InsightsView';
import { DepartmentInsight } from '../types';
import { useData } from '../contexts/DataContext';
import { useSupabaseCandidateInsights } from '../hooks/useSupabaseCandidateInsights';

interface InsightsPageProps {
    departmentInsights: DepartmentInsight[];
}

const InsightsPage: React.FC<InsightsPageProps> = ({ departmentInsights }) => {
    const [source, setSource] = useState<'jobs' | 'candidates'>('jobs');
    const { internalCandidates, pastCandidates, uploadedCandidates } = useData();

    const {
        insights: supabaseCandidateInsights,
        isLoading: isLoadingSupabaseInsights,
        totalCandidates: supabaseTotalCandidates
    } = useSupabaseCandidateInsights({ enabled: source === 'candidates', pageSize: 1000 });

    const candidateInsights = useMemo<DepartmentInsight[]>(() => {
        const counts = new Map<string, Map<string, number>>();

        // Start with Supabase counts (already aggregated)
        for (const dept of supabaseCandidateInsights) {
            if (!counts.has(dept.department)) counts.set(dept.department, new Map());
            const skillCounts = counts.get(dept.department)!;
            dept.topSkills.forEach((s) => {
                skillCounts.set(s.skill, (skillCounts.get(s.skill) || 0) + s.count);
            });
        }

        // Merge demo candidates (internal/past/uploaded) into the same counts
        const demoCandidates = [...internalCandidates, ...pastCandidates, ...uploadedCandidates] as any[];
        for (const candidate of demoCandidates) {
            const dept =
                candidate.department ||
                candidate.metadata?.department ||
                candidate.metadata?.industry ||
                'Unknown';

            const skills: unknown = candidate.skills;
            if (!Array.isArray(skills) || skills.length === 0) continue;

            if (!counts.has(dept)) counts.set(dept, new Map());
            const skillCounts = counts.get(dept)!;

            for (const rawSkill of skills) {
                const skill = String(rawSkill || '').trim();
                if (!skill) continue;
                skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
            }
        }

        return Array.from(counts.entries())
            .map(([department, skillCounts]) => {
                const topSkills = Array.from(skillCounts.entries())
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([skill, count]) => ({ skill, count }));
                return { department, topSkills };
            })
            .filter((d) => d.topSkills.length > 0)
            .sort((a, b) => a.department.localeCompare(b.department));
    }, [internalCandidates, pastCandidates, uploadedCandidates, supabaseCandidateInsights]);

    const displayedInsights = source === 'jobs' ? departmentInsights : candidateInsights;

    return (
        <div className="h-full">
            <div className="flex items-center justify-end gap-2 mb-4">
                <button
                    onClick={() => setSource('jobs')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${source === 'jobs'
                        ? 'bg-sky-600/20 border-sky-500/50 text-sky-200'
                        : 'bg-slate-800 border-slate-700 text-gray-300 hover:bg-slate-700/50'
                        }`}
                >
                    Job Demand
                </button>
                <button
                    onClick={() => setSource('candidates')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${source === 'candidates'
                        ? 'bg-purple-600/20 border-purple-500/50 text-purple-200'
                        : 'bg-slate-800 border-slate-700 text-gray-300 hover:bg-slate-700/50'
                        }`}
                >
                    Candidate Pool
                </button>
            </div>
            {source === 'candidates' && isLoadingSupabaseInsights && (
                <div className="mb-4 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-gray-300">
                    Loading insights from Supabase ({supabaseTotalCandidates.toLocaleString()} candidates)…
                </div>
            )}
            <InsightsView insights={displayedInsights} source={source} />
        </div>
    );
};

export default InsightsPage;
