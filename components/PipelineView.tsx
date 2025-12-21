import React, { useMemo } from 'react';
import type { Job, Candidate, PipelineStage } from '../types';
import { useData } from '../contexts/DataContext';
import { Search, User, Users, CheckCircle, XCircle, MessageSquare, Calendar, Briefcase, ChevronRight } from 'lucide-react';

interface PipelineViewProps {
  job: Job | undefined;
  onUpdateCandidateStage: (candidateId: string, jobId: string, newStage: PipelineStage) => void;
  onOpenCandidateJobDrawer: (candidate: Candidate, job: Job) => void;
}

const STAGES: { id: PipelineStage; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'sourced', label: 'Sourced', icon: <Search className="w-4 h-4" />, color: 'bg-indigo-500' },
  { id: 'new', label: 'New', icon: <User className="w-4 h-4" />, color: 'bg-slate-500' },
  { id: 'long_list', label: 'Long List', icon: <Users className="w-4 h-4" />, color: 'bg-cyan-500' },
  { id: 'screening', label: 'Screening', icon: <Briefcase className="w-4 h-4" />, color: 'bg-purple-500' },
  { id: 'scheduling', label: 'Interview Scheduling', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-blue-500' },
  { id: 'interview', label: 'Interview', icon: <Calendar className="w-4 h-4" />, color: 'bg-amber-500' },
  { id: 'offer', label: 'Offer', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-500' },
  { id: 'hired', label: 'Hired', icon: <User className="w-4 h-4" />, color: 'bg-emerald-600' },
  { id: 'rejected', label: 'Rejected', icon: <XCircle className="w-4 h-4" />, color: 'bg-red-500' },
];

const normalizeStage = (raw: unknown): PipelineStage => {
  const value = String(raw || '').toLowerCase();
  // Back-compat with older pipeline stage names
  if (value === 'sourcing' || value === 'contacted') return 'new';
  if (value === 'sourced' || value === 'new' || value === 'long_list' || value === 'screening' || value === 'scheduling' || value === 'interview' || value === 'offer' || value === 'hired' || value === 'rejected') {
    return value as PipelineStage;
  }
  return 'new';
};

const PipelineColumn: React.FC<{
  stage: typeof STAGES[0];
  candidates: Candidate[];
  jobId: string;
  onUpdateStage: (candidateId: string, newStage: PipelineStage) => void;
  onView: (candidate: Candidate) => void;
}> = ({ stage, candidates, jobId, onUpdateStage, onView }) => {

  const handleDragStart = (e: React.DragEvent, candidateId: string) => {
    e.dataTransfer.setData('candidateId', candidateId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData('candidateId');
    if (candidateId) {
      onUpdateStage(candidateId, stage.id);
    }
  };

  return (
    <div
      className="flex-shrink-0 w-72 bg-slate-800/50 rounded-xl flex flex-col h-full border border-slate-700/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className={`p-3 rounded-t-xl border-b border-slate-700 flex justify-between items-center ${stage.color} bg-opacity-10`}>
        <div className="flex items-center gap-2 font-semibold text-gray-200">
          <span className={`p-1.5 rounded-md ${stage.color} text-white`}>
            {stage.icon}
          </span>
          {stage.label}
        </div>
        <span className="bg-slate-700 text-gray-300 text-xs px-2 py-1 rounded-full font-medium">
          {candidates.length}
        </span>
      </div>

      <div className="flex-grow overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-slate-500 text-xs border border-dashed border-slate-700 rounded-lg">
            <span>Drop candidates here</span>
          </div>
        ) : (
          candidates.map(candidate => (
            <div
              key={candidate.id}
              draggable
              onDragStart={(e) => handleDragStart(e, candidate.id)}
              className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm hover:shadow-md hover:border-sky-500/50 transition-all cursor-move group"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-sky-400 truncate pr-2">{candidate.name}</h4>
                {candidate.matchScores?.[jobId] && (
                  <span className={`text-xs font-bold ${candidate.matchScores[jobId] >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {candidate.matchScores[jobId]}%
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {candidate.skills.slice(0, 2).map(skill => (
                  <span key={skill} className="text-[10px] bg-slate-700 text-gray-400 px-1.5 py-0.5 rounded">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex justify-end items-center mt-2 pt-2 border-t border-slate-700/50">
                <button
                  onClick={() => onView(candidate)}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center"
                >
                  View <ChevronRight className="w-3 h-3 ml-0.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const PipelineView: React.FC<PipelineViewProps> = ({ job, onUpdateCandidateStage, onOpenCandidateJobDrawer }) => {
  const { internalCandidates, pastCandidates, uploadedCandidates } = useData();

  const allCandidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);

  // Group candidates by stage for the selected job (must be before any conditional returns for hooks rules)
  const candidatesByStage = useMemo(() => {
    if (!job) {
      return {
        sourced: [], new: [], long_list: [], screening: [], scheduling: [], interview: [], offer: [], hired: [], rejected: []
      } as Record<PipelineStage, Candidate[]>;
    }

    const grouped: Record<PipelineStage, Candidate[]> = {
      sourced: [], new: [], long_list: [], screening: [], scheduling: [], interview: [], offer: [], hired: [], rejected: []
    };

    allCandidates.forEach(candidate => {
      // Check if candidate has a stage for this job
      const stage = normalizeStage(candidate.pipelineStage?.[job.id] || candidate.stage || 'new');

      // Only include if they have a match score (meaning they are relevant to this job)
      if (candidate.matchScores?.[job.id]) {
        grouped[stage].push(candidate);
      }
    });

    return grouped;
  }, [allCandidates, job]);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-slate-800 rounded-xl border border-slate-700">
        <Briefcase className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg">Select a job to view the candidate pipeline</p>
      </div>
    );
  }

  const totalCandidates = Object.values(candidatesByStage).reduce((sum: number, arr: Candidate[]) => sum + arr.length, 0);
  const activeStages = Object.values(candidatesByStage).filter((arr: Candidate[]) => arr.length > 0).length;

  return (
    <div className="h-full flex flex-col bg-slate-900/50 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-sky-400" />
            {job.title} Pipeline
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            <span className="font-medium text-white">{totalCandidates}</span> candidates across <span className="font-medium text-white">{activeStages}</span> stages
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>&gt;=70%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span>&lt;70%</span>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-x-auto overflow-y-hidden p-4">
        <div className="flex h-full gap-4 min-w-max">
          {STAGES.map(stage => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              candidates={candidatesByStage[stage.id]}
              jobId={job.id}
              onUpdateStage={(candidateId, newStage) => onUpdateCandidateStage(candidateId, job.id, newStage)}
              onView={(candidate) => onOpenCandidateJobDrawer(candidate, job)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PipelineView;
