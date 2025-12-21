import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Briefcase, Plus, Search, ChevronDown, Sparkles, Brain, Database } from 'lucide-react';
import JobListItem from '../components/JobListItem';
import JobDetails from '../components/JobDetails';
import CandidatePane from '../components/CandidatePane';
import { Job, Candidate } from '../types';

interface JobsPageProps {
    jobs: Job[];
    selectedJobId: string | null;
    setSelectedJobId: (id: string | null) => void;
    filteredJobs: Job[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: Job['status'] | 'all';
    setStatusFilter: (status: Job['status'] | 'all') => void;
    setAddJobModalOpen: (open: boolean) => void;
    handleInitiateAnalysis: (type: any, subject: any) => void;
    handleUpdateJobStatus: (id: string, status: Job['status']) => void;
    handleFeedback: (candidateId: string, jobId: string, feedback: 'positive' | 'negative') => void;
    handleBatchAnalysis: (candidates: Candidate[]) => void;
    handleViewProfile: (candidate: Candidate) => void;
    handleOpenCandidateJobDrawer: (candidate: Candidate, job: Job) => void;
    handleAddCandidateToPipeline: (candidate: Candidate, jobId: string) => void;
    isLoading: boolean;
    loadingCandidateId: string | null;
    isBatchAnalyzing: boolean;
    analysisState: any;
    selectedJob: Job | undefined;
}

const JobsPage: React.FC<JobsPageProps> = ({
    jobs,
    selectedJobId,
    setSelectedJobId,
    filteredJobs,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    setAddJobModalOpen,
    handleInitiateAnalysis,
    handleUpdateJobStatus,
    handleFeedback,
    handleBatchAnalysis,
    handleViewProfile,
    handleOpenCandidateJobDrawer,
    handleAddCandidateToPipeline,
    isLoading,
    loadingCandidateId,
    isBatchAnalyzing,
    analysisState,
    selectedJob
}) => {
    const jobListRef = useRef<HTMLDivElement>(null);
    const [showJobFilters, setShowJobFilters] = useState(false);

    // Keyboard navigation for job list
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!filteredJobs.length) return;

        const currentIndex = filteredJobs.findIndex(j => j.id === selectedJobId);

