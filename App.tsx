import React, { useState, useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Job, DepartmentInsight, Candidate, PipelineStage } from './types';
import AddJobModal from './components/modals/AddJobModal';
import UploadCvModal from './components/modals/UploadCvModal';
import AnalysisModal from './components/modals/AnalysisModal';
import HireCandidateModal from './components/modals/HireCandidateModal';
import CandidateProfileModal from './components/modals/CandidateProfileModal';
import CandidateJobDrawer from './components/modals/CandidateJobDrawer';
import InterviewGuideModal from './components/modals/InterviewGuideModal';
import SmartSearchModal from './components/modals/SmartSearchModal';
import RAGQueryModal from './components/modals/RAGQueryModal';
import ConfirmModal from './components/modals/ConfirmModal';
import RoleContextPackModal from './components/modals/RoleContextPackModal';
import { useAnalysis } from './hooks/useAnalysis';
import { DataProvider, useData } from './contexts/DataContext';
import { useToast } from './contexts/ToastContext';
import { useCandidateOperations } from './hooks/useCandidateOperations';
import { useJobOperations } from './hooks/useJobOperations';
import { Loader2, Sparkles } from 'lucide-react';
import { eventBus, EVENTS } from './utils/EventBus';

// Layouts & Pages
import MainLayout from './layouts/MainLayout';
import JobsPage from './pages/JobsPage';
import PipelinePage from './pages/PipelinePage';
import CandidatesPage from './pages/CandidatesPage';
import InsightsPage from './pages/InsightsPage';
import HealthPage from './pages/HealthPage';
import OrgTwinPage from './pages/OrgTwinPage';
import ForecastPage from './pages/ForecastPage';
import AgentPlaygroundPage from './pages/AgentPlaygroundPage';
import AutonomousAgentsPage from './pages/AutonomousAgentsPage';
import AgentInboxPage from './pages/AgentInboxPage';
import MobilityPage from './pages/MobilityPage';
import GovernancePage from './pages/GovernancePage';
import WarRoomPage from './pages/WarRoomPage';
import IngestPage from './pages/IngestPage';
import AutonomousAgentsBootstrap from './components/AutonomousAgentsBootstrap';

type PulseNavigatePayload = {
  to?: string;
  candidateId?: string;
  jobId?: string;
};

const PulseNavigationHandler: React.FC<{
  jobs: Job[];
  allCandidates: Candidate[];
  setSelectedJobId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedCandidateId: React.Dispatch<React.SetStateAction<string | null>>;
  openCandidateJobDrawer: (candidate: Candidate, job: Job) => void;
}> = ({ jobs, allCandidates, setSelectedJobId, setSelectedCandidateId, openCandidateJobDrawer }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const sub = eventBus.on<any>(EVENTS.PULSE_NAVIGATE, (data: PulseNavigatePayload) => {
      const target = String(data?.to || '').toLowerCase();
      const candidateId = data?.candidateId ? String(data.candidateId) : null;
      const jobId = data?.jobId ? String(data.jobId) : null;

      if (jobId) setSelectedJobId(jobId);
      if (candidateId) setSelectedCandidateId(candidateId);

      if (target === 'pipeline') {
        navigate('/pipeline');
        return;
      }

      if (target === 'agent-inbox') {
        navigate('/agent-inbox');
        return;
      }

      // Default: candidates page.
      navigate('/candidates');

      // If we have both job + candidate, open the job drawer after state updates.
      if (candidateId && jobId) {
        const candidate = allCandidates.find((c) => String(c.id) === candidateId);
        const job = jobs.find((j) => String(j.id) === jobId);
        if (candidate && job) {
          setTimeout(() => openCandidateJobDrawer(candidate, job), 0);
        }
      }
    });

    return () => sub.unsubscribe();
  }, [navigate, allCandidates, jobs, setSelectedJobId, setSelectedCandidateId, openCandidateJobDrawer]);

  return null;
};

// Logic helpers (kept for now, or could be moved to utils)
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

