import React from 'react';
import { InterviewGuide } from '../../types';
import { X, Printer, MessageSquare, CheckCircle, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';

interface InterviewGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    guide: InterviewGuide | null;
    isLoading?: boolean;
}

const InterviewGuideModal: React.FC<InterviewGuideModalProps> = ({ isOpen, onClose, guide, isLoading }) => {
    if (!isOpen) return null;

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]" onClick={onClose}>
                <div className="bg-slate-900 shadow-2xl rounded-xl p-8 flex flex-col items-center border border-slate-700">
                    <Loader2 className="h-8 w-8 animate-spin text-sky-500 mb-3" />
                    <p className="text-gray-300 font-medium">Generating Interview Guide...</p>
                </div>
            </div>
        );
    }

    if (!guide) return null;

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
                            <MessageSquare className="text-purple-400" />
                            AI Interview Copilot
                        </h2>
                        <p className="text-gray-400 mt-1">
                            Custom guide for <span className="text-sky-400 font-medium">{guide.candidateName}</span> • {guide.jobTitle}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.print()}
                            className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            title="Print Guide"
                        >
                            <Printer size={20} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto custom-scrollbar p-8 space-y-8 bg-slate-900">
                    {guide.sections.map((section, index) => (
                        <div key={index} className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50">
                            <h3 className="text-xl font-semibold text-sky-300 mb-6 flex items-center gap-2">
                                <span className="bg-sky-500/10 text-sky-400 w-8 h-8 rounded-full flex items-center justify-center text-sm border border-sky-500/20">
                                    {index + 1}
                                </span>
                                {section.title ?? section.category}
                            </h3>

                            <div className="space-y-6">
                                {section.questions.map((q, qIndex) => (
                                    <div key={qIndex} className="group">
                                        <div className="flex gap-4">
                                            <div className="flex-grow">
                                                <p className="text-lg text-gray-200 font-medium mb-3 group-hover:text-white transition-colors">
                                                    "{q.question ?? q.text}"
                                                </p>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                                        <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                            <HelpCircle size={12} /> Why ask this?
                                                        </p>
                                                        <p className="text-sm text-gray-400 italic leading-relaxed">
                                                            {q.rationale ?? q.context}
                                                        </p>
                                                    </div>

                                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                                        <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                            <CheckCircle size={12} /> What to look for
                                                        </p>
                                                        <p className="text-sm text-gray-400 italic leading-relaxed">
                                                            {q.expectedSignal}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {qIndex < section.questions.length - 1 && (
                                            <div className="h-px bg-slate-700/50 my-6" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        Generated by AI based on candidate analysis. Use professional judgment.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Close Guide
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InterviewGuideModal;
