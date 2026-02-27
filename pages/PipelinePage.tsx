import React from 'react';
import { Briefcase, Plus, Search, ChevronDown } from 'lucide-react';
import JobListItem from '../components/JobListItem';
import PipelineView from '../components/PipelineView';
import { Job, PipelineStage } from '../types';

interface PipelinePageProps {
    jobs: Job[];
    selectedJobId: string | null;
    setSelectedJobId: (id: string | null) => void;
    filteredJobs: Job[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: Job['status'] | 'all';
    setStatusFilter: (status: Job['status'] | 'all') => void;
    setAddJobModalOpen: (open: boolean) => void;
    handleUpdateCandidateStage: (candidateId: string, jobId: string, newStage: PipelineStage) => void;
}

const PipelinePage: React.FC<PipelinePageProps> = ({
    jobs,
    selectedJobId,
    setSelectedJobId,
    filteredJobs,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    setAddJobModalOpen,
    handleUpdateCandidateStage
}) => {

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
            <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col space-y-4 h-full">
                <div className="bg-slate-800 shadow-xl rounded-xl p-1 flex flex-col h-full">
                    <div className="p-4 flex-shrink-0">
                        <h2 className="text-xl font-semibold text-sky-400 mb-3 flex items-center justify-between">
                            <span className="flex items-center">
                                <Briefcase className="mr-2 h-5 w-5" />Select Job
                            </span>
                            {jobs.length > 0 && (
                                <button
                                    onClick={() => setAddJobModalOpen(true)}
                                    className="p-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
                                    title="Add New Job"
                                >
                                    <Plus size={18} />
                                </button>
                            )}
                        </h2>
                        {jobs.length > 0 && (
                            <div className="space-y-2">
                                <div className="relative">
                                    <input type="text" placeholder="Search jobs..." className="w-full p-2 pl-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                </div>
                                <div className="relative">
                                    <label htmlFor="status-filter-pipeline" className="sr-only">Filter by Status</label>
                                    <select id="status-filter-pipeline" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Job['status'] | 'all')} className="w-full p-2 pl-3 pr-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none appearance-none capitalize text-sm">
                                        <option value="all" className="font-semibold">All Statuses</option>
                                        <option value="open">Open</option>
                                        <option value="on hold">On Hold</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex-grow overflow-y-auto px-4 pb-2 custom-scrollbar min-h-0">
                        {filteredJobs.length > 0 ? (
                            filteredJobs.map(job => (<JobListItem key={job.id} job={job} selected={job.id === selectedJobId} onSelect={() => setSelectedJobId(job.id)} />))
                        ) : (
                            <p className="text-center text-gray-400 p-4">No jobs found.</p>
                        )}
                    </div>
                </div>
            </div>
            <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col h-full">
                <PipelineView
                    job={jobs.find(j => j.id === selectedJobId)}
                    onUpdateCandidateStage={handleUpdateCandidateStage}
                />
            </div>
        </div>
    );
};

export default PipelinePage;
