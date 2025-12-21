import React from 'react';
import { X, Trophy, TrendingUp, AlertCircle } from 'lucide-react';
import type { Candidate, Job } from '../../types';

interface ComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: Candidate[];
    job: Job;
}

const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose, candidates, job }) => {
    if (!isOpen || candidates.length === 0) return null;

    const getMatchScore = (candidate: Candidate) => {
        return candidate.matchScores?.[job.id] || 0;
    };

    const getSkillOverlap = (candidate: Candidate) => {
        const jobSkills = new Set(job.requiredSkills.map(s => s.toLowerCase()));
        return candidate.skills.filter(s => jobSkills.has(s.toLowerCase()));
    };

    const getBestCandidateForMetric = (metric: 'score' | 'skills') => {
        if (metric === 'score') {
            return candidates.reduce((best, current) =>
                getMatchScore(current) > getMatchScore(best) ? current : best
            );
        } else {
            return candidates.reduce((best, current) =>
                getSkillOverlap(current).length > getSkillOverlap(best).length ? current : best
            );
        }
    };

    const bestByScore = getBestCandidateForMetric('score');
    const bestBySkills = getBestCandidateForMetric('skills');

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]" onClick={onClose}>
            <div
                className="bg-slate-900 shadow-2xl rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <TrendingUp className="text-sky-400" />
                            Candidate Comparison
                        </h2>
                        <p className="text-gray-400 mt-1">
                            Comparing {candidates.length} candidates for <span className="text-sky-400 font-medium">{job.title}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Comparison Table */}
                <div className="flex-grow overflow-auto custom-scrollbar p-6">
                    <div className="min-w-[800px]">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left p-4 text-gray-400 font-semibold sticky left-0 bg-slate-900 z-10">Metric</th>
                                    {candidates.map(candidate => (
                                        <th key={candidate.id} className="p-4 text-center min-w-[200px]">
                                            <div className="text-sky-300 font-semibold">{candidate.name}</div>
                                            <div className="text-xs text-gray-500 mt-1">{candidate.type}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Match Score Row */}
                                <tr className="border-b border-slate-700/50 hover:bg-slate-800/30">
                                    <td className="p-4 font-medium text-gray-300 sticky left-0 bg-slate-900">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={16} className="text-purple-400" />
                                            Match Score
                                        </div>
                                    </td>
                                    {candidates.map(candidate => {
                                        const score = getMatchScore(candidate);
                                        const isBest = candidate.id === bestByScore.id;
                                        return (
                                            <td key={candidate.id} className="p-4 text-center">
                                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isBest ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30' : 'bg-slate-800'
                                                    }`}>
                                                    {isBest && <Trophy size={14} className="text-amber-400" />}
                                                    <span className={`font-bold ${isBest ? 'text-amber-300' : 'text-white'}`}>
                                                        {score}%
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Role Row */}
                                <tr className="border-b border-slate-700/50 hover:bg-slate-800/30">
                                    <td className="p-4 font-medium text-gray-300 sticky left-0 bg-slate-900">Current Role</td>
                                    {candidates.map(candidate => (
                                        <td key={candidate.id} className="p-4 text-center text-gray-300 text-sm">
                                            {candidate.role || 'N/A'}
                                        </td>
                                    ))}
                                </tr>

                                {/* Skills Match Row */}
                                <tr className="border-b border-slate-700/50 hover:bg-slate-800/30">
                                    <td className="p-4 font-medium text-gray-300 sticky left-0 bg-slate-900">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle size={16} className="text-green-400" />
                                            Matching Skills
                                        </div>
                                    </td>
                                    {candidates.map(candidate => {
                                        const matchingSkills = getSkillOverlap(candidate);
                                        const isBest = candidate.id === bestBySkills.id;
                                        return (
                                            <td key={candidate.id} className="p-4">
                                                <div className={`flex flex-wrap gap-1.5 justify-center ${isBest ? 'p-2 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20' : ''
                                                    }`}>
                                                    {isBest && <Trophy size={14} className="text-green-400 mr-1" />}
                                                    {matchingSkills.length > 0 ? (
                                                        matchingSkills.slice(0, 3).map(skill => (
                                                            <span key={skill} className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded border border-green-500/30">
                                                                {skill}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-500">None</span>
                                                    )}
                                                    {matchingSkills.length > 3 && (
                                                        <span className="text-xs text-gray-400">+{matchingSkills.length - 3}</span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Total Skills Row */}
                                <tr className="border-b border-slate-700/50 hover:bg-slate-800/30">
                                    <td className="p-4 font-medium text-gray-300 sticky left-0 bg-slate-900">Total Skills</td>
                                    {candidates.map(candidate => (
                                        <td key={candidate.id} className="p-4 text-center text-gray-300">
                                            {candidate.skills.length}
                                        </td>
                                    ))}
                                </tr>

                                {/* Experience Row */}
                                <tr className="border-b border-slate-700/50 hover:bg-slate-800/30">
                                    <td className="p-4 font-medium text-gray-300 sticky left-0 bg-slate-900">Experience</td>
                                    {candidates.map(candidate => (
                                        <td key={candidate.id} className="p-4 text-center text-gray-300">
                                            {candidate.experienceYears ? `${candidate.experienceYears} years` : 'N/A'}
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        <Trophy size={14} className="inline text-amber-400 mr-1" />
                        Winners highlighted for each metric
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Close Comparison
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComparisonModal;
