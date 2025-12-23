import React from 'react';
import type { Job, Candidate, AnalysisResult, JobAnalysis, FitAnalysis, HiddenGemAnalysis } from '../../types';
import { X, Loader2, Sparkles, TrendingUp, Target, MessageSquare, Diamond } from 'lucide-react';
import JobAnalysisContent from '../analysis/JobAnalysisContent';
import FitAnalysisContent from '../analysis/FitAnalysisContent';
import HiddenGemAnalysisContent from '../analysis/HiddenGemAnalysisContent';
import OutreachContent from '../analysis/OutreachContent';
import { useToast } from '../../contexts/ToastContext';

interface AnalysisModalProps {
    type: string;
    job: Job;
    candidate?: Candidate;
    isLoading: boolean;
    analysisResult: AnalysisResult | null;
    onClose: () => void;
    onInitiateAnalysis?: (type: string, target: Candidate) => void;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ type, job, candidate, isLoading, analysisResult, onClose, onInitiateAnalysis }) => {
    const { showToast } = useToast();
    const TITLES: { [key: string]: { icon: React.ReactNode, text: string } } = {
        JOB_SUMMARY: { icon: <Target className="h-6 w-6 mr-2 text-sky-400" />, text: "AI Job Analysis" },
        FIT_ANALYSIS: { icon: <TrendingUp className="h-6 w-6 mr-2 text-purple-400" />, text: "AI Fit Analysis" },
        HIDDEN_GEM_ANALYSIS: { icon: <Diamond className="h-6 w-6 mr-2 text-amber-400" />, text: "Hidden Gem Deep Dive" },
        OUTREACH: { icon: <MessageSquare className="h-6 w-6 mr-2 text-blue-400" />, text: "AI Outreach Message" }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-2 text-sky-500" /> Generating...
                </div>
            );
        }
        if (!analysisResult) return <p className="text-center text-gray-400 py-10">No analysis result available.</p>;

        switch (type) {
            case 'JOB_SUMMARY':
                return <JobAnalysisContent analysis={analysisResult as JobAnalysis} />;
            case 'FIT_ANALYSIS':
                // Safety check: ensure candidate exists for FIT_ANALYSIS
                if (!candidate) return <p className="text-red-400">Candidate data missing.</p>;
                return <FitAnalysisContent analysis={analysisResult as FitAnalysis} job={job} candidate={candidate} />;
            case 'HIDDEN_GEM_ANALYSIS':
                return <HiddenGemAnalysisContent analysis={analysisResult as HiddenGemAnalysis} />;
            case 'OUTREACH':
                return <OutreachContent message={analysisResult as string} />;
            default:
                return <p>Invalid analysis type.</p>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-slate-800 shadow-2xl rounded-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-sky-400 flex items-center">
                        {TITLES[type]?.icon || <Sparkles className="h-6 w-6 mr-2" />} {TITLES[type]?.text || "AI Analysis"}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors"><X size={24} /></button>
                </div>
                <div className="mb-3 p-3 bg-slate-700/50 rounded-md text-sm border border-slate-600/50">
                    <p><span className="font-semibold text-sky-400/80">Role:</span> {job.title}</p>
                    {candidate && <p><span className="font-semibold text-sky-400/80">Candidate:</span> {candidate.name}</p>}
                </div>
                <div className="overflow-y-auto custom-scrollbar flex-grow pr-2">
                    {renderContent()}
                </div>
                <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-700">
                    <button onClick={onClose} className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-gray-200 font-medium transition-colors">Close</button>

                    {type === 'FIT_ANALYSIS' && candidate && onInitiateAnalysis && (
                        <button
                            onClick={() => onInitiateAnalysis('INTERVIEW_GUIDE', candidate)}
                            className="px-6 py-2 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-900/20 flex items-center gap-2 transition-all"
                        >
                            <MessageSquare size={18} />
                            Generate Interview Guide
                        </button>
                    )}

                    {type === 'OUTREACH' && (
                        <button
                            onClick={() => showToast(`Simulated: Message sent to ${candidate?.name || 'candidate'}!`, 'success')}
                            className="px-6 py-2 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold"
                        >
                            Send Message
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalysisModal;
