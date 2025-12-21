import React, { useState } from 'react';
import type { Job } from '../../types';
import { X, PlusCircle, Sparkles, Loader2, CheckCircle, Edit2, ArrowRight, ArrowLeft } from 'lucide-react';
import * as geminiService from '../../services/geminiService';

interface AddJobModalProps {
  onClose: () => void;
  onAddJob: (job: Job) => void;
}

type Step = 'input' | 'review' | 'creating';

const AddJobModal: React.FC<AddJobModalProps> = ({ onClose, onAddJob }) => {
  const [step, setStep] = useState<Step>('input');
  const [rawDescription, setRawDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Extracted and editable fields
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [mustHaveSkills, setMustHaveSkills] = useState<string[]>([]);
  const [niceToHaveSkills, setNiceToHaveSkills] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState('');
  const [keyResponsibilities, setKeyResponsibilities] = useState<string[]>([]);

  const handleAnalyzeDescription = async () => {
    if (!rawDescription.trim()) {
      setAnalysisError('Please enter a job description');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const extracted = await geminiService.extractJobRequirements(rawDescription);

      // Populate fields with extracted data
      setTitle(extracted.suggestedTitle);
      setDepartment(extracted.suggestedDepartment);
      setLocation(extracted.suggestedLocation);
      setDescription(extracted.cleanedDescription);
      setMustHaveSkills(extracted.mustHaveSkills);
      setNiceToHaveSkills(extracted.niceToHaveSkills);
      setExperienceLevel(extracted.experienceLevel);
      setKeyResponsibilities(extracted.keyResponsibilities);

      setStep('review');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze job description');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateJob = () => {
    if (!title || !description) {
      setAnalysisError('Title and description are required');
      return;
    }

    const newJob: Job = {
      id: `job-${Date.now()}`,
      title,
      department,
      location,
      description,
      requiredSkills: [...mustHaveSkills, ...niceToHaveSkills],
      type: 'Full-time',
      postedDate: new Date().toISOString().split('T')[0],
      status: 'open',
      companyContext: {
        roleContextNotes: `Experience Level: ${experienceLevel}\n\nKey Responsibilities:\n${keyResponsibilities.map(r => `- ${r}`).join('\n')}`
      }
    };

    onAddJob(newJob);
    onClose();
  };

  const addSkill = (type: 'must' | 'nice', skill: string) => {
    if (!skill.trim()) return;
    if (type === 'must') {
      setMustHaveSkills([...mustHaveSkills, skill.trim()]);
    } else {
      setNiceToHaveSkills([...niceToHaveSkills, skill.trim()]);
    }
  };

  const removeSkill = (type: 'must' | 'nice', index: number) => {
    if (type === 'must') {
      setMustHaveSkills(mustHaveSkills.filter((_, i) => i !== index));
    } else {
      setNiceToHaveSkills(niceToHaveSkills.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <div>
            <h3 className="text-xl font-semibold text-sky-400 flex items-center">
              <Sparkles className="h-6 w-6 mr-2 text-yellow-400" />
              {step === 'input' && 'AI-Powered Job Creation'}
              {step === 'review' && 'Review & Edit Requirements'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {step === 'input' && 'Paste your job description and let AI extract the key requirements'}
              {step === 'review' && 'Confirm or adjust the extracted requirements before creating the job'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="rawDescription" className="block text-sm font-medium text-sky-300 mb-2">
                  Paste Job Description
                </label>
                <textarea
                  id="rawDescription"
                  value={rawDescription}
                  onChange={(e) => setRawDescription(e.target.value)}
                  placeholder="Paste the full job description here... (e.g., from LinkedIn, job board, or your draft)

Example:
We're looking for a Senior React Developer with 5+ years experience.
Must know TypeScript, React, and Node.js.
Nice to have: AWS, Docker, GraphQL.
You'll be building our core product features and mentoring junior developers..."
                  rows={15}
                  className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none resize-y custom-scrollbar text-sm"
                />
              </div>

              {analysisError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                  {analysisError}
                </div>
              )}

              <div className="bg-gradient-to-r from-purple-900/30 to-sky-900/30 border border-purple-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-purple-300 mb-2 flex items-center">
                  <Sparkles className="h-4 w-4 mr-2" />
                  How it works
                </h4>
                <ul className="text-xs text-gray-300 space-y-1">
                  <li>• AI analyzes your description to extract must-have vs nice-to-have skills</li>
                  <li>• Determines realistic experience level and responsibilities</li>
                  <li>• Suggests department and location if not specified</li>
                  <li>• You review and edit before creating the job</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              {/* Job Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-sky-300 mb-2">
                  Job Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Department & Location */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-sky-300 mb-2">
                    Department
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-sky-300 mb-2">
                    Location
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="experienceLevel" className="block text-sm font-medium text-sky-300 mb-2">
                    Experience Level
                  </label>
                  <input
                    id="experienceLevel"
                    type="text"
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Must-Have Skills */}
              <div>
                <label className="block text-sm font-medium text-sky-300 mb-2">
                  Must-Have Skills (Critical Requirements)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {mustHaveSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      {skill}
                      <button
                        onClick={() => removeSkill('must', index)}
                        className="hover:text-green-100"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a must-have skill..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill('must', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    className="flex-grow p-2 rounded-md bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              {/* Nice-to-Have Skills */}
              <div>
                <label className="block text-sm font-medium text-sky-300 mb-2">
                  Nice-to-Have Skills (Beneficial but not critical)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {niceToHaveSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      {skill}
                      <button
                        onClick={() => removeSkill('nice', index)}
                        className="hover:text-yellow-100"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a nice-to-have skill..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill('nice', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    className="flex-grow p-2 rounded-md bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-sky-300 mb-2">
                  Job Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none resize-y custom-scrollbar text-sm"
                />
              </div>

              {analysisError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
                  {analysisError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-6 flex justify-between">
          <div>
            {step === 'review' && (
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors"
            >
              Cancel
            </button>
            {step === 'input' && (
              <button
                onClick={handleAnalyzeDescription}
                disabled={isAnalyzing || !rawDescription.trim()}
                className="px-6 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Analyze with AI
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
            {step === 'review' && (
              <button
                onClick={handleCreateJob}
                className="px-6 py-2 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold transition-all flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Create Job & Find Candidates
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddJobModal;
