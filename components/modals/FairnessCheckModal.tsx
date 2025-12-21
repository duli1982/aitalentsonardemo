import React, { useMemo } from 'react';
import { X, ShieldCheck, AlertTriangle, UserPlus } from 'lucide-react';
import { Candidate } from '../../types';
import { FairnessReport, DiversityNudge } from '../../types/fairness';
import { fairnessEngine } from '../../services/FairnessEngine';

interface FairnessCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: FairnessReport;
    currentShortlist: Candidate[];
    allCandidates: Candidate[];
    onAddCandidate: (c: Candidate) => void;
}

const FairnessCheckModal: React.FC<FairnessCheckModalProps> = ({
    isOpen, onClose, report, currentShortlist, allCandidates, onAddCandidate
}) => {
    if (!isOpen) return null;

    const nudges = useMemo(() => fairnessEngine.generateNudges(currentShortlist, allCandidates), [currentShortlist, allCandidates]);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div className="flex items-center">
                        <ShieldCheck className="text-purple-400 mr-3 h-6 w-6" />
                        <h2 className="text-xl font-bold text-white">Fairness & Bias Audit</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">

                    {/* Alerts Section */}
                    {report.alerts.length > 0 ? (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Alerts</h3>
                            {report.alerts.map((alert, i) => (
                                <div key={i} className={`p-4 rounded-lg border ${alert.severity === 'CRITICAL' ? 'bg-red-900/20 border-red-500/50' : 'bg-yellow-900/20 border-yellow-500/50'}`}>
                                    <div className="flex items-center mb-1">
                                        <AlertTriangle size={16} className={`mr-2 ${alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}`} />
                                        <span className={`font-bold ${alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}`}>{alert.message}</span>
                                    </div>
                                    <p className="text-slate-300 text-sm ml-6">{alert.suggestion}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg flex items-center">
                            <ShieldCheck className="text-green-400 mr-3" />
                            <p className="text-green-300 font-medium">No critical bias patterns detected. Good job!</p>
                        </div>
                    )}

                    {/* Diversity Nudges */}
                    {nudges.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center">
                                <UserPlus size={16} className="mr-2" />
                                AI Diversity Nudges
                            </h3>
                            <p className="text-xs text-slate-500">Based on Skill Graph analysis, these candidates match the role requirements but bring diverse attributes.</p>

                            <div className="grid grid-cols-1 gap-3">
                                {nudges.map(nudge => {
                                    const candidate = allCandidates.find(c => c.id === nudge.candidateId);
                                    if (!candidate) return null;
                                    return (
                                        <div key={nudge.candidateId} className="bg-slate-800 border border-purple-500/30 p-4 rounded-lg flex justify-between items-center group hover:border-purple-500 transition-colors">
                                            <div>
                                                <h4 className="font-bold text-white mb-0.5">{candidate.name}</h4>
                                                <div className="flex gap-2 text-xs">
                                                    <span className="text-sky-400 font-semibold">{nudge.missingAttribute}</span>
                                                    <span className="text-slate-500">•</span>
                                                    <span className="text-slate-400">{nudge.reasoning}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { onAddCandidate(candidate); onClose(); }}
                                                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
                                            >
                                                Add to Shortlist
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Distributions (Visuals) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Gender Split</h4>
                            {Object.entries(report.genderDistribution).map(([label, val]) => (
                                <div key={label} className="mb-2">
                                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                                        <span>{label}</span>
                                        <span>{val}%</span>
                                    </div>
                                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${val}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Education Background</h4>
                            {Object.entries(report.educationDistribution).map(([label, val]) => (
                                <div key={label} className="mb-2">
                                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                                        <span>{label}</span>
                                        <span>{val}%</span>
                                    </div>
                                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${val}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default FairnessCheckModal;
