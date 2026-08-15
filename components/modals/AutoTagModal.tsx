import React, { useState, useEffect } from 'react';
import { X, Tag, Folder, Loader2, Sparkles, TrendingUp, AlertTriangle, Users, CheckCircle } from 'lucide-react';
import type { Candidate } from '../../types';
import * as geminiService from '../../services/geminiService';

interface AutoTagModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: Candidate;
    onApplyTags?: (tags: string[]) => void;
}

const AutoTagModal: React.FC<AutoTagModalProps> = ({ isOpen, onClose, candidate, onApplyTags }) => {
    const [tagging, setTagging] = useState<geminiService.CandidateTagging | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            generateTags();
        }
    }, [isOpen, candidate]);

    const generateTags = async () => {
        setIsLoading(true);
        try {
            const response = await geminiService.generateCandidateTagsResult(candidate);
            if (!response.success && 'error' in response) {
                throw new Error(response.error.message);
            }
            const result = response.data;
            setTagging(result);
            // Auto-select high-confidence tags
            const autoSelected = result.tags
                .filter(tag => tag.confidence >= 70)
                .map(tag => tag.name);
            setSelectedTags(autoSelected);
        } catch (error) {
            console.error('Error generating tags:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTag = (tagName: string) => {
        setSelectedTags(prev =>
            prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
        );
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'attribute': return <Sparkles size={14} className="text-purple-400" />;
            case 'readiness': return <CheckCircle size={14} className="text-green-400" />;
            case 'risk': return <AlertTriangle size={14} className="text-amber-400" />;
            case 'diversity': return <Users size={14} className="text-sky-400" />;
            default: return <Tag size={14} className="text-gray-400" />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'attribute': return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
            case 'readiness': return 'border-green-500/30 bg-green-500/10 text-green-300';
            case 'risk': return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
            case 'diversity': return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
            default: return 'border-gray-500/30 bg-gray-500/10 text-gray-300';
        }
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return 'text-green-400';
        if (confidence >= 60) return 'text-amber-400';
        return 'text-orange-400';
    };

    const handleApply = () => {
        if (onApplyTags) {
            onApplyTags(selectedTags);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]" onClick={onClose}>
            <div
                className="bg-slate-900 shadow-2xl rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Tag className="text-sky-400" />
                            AI Auto-Tagging
                        </h2>
                        <p className="text-gray-400 mt-1">
                            Smart tags and folder recommendations for {candidate.name}
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
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-12 w-12 animate-spin text-sky-500 mb-4" />
                            <p className="text-gray-300 font-medium">Analyzing candidate profile...</p>
                            <p className="text-gray-500 text-sm mt-2">Generating intelligent tags and recommendations</p>
                        </div>
                    ) : tagging ? (
                        <div className="space-y-6">
                            {/* Overall Assessment */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                    <TrendingUp className="text-sky-400" size={20} />
                                    Overall Assessment
                                </h3>
                                <p className="text-gray-300 leading-relaxed">{tagging.reasoning}</p>
                            </div>

                            {/* Suggested Tags */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Tag className="text-sky-400" size={20} />
                                    Suggested Tags
                                    <span className="text-xs text-gray-500 font-normal ml-2">
                                        ({selectedTags.length} selected)
                                    </span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {tagging.tags.map((tag, index) => {
                                        const isSelected = selectedTags.includes(tag.name);
                                        return (
                                            <button
                                                key={index}
                                                onClick={() => toggleTag(tag.name)}
                                                className={`text-left p-4 rounded-xl border transition-all ${isSelected
                                                    ? 'border-sky-500/50 bg-sky-500/10 shadow-lg shadow-sky-900/20'
                                                    : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {getCategoryIcon(tag.category)}
                                                        <span className={`text-sm font-semibold ${isSelected ? 'text-sky-300' : 'text-white'}`}>
                                                            {tag.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold ${getConfidenceColor(tag.confidence)}`}>
                                                            {tag.confidence}%
                                                        </span>
                                                        {isSelected && <CheckCircle size={16} className="text-sky-400" />}
                                                    </div>
                                                </div>
                                                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${getCategoryColor(tag.category)}`}>
                                                    {tag.category}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Smart Folders */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                    <Folder className="text-sky-400" size={20} />
                                    Recommended Smart Folders
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {tagging.smartFolders.map((folder, index) => (
                                        <span
                                            key={index}
                                            className="px-4 py-2 bg-gradient-to-r from-sky-500/20 to-blue-500/20 border border-sky-500/30 text-sky-300 rounded-lg text-sm font-medium flex items-center gap-2"
                                        >
                                            <Folder size={14} />
                                            {folder}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        <Sparkles size={14} className="inline text-purple-400 mr-1" />
                        High-confidence tags ({'>'}70%) are auto-selected
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={isLoading || selectedTags.length === 0}
                            className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            <Tag size={18} />
                            Apply {selectedTags.length} Tags
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutoTagModal;
