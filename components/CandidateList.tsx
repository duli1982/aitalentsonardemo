import React, { useState, useMemo } from 'react';
import type { Candidate } from '../types';
import { Search, Users, UserCheck, UploadCloud, Diamond } from 'lucide-react';

const CandidateListItem: React.FC<{ candidate: Candidate; isSelected: boolean; onSelect: () => void; }> = ({ candidate, isSelected, onSelect }) => {
    const getRoleInfo = () => {
        if (candidate.suggestedRoleTitle) return candidate.suggestedRoleTitle;
        switch (candidate.type) {
            case 'internal': return candidate.currentRole || 'Internal Candidate';
            case 'past': return `Past Applicant`;
            case 'uploaded': return `Uploaded CV`;
            default: return 'Candidate';
        }
    };

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left p-3 mb-2 rounded-lg flex items-center transition-all duration-200 ${isSelected ? 'bg-sky-600/30 ring-2 ring-sky-500' : 'bg-slate-700/50 hover:bg-slate-600/70'}`}
        >
            <div className="flex-grow mr-3">
                <h4 className={`font-semibold ${isSelected ? 'text-sky-300' : 'text-sky-400'}`}>{candidate.name}</h4>
                <p className="text-xs text-gray-400">{getRoleInfo()}</p>
            </div>
            <div className="flex items-center space-x-2">
                {candidate.profileStatus !== 'complete' && <div className="w-2 h-2 bg-amber-500 rounded-full" title="Incomplete Profile"></div>}
                {candidate.isHiddenGem && <Diamond className="h-4 w-4 text-amber-400 flex-shrink-0" />}
            </div>
        </button>
    );
};


const CandidateList: React.FC<{ candidates: Candidate[]; selectedCandidateId: string | null; onSelectCandidate: (id: string | null) => void; }> = ({ candidates, selectedCandidateId, onSelectCandidate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'internal' | 'past' | 'uploaded'>('all');

    const filteredCandidates = useMemo(() => {
        return candidates
            .filter(c => sourceFilter === 'all' || c.type === sourceFilter)
            .filter(c =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.skills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
            );
    }, [candidates, searchTerm, sourceFilter]);

    return (
        <div className="bg-slate-800/70 backdrop-blur-sm shadow-xl rounded-xl p-1 flex flex-col h-full">
            <div className="p-4">
                <h2 className="text-xl font-semibold text-sky-400 mb-3 flex items-center">
                    <Users className="mr-2 h-5 w-5" /> Talent Pool
                </h2>
                <div className="relative mb-2">
                    <input type="text" placeholder="Search by name or skill..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 pl-8 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                <div className="flex justify-around text-xs text-gray-400">
                    <button onClick={() => setSourceFilter('all')} className={sourceFilter === 'all' ? 'font-bold text-sky-400' : 'hover:text-sky-300'}>All</button>
                    <button onClick={() => setSourceFilter('internal')} className={sourceFilter === 'internal' ? 'font-bold text-sky-400' : 'hover:text-sky-300'}>Internal</button>
                    <button onClick={() => setSourceFilter('past')} className={sourceFilter === 'past' ? 'font-bold text-sky-400' : 'hover:text-sky-300'}>Past</button>
                    <button onClick={() => setSourceFilter('uploaded')} className={sourceFilter === 'uploaded' ? 'font-bold text-sky-400' : 'hover:text-sky-300'}>Uploaded</button>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto px-2 pb-2 custom-scrollbar min-h-0">
                {filteredCandidates.map(c => (
                    <CandidateListItem
                        key={c.id}
                        candidate={c}
                        isSelected={c.id === selectedCandidateId}
                        onSelect={() => onSelectCandidate(c.id)}
                    />
                ))}
            </div>
        </div>
    );
};

export default CandidateList;