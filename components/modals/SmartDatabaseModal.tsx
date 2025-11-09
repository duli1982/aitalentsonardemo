import React, { useState } from 'react';
import type { UploadedCandidate, Job } from '../../types';
import { X, Database, Users, TrendingUp, Search, Loader2, CheckCircle, AlertTriangle, Trophy, ThumbsUp, Meh, ThumbsDown } from 'lucide-react';
import * as demoService from '../../services/demoDatabaseService';

interface SmartDatabaseModalProps {
  onClose: () => void;
  onLoadCandidates: (candidates: UploadedCandidate[]) => void;
  jobs: Job[];
}

type ScanStatus = 'job-selection' | 'scanning' | 'results' | 'importing';

const SmartDatabaseModal: React.FC<SmartDatabaseModalProps> = ({ onClose, onLoadCandidates, jobs }) => {
  const [scanStatus, setScanStatus] = useState<ScanStatus>('job-selection');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState<demoService.DemoLoadProgress>({ current: 0, total: 0, candidateName: '', currentScore: 0, isAiAnalysis: false });
  const [matchResults, setMatchResults] = useState<demoService.MatchTierResults | null>(null);
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set(['excellent', 'good']));
  const [maxAiAnalysis, setMaxAiAnalysis] = useState<number>(10); // Default: 10 AI analyses
  const [apiSavings, setApiSavings] = useState<number>(0);

  const stats = demoService.getDemoStats();

  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
  };

  const handleStartScan = async () => {
    if (!selectedJob) return;

    setScanStatus('scanning');
    setApiSavings(stats.totalCandidates - maxAiAnalysis);

    try {
      const results = await demoService.scanDatabaseForMatches(
        selectedJob,
        (prog) => {
          setProgress(prog);
        },
        maxAiAnalysis // Pass the user-selected limit
      );

      setMatchResults(results);
      setScanStatus('results');

      // Auto-select appropriate tiers based on results
      if (results.excellent.length > 0 || results.good.length > 0) {
        setSelectedTiers(new Set(['excellent', 'good']));
      } else if (results.moderate.length > 0) {
        setSelectedTiers(new Set(['moderate']));
      } else if (results.low.length > 0) {
        setSelectedTiers(new Set(['low']));
      }
    } catch (error) {
      console.error('Failed to scan database:', error);
      setScanStatus('job-selection');
    }
  };

  const handleImport = () => {
    if (!matchResults || !selectedJob) return;

    setScanStatus('importing');

    const tiersArray = Array.from(selectedTiers) as ('excellent' | 'good' | 'moderate' | 'low')[];
    const candidates = demoService.importMatchedCandidates(matchResults, selectedJob, tiersArray);

    onLoadCandidates(candidates);

    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const toggleTier = (tier: string) => {
    const newTiers = new Set(selectedTiers);
    if (newTiers.has(tier)) {
      newTiers.delete(tier);
    } else {
      newTiers.add(tier);
    }
    setSelectedTiers(newTiers);
  };

  const getTotalSelected = () => {
    if (!matchResults) return 0;
    let total = 0;
    selectedTiers.forEach(tier => {
      total += (matchResults as any)[tier].length;
    });
    return total;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <div>
            <h3 className="text-xl font-semibold text-sky-400 flex items-center">
              <Database className="h-6 w-6 mr-2" />
              Smart Candidate Matching
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              AI-powered matching - import only relevant candidates
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Job Selection */}
          {scanStatus === 'job-selection' && (
            <>
              <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-purple-300 mb-4 flex items-center">
                  <Search className="h-5 w-5 mr-2" />
                  Select Job to Match Against
                </h4>
                <p className="text-sm text-gray-300 mb-4">
                  The AI will scan {stats.totalCandidates} candidates and import only those who match your selected job (65%+ match recommended)
                </p>

                {jobs.length === 0 ? (
                  <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 mb-2" />
                    <p className="text-yellow-300 text-sm font-semibold">No jobs available</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Please create a job first before scanning the database.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {jobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => handleJobSelect(job)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          selectedJob?.id === job.id
                            ? 'bg-purple-500/20 border-purple-500 shadow-lg'
                            : 'bg-slate-700/30 border-slate-600 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="font-semibold text-white">{job.title}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {job.department} • {job.location}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          Required: {job.requiredSkills.slice(0, 3).join(', ')}
                          {job.requiredSkills.length > 3 && '...'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* API Optimization Settings */}
              <div className="bg-gradient-to-br from-green-900/30 to-teal-900/30 border border-green-500/30 rounded-lg p-5">
                <h4 className="text-sm font-semibold text-green-300 mb-3 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Optimize API Usage (Free Tier Friendly)
                </h4>
                <p className="text-xs text-gray-300 mb-4">
                  Smart matching uses a two-tier system: fast skill pre-screening (0 API calls) + AI analysis for top candidates only
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 mb-2 block">
                      How many candidates should get full AI analysis?
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 20].map(num => (
                        <button
                          key={num}
                          onClick={() => setMaxAiAnalysis(num)}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                            maxAiAnalysis === num
                              ? 'bg-green-500/30 border-2 border-green-500 text-green-300'
                              : 'bg-slate-700/50 border-2 border-slate-600 text-gray-400 hover:border-green-500/50'
                          }`}
                        >
                          {num === 20 ? 'All' : num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-3 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-400">AI Analyses:</span>
                      <span className="text-green-400 font-bold">{maxAiAnalysis} / {stats.totalCandidates}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">API Calls Saved:</span>
                      <span className="text-green-400 font-bold">{stats.totalCandidates - maxAiAnalysis} ({Math.round(((stats.totalCandidates - maxAiAnalysis) / stats.totalCandidates) * 100)}%)</span>
                    </div>
                    {maxAiAnalysis < 20 && (
                      <p className="text-gray-500 mt-2 text-xs">
                        Top {maxAiAnalysis} candidates by skill match get full AI analysis. Rest get fast skill-based scores.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/40 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-sky-300 mb-3">How It Works</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span>Fast pre-screening ranks all {stats.totalCandidates} candidates by skill match (instant)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span>AI deeply analyzes top {maxAiAnalysis} candidates with detailed fit scoring</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span>Results cached for 24 hours - repeat scans use 0 API calls</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span>Choose which quality tiers to import - only add relevant matches</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Scanning Progress */}
          {scanStatus === 'scanning' && (
            <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Loader2 className="h-6 w-6 mr-3 animate-spin text-purple-400" />
                <div className="flex-grow">
                  <h4 className="text-purple-300 font-semibold">Smart Matching in Progress...</h4>
                  <p className="text-sm text-gray-400">
                    Analyzing {progress.current} of {progress.total} candidates
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">API Saved</div>
                  <div className="text-lg font-bold text-green-400">{apiSavings}</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-300 flex items-center">
                    <Users className="h-4 w-4 inline mr-2 text-purple-400" />
                    <span className="font-semibold">{progress.candidateName}</span>
                  </div>
                  {progress.isAiAnalysis !== undefined && (
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      progress.isAiAnalysis
                        ? 'bg-purple-500/30 text-purple-300'
                        : 'bg-green-500/30 text-green-300'
                    }`}>
                      {progress.isAiAnalysis ? '🤖 AI Analysis' : '⚡ Quick Match'}
                    </span>
                  )}
                </div>
                {progress.currentScore !== undefined && progress.currentScore > 0 && (
                  <div className="text-sm">
                    <span className="text-gray-400">Match Score: </span>
                    <span className={`font-bold ${
                      progress.currentScore >= 80 ? 'text-green-400' :
                      progress.currentScore >= 65 ? 'text-blue-400' :
                      progress.currentScore >= 50 ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {progress.currentScore}%
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">
                  {progress.current <= maxAiAnalysis
                    ? `🤖 Deep AI analysis for top candidates... ${maxAiAnalysis - progress.current} AI analyses remaining`
                    : `⚡ Fast skill matching for remaining candidates... Saving ${progress.current - maxAiAnalysis} API calls so far`
                  }
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {scanStatus === 'results' && matchResults && (
            <>
              <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-green-300 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Match Results for: {selectedJob?.title}
                </h4>

                <div className="space-y-3">
                  {/* Excellent Tier */}
                  {matchResults.excellent.length > 0 && (
                    <button
                      onClick={() => toggleTier('excellent')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedTiers.has('excellent')
                          ? 'bg-green-500/20 border-green-500'
                          : 'bg-slate-700/30 border-slate-600 hover:border-green-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Trophy className="h-5 w-5 text-green-400 mr-3" />
                          <div>
                            <div className="font-semibold text-green-300">Excellent Match (80%+)</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {matchResults.excellent.length} candidate{matchResults.excellent.length !== 1 ? 's' : ''} •
                              Top: {matchResults.excellent[0].candidate.name} ({matchResults.excellent[0].matchScore}%)
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedTiers.has('excellent')}
                          onChange={() => toggleTier('excellent')}
                          className="w-5 h-5"
                        />
                      </div>
                    </button>
                  )}

                  {/* Good Tier */}
                  {matchResults.good.length > 0 && (
                    <button
                      onClick={() => toggleTier('good')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedTiers.has('good')
                          ? 'bg-blue-500/20 border-blue-500'
                          : 'bg-slate-700/30 border-slate-600 hover:border-blue-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <ThumbsUp className="h-5 w-5 text-blue-400 mr-3" />
                          <div>
                            <div className="font-semibold text-blue-300">Good Match (65-79%)</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {matchResults.good.length} candidate{matchResults.good.length !== 1 ? 's' : ''} •
                              Top: {matchResults.good[0].candidate.name} ({matchResults.good[0].matchScore}%)
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedTiers.has('good')}
                          onChange={() => toggleTier('good')}
                          className="w-5 h-5"
                        />
                      </div>
                    </button>
                  )}

                  {/* No Good Matches - Show Lower Tiers */}
                  {matchResults.excellent.length === 0 && matchResults.good.length === 0 && (
                    <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mb-2" />
                      <p className="text-yellow-300 text-sm font-semibold">No candidates with 65%+ match found</p>
                      <p className="text-gray-400 text-xs mt-1">
                        Would you like to see lower-tier matches below?
                      </p>
                    </div>
                  )}

                  {/* Moderate Tier */}
                  {matchResults.moderate.length > 0 && (
                    <button
                      onClick={() => toggleTier('moderate')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedTiers.has('moderate')
                          ? 'bg-yellow-500/20 border-yellow-500'
                          : 'bg-slate-700/30 border-slate-600 hover:border-yellow-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Meh className="h-5 w-5 text-yellow-400 mr-3" />
                          <div>
                            <div className="font-semibold text-yellow-300">Moderate Match (50-64%)</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {matchResults.moderate.length} candidate{matchResults.moderate.length !== 1 ? 's' : ''} •
                              Top: {matchResults.moderate[0].candidate.name} ({matchResults.moderate[0].matchScore}%)
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedTiers.has('moderate')}
                          onChange={() => toggleTier('moderate')}
                          className="w-5 h-5"
                        />
                      </div>
                    </button>
                  )}

                  {/* Low Tier */}
                  {matchResults.low.length > 0 && (
                    <button
                      onClick={() => toggleTier('low')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedTiers.has('low')
                          ? 'bg-orange-500/20 border-orange-500'
                          : 'bg-slate-700/30 border-slate-600 hover:border-orange-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <ThumbsDown className="h-5 w-5 text-orange-400 mr-3" />
                          <div>
                            <div className="font-semibold text-orange-300">Low Match (30-49%)</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {matchResults.low.length} candidate{matchResults.low.length !== 1 ? 's' : ''} •
                              Top: {matchResults.low[0].candidate.name} ({matchResults.low[0].matchScore}%)
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedTiers.has('low')}
                          onChange={() => toggleTier('low')}
                          className="w-5 h-5"
                        />
                      </div>
                    </button>
                  )}

                  {matchResults.poor.length > 0 && (
                    <div className="text-sm text-gray-500 p-3 bg-slate-700/30 rounded-lg">
                      {matchResults.poor.length} candidate{matchResults.poor.length !== 1 ? 's' : ''} with &lt;30% match (not recommended)
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Importing */}
          {scanStatus === 'importing' && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 mr-3 text-green-400" />
                <div>
                  <h4 className="text-green-300 font-semibold text-lg">Importing {getTotalSelected()} Candidates!</h4>
                  <p className="text-gray-300 text-sm">Adding matched candidates to your talent pool...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-6 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {scanStatus === 'results' && (
              <span className="text-sky-300 font-semibold">
                {getTotalSelected()} candidate{getTotalSelected() !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={scanStatus === 'scanning' || scanStatus === 'importing'}
              className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            {scanStatus === 'job-selection' && (
              <button
                onClick={handleStartScan}
                disabled={!selectedJob}
                className="px-6 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search size={18} />
                Start AI Matching
              </button>
            )}
            {scanStatus === 'results' && (
              <button
                onClick={handleImport}
                disabled={getTotalSelected() === 0}
                className="px-6 py-2 rounded-md bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={18} />
                Import {getTotalSelected()} Candidate{getTotalSelected() !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartDatabaseModal;
