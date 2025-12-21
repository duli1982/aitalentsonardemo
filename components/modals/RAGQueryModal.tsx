import React, { useState } from 'react';
import { X, Sparkles, Loader2, User, TrendingUp, Copy, CheckCircle, MessageSquare, FileText, GitCompare, Brain } from 'lucide-react';
import { ragService, RAGResult } from '../../services/RAGService';

interface RAGQueryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type QueryTemplate = {
    id: string;
    icon: React.ReactNode;
    label: string;
    description: string;
    prompt: string;
};

const RAGQueryModal: React.FC<RAGQueryModalProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<RAGResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const templates: QueryTemplate[] = [
        {
            id: 'outreach',
            icon: <MessageSquare size={18} />,
            label: 'Outreach Email',
            description: 'Generate personalized outreach',
            prompt: 'Write a personalized outreach email to senior React developers in California for a Senior Frontend Engineer role at TechCorp'
        },
        {
            id: 'interview',
            icon: <FileText size={18} />,
            label: 'Interview Questions',
            description: 'Create tailored questions',
            prompt: 'Generate interview questions for ML engineers with Python and TensorFlow experience'
        },
        {
            id: 'compare',
            icon: <GitCompare size={18} />,
            label: 'Compare Candidates',
            description: 'Analyze and rank profiles',
            prompt: 'Compare candidates with DevOps experience and rank them based on Kubernetes, AWS, and CI/CD skills'
        },
        {
            id: 'summary',
            icon: <Brain size={18} />,
            label: 'Candidate Brief',
            description: 'Summarize profiles',
            prompt: 'Summarize the top 3 candidates for a Product Manager role, highlighting their unique strengths'
        }
    ];

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsSearching(true);
        setError(null);
        setResult(null);
        setCopied(false);

        try {
            const ragResult = await ragService.query({
                query: query.trim(),
                maxCandidates: 5
            });

            setResult(ragResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process query');
        } finally {
            setIsSearching(false);
        }
    };

    const handleTemplateClick = (template: QueryTemplate) => {
        setQuery(template.prompt);
        setResult(null);
        setError(null);
    };

    const handleCopyResponse = () => {
        if (result) {
            navigator.clipboard.writeText(result.response);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.metaKey) {
            handleSearch();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                                <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">RAG Query</h2>
                                <p className="text-sm text-slate-400">AI-powered responses with candidate context</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Templates */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-3">Quick Templates</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {templates.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => handleTemplateClick(template)}
                                    className="p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-700 hover:border-purple-500/50 rounded-lg text-left transition-all group"
                                >
                                    <div className="flex items-start space-x-2">
                                        <div className="text-purple-400 mt-0.5 group-hover:text-purple-300">
                                            {template.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white mb-0.5">{template.label}</div>
                                            <div className="text-xs text-slate-400">{template.description}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Query Input */}
                    <div>
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">
                            Your Query
                        </label>
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Example: Write a personalized outreach email to senior React developers in California..."
                            className="w-full h-28 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-slate-500">
                                Press Cmd/Ctrl + Enter to search
                            </p>
                            <button
                                onClick={handleSearch}
                                disabled={isSearching || !query.trim()}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 text-white text-sm font-medium rounded-lg transition-all disabled:cursor-not-allowed flex items-center space-x-2"
                            >
                                {isSearching ? (
                                    <>
                                        <Loader2 className="animate-spin h-4 w-4" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" />
                                        <span>Generate</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="space-y-4">
                            {/* Source Candidates */}
                            {result.sourceCandidates.length > 0 && (
                                <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-4">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <User className="h-4 w-4 text-purple-400" />
                                        <span className="text-sm font-semibold text-slate-300">
                                            Based on {result.sourceCandidates.length} candidate{result.sourceCandidates.length > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {result.sourceCandidates.map((candidate, index) => (
                                            <div key={candidate.id} className="flex items-center justify-between text-sm">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-slate-500">#{index + 1}</span>
                                                    <span className="text-white font-medium">{candidate.name}</span>
                                                    <span className="text-slate-400">•</span>
                                                    <span className="text-slate-400">{candidate.title}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-emerald-400 font-medium">
                                                        {Math.round(candidate.similarity * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* AI Response */}
                            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg border border-purple-500/30 p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                        <Brain className="h-4 w-4 text-purple-400" />
                                    <span className="text-sm font-semibold text-white">
                                        {result.generationMode === 'template' ? 'Template Response' : 'AI-Generated Response'}
                                    </span>
                                    </div>
                                    <button
                                        onClick={handleCopyResponse}
                                        className="flex items-center space-x-1 px-3 py-1 bg-slate-800/50 hover:bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 hover:text-white transition-colors"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckCircle className="h-3 w-3 text-emerald-400" />
                                                <span>Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-3 w-3" />
                                                <span>Copy</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
                                    {result.response}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-900/50">
                    <p className="text-xs text-slate-500 text-center">
                        RAG combines vector search with AI generation for context-aware, personalized responses
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RAGQueryModal;
