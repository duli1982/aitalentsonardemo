import React from 'react';
import type { HiddenGemAnalysis } from '../../types';
import { Sparkles, Zap, Brain } from 'lucide-react';

const HiddenGemAnalysisContent: React.FC<{ analysis: HiddenGemAnalysis }> = ({ analysis }) => (
    <div className="space-y-5 text-sm">
        <div>
            <h4 className="font-semibold text-lg text-amber-300 mb-1 flex items-center">
                <Sparkles size={18} className="mr-2" /> Gem Rationale
            </h4>
            <p className="text-gray-300 bg-slate-700/30 p-3 rounded-md">{analysis.gemRationale || "N/A"}</p>
        </div>
        <div>
            <h4 className="font-semibold text-lg text-amber-300 mb-2 flex items-center">
                <Zap size={18} className="mr-2" /> Transferable Skills Analysis
            </h4>
            {analysis.transferableSkillsAnalysis?.length > 0 ? (
                <ul className="space-y-3">
                    {analysis.transferableSkillsAnalysis.map((item, index) => (
                        <li key={index} className="p-3 rounded-md bg-slate-700/30">
                            <p className="font-semibold text-sky-400">{item.skill}</p>
                            <p className="text-xs text-gray-400 mt-0.5 mb-1"><span className="font-medium text-gray-500">Evidence:</span> {item.candidateEvidence}</p>
                            <p className="text-xs text-gray-300"><span className="font-medium text-gray-500">Relevance to Job:</span> {item.relevanceToJob}</p>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-gray-400">No specific transferable skills highlighted.</p>}
        </div>
        <div>
            <h4 className="font-semibold text-lg text-amber-300 mb-1 flex items-center">
                <Brain size={18} className="mr-2" /> Unconventional Fit Rationale
            </h4>
            <p className="text-gray-300 bg-slate-700/30 p-3 rounded-md">{analysis.unconventionalFitRationale || "N/A"}</p>
        </div>
    </div>
);

export default HiddenGemAnalysisContent;
