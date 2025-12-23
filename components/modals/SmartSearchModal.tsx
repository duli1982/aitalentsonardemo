import React, { useState } from 'react';
import { X, Search, Sparkles, Loader2, TrendingUp, Briefcase, User } from 'lucide-react';
import { semanticSearchService, SemanticSearchResult } from '../../services/SemanticSearchService';
import { degradedModeService } from '../../services/DegradedModeService';
import { unknown } from '../../services/errorHandling';

interface SmartSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectCandidate?: (result: SemanticSearchResult) => void;
}

const SmartSearchModal: React.FC<SmartSearchModalProps> = ({
    isOpen,
    onClose,
    onSelectCandidate
}) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<SemanticSearchResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsSearching(true);
        setError(null);
        setHasSearched(true);

        try {
            const searchResults = await semanticSearchService.search(query, {
                threshold: 0.6,
                limit: 10
            });

            const list = searchResults.success ? searchResults.data : searchResults.data ?? [];
            setResults(list);

            if (!searchResults.success) {
                degradedModeService.report({
                    feature: 'smart_search',
                    error: searchResults.error,
                    retryAfterMs: searchResults.retryAfterMs,
                    lastUpdatedAt: new Date().toISOString(),
                    whatMightBeMissing: 'Search results may be incomplete.',
                    input: { query, threshold: 0.6, limit: 10 }
                });
            }

            if (list.length === 0) {
                setError('No candidates found matching your query. Try different keywords or lower the similarity threshold.');
            } else if (!searchResults.success) {
                setError(searchResults.error.message);
            }
        } catch (err) {
            const appErr = unknown('SmartSearchModal', 'Search threw unexpectedly.', err);
            degradedModeService.report({
                feature: 'smart_search',
                error: appErr,
                lastUpdatedAt: new Date().toISOString(),
                whatMightBeMissing: 'Search results may be incomplete.',
                input: { query, threshold: 0.6, limit: 10 }
            });
            setError(appErr.message);
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isSearching) {
            handleSearch();
        }
    };

    const getCandidateTypeLabel = (type: string) => {
        switch (type) {
            case 'internal': return 'Internal';
            case 'past': return 'Past Candidate';
            case 'uploaded': return 'External';
            default: return type;
        }
    };

    const getCandidateTypeColor = (type: string) => {
        switch (type) {
            case 'internal': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'past': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'uploaded': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl my-8 border border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">AI Smart Search</h2>
                            <p className="text-sm text-slate-400">Search the Knowledge Graph with natural language</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-6 border-b border-slate-700">
                    <div className="flex space-x-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="e.g., Senior React developer with team leadership experience..."
                                className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                disabled={isSearching}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isSearching || !query.trim()}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {isSearching ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Searching...</span>
                                </>
                            ) : (
                                <>
                                    <Search className="h-5 w-5" />
                                    <span>Search</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Example Queries */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="text-sm text-slate-400">Try:</span>
                        {[
                            'Python developer with ML experience',
                            'Project manager with Agile certification',
                            'Designer with Figma skills'
                        ].map((example) => (
                            <button
                                key={example}
                                onClick={() => setQuery(example)}
                                className="text-sm px-3 py-1 bg-slate-900 hover:bg-slate-700 text-slate-300 rounded-full transition-colors"
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results */}
                <div className="p-6 max-h-[500px] overflow-y-auto">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-start space-x-3">
                            <div className="p-1 bg-red-500/20 rounded">
                                <X className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium">Search Error</p>
                                <p className="text-sm mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {!hasSearched && !error && (
                        <div className="text-center py-12 text-slate-400">
                            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">Enter a natural language query to search</p>
                            <p className="text-sm mt-2">AI will find the most relevant candidates from the Knowledge Graph</p>
                        </div>
                    )}

                    {hasSearched && !isSearching && results.length === 0 && !error && (
                        <div className="text-center py-12 text-slate-400">
                            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">No matches found</p>
                            <p className="text-sm mt-2">Try adjusting your search terms</p>
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-slate-400">
                                    Found <span className="text-white font-semibold">{results.length}</span> candidates
                                </p>
                                <div className="flex items-center space-x-2 text-xs text-slate-400">
                                    <TrendingUp className="h-4 w-4" />
                                    <span>Sorted by relevance</span>
                                </div>
                            </div>

                            {results.map((result) => (
                                <div
                                    key={result.id}
                                    className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-purple-500/50 transition-all cursor-pointer"
                                    onClick={() => onSelectCandidate?.(result)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <h3 className="text-lg font-semibold text-white">
                                                    {result.name}
                                                </h3>
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${getCandidateTypeColor(result.type)}`}>
                                                    {getCandidateTypeLabel(result.type)}
                                                </span>
                                            </div>
                                            {result.email && (
                                                <p className="text-sm text-slate-400">{result.email}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center space-x-1 text-purple-400">
                                                <Sparkles className="h-4 w-4" />
                                                <span className="text-sm font-bold">
                                                    {Math.round(result.similarity * 100)}%
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">Match</p>
                                        </div>
                                    </div>

                                    {result.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {result.skills.slice(0, 6).map((skill, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                            {result.skills.length > 6 && (
                                                <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs">
                                                    +{result.skills.length - 6} more
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {result.metadata?.experienceYears !== undefined && (
                                        <div className="flex items-center space-x-4 text-sm text-slate-400">
                                            <div className="flex items-center space-x-1">
                                                <Briefcase className="h-4 w-4" />
                                                <span>{result.metadata.experienceYears} years experience</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-900/50">
                    <p className="text-xs text-slate-500 text-center">
                        Powered by AI vector embeddings • Results ranked by semantic similarity
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SmartSearchModal;
