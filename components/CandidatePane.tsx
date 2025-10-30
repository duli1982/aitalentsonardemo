import React, { useState, useMemo } from 'react';
import type { Candidate, Job } from '../types';
import { Users, UserCheck, UploadCloud, Loader2, Diamond, TrendingUp, MessageSquare, Briefcase, ThumbsUp, ThumbsDown, Sparkles, Zap, Trophy } from 'lucide-react';

interface CandidatePaneProps {
  job: Job | null;
  internalCandidates: Candidate[];
  pastCandidates: Candidate[];
  uploadedCandidates: Candidate[];
  onInitiateAnalysis: (type: string, candidate: Candidate) => void;
  onFeedback: (candidateId: string, jobId: string, feedback: 'positive' | 'negative') => void;
  onBatchAnalysis?: (candidates: Candidate[]) => void;
  isLoading: boolean;
  loadingCandidateId: string | null;
  isBatchAnalyzing?: boolean;
}

const TabButton: React.FC<{ icon: React.ReactNode; label: string; count: number; isActive: boolean; onClick: () => void; }> = ({ icon, label, count, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center py-3 px-4 sm:px-6 text-sm font-medium transition-colors duration-150 border-b-2
      ${isActive ? 'border-sky-500 text-sky-400' : 'border-transparent text-gray-400 hover:text-sky-300'}`}
  >
    {icon}
    {label} <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-sky-500 text-slate-900' : 'bg-slate-600 text-gray-300'}`}>{count}</span>
  </button>
);

