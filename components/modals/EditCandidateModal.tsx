import React, { useState } from 'react';
import type { Candidate, InternalCandidate, PastCandidate } from '../../types';
import { X, Save } from 'lucide-react';

interface EditCandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSave: (updatedData: Partial<Candidate>) => void;
}

const EditCandidateModal: React.FC<EditCandidateModalProps> = ({ candidate, onClose, onSave }) => {
  // Common fields
  const [name, setName] = useState(candidate.name);
  const [email, setEmail] = useState(candidate.email);
  const [skills, setSkills] = useState(candidate.skills.join(', '));
  const [suggestedRoleTitle, setSuggestedRoleTitle] = useState(candidate.suggestedRoleTitle || (candidate.type === 'internal' ? candidate.currentRole : ''));
  const [experienceSummary, setExperienceSummary] = useState(candidate.experienceSummary || '');
  const [linkedInProfileUrl, setLinkedInProfileUrl] = useState(candidate.linkedInProfileUrl || '');
  const [githubProfileUrl, setGithubProfileUrl] = useState(candidate.githubProfileUrl || '');

  // Internal candidate fields
  const [currentRole, setCurrentRole] = useState(candidate.type === 'internal' ? candidate.currentRole : '');
  const [department, setDepartment] = useState(candidate.type === 'internal' ? candidate.department : '');

  // Past candidate fields
  const [notes, setNotes] = useState(candidate.type === 'past' ? candidate.notes : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updatedData: Partial<Candidate> = {
      name,
      email,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      suggestedRoleTitle,
      experienceSummary,
      linkedInProfileUrl,
      githubProfileUrl,
      profileStatus: 'complete',
    };

    if (candidate.type === 'internal') {
      updatedData = { ...updatedData, currentRole, department } as Partial<InternalCandidate>;
    }
    if (candidate.type === 'past') {
      updatedData = { ...updatedData, notes } as Partial<PastCandidate>;
    }
    
    onSave(updatedData);
    console.log(`FEEDBACK LOOP (Correction Learning): User corrected profile for ${candidate.name}. This diff would be sent to the backend to fine-tune the CV parsing and enrichment models.`, { original: candidate, corrected: { ...candidate, ...updatedData} });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-sky-400">Edit Candidate Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-sky-300/80 mb-1">Full Name</label>
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-sky-300/80 mb-1">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
          </div>
          <div>
            <label htmlFor="roleTitle" className="block text-sm font-medium text-sky-300/80 mb-1">Role Title</label>
            <input id="roleTitle" type="text" value={suggestedRoleTitle} onChange={e => setSuggestedRoleTitle(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
          </div>
          <div>
            <label htmlFor="summary" className="block text-sm font-medium text-sky-300/80 mb-1">Professional Summary</label>
            <textarea id="summary" value={experienceSummary} onChange={e => setExperienceSummary(e.target.value)} rows={4} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none resize-y custom-scrollbar" />
          </div>
          <div>
            <label htmlFor="skills" className="block text-sm font-medium text-sky-300/80 mb-1">Skills (comma-separated)</label>
            <input id="skills" type="text" value={skills} onChange={e => setSkills(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="linkedin" className="block text-sm font-medium text-sky-300/80 mb-1">LinkedIn Profile URL</label>
              <input id="linkedin" type="text" value={linkedInProfileUrl} onChange={e => setLinkedInProfileUrl(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
            <div>
              <label htmlFor="github" className="block text-sm font-medium text-sky-300/80 mb-1">GitHub Profile URL</label>
              <input id="github" type="text" value={githubProfileUrl} onChange={e => setGithubProfileUrl(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
          </div>
          
          {candidate.type === 'internal' && (
            <div className="pt-2 border-t border-slate-700 mt-4">
              <h4 className="text-lg font-semibold text-sky-400 mt-2 mb-2">Internal Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="currentRole" className="block text-sm font-medium text-sky-300/80 mb-1">Current Role</label>
                    <input id="currentRole" type="text" value={currentRole} onChange={e => setCurrentRole(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
                  </div>
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-sky-300/80 mb-1">Department</label>
                    <input id="department" type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
                  </div>
              </div>
            </div>
          )}
          
          {candidate.type === 'past' && (
             <div className="pt-2 border-t border-slate-700 mt-4">
                <h4 className="text-lg font-semibold text-sky-400 mt-2 mb-2">Past Applicant Details</h4>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-sky-300/80 mb-1">Notes</label>
                  <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none resize-y custom-scrollbar" />
                </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold transition-all flex items-center">
              <Save size={16} className="mr-2"/> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCandidateModal;