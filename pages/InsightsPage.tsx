import React, { useEffect, useMemo, useState } from 'react';
import InsightsView from '../components/InsightsView';
import SkillsSupplyDemandView from '../components/SkillsSupplyDemandView';
import { Candidate, DepartmentInsight } from '../types';
import { useData } from '../contexts/DataContext';
import { useLocalWorkspaceCandidateInsights } from '../hooks/useLocalWorkspaceCandidateInsights';
import { useAuth } from '../contexts/AuthContext';
import { canGenerateTalentIntel } from '../utils/permissions';
import { jobIntelligenceService, type ExternalJobPosting } from '../services/JobIntelligenceService';
import TalentIntelligenceReports from '../components/TalentIntelligenceReports';

interface InsightsPageProps {
    departmentInsights: DepartmentInsight[];
}

const InsightsPage: React.FC<InsightsPageProps> = ({ departmentInsights }) => {
    const [source, setSource] = useState<'coverage' | 'jobs' | 'candidates' | 'reports'>('coverage');
    const { jobs, internalCandidates, pastCandidates, uploadedCandidates } = useData();
    const { activeOrganization } = useAuth();
    const [externalPostings, setExternalPostings] = useState<ExternalJobPosting[]>([]);
    const allCandidates = useMemo<Candidate[]>(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);

    const {
        insights: localStoreCandidateInsights,
        isLoading: isLoadingLocalWorkspaceInsights,
        totalCandidates: localStoreTotalCandidates
    } = useLocalWorkspaceCandidateInsights({ enabled: source === 'candidates', pageSize: 1000 });

    const candidateInsights = localStoreCandidateInsights;

    const displayedInsights = source === 'jobs' ? departmentInsights : candidateInsights;
    useEffect(() => { void jobIntelligenceService.list(activeOrganization.organizationId).then(setExternalPostings); }, [activeOrganization.organizationId]);

    return (
        <div className="h-full space-y-6">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div><p className="text-xs font-bold uppercase tracking-wider text-sky-300">Workforce intelligence</p><h1 className="mt-1 text-3xl font-bold text-white">Skills Intelligence</h1><p className="mt-2 text-base text-slate-400">Compare recruiting demand with available talent and investigate the evidence behind every skill gap.</p></div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/45 p-1" role="tablist" aria-label="Skills intelligence view">
                <button
                    onClick={() => setSource('coverage')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${source === 'coverage' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    Supply vs Demand
                </button>
                <button
                    onClick={() => setSource('jobs')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${source === 'jobs'
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                >
                    Job Demand
                </button>
                <button
                    onClick={() => setSource('candidates')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${source === 'candidates'
                        ? 'bg-violet-500 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                >
                    Candidate Pool
                </button>
                {canGenerateTalentIntel(activeOrganization.role) && <button
                    onClick={() => setSource('reports')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${source === 'reports' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                    HM / TA Reports
                </button>}
                </div>
            </header>
            {source === 'candidates' && isLoadingLocalWorkspaceInsights && (
                <div className="mb-4 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-gray-300">
                    Loading local candidate insights ({localStoreTotalCandidates.toLocaleString()} candidates)…
                </div>
            )}
            {source === 'coverage'
                ? <SkillsSupplyDemandView jobs={jobs} candidates={allCandidates} externalPostings={externalPostings} />
                : source === 'reports'
                    ? <TalentIntelligenceReports jobs={jobs} candidates={allCandidates} externalPostings={externalPostings} onMarketSourcesChanged={setExternalPostings} />
                    : <InsightsView insights={displayedInsights} source={source} showHeader={false} />}
        </div>
    );
};

export default InsightsPage;
