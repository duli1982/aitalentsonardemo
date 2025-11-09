import React, { useMemo, useState } from 'react';
import type { Candidate, Job, PipelineStage } from '../types';
import { User, Clock, TrendingUp, ArrowRight, Mail, Phone, Calendar, Award, X } from 'lucide-react';

interface PipelineViewProps {
  job: Job | null;
  candidates: Candidate[];
  onUpdateCandidateStage: (candidateId: string, jobId: string, stage: PipelineStage) => void;
  onViewProfile: (candidate: Candidate) => void;
}

const PIPELINE_STAGES: { stage: PipelineStage; label: string; color: string; icon: React.ReactNode }[] = [
  { stage: 'new', label: 'New', color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30', icon: <User className="h-4 w-4 text-blue-400" /> },
  { stage: 'contacted', label: 'Contacted', color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30', icon: <Mail className="h-4 w-4 text-purple-400" /> },
  { stage: 'screening', label: 'Screening', color: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30', icon: <Phone className="h-4 w-4 text-yellow-400" /> },
  { stage: 'interview', label: 'Interview', color: 'from-orange-500/20 to-orange-600/20 border-orange-500/30', icon: <Calendar className="h-4 w-4 text-orange-400" /> },
  { stage: 'offer', label: 'Offer', color: 'from-green-500/20 to-green-600/20 border-green-500/30', icon: <Award className="h-4 w-4 text-green-400" /> },
  { stage: 'hired', label: 'Hired', color: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30', icon: <TrendingUp className="h-4 w-4 text-emerald-400" /> },
  { stage: 'rejected', label: 'Rejected', color: 'from-red-500/20 to-red-600/20 border-red-500/30', icon: <X className="h-4 w-4 text-red-400" /> },
];

const CandidateCard: React.FC<{
  candidate: Candidate;
  jobId: string;
  onViewProfile: () => void;
  onMoveStage: (stage: PipelineStage) => void;
}> = ({ candidate, jobId, onViewProfile, onMoveStage }) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const matchScore = candidate.matchScores?.[jobId] || 0;
  const currentStage = candidate.pipelineStage?.[jobId] || 'new';

  const availableStages = PIPELINE_STAGES.filter(s => s.stage !== currentStage && s.stage !== 'rejected');

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-2 hover:border-sky-500/50 transition-all cursor-pointer group">
      <div onClick={onViewProfile}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h4 className="font-semibold text-sky-300 text-sm group-hover:text-sky-200">{candidate.name}</h4>
            <p className="text-xs text-gray-400 truncate">{candidate.email}</p>
          </div>
          <div className={`text-xs font-bold px-2 py-1 rounded ${
            matchScore >= 70 ? 'bg-green-500/20 text-green-300' :
            matchScore >= 50 ? 'bg-yellow-500/20 text-yellow-300' :
            'bg-gray-500/20 text-gray-300'
          }`}>
            {matchScore}%
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          {candidate.skills.slice(0, 3).map((skill, idx) => (
            <span key={idx} className="text-xs px-2 py-0.5 bg-slate-700 text-sky-300 rounded">
              {skill}
            </span>
          ))}
          {candidate.skills.length > 3 && (
            <span className="text-xs px-2 py-0.5 bg-slate-700 text-gray-400 rounded">
              +{candidate.skills.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMoveMenu(!showMoveMenu);
          }}
          className="w-full text-xs py-1 px-2 bg-slate-700 hover:bg-slate-600 text-sky-300 rounded flex items-center justify-center gap-1 transition-colors"
        >
          <ArrowRight size={12} />
          Move Stage
        </button>

        {showMoveMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMoveMenu(false)}
            />
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-900 border border-sky-500/30 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
              {availableStages.map(({ stage, label, icon }) => (
                <button
                  key={stage}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveStage(stage);
                    setShowMoveMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm text-gray-300 hover:text-sky-300 flex items-center gap-2 transition-colors"
                >
                  {icon}
                  {label}
                </button>
              ))}
              <div className="border-t border-slate-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveStage('rejected');
                  setShowMoveMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sm text-red-400 hover:text-red-300 flex items-center gap-2 transition-colors"
              >
                <X size={14} />
                Reject
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const PipelineColumn: React.FC<{
  stage: PipelineStage;
  label: string;
  color: string;
  icon: React.ReactNode;
  candidates: Candidate[];
  jobId: string;
  onViewProfile: (candidate: Candidate) => void;
  onMoveCandidate: (candidateId: string, stage: PipelineStage) => void;
}> = ({ stage, label, color, icon, candidates, jobId, onViewProfile, onMoveCandidate }) => {
  const totalMatchScore = candidates.reduce((sum, c) => sum + (c.matchScores?.[jobId] || 0), 0);
  const avgScore = candidates.length > 0 ? Math.round(totalMatchScore / candidates.length) : 0;

  return (
    <div className="flex flex-col h-full min-w-[280px]">
      <div className={`bg-gradient-to-br ${color} border rounded-lg p-3 mb-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sky-300">{label}</h3>
        </div>
        <div className="flex items-center gap-3">
          {candidates.length > 0 && (
            <span className="text-xs text-gray-400">
              Avg: {avgScore}%
            </span>
          )}
          <span className="bg-slate-800 text-sky-300 px-2 py-1 rounded text-sm font-semibold">
            {candidates.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0 custom-scrollbar pr-1">
        {candidates.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8">
            No candidates
          </div>
        ) : (
          candidates.map(candidate => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              jobId={jobId}
              onViewProfile={() => onViewProfile(candidate)}
              onMoveStage={(stage) => onMoveCandidate(candidate.id, stage)}
            />
          ))
        )}
      </div>
    </div>
  );
};

const PipelineView: React.FC<PipelineViewProps> = ({ job, candidates, onUpdateCandidateStage, onViewProfile }) => {
  const candidatesByStage = useMemo(() => {
    if (!job) return {};

    const stages: { [key in PipelineStage]?: Candidate[] } = {};

    PIPELINE_STAGES.forEach(({ stage }) => {
      stages[stage] = candidates
        .filter(c => {
          const candidateStage = c.pipelineStage?.[job.id] || 'new';
          return candidateStage === stage;
        })
        .sort((a, b) => (b.matchScores?.[job.id] || 0) - (a.matchScores?.[job.id] || 0));
    });

    return stages;
  }, [job, candidates]);

  const pipelineStats = useMemo(() => {
    if (!job) return null;

    const total = candidates.length;
    const contacted = candidates.filter(c => {
      const stage = c.pipelineStage?.[job.id];
      return stage && stage !== 'new';
    }).length;
    const hired = (candidatesByStage['hired'] || []).length;
    const conversionRate = contacted > 0 ? Math.round((hired / contacted) * 100) : 0;

    return { total, contacted, hired, conversionRate };
  }, [job, candidates, candidatesByStage]);

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-800 shadow-xl rounded-xl p-8">
        <div className="text-center">
          <TrendingUp className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400">Select a job to view pipeline</h3>
          <p className="text-sm text-gray-500 mt-2">Choose a job requisition to track candidates through the hiring process</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Pipeline Header with Stats */}
      <div className="bg-slate-800 shadow-xl rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-bold text-sky-400">{job.title}</h2>
            <p className="text-sm text-gray-400">{job.department} • {job.location}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
            job.status === 'open' ? 'bg-green-500/20 text-green-300' :
            job.status === 'on hold' ? 'bg-amber-500/20 text-amber-300' :
            'bg-red-500/20 text-red-300'
          }`}>
            {job.status}
          </div>
        </div>

        {pipelineStats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Total Candidates</div>
              <div className="text-2xl font-bold text-sky-300">{pipelineStats.total}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">In Process</div>
              <div className="text-2xl font-bold text-purple-300">{pipelineStats.contacted}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Hired</div>
              <div className="text-2xl font-bold text-green-300">{pipelineStats.hired}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Conversion Rate</div>
              <div className="text-2xl font-bold text-emerald-300">{pipelineStats.conversionRate}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 bg-slate-800 shadow-xl rounded-xl p-4 overflow-hidden">
        <div className="flex gap-4 h-full overflow-x-auto pb-2">
          {PIPELINE_STAGES.map(({ stage, label, color, icon }) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              label={label}
              color={color}
              icon={icon}
              candidates={candidatesByStage[stage] || []}
              jobId={job.id}
              onViewProfile={onViewProfile}
              onMoveCandidate={(candidateId, newStage) => onUpdateCandidateStage(candidateId, job.id, newStage)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PipelineView;