        if (e.key === 'ArrowDown' || e.key === 'j') {
            e.preventDefault();
            const nextIndex = currentIndex < filteredJobs.length - 1 ? currentIndex + 1 : 0;
            setSelectedJobId(filteredJobs[nextIndex].id);
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
            e.preventDefault();
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredJobs.length - 1;
            setSelectedJobId(filteredJobs[prevIndex].id);
        }
    }, [filteredJobs, selectedJobId, setSelectedJobId]);

    useEffect(() => {
        const listElement = jobListRef.current;
        if (listElement) {
            listElement.addEventListener('keydown', handleKeyDown);
            return () => listElement.removeEventListener('keydown', handleKeyDown);
        }
    }, [handleKeyDown]);

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
            <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col space-y-4 h-full">
                <div className="bg-slate-800 shadow-xl rounded-xl p-1 flex flex-col h-full">
                    <div className="p-4 flex-shrink-0">
                        <h2 className="text-xl font-semibold text-sky-400 mb-3 flex items-center justify-between">
                            <span className="flex items-center">
                                <Briefcase className="mr-2 h-5 w-5" />Job Requisitions
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
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="Search jobs..."
                                            className="w-full p-2 pl-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowJobFilters((v) => !v)}
                                        className={`p-2 rounded-md border transition-colors ${showJobFilters ? 'bg-sky-600/20 border-sky-500/40 text-sky-200' : 'bg-slate-700 border-slate-600 text-gray-300 hover:text-white hover:bg-slate-600'}`}
                                        title="Filters"
                                    >
                                        <ChevronDown className={`h-4 w-4 transition-transform ${showJobFilters ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>

                                {showJobFilters && (
                                    <div className="relative">
                                        <label htmlFor="status-filter" className="sr-only">Filter by Status</label>
                                        <select
                                            id="status-filter"
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value as Job['status'] | 'all')}
                                            className="w-full p-2 pl-3 pr-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none appearance-none capitalize text-sm"
                                        >
                                            <option value="all" className="font-semibold">All Statuses</option>
                                            <option value="open">Open</option>
                                            <option value="on hold">On Hold</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div
                        ref={jobListRef}
                        tabIndex={0}
                        role="listbox"
                        aria-label="Job list"
                        className="flex-grow overflow-y-auto px-4 pb-2 custom-scrollbar min-h-0 focus:outline-none"
                    >
                        {jobs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                <div className="bg-gradient-to-br from-sky-900/30 to-purple-900/30 border border-sky-500/30 rounded-xl p-6 mb-4">
                                    <Sparkles className="h-12 w-12 text-sky-400 mx-auto mb-3" />
                                    <h3 className="text-lg font-semibold text-sky-300 mb-2">Start Your Hiring Journey</h3>
                                    <p className="text-sm text-gray-400 mb-4">
                                        Create your first job requisition using AI-powered analysis
                                    </p>
                                    <button
                                        onClick={() => setAddJobModalOpen(true)}
                                        className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center transition-all"
                                    >
                                        <Plus className="h-5 w-5 mr-2" />
                                        Add Your First Job
                                    </button>
                                </div>
                            </div>
                        ) : filteredJobs.length > 0 ? (
                            <>
                                {filteredJobs.map(job => (<JobListItem key={job.id} job={job} selected={job.id === selectedJobId} onSelect={() => setSelectedJobId(job.id)} />))}
                            </>
                        ) : (
                            <p className="text-center text-gray-400 p-4">No jobs match your search.</p>
                        )}
                    </div>
                </div>
            </div>
            <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col space-y-6 h-full">
                {selectedJob ? (
                    <>
                        <JobDetails job={selectedJob} onAnalyze={() => handleInitiateAnalysis('JOB_SUMMARY', selectedJob)} isAnalyzing={isLoading && analysisState.type === 'JOB_SUMMARY'} onUpdateStatus={handleUpdateJobStatus} />
                        <div className="flex-grow min-h-0">
                            <CandidatePane
                                job={selectedJob}
                                onInitiateAnalysis={(type, candidate) => handleInitiateAnalysis(type, candidate)}
                                onFeedback={handleFeedback}
                                onAddToPipeline={handleAddCandidateToPipeline}
                                onBatchAnalysis={handleBatchAnalysis}
                                onViewProfile={handleViewProfile}
                                onOpenCandidateJobDrawer={handleOpenCandidateJobDrawer}
                                isLoading={isLoading}
                                loadingCandidateId={loadingCandidateId}
                                isBatchAnalyzing={isBatchAnalyzing}
                            />
                        </div>
                    </>
                ) : jobs.length === 0 ? (
                    <div className="flex justify-center items-center h-full bg-slate-800 shadow-xl rounded-xl p-8">
                        <div className="text-center max-w-xl">
                            <div className="bg-gradient-to-br from-purple-900/30 to-sky-900/30 border border-purple-500/30 rounded-xl p-8 mb-6">
                                <Brain className="h-16 w-16 text-sky-400 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-sky-300 mb-3">Welcome to AI-Powered Talent Discovery</h2>
                                <p className="text-gray-400 mb-6">
                                    Get started by creating a job requisition. Our AI will analyze requirements and automatically find the best candidates.
                                </p>
                                <div className="space-y-3 text-left mb-6">
                                    <div className="flex items-start gap-3 text-sm text-gray-300">
                                        <div className="bg-sky-500/20 p-2 rounded-full mt-0.5">
                                            <Sparkles className="h-4 w-4 text-sky-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sky-300">AI Job Analysis</p>
                                            <p className="text-xs text-gray-400">Paste any job description and AI extracts key requirements</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-gray-300">
                                        <div className="bg-purple-500/20 p-2 rounded-full mt-0.5">
                                            <Database className="h-4 w-4 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-purple-300">Demo Candidate Database</p>
                                            <p className="text-xs text-gray-400">Load 20 realistic candidates with intelligent AI matching</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 text-sm text-gray-300">
                                        <div className="bg-green-500/20 p-2 rounded-full mt-0.5">
                                            <Brain className="h-4 w-4 text-green-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-green-300">Smart Matching</p>
                                            <p className="text-xs text-gray-400">AI ranks candidates and explains match scores</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setAddJobModalOpen(true)}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-8 rounded-lg flex items-center justify-center mx-auto transition-all text-lg shadow-lg"
                            >
                                <Plus className="h-6 w-6 mr-2" />
                                Create Your First Job
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center items-center h-full bg-slate-800 shadow-xl rounded-xl p-6">
                        <p className="text-xl text-gray-400">Select a job to view candidates</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobsPage;
