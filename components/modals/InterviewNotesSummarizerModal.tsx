import React, { useState } from 'react';
import { X, FileText, Loader2, CheckCircle, AlertCircle, TrendingUp, MessageSquare, ArrowRight } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import * as geminiService from '../../services/geminiService';
import { useToast } from '../../contexts/ToastContext';

interface InterviewNotesSummarizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: Candidate;
    job: Job;
}

const InterviewNotesSummarizerModal: React.FC<InterviewNotesSummarizerModalProps> = ({ isOpen, onClose, candidate, job }) => {
    const [rawNotes, setRawNotes] = useState('');
    const [interviewer, setInterviewer] = useState('');
    const [summary, setSummary] = useState<geminiService.InterviewSummary | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const { showToast } = useToast();

    const handleSummarize = async () => {
        if (!rawNotes.trim() || !interviewer.trim()) {
            showToast('Enter interview notes and the interviewer name.', 'warning');
            return;
        }

        setIsSummarizing(true);
        try {
            const response = await geminiService.summarizeInterviewNotesResult(
                rawNotes,
                candidate.name,
                job.title,
                interviewer
            );
            if (!response.success && 'error' in response) {
                throw new Error(response.error.message);
            }
            const result = response.data;
            setSummary(result);
        } catch (error) {
            console.error('Error summarizing notes:', error);
            showToast('Failed to summarize notes. Please try again.', 'error');
        } finally {
            setIsSummarizing(false);
        }
    };

    const getVerdictColor = (verdict: string) => {
        switch (verdict) {
            case 'strong_yes': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'yes': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'maybe': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'no': return 'text-red-400 bg-red-500/10 border-red-500/30';
            case 'strong_no': return 'text-red-400 bg-red-500/10 border-red-500/30';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const getVerdictLabel = (verdict: string) => {
        return verdict.replace(/_/g, ' ').toUpperCase();
    };

    const getRatingColor = (rating: number) => {
        if (rating >= 8) return 'text-green-400';
        if (rating >= 6) return 'text-amber-400';
        return 'text-red-400';
    };

    if (!isOpen) return null;

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
                            <FileText className="text-sky-400" />
                            Interview Notes Summarizer
                        </h2>
                        <p className="text-gray-400 mt-1">
                            Transform messy notes into structured insights for {candidate.name}
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
                    {!summary ? (
                        <div className="space-y-4">
                            {/* Input Section */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    Interviewer Name
                                </label>
                                <input
                                    type="text"
                                    value={interviewer}
                                    onChange={(e) => setInterviewer(e.target.value)}
                                    placeholder="e.g., John Smith"
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    Interview Notes (paste raw notes or transcript)
                                </label>
                                <textarea
                                    value={rawNotes}
                                    onChange={(e) => setRawNotes(e.target.value)}
                                    placeholder="Paste your interview notes here... Can be messy, incomplete, or even bullet points. AI will structure them for you."
                                    rows={12}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 Tip: Include strengths, concerns, technical skills discussed, and your overall impression
                                </p>
                            </div>

                            <button
                                onClick={handleSummarize}
                                disabled={isSummarizing || !rawNotes.trim() || !interviewer.trim()}
                                className="w-full px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSummarizing ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Analyzing Notes...
                                    </>
                                ) : (
                                    <>
                                        <MessageSquare size={18} />
                                        Generate Summary
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Header Info */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{summary.candidateName}</h3>
                                        <p className="text-gray-400">{summary.jobTitle}</p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Interviewed by {summary.interviewer} • {new Date(summary.interviewDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase border ${getVerdictColor(summary.verdict)}`}>
                                        {getVerdictLabel(summary.verdict)}
                                    </span>
                                </div>
                                <p className="text-gray-300 leading-relaxed">{summary.overallSummary}</p>
                            </div>

                            {/* Ratings */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Technical Assessment</h4>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`text-3xl font-bold ${getRatingColor(summary.technicalAssessment.rating)}`}>
                                            {summary.technicalAssessment.rating}/10
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300">{summary.technicalAssessment.notes}</p>
                                </div>

                                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Cultural Fit</h4>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`text-3xl font-bold ${getRatingColor(summary.culturalFit.rating)}`}>
                                            {summary.culturalFit.rating}/10
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300">{summary.culturalFit.notes}</p>
                                </div>
                            </div>

                            {/* Strengths */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                    <CheckCircle className="text-green-400" size={20} />
                                    Strengths ({summary.strengths.length})
                                </h4>
                                <ul className="space-y-2">
                                    {summary.strengths.map((strength, index) => (
                                        <li key={index} className="flex items-start gap-2 text-gray-300">
                                            <span className="text-green-400 mt-1">✓</span>
                                            {strength}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Concerns */}
                            {summary.concerns.length > 0 && (
                                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                    <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                        <AlertCircle className="text-amber-400" size={20} />
                                        Concerns ({summary.concerns.length})
                                    </h4>
                                    <ul className="space-y-2">
                                        {summary.concerns.map((concern, index) => (
                                            <li key={index} className="flex items-start gap-2 text-gray-300">
                                                <span className="text-amber-400 mt-1">⚠</span>
                                                {concern}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Key Takeaways */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                    <TrendingUp className="text-sky-400" size={20} />
                                    Key Takeaways
                                </h4>
                                <ul className="space-y-2">
                                    {summary.keyTakeaways.map((takeaway, index) => (
                                        <li key={index} className="flex items-start gap-2 text-gray-300">
                                            <span className="text-sky-400">•</span>
                                            {takeaway}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Next Steps */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                    <ArrowRight className="text-purple-400" size={20} />
                                    Recommended Next Steps
                                </h4>
                                <ol className="space-y-2">
                                    {summary.nextSteps.map((step, index) => (
                                        <li key={index} className="flex items-start gap-3 text-gray-300">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                                                {index + 1}
                                            </span>
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        <FileText size={14} className="inline text-sky-400 mr-1" />
                        Standardized format makes candidate comparison easier
                    </p>
                    <div className="flex gap-3">
                        {summary && (
                            <button
                                onClick={() => {
                                    setSummary(null);
                                    setRawNotes('');
                                    setInterviewer('');
                                }}
                                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                            >
                                New Summary
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                        >
                            Close
                        </button>
                        {summary && (
                            <button
                                onClick={() => {
                                    showToast('Interview summary saved to candidate profile.', 'success');
                                    onClose();
                                }}
                                className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                                <CheckCircle size={18} />
                                Save Summary
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InterviewNotesSummarizerModal;
