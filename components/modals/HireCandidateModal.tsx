import React, { useState } from 'react';
import type { Job, Candidate } from '../../types';
import { X, Award } from 'lucide-react';

interface HireCandidateModalProps {
  job: Job;
  candidates: Candidate[];
  onClose: () => void;
  onHire: (candidateId: string, jobId: string) => void;
}

const HireCandidateModal: React.FC<HireCandidateModalProps> = ({ job, candidates, onClose, onHire }) => {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedCandidateId) {
      onHire(selectedCandidateId, job.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-sky-400 flex items-center">
            <Award className="h-6 w-6 mr-2 text-green-400" /> Who was hired for {job.title}?
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors"><X size={24} /></button>
        </div>
        <p className="text-sm text-gray-400 mb-4">Tracking this helps the AI learn what a successful outcome looks like for your company.</p>
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2 mb-4">
          {candidates.map(c => (
            <label key={c.id} className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${selectedCandidateId === c.id ? 'bg-sky-600/50 ring-2 ring-sky-500' : 'bg-slate-700/50 hover:bg-slate-600/70'}`}>
              <input type="radio" name="hired-candidate" value={c.id} checked={selectedCandidateId === c.id} onChange={() => setSelectedCandidateId(c.id)} className="mr-3 h-4 w-4" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium">Skip</button>
          <button onClick={handleSubmit} disabled={!selectedCandidateId} className="px-6 py-2 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold disabled:opacity-50">Confirm Hire</button>
        </div>
      </div>
    </div>
  );
};

export default HireCandidateModal;
