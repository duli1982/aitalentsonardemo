import React, { useRef, useCallback, useEffect } from 'react';
import type { Candidate } from '../../types';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { Search, CheckSquare, Square, Building2, GraduationCap, Briefcase, MapPin } from 'lucide-react';

interface CandidateListProps {
    candidates: Candidate[];
    selectedCandidateId: string | null;
    onSelectCandidate: (id: string) => void;
    totalCandidates: number;
    isLoading?: boolean;
    selectedForComparison?: string[];
    onToggleComparison?: (id: string) => void;
    comparisonMode?: boolean;
}

/**
 * Helper: Extract company and school data from candidate
 */
const getCompanySchoolData = (candidate: Candidate) => {
    const companies: string[] = [];
    const schools: string[] = [];

    // Try to get from metadata (for Supabase candidates)
    if ((candidate as any).companies) {
        companies.push(...(candidate as any).companies);
    }
    if ((candidate as any).schools) {
        schools.push(...(candidate as any).schools);
    }

    return { companies, schools };
};

/**
 * Helper: Get best match score across all jobs
 */
const getBestMatchScore = (candidate: Candidate): number | null => {
    if (!candidate.matchScores) return null;
    const scores = Object.values(candidate.matchScores).filter((s): s is number => typeof s === 'number');
    return scores.length > 0 ? Math.max(...scores) : null;
};

/**
 * Helper: Get match quality badge based on score
 */
const getMatchQuality = (score: number | null) => {
    if (score === null || typeof score !== 'number') return null;
    if (score >= 80) return { text: 'Excellent', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: '⭐' };
    if (score >= 60) return { text: 'Good', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '✓' };
    if (score >= 40) return { text: 'Moderate', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: '○' };
    return { text: 'Fair', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: '·' };
};

