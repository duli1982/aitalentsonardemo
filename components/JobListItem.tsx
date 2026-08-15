import React, { useMemo } from 'react';
import type { Job } from '../types';
import { useData } from '../contexts/DataContext';

interface JobListItemProps {
    job: Job;
    selected: boolean;
    onSelect: () => void;
}

const JobListItem: React.FC<JobListItemProps> = ({ job, selected, onSelect }) => {
    const { internalCandidates, pastCandidates, uploadedCandidates } = useData();

    const allCandidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);

    const sourcedCount = useMemo(() => {
        if (allCandidates.length === 0) return 0;

        return allCandidates.filter((candidate) => {
            const rawStage = (candidate as any).pipelineStage?.[job.id];
            return String(rawStage || '').toLowerCase() === 'sourced';
        }).length;
    }, [allCandidates, job.id]);

    const matchCounts = useMemo(() => {
        if (allCandidates.length === 0) return { strong: 0, good: 0, total: 0 };

        const candidatesWithScores = allCandidates.filter(c => c.matchScores?.[job.id] !== undefined);
        const strong = candidatesWithScores.filter(c => (c.matchScores?.[job.id] || 0) >= 70).length;
        const good = candidatesWithScores.filter(c => {
            const score = c.matchScores?.[job.id] || 0;
            return score >= 50 && score < 70;
        }).length;

        return { strong, good, total: candidatesWithScores.length };
    }, [job.id, allCandidates]);

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left p-3 mb-2 rounded-lg transition-all duration-200 border-2 ${selected ? 'bg-slate-700 border-sky-500' : 'bg-slate-700/50 hover:bg-slate-700 border-transparent'}`}
        >
            <div className="flex justify-between items-start mb-1">
                <h3 className={`font-semibold ${selected ? 'text-sky-300' : 'text-sky-400'} pr-2`}>{job.title}</h3>
                <span className={`capitalize text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${job.status === 'open' ? 'bg-green-500/20 text-green-300' : job.status === 'on hold' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                    {job.status}
                </span>
            </div>
            <p className="text-xs text-gray-400 mb-2">{job.department} - {job.location}</p>
            {(sourcedCount > 0 || matchCounts.total > 0) && (
                <div className="flex gap-2 flex-wrap">
                    {sourcedCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 font-medium">
                            Sourced ({sourcedCount})
                        </span>
                    )}
                    {matchCounts.strong > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">
                            {matchCounts.strong} strong
                        </span>
                    )}
                    {matchCounts.good > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-medium">
                            {matchCounts.good} good
                        </span>
                    )}
                </div>
            )}
        </button>
    );
};

export default JobListItem;
