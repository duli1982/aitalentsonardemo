import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Job, Candidate, InternalCandidate, PastCandidate, UploadedCandidate, AnalysisResult, FitAnalysis } from './types';
import { MOCK_JOBS, MOCK_INTERNAL_CANDIDATES, MOCK_PAST_CANDIDATES, MOCK_UPLOADED_CANDIDATES } from './constants';
import * as geminiService from './services/geminiService';
import CandidatePane from './components/CandidatePane';
import AddJobModal from './components/modals/AddJobModal';
import UploadCvModal from './components/modals/UploadCvModal';
import AnalysisModal from './components/modals/AnalysisModal';
import CandidatesView from './components/CandidatesView';
import HireCandidateModal from './components/modals/HireCandidateModal';
import InsightsView from './components/InsightsView';
import { Briefcase, Brain, Search, ChevronDown, ChevronUp, Plus, Upload, Loader2, Sparkles, AlertTriangle, X, Users, Lightbulb, CheckCircle } from 'lucide-react';

type AppView = 'jobs' | 'candidates' | 'insights';

export interface DepartmentInsight {
  department: string;
  topSkills: { skill: string; count: number }[];
}

const Header: React.FC<{ activeView: AppView; onViewChange: (view: AppView) => void; }> = ({ activeView, onViewChange }) => (
  <header className="bg-slate-900 shadow-md p-4">
    <div className="container mx-auto flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Brain className="h-10 w-10 text-sky-400" />
        <p className="text-sm font-semibold text-gray-300 hidden sm:block">AI-Powered Proactive Talent Discovery</p>
      </div>
      <nav className="flex items-center p-1 bg-slate-800 rounded-full">
          <button onClick={() => onViewChange('jobs')} className={`flex items-center px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeView === 'jobs' ? 'bg-sky-600 text-white' : 'text-sky-300/80 hover:bg-slate-700/50'}`}>
            <Briefcase className="inline-block h-4 w-4 mr-2" /> Job Requisitions
          </button>
          <button onClick={() => onViewChange('candidates')} className={`flex items-center px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeView === 'candidates' ? 'bg-sky-600 text-white' : 'text-sky-300/80 hover:bg-slate-700/50'}`}>
            <Users className="inline-block h-4 w-4 mr-2" /> Talent Pool
          </button>
           <button onClick={() => onViewChange('insights')} className={`flex items-center px-4 py-2 text-sm font-semibold rounded-full transition-colors ${activeView === 'insights' ? 'bg-sky-600 text-white' : 'text-sky-300/80 hover:bg-slate-700/50'}`}>
            <Lightbulb className="inline-block h-4 w-4 mr-2" /> Insights
          </button>
      </nav>
    </div>
  </header>
);

