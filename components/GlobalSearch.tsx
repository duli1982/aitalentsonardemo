import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';

const GlobalSearch: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates, setSelectedJobId } = useData();
  const [query, setQuery] = useState('');
  useEffect(() => { if (isOpen) setQuery(''); }, [isOpen]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    const jobMatches = jobs.filter((job) => `${job.title} ${job.department} ${job.location} ${job.requiredSkills.join(' ')}`.toLowerCase().includes(term)).slice(0, 5).map((job) => ({ kind: 'Requisition', title: job.title, detail: `${job.department} · ${job.location}`, open: () => { setSelectedJobId(job.id); navigate(`/requisitions/${job.id}`); } }));
    const candidateMatches = [...internalCandidates, ...pastCandidates, ...uploadedCandidates].filter((candidate) => `${candidate.name} ${candidate.currentRole ?? candidate.role ?? ''} ${candidate.skills.join(' ')}`.toLowerCase().includes(term)).slice(0, 7).map((candidate) => ({ kind: 'Candidate', title: candidate.name, detail: `${candidate.currentRole ?? candidate.role ?? 'Candidate'} · ${candidate.skills.slice(0, 3).join(', ')}`, open: () => navigate(`/candidates/${candidate.id}`, { state: { candidate } }) }));
    return [...jobMatches, ...candidateMatches];
  }, [internalCandidates, jobs, navigate, pastCandidates, query, setSelectedJobId, uploadedCandidates]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/70 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}><div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center border-b border-slate-700 px-4"><Search className="h-5 w-5 text-sky-300" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates, roles, skills…" className="w-full bg-transparent px-3 py-4 text-base text-white outline-none placeholder:text-slate-500" /><button type="button" onClick={onClose} className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button></div><div className="max-h-[55vh] overflow-y-auto p-2">{query && !results.length && <p className="p-8 text-center text-sm text-slate-400">No candidates or requisitions found.</p>}{!query && <p className="p-6 text-sm text-slate-400">Start typing a candidate, requisition, location, or skill.</p>}{results.map((result, index) => <button key={`${result.kind}-${result.title}-${index}`} type="button" onClick={() => { result.open(); onClose(); }} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-slate-800"><div><p className="font-semibold text-white">{result.title}</p><p className="mt-1 text-sm text-slate-400">{result.detail}</p></div><span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-sky-200">{result.kind}</span></button>)}</div><div className="border-t border-slate-700 px-4 py-3 text-xs text-slate-500">Press <kbd className="rounded border border-slate-600 px-1.5 py-0.5 text-slate-300">Esc</kbd> to close</div></div></div>;
};
export default GlobalSearch;
