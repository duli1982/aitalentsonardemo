import React, { useState } from 'react';
import { X, RefreshCw, Loader2, TrendingUp, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import type { Candidate } from '../../types';
import * as geminiService from '../../services/geminiService';

interface RefreshProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: Candidate;
    onApplyChanges?: (updates: Partial<Candidate>) => void;
}

const RefreshProfileModal: React.FC<RefreshProfileModalProps> = ({ isOpen, onClose, candidate, onApplyChanges }) => {
    const [refreshData, setRefreshData] = useState<geminiService.RefreshedProfile | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const response = await geminiService.refreshCandidateProfileResult(candidate);
            if (!response.success && 'error' in response) {
                throw new Error(response.error.message);
            }
            const result = response.data;
            setRefreshData(result);
        } catch (error) {
            console.error('Error refreshing profile:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const getSignificanceColor = (significance: string) => {
        switch (significance) {
            case 'major': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'moderate': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'minor': return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const handleApply = () => {
        if (refreshData && onApplyChanges) {
            const updates: Partial<Candidate> = {
                skills: [...candidate.skills, ...refreshData.newSkills]
            };
            onApplyChanges(updates);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]" onClick={onClose}>
            <div
                className="bg-slate-900 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <RefreshCw className="text-sky-400" />
                            Refresh Candidate Profile
                        </h2>
                        <p className="text-gray-400 mt-1">
                            Pull latest updates from LinkedIn/GitHub for {candidate.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-auto custom-scrollbar p-6">
                    {!refreshData ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            {isRefreshing ? (
                                <>
                                    <Loader2 className="h-12 w-12 animate-spin text-sky-500 mb-4" />
                                    <p className="text-gray-300 font-medium">Scanning LinkedIn and GitHub...</p>
                                    <p className="text-gray-500 text-sm mt-2">Checking for profile updates</p>
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-16 w-16 text-sky-400 mb-4" />
                                    <p className="text-gray-300 font-medium mb-4">Ready to refresh profile</p>
                                    <button
                                        onClick={handleRefresh}
                                        className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <RefreshCw size={18} />
                                        Scan for Updates
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                    <Sparkles className="text-sky-400" size={20} />
                                    Profile Update Summary
                                </h3>
                                <p className="text-gray-300 mb-3">{refreshData.summary}</p>
                                <div className="bg-slate-900/50 rounded-lg p-3">
                                    <p className="text-sm text-sky-300 font-medium flex items-center gap-2">
                                        <TrendingUp size={14} />
                                        Impact: {refreshData.impactAssessment}
                                    </p>
                                </div>
                            </div>

                            {/* Changes Detected */}
                            {refreshData.changes.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <AlertCircle className="text-amber-400" size={20} />
                                        Changes Detected ({refreshData.changes.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {refreshData.changes.map((change, index) => (
                                            <div
                                                key={index}
                                                className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="text-white font-semibold">{change.field}</span>
                                                    <span className={`text-xs px-2 py-1 rounded-full uppercase font-bold border ${getSignificanceColor(change.significance)}`}>
                                                        {change.significance}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-gray-500 text-xs mb-1">Previous</p>
                                                        <p className="text-gray-400">{change.oldValue}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500 text-xs mb-1">Updated</p>
                                                        <p className="text-green-400 font-medium">{change.newValue}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New Skills */}
                            {refreshData.newSkills.length > 0 && (
                                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                        <CheckCircle className="text-green-400" size={20} />
                                        New Skills Acquired ({refreshData.newSkills.length})
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {refreshData.newSkills.map(skill => (
                                            <span
                                                key={skill}
                                                className="px-3 py-1 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-300 rounded-md text-sm font-medium"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Promotions */}
                            {refreshData.promotions.length > 0 && (
                                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                        <TrendingUp className="text-purple-400" size={20} />
                                        Career Progression
                                    </h3>
                                    <ul className="space-y-2">
                                        {refreshData.promotions.map((promo, index) => (
                                            <li key={index} className="flex items-center gap-2 text-gray-300">
                                                <CheckCircle size={16} className="text-purple-400" />
                                                {promo}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        <RefreshCw size={14} className="inline text-sky-400 mr-1" />
                        Last updated: {refreshData ? new Date(refreshData.lastUpdated).toLocaleString() : 'Never'}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                        >
                            Close
                        </button>
                        {refreshData && (
                            <button
                                onClick={handleApply}
                                className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                                <CheckCircle size={18} />
                                Apply Updates
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefreshProfileModal;
