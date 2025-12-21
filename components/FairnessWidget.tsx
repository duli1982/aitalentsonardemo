import React, { useState, useEffect } from 'react';
import { Candidate } from '../types';
import { fairnessEngine } from '../services/FairnessEngine';
import { FairnessReport } from '../types/fairness';
import { ShieldCheck, AlertTriangle, PieChart } from 'lucide-react';
import FairnessCheckModal from './modals/FairnessCheckModal';

interface FairnessWidgetProps {
    candidates: Candidate[];
    allCandidates: Candidate[]; // For nudges
    onAddCandidate: (candidate: Candidate) => void;
}

const FairnessWidget: React.FC<FairnessWidgetProps> = ({ candidates, allCandidates, onAddCandidate }) => {
    const [report, setReport] = useState<FairnessReport | null>(null);
    const [isModalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        setReport(fairnessEngine.analyzeShortlist(candidates));
    }, [candidates]);

    if (!report) return null;

    const isHealthy = report.diversityScore >= 80;

    return (
        <>
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-md mb-6 flex items-center justify-between">
                <div className="flex items-center">
                    <div className={`p-2 rounded-full mr-3 ${isHealthy ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                        {isHealthy ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Fairness Guardrails</h4>
                        <p className={`text-xs ${isHealthy ? 'text-green-400' : 'text-yellow-400'}`}>
                            {isHealthy ? 'Shortlist is balanced.' : `${report.alerts.length} Potential Bias Risk(s) Detected`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center">
                    <div className="text-right mr-4">
                        <div className="text-xl font-bold text-white">{report.diversityScore}/100</div>
                        <div className="text-[10px] text-slate-500 uppercase">Diversity Score</div>
                    </div>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="bg-slate-700 hover:bg-slate-600 text-sky-400 text-xs font-bold py-2 px-3 rounded flex items-center transition-colors"
                    >
                        <PieChart size={14} className="mr-2" />
                        Run Check
                    </button>
                </div>
            </div>

            <FairnessCheckModal
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
                report={report}
                currentShortlist={candidates}
                allCandidates={allCandidates}
                onAddCandidate={onAddCandidate}
            />
        </>
    );
};

export default FairnessWidget;
