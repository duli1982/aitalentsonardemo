import React, { useState, useEffect } from 'react';
import { inferenceEngine } from '../services/InferenceEngine';
import { SkillBelief } from '../types/inference';
import { Shield, GitCommit, Users, Award, Eye, FileBadge, Activity, TrendingUp, TrendingDown, Minus, X, Loader2 } from 'lucide-react';

interface SkillsPassportProps {
    skillName: string;
    level?: string;
    candidateId?: string;
    onClose?: () => void;
}

const SkillsPassport: React.FC<SkillsPassportProps> = ({ skillName, level, candidateId, onClose }) => {
    const [selectedSkill, setSelectedSkill] = useState<SkillBelief | null>(null);

    useEffect(() => {
        // In a real app, we'd fetch specific evidence for this candidate + skill.
        // For this demo, we'll generate a consistent mock based on the skill name.
        const signals = inferenceEngine.generateMockSignals(skillName);
        const belief = inferenceEngine.inferSkillState(skillName, signals);
        setSelectedSkill(belief);
    }, [skillName, candidateId]);

    const getSourceIcon = (type: string) => {
        switch (type) {
            case 'CODE_REPOSITORY': return <GitCommit size={14} className="text-purple-400" />;
            case 'PROCTORED_EXAM': return <Shield size={14} className="text-emerald-400" />;
            case 'PEER_REVIEW': return <Users size={14} className="text-blue-400" />;
            case 'SELF_ATTESTATION': return <FileBadge size={14} className="text-slate-400" />;
            default: return <Activity size={14} className="text-slate-400" />;
        }
    };

    if (!selectedSkill) return <div className="p-4 text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin" /> Loading Inference Model...</div>;

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header: Probabilistic Belief */}
            <div className="bg-slate-800 p-6 border-b border-slate-700 relative">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}

                <div className="flex justify-between items-start mb-4 pr-10">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Award className="text-purple-400" />
                            {selectedSkill.skillId}
                        </h2>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                            <span>Bayesian Inference Model v4.0</span>
                            <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                            <span>Updated {new Date(selectedSkill.lastUpdated).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full border text-sm font-bold flex items-center gap-2 ${selectedSkill.trend === 'RISING' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        selectedSkill.trend === 'DECAYING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                            'bg-slate-700/50 border-slate-600 text-slate-300'
                        }`}>
                        {selectedSkill.trend === 'RISING' && <TrendingUp size={14} />}
                        {selectedSkill.trend === 'DECAYING' && <TrendingDown size={14} />}
                        {selectedSkill.trend === 'STABLE' && <Minus size={14} />}
                        {selectedSkill.trend} Signal
                    </div>
                </div>

                {/* Confidence Visualizer */}
                <div className="mt-6 relative pt-6 pb-2">
                    {/* Track */}
                    <div className="h-4 bg-slate-700/30 rounded-full w-full relative overflow-hidden">
                        {/* Gradient Fill for Mean */}
                        <div
                            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                            style={{ width: `${selectedSkill.proficiencyMean}%` }}
                        ></div>

                        {/* Confidence Interval (Error Bars) */}
                        <div
                            className="absolute top-0 bottom-0 bg-white/20 border-l border-r border-white/50 backdrop-blur-[1px] transition-all duration-1000"
                            style={{
                                left: `${selectedSkill.proficiencyMean - selectedSkill.confidenceInterval}%`,
                                width: `${selectedSkill.confidenceInterval * 2}%`
                            }}
                        ></div>
                    </div>

                    {/* Labels */}
                    <div className="absolute top-0 left-0 w-full flex justify-between text-xs font-mono text-slate-500 px-1">
                        <span>Novice (0)</span>
                        <span>Expert (100)</span>
                    </div>

                    {/* Tooltip-like Readout */}
                    <div
                        className="absolute -top-1 transform -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${selectedSkill.proficiencyMean}%` }}
                    >
                        <div className="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded border border-slate-600 shadow-lg mb-1 whitespace-nowrap">
                            {selectedSkill.proficiencyMean}% <span className="text-slate-400 font-normal">±{selectedSkill.confidenceInterval}%</span>
                        </div>
                        <div className="w-0.5 h-3 bg-white/50"></div>
                    </div>
                </div>

                <p className="text-xs text-center text-slate-400 mt-4 leading-relaxed max-w-lg mx-auto">
                    We are <strong>{(100 - (selectedSkill.confidenceInterval)).toFixed(0)}% confident</strong> that the candidate's true proficiency lies between
                    <span className="text-white mx-1">{selectedSkill.proficiencyMean - selectedSkill.confidenceInterval}</span> and
                    <span className="text-white mx-1">{selectedSkill.proficiencyMean + selectedSkill.confidenceInterval}</span>.
                </p>
            </div>

            {/* Evidence Chain */}
            <div className="bg-slate-800/50 p-6">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity size={16} /> Signal Evidence Chain
                </h3>

                <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                    {selectedSkill.evidenceChain.map((signal, idx) => (
                        <div key={signal.id} className="relative pl-10 group">
                            {/* Connector Node */}
                            <div className={`absolute left-[11px] top-3 w-2.5 h-2.5 rounded-full border-2 bg-slate-900 transition-colors z-10 ${idx === 0 ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600 group-hover:border-purple-400'
                                }`}></div>

                            <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg hover:border-slate-500 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="p-1 bg-slate-900 rounded border border-slate-700">
                                            {getSourceIcon(signal.sourceType)}
                                        </span>
                                        <span className="text-sm font-semibold text-white">{signal.sourceName}</span>
                                    </div>
                                    <span className="text-xs font-mono text-slate-500">
                                        {new Date(signal.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mb-2">{signal.description}</p>
                                <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
                                    <span className={signal.rawScore > 80 ? 'text-emerald-400' : 'text-amber-400'}>
                                        Score: {signal.rawScore}
                                    </span>
                                    <span className="text-slate-500 flex items-center gap-1">
                                        <Shield size={10} /> Trust: {(signal.reliability * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SkillsPassport;
