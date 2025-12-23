import React, { useMemo, useState } from 'react';
import type { Job } from '../types';
import { ChevronDown, Loader2, PanelRightOpen, Sparkles } from 'lucide-react';
import Skeleton from './ui/Skeleton';
import JobDetailsDrawer from './modals/JobDetailsDrawer';

interface JobDetailsProps {
    job: Job;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    onUpdateStatus: (jobId: string, status: Job['status']) => void;
    isLoading?: boolean;
}

const JobDetails: React.FC<JobDetailsProps> = ({ job, onAnalyze, isAnalyzing, onUpdateStatus, isLoading }) => {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);

    const hasDescription = useMemo(() => Boolean(job.description && job.description.trim().length), [job.description]);
    const showExcerptToggle = useMemo(() => Boolean(job.description && job.description.trim().length > 160), [job.description]);

    if (isLoading) {
        return (
            <div className="bg-slate-800 shadow-xl rounded-xl p-6 mb-6 border border-slate-700">
                <div className="flex justify-between items-start mb-6">
                    <div className="space-y-2 w-2/3">
                        <Skeleton width="60%" height="2rem" />
                        <div className="flex gap-4">
                            <Skeleton width="20%" height="1rem" />
                            <Skeleton width="20%" height="1rem" />
                        </div>
                    </div>
                    <Skeleton width="8rem" height="2.5rem" />
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Skeleton height="3rem" />
                    <Skeleton height="3rem" />
                    <Skeleton height="3rem" />
                </div>
                <div className="space-y-2">
                    <Skeleton width="40%" height="1.5rem" />
                    <Skeleton width="100%" height="4rem" />
                </div>
            </div>
        );
    }

    const getStatusColor = (status: Job['status']) => {
        switch (status) {
            case 'open': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'on hold': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'closed': return 'bg-red-500/20 text-red-300 border-red-500/30';
            default: return 'bg-slate-600 text-gray-300';
        }
    };

    return (
        <div className="bg-slate-800 shadow-xl rounded-xl p-1">
            <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-sky-400">{job.title}</h2>
                        <div className="flex items-center gap-4 mt-2">
                            <p className="text-sky-300/80">{job.department} - {job.location}</p>
                            {/* Status Dropdown */}
                            <div className="relative">
                                <select
                                    value={job.status}
                                    onChange={(e) => onUpdateStatus(job.id, e.target.value as Job['status'])}
                                    className={`appearance-none cursor-pointer capitalize text-xs font-semibold px-3 py-1 pr-7 rounded-full border ${getStatusColor(job.status)} bg-transparent focus:outline-none focus:ring-2 focus:ring-sky-500`}
                                >
                                    <option value="open">Open</option>
                                    <option value="on hold">On Hold</option>
                                    <option value="closed">Closed</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className={`text-sm text-slate-200 ${descriptionExpanded ? '' : 'line-clamp-3'}`}>
                                {hasDescription ? job.description : <span className="text-slate-400">No job description provided yet.</span>}
                            </div>
                            {(hasDescription && showExcerptToggle) && (
                                <button
                                    type="button"
                                    onClick={() => setDescriptionExpanded((v) => !v)}
                                    className="mt-1 text-xs text-sky-300 hover:text-sky-200"
                                >
                                    {descriptionExpanded ? 'Show less' : 'Show more'}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 mt-1">
                        <button
                            type="button"
                            onClick={() => setDetailsOpen(true)}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2 px-3 rounded-md flex items-center transition-colors text-sm"
                        >
                            <PanelRightOpen className="h-4 w-4 mr-1.5 text-sky-300" />
                            Job details
                        </button>
                        <button onClick={onAnalyze} disabled={isAnalyzing} className="bg-slate-700 hover:bg-slate-600 text-sky-300 font-medium py-2 px-4 rounded-md flex items-center transition-colors text-sm disabled:opacity-50">
                            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5 text-yellow-400" />}
                            Analyze Job
                        </button>
                    </div>
                </div>
            </div>

            <JobDetailsDrawer isOpen={detailsOpen} job={job} onClose={() => setDetailsOpen(false)} />
        </div>
    );
};

export default JobDetails;