const JobListItem: React.FC<{ job: Job; selected: boolean; onSelect: () => void; allCandidates?: Candidate[]; }> = ({ job, selected, onSelect, allCandidates = [] }) => {
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
      {matchCounts.total > 0 && (
        <div className="flex gap-2 flex-wrap">
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

const JobDetails: React.FC<{ job: Job; onAnalyze: () => void; isAnalyzing: boolean; onUpdateStatus: (jobId: string, status: Job['status']) => void; }> = ({ job, onAnalyze, isAnalyzing, onUpdateStatus }) => {
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    setExpanded(false);
  }, [job.id]);

  return (
    <div className="bg-slate-800 shadow-xl rounded-xl p-1">
        <div className="p-4 sm:p-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold text-sky-400">{job.title}</h2>
                    <div className="flex items-center gap-4 mt-2">
                        <p className="text-sky-300/80">{job.department} - {job.location}</p>
                         <div className={`capitalize text-xs font-semibold px-3 py-1 rounded-full ${job.status === 'open' ? 'bg-green-500/20 text-green-300' : job.status === 'on hold' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                            {job.status}
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0 mt-1">
                    <button onClick={onAnalyze} disabled={isAnalyzing} className="bg-slate-700 hover:bg-slate-600 text-sky-300 font-medium py-2 px-4 rounded-md flex items-center transition-colors text-sm disabled:opacity-50">
                        {isAnalyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5 text-yellow-400" />}
                        Analyze Job
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

const calculateInitialMatch = (job: Job, candidate: Candidate): { score: number, rationale: string } => {
  const jobSkills = job.requiredSkills;
  const candidateSkills = candidate.skills;
  if (!jobSkills.length || !candidateSkills.length) return { score: 10, rationale: 'Initial profile check.' };
  const jobSkillSet = new Set(jobSkills.map(s => s.toLowerCase()));
  const matchedSkills = candidateSkills.filter(s => jobSkillSet.has(s.toLowerCase()));
  const score = Math.min(90, 15 + (matchedSkills.length / jobSkills.length) * 75);
  const rationale = matchedSkills.length > 0 ? `Matches skills: ${matchedSkills.slice(0, 2).join(', ')}...` : 'Potential based on general profile.';
  return { score: Math.round(score), rationale };
};

const App = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [internalCandidates, setInternalCandidates] = useState<InternalCandidate[]>([]);
  const [pastCandidates, setPastCandidates] = useState<PastCandidate[]>([]);
  const [uploadedCandidates, setUploadedCandidates] = useState<UploadedCandidate[]>([]);
  
  const [activeView, setActiveView] = useState<AppView>('jobs');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Job['status'] | 'all'>('all');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingCandidateId, setLoadingCandidateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isScoringCandidates, setIsScoringCandidates] = useState(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchAnalysisProgress, setBatchAnalysisProgress] = useState({ current: 0, total: 0 });

  const [isAddJobModalOpen, setAddJobModalOpen] = useState(false);
  const [isUploadCvModalOpen, setUploadCvModalOpen] = useState(false);
  const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [isHireModalOpen, setHireModalOpen] = useState(false);

  
  const [isInitialized, setIsInitialized] = useState(false);

  const [analysisState, setAnalysisState] = useState<{ type: string; candidate?: Candidate; result: AnalysisResult | null }>({ type: '', result: null });
  
  useEffect(() => {
    try {
      const savedJobs = localStorage.getItem('talentSonar-jobs');
      const savedInternal = localStorage.getItem('talentSonar-internalCandidates');
      const savedPast = localStorage.getItem('talentSonar-pastCandidates');
      const savedUploaded = localStorage.getItem('talentSonar-uploadedCandidates');
      
      if (savedJobs && savedInternal && savedPast && savedUploaded) {
        setJobs(JSON.parse(savedJobs));
        setInternalCandidates(JSON.parse(savedInternal));
        setPastCandidates(JSON.parse(savedPast));
        setUploadedCandidates(JSON.parse(savedUploaded));
        const savedSelectedJobId = localStorage.getItem('talentSonar-selectedJobId');
        if(savedSelectedJobId) setSelectedJobId(JSON.parse(savedSelectedJobId));
      } else {
        const allCandidates = [...MOCK_INTERNAL_CANDIDATES, ...MOCK_PAST_CANDIDATES, ...MOCK_UPLOADED_CANDIDATES];
        const scoredCandidates = allCandidates.map(c => ({
            ...c,
            matchScores: MOCK_JOBS.reduce((acc, job) => ({ ...acc, [job.id]: calculateInitialMatch(job, c).score }), {}),
            matchRationales: MOCK_JOBS.reduce((acc, job) => ({ ...acc, [job.id]: calculateInitialMatch(job, c).rationale }), {}),
        }));
        
        setJobs(MOCK_JOBS);
        setInternalCandidates(scoredCandidates.filter(c => c.type === 'internal') as InternalCandidate[]);
        setPastCandidates(scoredCandidates.filter(c => c.type === 'past') as PastCandidate[]);
        setUploadedCandidates(scoredCandidates.filter(c => c.type === 'uploaded') as UploadedCandidate[]);
        if (MOCK_JOBS.length > 0) setSelectedJobId(MOCK_JOBS[0].id);
      }
    } catch (e) {
      console.error("Failed to load or initialize data. Resetting to mock data.", e);
      // Fallback logic remains same as initial load
       const allCandidates = [...MOCK_INTERNAL_CANDIDATES, ...MOCK_PAST_CANDIDATES, ...MOCK_UPLOADED_CANDIDATES];
        const scoredCandidates = allCandidates.map(c => ({
            ...c,
            matchScores: MOCK_JOBS.reduce((acc, job) => ({ ...acc, [job.id]: calculateInitialMatch(job, c).score }), {}),
            matchRationales: MOCK_JOBS.reduce((acc, job) => ({ ...acc, [job.id]: calculateInitialMatch(job, c).rationale }), {}),
        }));
      setJobs(MOCK_JOBS);
      setInternalCandidates(scoredCandidates.filter(c => c.type === 'internal') as InternalCandidate[]);
      setPastCandidates(scoredCandidates.filter(c => c.type === 'past') as PastCandidate[]);
      setUploadedCandidates(scoredCandidates.filter(c => c.type === 'uploaded') as UploadedCandidate[]);
      if (MOCK_JOBS.length > 0) setSelectedJobId(MOCK_JOBS[0].id);
    } finally {
        setIsInitialized(true);
    }
  }, []);

  useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-jobs', JSON.stringify(jobs)); }, [jobs, isInitialized]);
  useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-internalCandidates', JSON.stringify(internalCandidates)); }, [internalCandidates, isInitialized]);
  useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-pastCandidates', JSON.stringify(pastCandidates)); }, [pastCandidates, isInitialized]);
  useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-uploadedCandidates', JSON.stringify(uploadedCandidates)); }, [uploadedCandidates, isInitialized]);
  useEffect(() => { if (isInitialized) localStorage.setItem('talentSonar-selectedJobId', JSON.stringify(selectedJobId)); }, [selectedJobId, isInitialized]);
  useEffect(() => { if (activeView === 'jobs') setSelectedCandidateId(null); else if (selectedJobId) setSelectedJobId(selectedJobId); else if(jobs.length > 0) setSelectedJobId(jobs[0].id); }, [activeView, jobs]);

  const allCandidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const selectedJob = useMemo(() => jobs.find(job => job.id === selectedJobId), [jobs, selectedJobId]);
  
  const filteredJobs = useMemo(() => {
    return jobs
      .filter(job => job.title.toLowerCase().includes(searchTerm.toLowerCase()) || job.department.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(job => statusFilter === 'all' || job.status === statusFilter);
  }, [jobs, searchTerm, statusFilter]);

  const departmentInsights = useMemo<DepartmentInsight[]>(() => {
    const skillsByDept: { [key: string]: { [skill: string]: number } } = {};
    const jobsByDept: { [key: string]: number } = {};

    jobs.forEach(job => {
      if (!job.department) return;
      if (!skillsByDept[job.department]) {
        skillsByDept[job.department] = {};
        jobsByDept[job.department] = 0;
      }
      jobsByDept[job.department]++;
      job.requiredSkills.forEach(skill => {
        skillsByDept[job.department][skill] = (skillsByDept[job.department][skill] || 0) + 1;
      });
    });

    return Object.entries(skillsByDept).map(([department, skills]) => {
      const topSkills = Object.entries(skills)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([skill, count]) => ({ skill, count }));
      
      return { department, topSkills };
    });
  }, [jobs]);


  const handleAddJob = (job: Job) => {
    setIsScoringCandidates(true);

    // Score all existing candidates against the new job
    const allCurrentCandidates = [...internalCandidates, ...pastCandidates, ...uploadedCandidates];

    const scoreUpdater = (c: Candidate) => {
      const matchResult = calculateInitialMatch(job, c);
      return {
        ...c,
        matchScores: { ...(c.matchScores || {}), [job.id]: matchResult.score },
        matchRationales: { ...(c.matchRationales || {}), [job.id]: matchResult.rationale }
      };
    };

    setInternalCandidates(prev => prev.map(scoreUpdater) as InternalCandidate[]);
    setPastCandidates(prev => prev.map(scoreUpdater) as PastCandidate[]);
    setUploadedCandidates(prev => prev.map(scoreUpdater) as UploadedCandidate[]);

    setJobs(prev => [job, ...prev]);
    setSelectedJobId(job.id);

    // Calculate match statistics for feedback
    const scoredCandidates = allCurrentCandidates.map(c => {
      const matchResult = calculateInitialMatch(job, c);
      return { ...c, score: matchResult.score };
    });

    const strongMatches = scoredCandidates.filter(c => c.score >= 70).length;
    const goodMatches = scoredCandidates.filter(c => c.score >= 50 && c.score < 70).length;
    const totalCandidates = allCurrentCandidates.length;

    // Show success notification
    setSuccessMessage(
      `Job "${job.title}" added! Found ${strongMatches} strong match${strongMatches !== 1 ? 'es' : ''} (≥70%) and ${goodMatches} good match${goodMatches !== 1 ? 'es' : ''} (50-69%) from ${totalCandidates} candidates.`
    );
    setTimeout(() => setSuccessMessage(null), 8000);

    setIsScoringCandidates(false);

    // Log detailed feedback
    console.log(`✅ Job "${job.title}" added successfully!`);
    console.log(`📊 Analyzed ${totalCandidates} candidates from database:`);
    console.log(`   - ${strongMatches} strong matches (≥70% score)`);
    console.log(`   - ${goodMatches} good matches (50-69% score)`);
    console.log(`   - ${totalCandidates - strongMatches - goodMatches} potential matches (<50% score)`);
  };
  
  const handleUpdateJobStatus = (jobId: string, newStatus: Job['status']) => {
    setJobs(prevJobs => prevJobs.map(job => job.id === jobId ? { ...job, status: newStatus } : job));
    if (newStatus === 'closed') {
        setSelectedJobId(jobId);
        setHireModalOpen(true);
    }
  };
  
  const handleAddCandidates = (newCandidates: UploadedCandidate[]) => {
    const scoredNewCandidates = newCandidates.map(c => ({
      ...c,
      matchScores: jobs.reduce((acc, job) => ({ ...acc, [job.id]: calculateInitialMatch(job, c).score }), {}),
      matchRationales: jobs.reduce((acc, job) => ({ ...acc, [job.id]: calculateInitialMatch(job, c).rationale }), {}),
    }));
    setUploadedCandidates(prev => [...scoredNewCandidates, ...prev]);

    // Calculate match statistics across all jobs for the new candidates
    const candidateCount = newCandidates.length;
    const jobCount = jobs.length;

    if (jobCount > 0 && candidateCount > 0) {
      // Find best matches for each candidate
      const bestMatches = scoredNewCandidates.map(c => {
        const scores = Object.values(c.matchScores || {}) as number[];
        return Math.max(...scores, 0);
      });

      const strongMatchCount = bestMatches.filter(score => score >= 70).length;
      const goodMatchCount = bestMatches.filter(score => score >= 50 && score < 70).length;

      // Show success notification
      const candidatePlural = candidateCount === 1 ? 'candidate' : 'candidates';
      const jobPlural = jobCount === 1 ? 'job' : 'jobs';

      setSuccessMessage(
        `${candidateCount} ${candidatePlural} uploaded and analyzed against ${jobCount} ${jobPlural}! Found ${strongMatchCount} strong match${strongMatchCount !== 1 ? 'es' : ''} (≥70%) and ${goodMatchCount} good match${goodMatchCount !== 1 ? 'es' : ''} (50-69%).`
      );
      setTimeout(() => setSuccessMessage(null), 8000);

      // Log detailed feedback
      console.log(`✅ ${candidateCount} candidate(s) uploaded successfully!`);
      console.log(`📊 Scored against ${jobCount} existing job(s):`);
      console.log(`   - ${strongMatchCount} candidate(s) have strong matches (≥70%)`);
      console.log(`   - ${goodMatchCount} candidate(s) have good matches (50-69%)`);
    }
  };
  
  const handleUpdateCandidate = (candidateId: string, updatedData: Partial<Candidate>) => {
      const updater = (c: Candidate) => c.id === candidateId ? { ...c, ...updatedData } : c;
      setInternalCandidates(prev => prev.map(updater) as InternalCandidate[]);
      setPastCandidates(prev => prev.map(updater) as PastCandidate[]);
      setUploadedCandidates(prev => prev.map(updater) as UploadedCandidate[]);
  };

  const handleFeedback = (candidateId: string, jobId: string, feedback: 'positive' | 'negative') => {
    const updater = (c: Candidate): Candidate => {
        if (c.id === candidateId) {
            const currentFeedback = c.feedback?.[jobId];
            const newFeedbackValue = currentFeedback === feedback ? 'none' : feedback;
            return {
                ...c,
                feedback: {
                    ...(c.feedback || {}),
                    [jobId]: newFeedbackValue,
                }
            };
        }
        return c;
    };
    setInternalCandidates(prev => prev.map(updater) as InternalCandidate[]);
    setPastCandidates(prev => prev.map(updater) as PastCandidate[]);
    setUploadedCandidates(prev => prev.map(updater) as UploadedCandidate[]);
    console.log(`FEEDBACK LOOP (Match Quality): Candidate ${candidateId} for Job ${jobId} rated as ${feedback}. This data would be sent to the backend to retrain models.`);
  };
  
  const handleHireCandidate = (candidateId: string, jobId: string) => {
    handleUpdateCandidate(candidateId, { employmentStatus: 'hired' });
    setHireModalOpen(false);
    console.log(`FEEDBACK LOOP (Outcome Tracking): Candidate ${candidateId} was HIRED for Job ${jobId}. Backend systems would now analyze this candidate's profile against the job to learn what a successful hire looks like for this role/company.`);
  };

  const runFitAnalysis = useCallback(async (candidate: Candidate, job: Job): Promise<FitAnalysis | null> => {
      try {
          const result = await geminiService.analyzeFit(job, candidate);
          const { matchScore, matchRationale } = result;
          handleUpdateCandidate(candidate.id, {
              matchScores: { ...(candidate.matchScores || {}), [job.id]: matchScore },
              matchRationales: { ...(candidate.matchRationales || {}), [job.id]: matchRationale }
          });
          return result;
      } catch (e) {
          setError(e instanceof Error ? e.message : 'An unknown error occurred during fit analysis.');
          return null;
      }
  }, []);
  
  const handleInitiateAnalysis = useCallback(async (type: string, target: Job | Candidate) => {
      if (!selectedJob) return;
      const isJob = 'department' in target;
      const candidate = isJob ? undefined : target as Candidate;

      setAnalysisState({ type, candidate, result: null });
      setAnalysisModalOpen(true);
      setIsLoading(true);
      if(candidate) setLoadingCandidateId(candidate.id);
      setError(null);
      
      try {
          let result: AnalysisResult | null = null;
          switch(type) {
              case 'JOB_SUMMARY': result = await geminiService.analyzeJob(selectedJob); break;
              case 'FIT_ANALYSIS': if (candidate) result = await runFitAnalysis(candidate, selectedJob); break;
              case 'HIDDEN_GEM_ANALYSIS': if (candidate) result = await geminiService.analyzeHiddenGem(selectedJob, candidate); break;
              case 'OUTREACH': if(candidate) result = await geminiService.generateOutreachMessage(selectedJob, candidate); break;
          }
          setAnalysisState(prev => ({ ...prev, result }));
      } catch (e) {
          setError(e instanceof Error ? e.message : 'An unknown error occurred.');
          setAnalysisModalOpen(false);
      } finally {
          setIsLoading(false);
          setLoadingCandidateId(null);
      }
  }, [selectedJob, runFitAnalysis]);

  const handleBatchAnalysis = useCallback(async (candidates: Candidate[]) => {
    if (!selectedJob) return;

    setIsBatchAnalyzing(true);
    setBatchAnalysisProgress({ current: 0, total: candidates.length });
    setError(null);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      setBatchAnalysisProgress({ current: i + 1, total: candidates.length });

      try {
        await runFitAnalysis(candidate, selectedJob);
        successCount++;
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`Failed to analyze candidate ${candidate.name}:`, e);
        failCount++;
      }
    }

    setIsBatchAnalyzing(false);
    setBatchAnalysisProgress({ current: 0, total: 0 });

    // Show completion message
    const message = failCount === 0
      ? `Successfully analyzed ${successCount} top candidates! Check individual profiles for detailed insights.`
      : `Analyzed ${successCount} candidates successfully. ${failCount} analysis failed.`;

    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 8000);

    console.log(`🎯 Batch Analysis Complete: ${successCount} successful, ${failCount} failed`);
  }, [selectedJob, runFitAnalysis]);

  const isPaneLayout = activeView === 'jobs' || activeView === 'candidates';

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 font-sans flex flex-col">
      <Header activeView={activeView} onViewChange={setActiveView} />

       {error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600/90 text-white p-3 rounded-md shadow-lg z-[150] flex items-center max-w-md">
            <AlertTriangle size={20} className="mr-2"/>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-200 hover:text-white"><X size={18}/></button>
        </div>
      )}

      {successMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600/90 text-white p-3 rounded-md shadow-lg z-[150] flex items-center max-w-2xl">
            <CheckCircle size={20} className="mr-2 flex-shrink-0"/>
            <span className="text-sm">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-4 text-green-200 hover:text-white flex-shrink-0"><X size={18}/></button>
        </div>
      )}

      {isScoringCandidates && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-600/90 text-white p-3 rounded-md shadow-lg z-[150] flex items-center">
            <Loader2 size={20} className="mr-2 animate-spin"/>
            <span className="text-sm">Analyzing candidates from database...</span>
        </div>
      )}

      {isBatchAnalyzing && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-purple-600/90 text-white p-4 rounded-md shadow-lg z-[150] flex flex-col min-w-[300px]">
            <div className="flex items-center mb-2">
              <Sparkles size={20} className="mr-2 animate-pulse"/>
              <span className="text-sm font-semibold">AI Deep Analysis in Progress...</span>
            </div>
            <div className="flex items-center">
              <span className="text-xs mr-2">Candidate {batchAnalysisProgress.current} of {batchAnalysisProgress.total}</span>
              <div className="flex-grow bg-purple-800 rounded-full h-2">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(batchAnalysisProgress.current / batchAnalysisProgress.total) * 100}%` }}
                />
              </div>
            </div>
        </div>
      )}

      <main className={`container mx-auto p-4 sm:p-6 lg:p-8 flex-grow ${isPaneLayout ? 'flex flex-col md:flex-row gap-6 h-[calc(100vh-88px)]' : ''}`}>
        {activeView === 'jobs' ? (
          <>
            <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col space-y-4 h-full">
              <div className="bg-slate-800 shadow-xl rounded-xl p-1 flex flex-col h-full">
                <div className="p-4 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-sky-400 mb-3 flex items-center"><Briefcase className="mr-2 h-5 w-5"/>Job Requisitions</h2>
                    <div className="space-y-2">
                      <div className="relative"><input type="text" placeholder="Search jobs..." className="w-full p-2 pl-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /></div>
                      <div className="relative"><label htmlFor="status-filter" className="sr-only">Filter by Status</label><select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Job['status'] | 'all')} className="w-full p-2 pl-3 pr-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none appearance-none capitalize text-sm"><option value="all" className="font-semibold">All Statuses</option><option value="open">Open</option><option value="on hold">On Hold</option><option value="closed">Closed</option></select><ChevronDown className="absolute right-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" /></div>
                    </div>
                  </div>
                <div className="flex-grow overflow-y-auto px-4 pb-2 custom-scrollbar min-h-0">{filteredJobs.length > 0 ? filteredJobs.map(job => (<JobListItem key={job.id} job={job} selected={job.id === selectedJobId} onSelect={() => setSelectedJobId(job.id)} allCandidates={allCandidates} />)) : <p className="text-center text-gray-400 p-4">No jobs found.</p>}</div>
              </div>
            </div>
            <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col space-y-6 h-full">
              {selectedJob ? (<><JobDetails job={selectedJob} onAnalyze={() => handleInitiateAnalysis('JOB_SUMMARY', selectedJob)} isAnalyzing={isLoading && analysisState.type === 'JOB_SUMMARY'} onUpdateStatus={handleUpdateJobStatus} /><div className="flex-grow min-h-0"><CandidatePane job={selectedJob} internalCandidates={internalCandidates} pastCandidates={pastCandidates} uploadedCandidates={uploadedCandidates} onInitiateAnalysis={(type, candidate) => handleInitiateAnalysis(type, candidate)} onFeedback={handleFeedback} onBatchAnalysis={handleBatchAnalysis} isLoading={isLoading} loadingCandidateId={loadingCandidateId} isBatchAnalyzing={isBatchAnalyzing} /></div></>) : (<div className="flex justify-center items-center h-full bg-slate-800 shadow-xl rounded-xl p-6"><p className="text-xl text-gray-400">Select a job to begin.</p></div>)}
            </div>
          </>
        ) : activeView === 'candidates' ? (
          <CandidatesView
            candidates={allCandidates}
            jobs={jobs}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={setSelectedCandidateId}
            onInitiateAnalysis={runFitAnalysis}
            onUpdateCandidate={handleUpdateCandidate}
          />
        ) : (
          <InsightsView insights={departmentInsights} />
        )}
      </main>
      
      {isAddJobModalOpen && <AddJobModal onClose={() => setAddJobModalOpen(false)} onAddJob={handleAddJob} />}
      {isUploadCvModalOpen && <UploadCvModal onClose={() => setUploadCvModalOpen(false)} onAddCandidates={handleAddCandidates} />}
      {isAnalysisModalOpen && selectedJob && (
        <AnalysisModal type={analysisState.type} job={selectedJob} candidate={analysisState.candidate} isLoading={isLoading} analysisResult={analysisState.result} onClose={() => setAnalysisModalOpen(false)} />
      )}
      {isHireModalOpen && selectedJob && (
        <HireCandidateModal
            job={selectedJob}
            candidates={allCandidates}
            onClose={() => setHireModalOpen(false)}
            onHire={handleHireCandidate}
        />
      )}
    </div>
  );
};

export default App;