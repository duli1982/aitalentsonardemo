import React, { useState } from 'react';
import { Search, User, Sparkles, Loader2 } from 'lucide-react';
import { parseCandidateQuery, FilterCriteria } from '../../services/geminiService';

interface CandidateFiltersProps {
    searchTerm: string;
    onSearchChange: (term: string) => void;
    typeFilter: 'all' | 'internal' | 'past' | 'uploaded';
    onTypeFilterChange: (type: 'all' | 'internal' | 'past' | 'uploaded') => void;
    onAiFilterUpdate?: (criteria: FilterCriteria) => void;
    variant?: 'full' | 'compact';
    showAiSearch?: boolean;
    showTitle?: boolean;
}

const CandidateFilters: React.FC<CandidateFiltersProps> = ({
    searchTerm,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    onAiFilterUpdate,
    variant = 'full',
    showAiSearch = true,
    showTitle = true
}) => {
    const [aiQuery, setAiQuery] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const handleAiSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiQuery.trim()) return;

        setIsAiLoading(true);
        try {
            const criteria = await parseCandidateQuery(aiQuery);
            if (onAiFilterUpdate) {
                onAiFilterUpdate(criteria);
            }
        } catch (error) {
            console.error("AI Search failed", error);
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className={`${variant === 'compact' ? 'space-y-2' : 'space-y-4'} ${variant === 'compact' ? '' : 'p-4 border-b border-slate-700'}`}>
            {showTitle && (
                <h2 className="text-xl font-semibold text-sky-400 flex items-center">
                    <User className="mr-2 h-5 w-5" /> Talent Pool
                </h2>
            )}

            {/* AI Search Bar */}
            {showAiSearch && (
                <form onSubmit={handleAiSearch} className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-sky-600 rounded-lg opacity-30 group-hover:opacity-75 transition duration-200 blur"></div>
                    <div className="relative flex items-center bg-slate-800 rounded-lg p-1">
                        <Sparkles className={`ml-2 h-4 w-4 ${isAiLoading ? 'animate-spin text-purple-400' : 'text-purple-400'}`} />
                        <input
                            type="text"
                            placeholder="Ask AI: 'Find internal React devs'..."
                            className="w-full p-2 bg-transparent border-none focus:ring-0 outline-none text-sm text-white placeholder-gray-500"
                            value={aiQuery}
                            onChange={(e) => setAiQuery(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isAiLoading}
                            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-xs font-medium text-gray-300 transition-colors"
                        >
                            {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : 'Ask'}
                        </button>
                    </div>
                </form>
            )}

            <div className="relative">
                <input
                    type="text"
                    placeholder="Filter by name..."
                    className="w-full p-2 pl-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none text-sm text-white"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>

            <div className="flex gap-2">
                <select
                    className="flex-1 p-2 rounded-md bg-slate-700 border border-slate-600 text-sm text-white outline-none focus:ring-2 focus:ring-sky-500"
                    value={typeFilter}
                    onChange={(e) => onTypeFilterChange(e.target.value as any)}
                >
                    <option value="all">All Types</option>
                    <option value="internal">Internal</option>
                    <option value="past">Past Applicants</option>
                    <option value="uploaded">Uploaded</option>
                </select>
            </div>
        </div>
    );
};

export default CandidateFilters;
