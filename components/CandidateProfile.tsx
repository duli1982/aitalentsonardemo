import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Candidate, Job, FitAnalysis, InternalCandidate, ProfileEnrichmentAnalysis } from '../types';
import { User, ClipboardList, Briefcase, Brain, Loader2, Target, BarChart, ChevronDown, Sparkles, AlertCircle, Info, GitBranch, Linkedin, BarChart2, Pencil } from 'lucide-react';
import * as geminiService from '../services/geminiService';
import SkillGapChart from './SkillGapChart';
import EditCandidateModal from './modals/EditCandidateModal';

const CandidateProfile: React.FC<{
  candidate: Candidate | null;
  jobs: Job[];
  onInitiateAnalysis: (candidate: Candidate, job: Job) => Promise<FitAnalysis | null>;
  onUpdateCandidate: (candidateId: string, updatedData: Partial<Candidate>) => void;
}> = ({ candidate, jobs, onInitiateAnalysis, onUpdateCandidate }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    // When candidate changes, reset to summary tab
    setActiveTab('summary');
  }, [candidate?.id]);

  if (!candidate) {
    return (
      <div className="flex justify-center items-center h-full bg-slate-800/70 backdrop-blur-sm shadow-xl rounded-xl p-6">
        <p className="text-xl text-gray-400 flex items-center"><User className="mr-3" /> Select a candidate to view their profile.</p>
      </div>
    );
  }

  const TabButton: React.FC<{ label: string; tabName: string; icon: React.ReactNode }> = ({ label, tabName, icon }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`flex items-center justify-center py-3 px-4 sm:px-6 text-sm font-medium rounded-t-lg transition-colors duration-150 ${activeTab === tabName ? 'border-b-2 border-sky-500 text-sky-400 bg-slate-700/50' : 'text-gray-400 hover:text-sky-300 hover:bg-slate-700/30'}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="bg-slate-800/70 backdrop-blur-sm shadow-xl rounded-xl p-1 h-full flex flex-col">
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-sky-400">{candidate.name}</h2>
              <p className="text-sky-300/80">{candidate.email}</p>
            </div>
             <button 
              onClick={() => setIsEditModalOpen(true)}
              className="bg-slate-600/50 hover:bg-slate-500/50 text-sky-300 font-medium py-2 px-3 rounded-lg flex items-center transition-colors text-sm"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit Profile
            </button>
        </div>
        <div className="flex border-b border-slate-700">
            <TabButton label="Summary & Enrichment" tabName="summary" icon={<ClipboardList className="mr-2 h-5 w-5" />} />
            <TabButton label="AI Job Matching" tabName="matching" icon={<Target className="mr-2 h-5 w-5" />} />
        </div>
      </div>
      <div className="overflow-y-auto custom-scrollbar px-6 pb-6 flex-grow min-h-0">
          {activeTab === 'summary' && <SummaryTab candidate={candidate} jobs={jobs} onUpdateCandidate={onUpdateCandidate} />}
          {activeTab === 'matching' && <MatchingTab candidate={candidate} jobs={jobs} onInitiateAnalysis={onInitiateAnalysis} />}
      </div>
      {isEditModalOpen && (
        <EditCandidateModal 
          candidate={candidate}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(updatedData) => {
            onUpdateCandidate(candidate.id, updatedData);
            setIsEditModalOpen(false);
          }}
        />)}
    </div>
  );
};

const ProfileCompletionCard: React.FC<{ candidate: Candidate, onUpdateCandidate: (id: string, data: Partial<Candidate>) => void }> = ({ candidate, onUpdateCandidate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleEnrich = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await geminiService.enrichCandidateProfile(candidate);
            const enrichedData: Partial<Candidate> = {
                ...result,
                skills: [...new Set([...candidate.skills, ...result.inferredSkills])],
                profileStatus: 'complete'
            };
            onUpdateCandidate(candidate.id, enrichedData);
        } catch(e) {
            setError(e instanceof Error ? e.message : "Failed to enrich profile.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSimulatedImport = (source: 'linkedin' | 'github') => {
        const mockData = {
            linkedin: {
                suggestedRoleTitle: 'Senior Product Manager',
                skills: [...candidate.skills, 'Product Strategy', 'Agile', 'Roadmapping'],
                experienceSummary: 'Simulated: Experienced Senior Product Manager with a demonstrated history of working in the computer software industry.',
                profileStatus: 'complete' as const
            },
            github: {
                suggestedRoleTitle: 'Software Developer',
                skills: [...candidate.skills, 'Python', 'Go', 'Docker', 'Kubernetes'],
                experienceSummary: 'Simulated: Software developer with strong contributions to open-source projects, skilled in backend technologies and cloud infrastructure.',
                profileStatus: 'complete' as const
            }
        };
        onUpdateCandidate(candidate.id, mockData[source]);
    }

    return (
        <div className="bg-slate-700/40 p-4 rounded-lg border-l-4 border-amber-500">
            <h4 className="font-semibold text-lg text-amber-300 mb-2 flex items-center"><AlertCircle className="mr-2" /> Profile Incomplete</h4>
            <p className="text-sm text-gray-300 mb-4">This profile has missing information. Enrich it to improve matching accuracy and unlock insights.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={() => handleSimulatedImport('linkedin')} className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-medium py-2 px-3 rounded-lg flex items-center justify-center transition-colors text-sm"><Linkedin className="h-4 w-4 mr-2"/> Import from LinkedIn</button>
                <button onClick={() => handleSimulatedImport('github')} className="bg-gray-500/20 hover:bg-gray-500/40 text-gray-300 font-medium py-2 px-3 rounded-lg flex items-center justify-center transition-colors text-sm"><GitBranch className="h-4 w-4 mr-2"/> Import from GitHub</button>
                <button onClick={handleEnrich} disabled={isLoading} className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition-all text-sm disabled:opacity-50">
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2"/>} Enrich with AI
                </button>
            </div>
            {error && <p className="text-xs text-red-400 mt-2 text-center">{error}</p>}
        </div>
    );
}

const RecommendedJobs: React.FC<{ candidate: Candidate, jobs: Job[]}> = ({ candidate, jobs }) => {
    const recommended = useMemo(() => {
        const candidateSkills = new Set(candidate.skills.map(s => s.toLowerCase()));
        if (candidateSkills.size === 0) return [];

        return jobs
            .filter(j => j.status === 'open')
            .map(job => {
                const jobSkills = new Set(job.requiredSkills.map(s => s.toLowerCase()));
                const matchedSkills = [...jobSkills].filter(s => candidateSkills.has(s));
                const score = matchedSkills.length / jobSkills.size;
                return { ...job, score };
            })
            .filter(j => j.score > 0.2)
            .sort((a,b) => b.score - a.score)
            .slice(0, 3);
    }, [candidate, jobs]);

    if (recommended.length === 0) return null;

    return (
        <div>
            <h4 className="font-semibold text-lg text-sky-300 mb-2">Recommended Roles</h4>
            <div className="space-y-2">
                {recommended.map(job => (
                    <div key={job.id} className="bg-slate-700/30 p-3 rounded-md">
                        <p className="font-semibold text-sky-400">{job.title}</p>
                        <p className="text-xs text-gray-400">{job.department} - {job.location}</p>
                        <p className="text-xs mt-1"><span className="font-medium text-green-400">Match Score:</span> {Math.round(job.score * 100)}%</p>
                    </div>
                ))}
            </div>
        </div>
    );
};


const SummaryTab: React.FC<{ candidate: Candidate, jobs: Job[], onUpdateCandidate: (id: string, data: Partial<Candidate>) => void }> = ({ candidate, jobs, onUpdateCandidate }) => {
    const isComplete = candidate.profileStatus === 'complete';
    const roleTitle = candidate.suggestedRoleTitle || (candidate.type === 'internal' && candidate.currentRole) || 'Role Not Specified';

    return (
        <div className="space-y-6 pt-4">
            {!isComplete && <ProfileCompletionCard candidate={candidate} onUpdateCandidate={onUpdateCandidate}/>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <div><h4 className="font-semibold text-lg text-sky-300 mb-1">Role Title</h4><p className="text-sm text-gray-300 bg-slate-700/40 p-2 rounded-md">{roleTitle}</p></div>
                    <div>
                        <h4 className="font-semibold text-lg text-sky-300 mb-1">Professional Summary</h4>
                        <p className="text-sm text-gray-300 italic bg-slate-700/40 p-2 rounded-md min-h-[60px]">{candidate.experienceSummary || "No summary available."}</p>
                    </div>
                 </div>
                 <div className="bg-slate-700/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg text-sky-300 mb-2">Key Skills</h4>
                    <div className="flex flex-wrap gap-2">
                        {candidate.skills.map(skill => (
                            <span key={skill} className="bg-sky-500/20 text-sky-300 text-xs px-2 py-1 rounded-full">{skill}</span>
                        ))}
                         {candidate.skills.length === 0 && <p className="text-sm text-gray-400">No skills listed.</p>}
                    </div>
                 </div>
            </div>

            <RecommendedJobs candidate={candidate} jobs={jobs} />

            <div>
                <h4 className="font-semibold text-lg text-sky-300 mb-2">Advanced Analytics</h4>
                <button disabled={!isComplete} className="w-full bg-purple-500/20 text-purple-300 font-medium py-2 px-4 rounded-lg flex items-center justify-center transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed group">
                    <BarChart2 className="h-4 w-4 mr-2"/> Unlock Market Insights
                    <span className="hidden group-disabled:inline-block absolute bg-slate-900 text-xs px-2 py-1 rounded-md ml-48 shadow-lg border border-slate-700">Complete profile to enable</span>
                </button>
            </div>
        </div>
    );
};

const MatchingTab: React.FC<{ candidate: Candidate, jobs: Job[], onInitiateAnalysis: (candidate: Candidate, job: Job) => Promise<FitAnalysis | null> }> = ({ candidate, jobs, onInitiateAnalysis }) => {
    const [selectedJobId, setSelectedJobId] = useState<string>('');
    const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const openJobs = jobs.filter(j => j.status === 'open');

    useEffect(() => {
        // Reset on candidate change
        setSelectedJobId('');
        setAnalysis(null);
    }, [candidate.id]);

    const handleJobSelect = useCallback(async (jobId: string) => {
        setSelectedJobId(jobId);
        if (!jobId) {
            setAnalysis(null);
            return;
        }
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            setIsLoading(true);
            const result = await onInitiateAnalysis(candidate, job);
            setAnalysis(result);
            setIsLoading(false);
        }
    }, [jobs, candidate, onInitiateAnalysis]);

    const selectedJob = jobs.find(j => j.id === selectedJobId);

    return (
        <div className="space-y-4 pt-4">
            <div>
                <label htmlFor="job-selector" className="block text-sm font-medium text-sky-300/80 mb-1">Select an open job to analyze fit:</label>
                <div className="relative">
                    <select id="job-selector" value={selectedJobId} onChange={(e) => handleJobSelect(e.target.value)} className="w-full p-2 pl-3 pr-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none appearance-none capitalize">
                        <option value="">-- Select a Job --</option>
                        {openJobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {isLoading && (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-2 text-sky-500" /> Analyzing Fit...
                </div>
            )}

            {!isLoading && analysis && selectedJob && (
                 <div className="p-3 rounded-md bg-slate-700/40 space-y-3">
                    <div className="text-center">
                        <h4 className="font-semibold text-sky-400/90 mb-1">Overall Match Score</h4>
                        <p className={`font-bold text-5xl ${analysis.matchScore > 75 ? 'text-green-400' : analysis.matchScore > 50 ? 'text-yellow-400' : 'text-red-400'}`}>{analysis.matchScore}<span className="text-2xl">%</span></p>
                    </div>
                     <div><h4 className="font-semibold text-sky-400/90 mb-1">Rationale:</h4><p className="text-gray-300 italic text-sm">{analysis.matchRationale}</p></div>
                    <div className="flex justify-center items-center pt-4 border-t border-slate-600/50">
                        <SkillGapChart analysis={analysis.skillGapAnalysis} jobSkills={selectedJob.requiredSkills} />
                    </div>
                 </div>
            )}
        </div>
    );
};

export default CandidateProfile;