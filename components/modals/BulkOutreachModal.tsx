import React, { useState, useEffect } from 'react';
import { X, Mail, Loader2, Copy, Check, Send } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import * as geminiService from '../../services/geminiService';
import { useToast } from '../../contexts/ToastContext';

interface BulkOutreachModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: Candidate[];
    job: Job;
}

interface OutreachMessage {
    candidateId: string;
    candidateName: string;
    message: string;
    isEditing: boolean;
}

const BulkOutreachModal: React.FC<BulkOutreachModalProps> = ({ isOpen, onClose, candidates, job }) => {
    const { showToast } = useToast();
    const [messages, setMessages] = useState<OutreachMessage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && candidates.length > 0) {
            generateMessages();
        }
    }, [isOpen, candidates]);

    const generateMessages = async () => {
        setIsGenerating(true);
        try {
            const generatedMessages = await Promise.all(
                candidates.map(async (candidate) => {
                    const message = await geminiService.generateOutreachMessage(job, candidate);
                    return {
                        candidateId: candidate.id,
                        candidateName: candidate.name,
                        message,
                        isEditing: false
                    };
                })
            );
            setMessages(generatedMessages);
        } catch (error) {
            console.error('Error generating outreach messages:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (candidateId: string, message: string) => {
        navigator.clipboard.writeText(message);
        setCopiedId(candidateId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleEdit = (candidateId: string, newMessage: string) => {
        setMessages(prev => prev.map(m =>
            m.candidateId === candidateId ? { ...m, message: newMessage } : m
        ));
    };

    const toggleEdit = (candidateId: string) => {
        setMessages(prev => prev.map(m =>
            m.candidateId === candidateId ? { ...m, isEditing: !m.isEditing } : m
        ));
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
                            <Mail className="text-sky-400" />
                            Bulk AI Outreach
                        </h2>
                        <p className="text-gray-400 mt-1">
                            Personalized messages for {candidates.length} candidates • {job.title}
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
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-12 w-12 animate-spin text-sky-500 mb-4" />
                            <p className="text-gray-300 font-medium">Generating personalized messages...</p>
                            <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {messages.map((msg) => (
                                <div key={msg.candidateId} className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50 flex flex-col">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="text-lg font-semibold text-sky-300">{msg.candidateName}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">To: {candidates.find(c => c.id === msg.candidateId)?.email}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => toggleEdit(msg.candidateId)}
                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition-colors text-xs"
                                            >
                                                {msg.isEditing ? 'Done' : 'Edit'}
                                            </button>
                                            <button
                                                onClick={() => handleCopy(msg.candidateId, msg.message)}
                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                                title="Copy to clipboard"
                                            >
                                                {copiedId === msg.candidateId ? (
                                                    <Check size={16} className="text-green-400" />
                                                ) : (
                                                    <Copy size={16} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {msg.isEditing ? (
                                        <textarea
                                            value={msg.message}
                                            onChange={(e) => handleEdit(msg.candidateId, e.target.value)}
                                            className="flex-grow w-full p-3 bg-slate-900 border border-slate-600 rounded-lg text-gray-300 text-sm resize-none focus:ring-2 focus:ring-sky-500 outline-none"
                                            rows={12}
                                        />
                                    ) : (
                                        <div className="flex-grow bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                                            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                                                {msg.message}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        <Mail size={14} className="inline text-sky-400 mr-1" />
                        Review and customize each message before sending
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                showToast(`Simulated: ${messages.length} messages sent.`, 'success');
                                onClose();
                            }}
                            disabled={isGenerating}
                            className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <Send size={18} />
                            Send All Messages
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkOutreachModal;
