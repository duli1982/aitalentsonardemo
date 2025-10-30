
import React, { useState } from 'react';
import type { Job } from '../../types';
import { X, PlusCircle, Building2 } from 'lucide-react';

interface AddJobModalProps {
  onClose: () => void;
  onAddJob: (job: Job) => void;
}

const AddJobModal: React.FC<AddJobModalProps> = ({ onClose, onAddJob }) => {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [status, setStatus] = useState<'open' | 'closed' | 'on hold'>('open');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [reportingStructure, setReportingStructure] = useState('');
  const [roleContextNotes, setRoleContextNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    const newJob: Job = {
      id: `job-${Date.now()}`,
      title,
      department,
      location,
      description,
      requiredSkills: skills.split(',').map(s => s.trim()).filter(Boolean),
      type: 'Full-time', // Default value
      postedDate: new Date().toISOString().split('T')[0],
      status,
      companyContext: {
        industry,
        companySize,
        reportingStructure,
        roleContextNotes,
      }
    };
    onAddJob(newJob);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-sky-400 flex items-center">
            <PlusCircle className="h-6 w-6 mr-2" /> Add New Job Requisition
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-sky-300/80 mb-1">Job Title</label>
            <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-sky-300/80 mb-1">Department</label>
              <input id="department" type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-sky-300/80 mb-1">Location</label>
              <input id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
            </div>
          </div>
           <div>
            <label htmlFor="status" className="block text-sm font-medium text-sky-300/80 mb-1">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'open' | 'closed' | 'on hold')}
              className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none"
            >
              <option value="open">Open</option>
              <option value="on hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-sky-300/80 mb-1">Job Description</label>
            <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={8} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none resize-y custom-scrollbar" />
          </div>
          <div>
            <label htmlFor="skills" className="block text-sm font-medium text-sky-300/80 mb-1">Required Skills (comma-separated)</label>
            <input id="skills" type="text" value={skills} onChange={e => setSkills(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
          </div>

          <div className="pt-2">
            <h4 className="text-lg font-semibold text-sky-400 flex items-center mb-2 border-t border-slate-700 pt-4">
              <Building2 className="h-5 w-5 mr-2" /> Company & Role Context
            </h4>
            <p className="text-xs text-slate-400 mb-3">Provide context to improve AI analysis of seniority and skill requirements.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="industry" className="block text-sm font-medium text-sky-300/80 mb-1">Industry</label>
                    <input id="industry" type="text" placeholder="e.g., SaaS, E-commerce" value={industry} onChange={e => setIndustry(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
                  </div>
                  <div>
                    <label htmlFor="companySize" className="block text-sm font-medium text-sky-300/80 mb-1">Company Size</label>
                    <input id="companySize" type="text" placeholder="e.g., 500-1000 employees" value={companySize} onChange={e => setCompanySize(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
                  </div>
              </div>
              <div>
                <label htmlFor="reportingStructure" className="block text-sm font-medium text-sky-300/80 mb-1">Reporting Structure</label>
                <input id="reportingStructure" type="text" placeholder="e.g., Reports to Engineering Manager" value={reportingStructure} onChange={e => setReportingStructure(e.target.value)} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none" />
              </div>
               <div>
                <label htmlFor="roleContextNotes" className="block text-sm font-medium text-sky-300/80 mb-1">Internal Role Context / Notes</label>
                <textarea id="roleContextNotes" placeholder="e.g., At our company, 'Senior' implies team mentorship. Progression is to 'Staff'." value={roleContextNotes} onChange={e => setRoleContextNotes(e.target.value)} rows={3} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none resize-y custom-scrollbar" />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold transition-all">Add Job</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddJobModal;