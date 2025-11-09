import React, { useState, useEffect } from 'react';
import type { UploadedCandidate } from '../../types';
import { X, Database, Users, TrendingUp, MapPin, Award, Loader2, CheckCircle } from 'lucide-react';
import * as demoService from '../../services/demoDatabaseService';

interface DemoDatabaseModalProps {
  onClose: () => void;
  onLoadCandidates: (candidates: UploadedCandidate[]) => void;
}

type LoadStatus = 'idle' | 'loading' | 'complete';

const DemoDatabaseModal: React.FC<DemoDatabaseModalProps> = ({ onClose, onLoadCandidates }) => {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, candidateName: '' });
  const [loadedCount, setLoadedCount] = useState(0);
  const [stats] = useState(demoService.getDemoStats());

  const handleLoadDatabase = async () => {
    setLoadStatus('loading');
    setLoadedCount(0);

    try {
      const candidates = await demoService.loadDemoCandidates((progress) => {
        setProgress(progress);
      });

      setLoadedCount(candidates.length);
      setLoadStatus('complete');
      demoService.markDemoDatabaseAsLoaded();

      // Pass candidates to parent
      onLoadCandidates(candidates);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to load demo database:', error);
      setLoadStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <div>
            <h3 className="text-xl font-semibold text-sky-400 flex items-center">
              <Database className="h-6 w-6 mr-2" />
              Demo Candidate Database
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Load realistic test data to explore all features
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
          {loadStatus === 'idle' && (
            <>
              {/* Database Overview */}
              <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-purple-300 mb-4 flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  Database Overview
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center text-gray-400 text-sm mb-1">
                      <Users className="h-4 w-4 mr-2" />
                      Total Candidates
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.totalCandidates}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center text-gray-400 text-sm mb-1">
                      <Award className="h-4 w-4 mr-2" />
                      Unique Skills
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.uniqueSkillsCount}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center text-gray-400 text-sm mb-1">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Avg Experience
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.averageExperience} yrs</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center text-gray-400 text-sm mb-1">
                      <MapPin className="h-4 w-4 mr-2" />
                      Locations
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.locationsCount}</div>
                  </div>
                </div>
              </div>

              {/* Top Skills Preview */}
              <div className="bg-slate-700/40 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-sky-300 mb-3">Top Skills in Database</h4>
                <div className="flex flex-wrap gap-2">
                  {stats.topSkills.map((skill, index) => (
                    <span
                      key={skill}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        index === 0
                          ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-slate-600/50 text-gray-300'
                      }`}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Features List */}
              <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-300 mb-3">What You'll Get</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span><strong>20 diverse candidates</strong> across multiple roles and skill levels</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span><strong>Realistic profiles</strong> with experience ranges from 3-12 years</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span><strong>Varied skill sets</strong> including tech, marketing, design, and management</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span><strong>Ready for matching</strong> against any job description you create</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-green-400 flex-shrink-0" />
                    <span><strong>No authentication required</strong> - instant access to full features</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {/* Loading Progress */}
          {loadStatus === 'loading' && (
            <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Loader2 className="h-6 w-6 mr-3 animate-spin text-purple-400" />
                <div>
                  <h4 className="text-purple-300 font-semibold">Loading Candidates...</h4>
                  <p className="text-sm text-gray-400">
                    {progress.current} of {progress.total} candidates processed
                  </p>
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

              <div className="text-sm text-gray-300">
                <Users className="h-4 w-4 inline mr-2 text-purple-400" />
                Currently processing: <span className="font-semibold">{progress.candidateName}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {loadStatus === 'complete' && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-6">
              <div className="flex items-center mb-2">
                <CheckCircle className="h-8 w-8 mr-3 text-green-400" />
                <div>
                  <h4 className="text-green-300 font-semibold text-lg">Successfully Loaded!</h4>
                  <p className="text-gray-300 text-sm">
                    {loadedCount} candidates are now available in your talent pool
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                You can now create job descriptions and test the AI matching features!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-6 flex justify-between">
          <div className="text-xs text-gray-500">
            💡 Tip: This loads realistic test data - perfect for demos and testing
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loadStatus === 'loading'}
              className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadStatus === 'complete' ? 'Done' : 'Cancel'}
            </button>
            {loadStatus === 'idle' && (
              <button
                onClick={handleLoadDatabase}
                className="px-6 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all flex items-center gap-2"
              >
                <Database size={18} />
                Load Demo Database
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoDatabaseModal;