const CandidateList: React.FC<CandidateListProps> = ({ candidates, selectedCandidateId, onSelectCandidate, totalCandidates, isLoading, selectedForComparison = [], onToggleComparison, comparisonMode = false }) => {
    const listRef = useRef<HTMLDivElement>(null);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!candidates.length || comparisonMode) return;

        const currentIndex = candidates.findIndex(c => c.id === selectedCandidateId);

        if (e.key === 'ArrowDown' || e.key === 'j') {
            e.preventDefault();
            const nextIndex = currentIndex < candidates.length - 1 ? currentIndex + 1 : 0;
            onSelectCandidate(candidates[nextIndex].id);
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
            e.preventDefault();
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : candidates.length - 1;
            onSelectCandidate(candidates[prevIndex].id);
        }
    }, [candidates, selectedCandidateId, onSelectCandidate, comparisonMode]);

    useEffect(() => {
        const listElement = listRef.current;
        if (listElement) {
            listElement.addEventListener('keydown', handleKeyDown);
            return () => listElement.removeEventListener('keydown', handleKeyDown);
        }
    }, [handleKeyDown]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-full p-2 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="p-3 rounded-lg bg-slate-700/30 border border-transparent">
                        <div className="flex justify-between items-start mb-2">
                            <Skeleton width="60%" height="1.25rem" />
                            <Skeleton width="20%" height="1rem" variant="circular" />
                        </div>
                        <Skeleton width="80%" height="0.75rem" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div
            ref={listRef}
            tabIndex={0}
            className="flex flex-col h-full overflow-hidden focus:outline-none"
            role="listbox"
            aria-label="Candidate list"
        >
            <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
                {candidates.length > 0 ? (
                    candidates.map((candidate, index) => {
                        const isSelected = selectedForComparison.includes(candidate.id);
                        return (
                            <div
                                key={candidate.id}
                                style={{ animationDelay: `${index * 50}ms` }}
                                className="relative mb-3 animate-fade-in-up"
                            >
                                <button
                                    onClick={() => comparisonMode ? onToggleComparison?.(candidate.id) : onSelectCandidate(candidate.id)}
                                    role="option"
                                    aria-selected={selectedCandidateId === candidate.id}
                                    className={`w-full text-left p-4 rounded-xl transition-all duration-300 border relative overflow-hidden group ${isSelected && comparisonMode
                                        ? 'bg-purple-900/30 border-purple-500/50 shadow-lg shadow-purple-900/20'
                                        : selectedCandidateId === candidate.id
                                            ? 'bg-slate-800 shadow-lg shadow-sky-900/20 ring-1 ring-sky-500/50 border-transparent'
                                            : 'bg-slate-800/50 hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5 border-transparent hover:border-slate-700'
                                        }`}
                                >
                                    {selectedCandidateId === candidate.id && !comparisonMode && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-sky-400 to-blue-600 rounded-l-xl" />
                                    )}

                                    {comparisonMode && (
                                        <div className="absolute top-3 right-3">
                                            {isSelected ? (
                                                <CheckSquare size={20} className="text-purple-400" />
                                            ) : (
                                                <Square size={20} className="text-gray-500" />
                                            )}
                                        </div>
                                    )}

                                    {/* Enhanced Card Content */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`flex-1 ${comparisonMode ? 'pr-8' : ''}`}>
                                            <h3 className={`font-semibold text-base mb-1 ${isSelected && comparisonMode ? 'text-purple-300' :
                                                selectedCandidateId === candidate.id ? 'text-sky-300' : 'text-gray-100 group-hover:text-white'
                                                }`}>
                                                {candidate.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                                {((candidate as any).experienceYears || 0) > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Briefcase className="h-3 w-3" />
                                                        {(candidate as any).experienceYears} yrs
                                                    </span>
                                                )}
                                                {((candidate as any).location || candidate.location) && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {(candidate as any).location || candidate.location}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {!comparisonMode && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-sm ${candidate.type === 'internal' ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' :
                                                candidate.type === 'past' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' :
                                                    'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                                                }`}>
                                                {candidate.type}
                                            </span>
                                        )}
                                    </div>

                                    {/* Company and School Badges */}
                                    {(() => {
                                        const { companies, schools } = getCompanySchoolData(candidate);
                                        return (companies.length > 0 || schools.length > 0) && (
                                            <div className="mb-2 flex flex-wrap gap-1.5">
                                                {companies.slice(0, 1).map((company, idx) => (
                                                    <span key={idx} className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-300 text-[9px] px-1.5 py-0.5 rounded-full border border-purple-500/20">
                                                        <Building2 className="h-2.5 w-2.5" />
                                                        {company}
                                                    </span>
                                                ))}
                                                {schools.slice(0, 1).map((school, idx) => (
                                                    <span key={idx} className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-300 text-[9px] px-1.5 py-0.5 rounded-full border border-sky-500/20">
                                                        <GraduationCap className="h-2.5 w-2.5" />
                                                        {school}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* Match Score (if available) */}
                                    {(() => {
                                        const bestScore = getBestMatchScore(candidate);
                                        const quality = getMatchQuality(bestScore);
                                        return bestScore !== null && quality && (
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="text-sm font-bold text-green-400">
                                                    {bestScore}%
                                                </span>
                                                <span className={`inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full border ${quality.color}`}>
                                                    {quality.icon} {quality.text}
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {/* Skills */}
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {candidate.skills.slice(0, 4).map(skill => (
                                            <span key={skill} className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 border border-slate-600/50 text-gray-300 rounded text-nowrap">
                                                {skill}
                                            </span>
                                        ))}
                                        {candidate.skills.length > 4 && (
                                            <span className="text-[10px] px-1.5 py-0.5 text-gray-500">
                                                +{candidate.skills.length - 4}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <EmptyState
                        icon={Search}
                        title="No candidates found"
                        description="Try adjusting your search or filters to find what you're looking for."
                    />
                )}
            </div>

            <div className="p-3 bg-slate-700/50 text-xs text-center text-gray-400 border-t border-slate-700 flex justify-between items-center">
                <span className="hidden sm:inline text-gray-500">↑↓ Navigate</span>
                <span>Showing {candidates.length} of {totalCandidates}</span>
                <span className="hidden sm:inline text-gray-500">j/k keys</span>
            </div>
        </div>
    );
};

export default CandidateList;