const CandidateCard: React.FC<{ candidate: Candidate; job: Job; onInitiateAnalysis: (type: string, candidate: Candidate) => void; onFeedback: (candidateId: string, jobId: string, feedback: 'positive' | 'negative') => void; isLoading: boolean; loadingCandidateId: string | null; }> = ({ candidate, job, onInitiateAnalysis, onFeedback, isLoading, loadingCandidateId }) => {
    const isCurrentCardLoading = isLoading && loadingCandidateId === candidate.id;
    const matchScore = candidate.matchScores?.[job.id];
    const matchRationale = candidate.matchRationales?.[job.id];
    const feedback = candidate.feedback?.[job.id] ?? 'none';

    return (
        <div className="bg-slate-800 shadow-lg rounded-xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-sky-500/20 hover:ring-1 hover:ring-slate-700">
            <div>
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-lg font-semibold text-sky-400">{candidate.name}</h3>
                        {candidate.type === 'internal' && <p className="text-xs text-gray-400">{candidate.currentRole}</p>}
                        {candidate.type === 'past' && <p className="text-xs text-gray-400">Applied for: {candidate.previousRoleAppliedFor}</p>}
                        {candidate.type === 'uploaded' && <p className="text-xs text-gray-400">Uploaded from: {candidate.fileName}</p>}
                    </div>
                     <div className="flex items-center space-x-1">
                        <button onClick={() => onFeedback(candidate.id, job.id, 'positive')} className={`p-1.5 rounded-full transition-colors ${feedback === 'positive' ? 'bg-green-500/30 text-green-300' : 'text-gray-400 hover:text-green-400 hover:bg-slate-700'}`} aria-label="Good match"><ThumbsUp size={16} /></button>
                        <button onClick={() => onFeedback(candidate.id, job.id, 'negative')} className={`p-1.5 rounded-full transition-colors ${feedback === 'negative' ? 'bg-red-500/30 text-red-300' : 'text-gray-400 hover:text-red-400 hover:bg-slate-700'}`} aria-label="Bad match"><ThumbsDown size={16} /></button>
                    </div>
                </div>
                 <div className="mb-3">
                    <span className="text-sm font-medium text-sky-300/80 mr-2">Match Score: </span>
                    <span className={`font-bold text-xl ${matchScore && matchScore > 75 ? 'text-green-400' : matchScore && matchScore > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {typeof matchScore === 'number' ? `${matchScore}%` : 'N/A'}
                    </span>
                </div>
                 {candidate.isHiddenGem && (
                    <span className="mb-2 inline-flex items-center bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded-full">
                        <Diamond className="h-3 w-3 mr-1 text-amber-400" /> Hidden Gem
                    </span>
                )}
                <p className="text-xs text-gray-400 italic mb-3 h-8 overflow-hidden text-ellipsis" title={matchRationale}>{matchRationale || 'Run AI Fit Analysis for details.'}</p>

                <h5 className="text-xs font-semibold text-sky-400/90 mb-2">Key Skills:</h5>
                <div className="flex flex-wrap gap-1.5 mb-3 min-h-[40px]">
                    {candidate.skills.slice(0, 4).map(skill => (
                    <span key={skill} className="bg-slate-700 text-gray-300 text-xs px-2 py-1 rounded-md">{skill}</span>
                    ))}
                    {candidate.skills.length > 4 && <span className="text-gray-400 text-xs px-2 py-1 rounded-md bg-slate-700">+{candidate.skills.length - 4} more</span>}
                </div>
            </div>
            <div className="mt-auto space-y-2">
                <button
                    onClick={() => onInitiateAnalysis('FIT_ANALYSIS', candidate)}
                    disabled={isCurrentCardLoading}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCurrentCardLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                    Detailed AI Fit Analysis
                </button>
                <button
                    onClick={() => onInitiateAnalysis('OUTREACH', candidate)}
                    disabled={isCurrentCardLoading}
                    className="w-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition-all text-sm disabled:opacity-50"
                >
                    <MessageSquare className="h-4 w-4 mr-2" /> Generate AI Outreach
                </button>
            </div>
        </div>
    );
};


const CandidatePane: React.FC<CandidatePaneProps> = ({ job, internalCandidates, pastCandidates, uploadedCandidates, onInitiateAnalysis, onFeedback, onBatchAnalysis, isLoading, loadingCandidateId, isBatchAnalyzing }) => {
  const [activeTab, setActiveTab] = useState('best');

  const allSortedCandidates = useMemo(() => {
    if (!job) return [];
    const allCandidates = [...internalCandidates, ...pastCandidates, ...uploadedCandidates];
    return allCandidates.sort((a, b) => (b.matchScores?.[job.id] || 0) - (a.matchScores?.[job.id] || 0));
  }, [job, internalCandidates, pastCandidates, uploadedCandidates]);

  const sortedCandidates = useMemo(() => {
    if (!job) return [];
    if (activeTab === 'best') {
      // Show top 15 best matches across all candidate pools
      return allSortedCandidates.slice(0, 15);
    }
    const candidates = activeTab === 'internal' ? internalCandidates : activeTab === 'past' ? pastCandidates : uploadedCandidates;
    return [...candidates].sort((a, b) => (b.matchScores?.[job.id] || 0) - (a.matchScores?.[job.id] || 0));
  }, [job, activeTab, internalCandidates, pastCandidates, uploadedCandidates, allSortedCandidates]);

  const handleBatchAnalyze = () => {
    const topCandidates = allSortedCandidates.slice(0, 10);
    if (onBatchAnalysis && topCandidates.length > 0) {
      onBatchAnalysis(topCandidates);
    }
  };
  
  if (!job) {
    return (
      <div className="flex justify-center items-center h-full bg-slate-800 shadow-xl rounded-xl p-6">
        <p className="text-xl text-gray-400 flex items-center"><Briefcase className="mr-3" /> Select a job to see potential matches.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 shadow-xl rounded-xl p-1 h-full flex flex-col">
      <div className="px-4 sm:px-6 pt-4 flex flex-col h-full">
        <div className="flex border-b border-slate-700 flex-shrink-0 overflow-x-auto">
          <TabButton icon={<Trophy className="mr-2 h-5 w-5"/>} label="Best Matches" count={Math.min(15, allSortedCandidates.length)} isActive={activeTab === 'best'} onClick={() => setActiveTab('best')} />
          <TabButton icon={<Users className="mr-2 h-5 w-5"/>} label="Internal Talent" count={internalCandidates.length} isActive={activeTab === 'internal'} onClick={() => setActiveTab('internal')} />
          <TabButton icon={<UserCheck className="mr-2 h-5 w-5"/>} label="Past Applicants" count={pastCandidates.length} isActive={activeTab === 'past'} onClick={() => setActiveTab('past')} />
          <TabButton icon={<UploadCloud className="mr-2 h-5 w-5"/>} label="Uploaded CVs" count={uploadedCandidates.length} isActive={activeTab === 'uploaded'} onClick={() => setActiveTab('uploaded')} />
        </div>
        {onBatchAnalysis && allSortedCandidates.length > 0 && (
          <div className="mt-3 mb-2">
            <button
              onClick={handleBatchAnalyze}
              disabled={isBatchAnalyzing || isLoading}
              className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 hover:from-yellow-600 hover:via-orange-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBatchAnalyzing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Analyzing Top 10 Candidates...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 mr-2" />
                  AI Analyze Top 10 Best Matches
                </>
              )}
            </button>
          </div>
        )}
        {activeTab === 'best' && sortedCandidates.length > 0 && (
          <div className="mx-2 mt-2 mb-3 p-3 bg-gradient-to-r from-sky-900/30 to-purple-900/30 border border-sky-500/30 rounded-lg">
            <div className="flex items-center">
              <Trophy className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
              <p className="text-sm text-sky-200">
                <span className="font-semibold">Top {sortedCandidates.length} Best Matches</span> across all candidate pools (Internal, Past, Uploaded) sorted by AI match score.
              </p>
            </div>
          </div>
        )}
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedCandidates.length > 0 ? (
                    sortedCandidates.map(candidate => (
                        <CandidateCard key={candidate.id} candidate={candidate} job={job} onInitiateAnalysis={onInitiateAnalysis} onFeedback={onFeedback} isLoading={isLoading} loadingCandidateId={loadingCandidateId} />
                    ))
                ) : (
                    <p className="text-center text-gray-400 py-8 col-span-full">No candidates in this category.</p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default CandidatePane;