const AppContent = () => {
  const { showToast } = useToast();
  const {
    jobs, setJobs,
    internalCandidates, setInternalCandidates,
    pastCandidates, setPastCandidates,
    uploadedCandidates, setUploadedCandidates,
    selectedJobId, setSelectedJobId,
    isInitialized,
  } = useData();

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Job['status'] | 'all'>('all');

  // Modals state
  const [isAddJobModalOpen, setAddJobModalOpen] = useState(false);
  const [isUploadCvModalOpen, setUploadCvModalOpen] = useState(false);
  const [isSmartSearchModalOpen, setSmartSearchModalOpen] = useState(false);
  const [isRAGModalOpen, setRAGModalOpen] = useState(false);
  const [isHireModalOpen, setHireModalOpen] = useState(false);
  const [isCandidateProfileModalOpen, setCandidateProfileModalOpen] = useState(false);
  const [selectedProfileCandidate, setSelectedProfileCandidate] = useState<Candidate | null>(null);
  const [isCandidateJobDrawerOpen, setCandidateJobDrawerOpen] = useState(false);
  const [candidateJobDrawerCandidate, setCandidateJobDrawerCandidate] = useState<Candidate | null>(null);
  const [candidateJobDrawerJob, setCandidateJobDrawerJob] = useState<Job | null>(null);
  const [intakePromptOpen, setIntakePromptOpen] = useState(false);
  const [intakeJob, setIntakeJob] = useState<Job | null>(null);
  const [roleContextPackOpen, setRoleContextPackOpen] = useState(false);

  const allCandidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const selectedJob = useMemo(() => jobs.find(job => job.id === selectedJobId), [jobs, selectedJobId]);

  const openCandidateJobDrawer = (candidate: Candidate, job: Job) => {
    setCandidateJobDrawerCandidate(candidate);
    setCandidateJobDrawerJob(job);
    setCandidateJobDrawerOpen(true);
  };

  // Use Custom Hooks
  const {
    handleUpdateCandidate,
    handleUpdateCandidateStage,
    handleAddCandidateToPipeline,
    handleFeedback,
    handleHireCandidate: handleHireCandidateLogic,
    handleAddCandidates: handleAddCandidatesLogic
  } = useCandidateOperations({
    jobs,
    internalCandidates, setInternalCandidates,
    pastCandidates, setPastCandidates,
    uploadedCandidates, setUploadedCandidates,
    calculateInitialMatch,
    setJobs,
    showToast
  });

  const { handleAddJob: handleAddJobLogic, handleUpdateJobStatus } = useJobOperations({
    jobs, setJobs,
    allCandidates, setInternalCandidates, setPastCandidates, setUploadedCandidates,
    calculateInitialMatch, setSelectedJobId, showToast
  });

  // Analysis Hook
  const {
    isLoading,
    loadingCandidateId,
    error, setError,
    isBatchAnalyzing,
    batchAnalysisProgress,
    analysisState,
    isAnalysisModalOpen, setAnalysisModalOpen,
    runFitAnalysis,
    handleInitiateAnalysis,
    handleBatchAnalysis
  } = useAnalysis({ selectedJob, onUpdateCandidate: handleUpdateCandidate, onUpdateCandidateStage: handleUpdateCandidateStage });

  // Wrappers for logic hooks to handle "Auto Analyze" callbacks which depend on `handleBatchAnalysis`
  const handleAddJob = (job: Job) => {
    handleAddJobLogic(job, handleBatchAnalysis);
    // Optional: prompt for intake (no gating).
    setIntakeJob(job);
    setIntakePromptOpen(true);
  };
  const handleAddCandidates = (candidates: any[]) => handleAddCandidatesLogic(candidates, selectedJobId || undefined, handleBatchAnalysis);

  const handleHireCandidate = (candidateId: string, jobId: string) => {
    handleHireCandidateLogic(candidateId, jobId);
    setHireModalOpen(false);
  };

  // View Helpers
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

  // Allow background agents to advance candidates through the pipeline.
  useEffect(() => {
    const subscription = eventBus.on<any>(EVENTS.CANDIDATE_STAGED, (data) => {
      const candidateId = String(data?.candidateId || '');
      const jobId = String(data?.jobId || '');
      const requestedStage = String(data?.stage || '').toLowerCase() as PipelineStage;

      if (!candidateId || !jobId || !requestedStage) return;

      const candidate = allCandidates.find((c) => c.id === candidateId);
      const providedCandidate = data?.candidate as Candidate | undefined;

      // If the agent provides a candidate payload, we can stage even if not yet in local state.
      if (!candidate && providedCandidate) {
        handleAddCandidateToPipeline(providedCandidate, jobId, requestedStage);
        return;
      }

      if (!candidate) return;
      const rawCurrent = (candidate as any)?.pipelineStage?.[jobId] ?? (candidate as any)?.stage;
      const current = String(rawCurrent || '').toLowerCase();

      // Back-compat: old stages map to `new`
      const normalizedCurrent =
        current === 'sourcing' || current === 'contacted' || !current ? 'new' : (current as PipelineStage);

      const stageOrder: PipelineStage[] = [
        'sourced',
        'new',
        'long_list',
        'screening',
        'scheduling',
        'interview',
        'offer',
        'hired',
        'rejected'
      ];

      const currentIndex = stageOrder.indexOf(normalizedCurrent);
      const nextIndex = stageOrder.indexOf(requestedStage);

      // Prevent agents from moving candidates backwards in the funnel.
      if (currentIndex !== -1 && nextIndex !== -1 && nextIndex < currentIndex) return;

      handleUpdateCandidateStage(candidateId, jobId, requestedStage);
    });

    return () => subscription.unsubscribe();
  }, [allCandidates, handleAddCandidateToPipeline, handleUpdateCandidateStage]);

  // Allow background agents to update candidate fields (e.g., AI scores / notes) without direct UI interaction.
  useEffect(() => {
    const subscription = eventBus.on<any>(EVENTS.CANDIDATE_UPDATED, (data) => {
      const candidateId = String(data?.candidateId || '');
      const updates = (data?.updates || data?.candidate || {}) as Partial<Candidate>;
      if (!candidateId || !updates) return;

      const candidate = allCandidates.find((c) => c.id === candidateId);
      if (!candidate) return;

      const merged: Partial<Candidate> = { ...updates };

      if (Array.isArray((updates as any).skills)) {
        const base = Array.isArray(candidate.skills) ? candidate.skills : [];
        const next = [...base];
        const seen = new Set(base.map((s) => String(s).toLowerCase()));
        (updates as any).skills.forEach((s: any) => {
          const key = String(s).toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          next.push(String(s));
        });
        merged.skills = next;
      }

      if ((updates as any).passport) {
        const patch = (updates as any).passport;
        const existing = (candidate as any).passport ?? { verifiedSkills: [], badges: [] };
        const existingSkills = Array.isArray(existing.verifiedSkills) ? existing.verifiedSkills : [];
        const deltaSkills = Array.isArray(patch.verifiedSkills) ? patch.verifiedSkills : [];

        const byName = new Map<string, any>();
        existingSkills.forEach((s: any) => {
          const key = String(s?.skillName || '').toLowerCase();
          if (!key) return;
          byName.set(key, s);
        });

        deltaSkills.forEach((s: any) => {
          const key = String(s?.skillName || '').toLowerCase();
          if (!key) return;
          const prev = byName.get(key);
          const prevLevel = Number(prev?.proficiencyLevel ?? 0);
          const nextLevel = Number(s?.proficiencyLevel ?? 0);
          if (!prev || nextLevel >= prevLevel) byName.set(key, s);
        });

        const nextBadges = Array.from(new Set([...(existing.badges ?? []), ...(patch.badges ?? [])]));

        merged.passport = {
          verifiedSkills: Array.from(byName.values()),
          badges: nextBadges
        } as any;
      }

      if ((updates as any).matchScores) {
        merged.matchScores = { ...(candidate.matchScores || {}), ...(updates as any).matchScores };
      }

      if ((updates as any).matchRationales) {
        merged.matchRationales = { ...((candidate as any).matchRationales || {}), ...(updates as any).matchRationales };
      }

      handleUpdateCandidate(candidateId, merged);
    });

    return () => subscription.unsubscribe();
  }, [allCandidates, handleUpdateCandidate]);

  // Auto-select first job
  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) setSelectedJobId(jobs[0].id);
  }, [jobs, selectedJobId, setSelectedJobId]);

  return (
    <BrowserRouter>
      <AutonomousAgentsBootstrap isInitialized={isInitialized} jobs={jobs} allCandidates={allCandidates} />
      <PulseNavigationHandler
        jobs={jobs}
        allCandidates={allCandidates}
        setSelectedJobId={setSelectedJobId}
        setSelectedCandidateId={setSelectedCandidateId}
        openCandidateJobDrawer={openCandidateJobDrawer}
      />
      <Routes>
        <Route
          path="/"
          element={
            <MainLayout
              error={error}
              setError={setError}
              onOpenSmartSearch={() => setSmartSearchModalOpen(true)}
              onOpenRAG={() => setRAGModalOpen(true)}
              onOpenUploadCv={() => setUploadCvModalOpen(true)}
            />
          }
        >
          <Route index element={
            <JobsPage
              jobs={jobs}
              selectedJobId={selectedJobId}
              setSelectedJobId={setSelectedJobId}
              filteredJobs={filteredJobs}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              setAddJobModalOpen={setAddJobModalOpen}
              handleInitiateAnalysis={handleInitiateAnalysis}
              handleUpdateJobStatus={handleUpdateJobStatus}
              handleFeedback={handleFeedback}
              handleBatchAnalysis={handleBatchAnalysis}
              handleViewProfile={(c) => { setSelectedProfileCandidate(c); setCandidateProfileModalOpen(true); }}
              handleOpenCandidateJobDrawer={(candidate, job) => openCandidateJobDrawer(candidate, job)}
              handleAddCandidateToPipeline={handleAddCandidateToPipeline}
              isLoading={isLoading}
              loadingCandidateId={loadingCandidateId}
              isBatchAnalyzing={isBatchAnalyzing}
              analysisState={analysisState}
              selectedJob={selectedJob}
            />
          } />
          <Route path="pipeline" element={
            <PipelinePage
              jobs={jobs}
              selectedJobId={selectedJobId}
              setSelectedJobId={setSelectedJobId}
              filteredJobs={filteredJobs}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              setAddJobModalOpen={setAddJobModalOpen}
              handleUpdateCandidateStage={handleUpdateCandidateStage}
              onOpenCandidateJobDrawer={(candidate, job) => openCandidateJobDrawer(candidate, job)}
            />
          } />
	          <Route path="candidates" element={
	            <CandidatesPage
	              selectedCandidateId={selectedCandidateId}
	              setSelectedCandidateId={setSelectedCandidateId}
	              runFitAnalysis={runFitAnalysis}
	              handleUpdateCandidate={handleUpdateCandidate}
	              handleAddCandidateToPipeline={handleAddCandidateToPipeline}
	              handleUpdateCandidateStage={handleUpdateCandidateStage}
	            />
	          } />
          <Route path="insights" element={<InsightsPage departmentInsights={departmentInsights} />} />
          <Route path="org-twin" element={<OrgTwinPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="agents" element={<AgentPlaygroundPage />} />
          <Route path="autonomous-agents" element={<AutonomousAgentsPage />} />
          <Route path="agent-inbox" element={<AgentInboxPage />} />
          <Route path="mobility" element={<MobilityPage />} />
          <Route path="governance" element={<GovernancePage />} />
          <Route path="war-room" element={<WarRoomPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="ingest" element={<IngestPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {/* Global Modals */}
      {isAddJobModalOpen && <AddJobModal onClose={() => setAddJobModalOpen(false)} onAddJob={handleAddJob} />}
      <ConfirmModal
        isOpen={intakePromptOpen}
        title="Add Role Context Pack?"
        message={
          <div className="space-y-2">
            <div className="text-slate-200">
              Intake is optional, but it improves evidence, truth-check questions, and confidence for this job.
            </div>
            <div className="text-xs text-slate-400">You can skip now and add/edit it later from Job Details.</div>
          </div>
        }
        confirmLabel="Add intake now"
        cancelLabel="Not now"
        onConfirm={() => {
          setIntakePromptOpen(false);
          setRoleContextPackOpen(true);
        }}
        onCancel={() => {
          setIntakePromptOpen(false);
        }}
      />
      <RoleContextPackModal
        isOpen={roleContextPackOpen}
        job={intakeJob}
        onClose={() => {
          setRoleContextPackOpen(false);
          setIntakeJob(null);
        }}
      />
      {isUploadCvModalOpen && <UploadCvModal onClose={() => setUploadCvModalOpen(false)} onUpload={handleAddCandidates} />}
      {isSmartSearchModalOpen && (
        <SmartSearchModal
          isOpen={isSmartSearchModalOpen}
          onClose={() => setSmartSearchModalOpen(false)}
          onSelectCandidate={(result) => {
            showToast(`Selected: ${result.name} (${Math.round(result.similarity * 100)}% match)`, 'success');
            setSmartSearchModalOpen(false);
            // You can add logic here to add the candidate to a job if needed
          }}
        />
      )}
      {isRAGModalOpen && (
        <RAGQueryModal
          isOpen={isRAGModalOpen}
          onClose={() => setRAGModalOpen(false)}
        />
      )}
      {isAnalysisModalOpen && selectedJob && (
        analysisState.type === 'INTERVIEW_GUIDE' ? (
          <InterviewGuideModal
            isOpen={isAnalysisModalOpen}
            onClose={() => setAnalysisModalOpen(false)}
            guide={analysisState.result as any}
            isLoading={isLoading}
          />
        ) : (
          <AnalysisModal
            type={analysisState.type}
            job={selectedJob}
            candidate={analysisState.candidate}
            isLoading={isLoading}
            analysisResult={analysisState.result}
            onClose={() => setAnalysisModalOpen(false)}
            onInitiateAnalysis={handleInitiateAnalysis}
          />
        )
      )}
      {isHireModalOpen && selectedJob && (
        <HireCandidateModal
          isOpen={isHireModalOpen}
          onClose={() => setHireModalOpen(false)}
          job={selectedJob}
          candidates={allCandidates}
          onHire={handleHireCandidate}
        />
      )}
      {isCandidateProfileModalOpen && selectedProfileCandidate && (
        <CandidateProfileModal
          isOpen={isCandidateProfileModalOpen}
          onClose={() => { setCandidateProfileModalOpen(false); setSelectedProfileCandidate(null); }}
          candidate={selectedProfileCandidate}
          jobs={jobs}
          jobContext={selectedJob}
          onInitiateAnalysis={handleInitiateAnalysis}
          onUpdateCandidate={handleUpdateCandidate}
        />
      )}
      {isCandidateJobDrawerOpen && candidateJobDrawerCandidate && candidateJobDrawerJob && (
        <CandidateJobDrawer
          isOpen={isCandidateJobDrawerOpen}
          candidate={candidateJobDrawerCandidate}
          job={candidateJobDrawerJob}
          onClose={() => {
            setCandidateJobDrawerOpen(false);
            setCandidateJobDrawerCandidate(null);
            setCandidateJobDrawerJob(null);
          }}
          onAddToPipeline={handleAddCandidateToPipeline}
          onUpdateCandidateStage={handleUpdateCandidateStage}
          onOpenCandidateProfile={(c) => {
            setSelectedProfileCandidate(c);
            setCandidateProfileModalOpen(true);
          }}
        />
      )}

      {/* Global Overlays */}
      {isBatchAnalyzing && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-purple-600/90 text-white p-4 rounded-md shadow-lg z-[150] flex flex-col min-w-[300px]">
          <div className="flex items-center mb-2">
            <Sparkles size={20} className="mr-2 animate-pulse" />
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
    </BrowserRouter>
  );
};

const App = () => (
  <DataProvider>
    <AppContent />
  </DataProvider>
);

export default App;
