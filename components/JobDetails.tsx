import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Job } from '../types';
import { BriefcaseBusiness, ChevronDown, Loader2, PanelRightOpen, Sparkles, Phone } from 'lucide-react';
import Skeleton from './ui/Skeleton';
import JobDetailsDrawer from './modals/JobDetailsDrawer';
import IntakeCallModal from './modals/IntakeCallModal';
import IntakeScorecardReviewModal from './modals/IntakeScorecardReviewModal';

interface JobDetailsProps {
    job: Job;
    readOnly?: boolean;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    onUpdateStatus: (jobId: string, status: Job['status']) => void;
    isLoading?: boolean;
}

const JobDetails: React.FC<JobDetailsProps> = ({ job, readOnly = false, onAnalyze, isAnalyzing, onUpdateStatus, isLoading }) => {
    const navigate = useNavigate();
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [intakeCallOpen, setIntakeCallOpen] = useState(false);
    const [scorecardReviewOpen, setScorecardReviewOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-xl">
                <div className="flex items-center justify-between gap-5">
                    <div className="min-w-0 flex-1"><Skeleton width="55%" height="1.75rem" /></div>
                    <div className="hidden gap-2 sm:flex"><Skeleton width="7rem" height="2.25rem" /><Skeleton width="7rem" height="2.25rem" /></div>
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
        <div className="rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
            <div className="p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                        <h2 className="truncate text-2xl font-bold text-sky-400">{job.title}</h2>
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm text-sky-300/80">{job.department} · {job.location}</p>
                            {/* Status Dropdown */}
                            {!readOnly ? <div className="relative">
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
                            </div> : <span className={`capitalize text-xs font-semibold px-3 py-1 rounded-full border ${getStatusColor(job.status)}`}>{job.status}</span>}
                        </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                        {!readOnly && <button
                            type="button"
                            onClick={() => navigate(`/requisitions/${job.id}`)}
                            className="bg-sky-700/30 hover:bg-sky-600/40 text-sky-200 font-medium py-2 px-3 rounded-md flex items-center transition-colors text-sm border border-sky-500/30"
                        >
                            <BriefcaseBusiness className="h-4 w-4 mr-1.5" />
                            Workspace
                        </button>}
                        {!readOnly && <button
                            type="button"
                            onClick={() => setIntakeCallOpen(true)}
                            className="bg-green-700/30 hover:bg-green-600/40 text-green-300 font-medium py-2 px-3 rounded-md flex items-center transition-colors text-sm border border-green-600/30"
                        >
                            <Phone className="h-4 w-4 mr-1.5" />
                            Intake Call
                        </button>}
                        <button
                            type="button"
                            onClick={() => setDetailsOpen(true)}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2 px-3 rounded-md flex items-center transition-colors text-sm"
                        >
                            <PanelRightOpen className="h-4 w-4 mr-1.5 text-sky-300" />
                            Job details
                        </button>
                        {!readOnly && <button onClick={onAnalyze} disabled={isAnalyzing} className="bg-slate-700 hover:bg-slate-600 text-sky-300 font-medium py-2 px-4 rounded-md flex items-center transition-colors text-sm disabled:opacity-50">
                            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5 text-yellow-400" />}
                            Analyze Job
                        </button>}
                    </div>
                </div>
            </div>

            <JobDetailsDrawer isOpen={detailsOpen} job={job} onClose={() => setDetailsOpen(false)} />

            <IntakeCallModal
                isOpen={intakeCallOpen}
                onClose={() => setIntakeCallOpen(false)}
                job={job}
                onScorecardReady={() => {
                    setIntakeCallOpen(false);
                    setScorecardReviewOpen(true);
                }}
            />

            <IntakeScorecardReviewModal
                isOpen={scorecardReviewOpen}
                onClose={() => setScorecardReviewOpen(false)}
                jobId={job.id}
                jobTitle={job.title}
            />
        </div>
    );
};

export default JobDetails;
