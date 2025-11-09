import React from 'react';
import type { Candidate, Job, InternalCandidate, PastCandidate, UploadedCandidate } from '../../types';
import { X, User, Mail, Briefcase, Star, Target, FileText, Calendar, Building2, TrendingUp, Award } from 'lucide-react';

interface CandidateProfileModalProps {
  candidate: Candidate;
  job: Job;
  onClose: () => void;
}

const CandidateProfileModal: React.FC<CandidateProfileModalProps> = ({
  candidate,
  job,
  onClose
}) => {
  const matchScore = candidate.matchScores?.[job.id];
  const matchRationale = candidate.matchRationales?.[job.id];

  const getCandidateTypeLabel = () => {
    switch (candidate.type) {
      case 'internal':
        return 'Internal Candidate';
      case 'past':
        return 'Past Applicant';
      case 'uploaded':
        return 'External Candidate';
      default:
        return 'Candidate';
    }
  };

  const getCandidateDetails = () => {
    if (candidate.type === 'internal') {
      const internalCandidate = candidate as InternalCandidate;
      return {
        role: internalCandidate.currentRole,
        department: internalCandidate.department,
        experience: `${internalCandidate.experienceYears} years`,
        performanceRating: internalCandidate.performanceRating,
        careerAspirations: internalCandidate.careerAspirations,
        developmentGoals: internalCandidate.developmentGoals,
      };
    } else if (candidate.type === 'past') {
      const pastCandidate = candidate as PastCandidate;
      return {
        previousRole: pastCandidate.previousRoleAppliedFor,
        lastContact: pastCandidate.lastContactDate,
        notes: pastCandidate.notes,
      };
    } else if (candidate.type === 'uploaded') {
      const uploadedCandidate = candidate as UploadedCandidate;
      return {
        summary: uploadedCandidate.summary,
        experience: `${uploadedCandidate.experienceYears} years`,
        fileName: uploadedCandidate.fileName,
      };
    }
    return {};
  };

  const details = getCandidateDetails();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onClick={onClose}>
      <div
        className="bg-slate-800 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-slate-700">
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-sky-500/20 p-3 rounded-full">
                <User className="h-6 w-6 text-sky-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-sky-400">{candidate.name}</h2>
                <p className="text-sm text-gray-400">{getCandidateTypeLabel()}</p>
              </div>
            </div>
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
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Match Score Section */}
          <div className="bg-gradient-to-br from-purple-900/30 to-sky-900/30 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-sky-300 flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Match for: {job.title}
              </h3>
              <div className="text-right">
                <div className={`text-4xl font-bold ${matchScore && matchScore > 75 ? 'text-green-400' : matchScore && matchScore > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {typeof matchScore === 'number' ? `${matchScore}%` : 'N/A'}
                </div>
                <p className="text-xs text-gray-400">Match Score</p>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-sky-400 mb-2">Why this score?</h4>
              <p className="text-sm text-gray-300 italic">
                {matchRationale || 'No detailed analysis available yet. Run AI Fit Analysis for comprehensive insights.'}
              </p>
            </div>
          </div>

          {/* Contact & Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-700/40 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-sky-300 mb-3 flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Contact Information
              </h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">
                  <span className="text-gray-500">Email:</span> {candidate.email}
                </p>
                {candidate.linkedInProfileUrl && (
                  <p className="text-gray-300">
                    <span className="text-gray-500">LinkedIn:</span>{' '}
                    <a href={candidate.linkedInProfileUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                      View Profile
                    </a>
                  </p>
                )}
                {candidate.githubProfileUrl && (
                  <p className="text-gray-300">
                    <span className="text-gray-500">GitHub:</span>{' '}
                    <a href={candidate.githubProfileUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                      View Profile
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-700/40 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-sky-300 mb-3 flex items-center">
                <Briefcase className="h-4 w-4 mr-2" />
                Professional Details
              </h3>
              <div className="space-y-2 text-sm">
                {candidate.type === 'internal' && (
                  <>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Current Role:</span> {details.role}
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Department:</span> {details.department}
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Experience:</span> {details.experience}
                    </p>
                    <p className="text-gray-300 flex items-center">
                      <span className="text-gray-500 mr-2">Performance:</span>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < (details.performanceRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                          />
                        ))}
                      </div>
                    </p>
                  </>
                )}
                {candidate.type === 'past' && (
                  <>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Applied For:</span> {details.previousRole}
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Last Contact:</span> {details.lastContact}
                    </p>
                  </>
                )}
                {candidate.type === 'uploaded' && (
                  <>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Experience:</span> {details.experience}
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Source:</span> {details.fileName}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Key Skills */}
          <div className="bg-slate-700/40 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-sky-300 mb-3 flex items-center">
              <Award className="h-4 w-4 mr-2" />
              Key Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map(skill => {
                const isJobRequirement = job.requiredSkills.some(
                  reqSkill => reqSkill.toLowerCase() === skill.toLowerCase()
                );
                return (
                  <span
                    key={skill}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      isJobRequirement
                        ? 'bg-green-500/20 text-green-300 ring-1 ring-green-500/50'
                        : 'bg-slate-600/50 text-gray-300'
                    }`}
                  >
                    {skill}
                    {isJobRequirement && ' ✓'}
                  </span>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              ✓ indicates skills matching the job requirements
            </p>
          </div>

          {/* Experience Summary / Notes */}
          {(candidate.experienceSummary || details.summary || details.notes || details.careerAspirations) && (
            <div className="bg-slate-700/40 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-sky-300 mb-3 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                {candidate.type === 'internal' ? 'Career Information' : candidate.type === 'past' ? 'Previous Application Notes' : 'Professional Summary'}
              </h3>
              <div className="space-y-3 text-sm text-gray-300">
                {candidate.experienceSummary && (
                  <div>
                    <p className="font-medium text-gray-400 mb-1">Summary:</p>
                    <p className="italic">{candidate.experienceSummary}</p>
                  </div>
                )}
                {details.summary && (
                  <div>
                    <p className="italic">{details.summary}</p>
                  </div>
                )}
                {details.careerAspirations && (
                  <div>
                    <p className="font-medium text-gray-400 mb-1">Career Aspirations:</p>
                    <p className="italic">{details.careerAspirations}</p>
                  </div>
                )}
                {details.developmentGoals && (
                  <div>
                    <p className="font-medium text-gray-400 mb-1">Development Goals:</p>
                    <p className="italic">{details.developmentGoals}</p>
                  </div>
                )}
                {details.notes && (
                  <div>
                    <p className="font-medium text-gray-400 mb-1">Notes:</p>
                    <p className="italic">{details.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CV/Resume Section */}
          {candidate.type === 'uploaded' && details.fileName && (
            <div className="bg-gradient-to-br from-sky-900/20 to-blue-900/20 border border-sky-500/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-sky-300 mb-3 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                CV / Resume
              </h3>
              <div className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center">
                  <div className="bg-sky-500/20 p-2 rounded">
                    <FileText className="h-5 w-5 text-sky-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-200">{details.fileName}</p>
                    <p className="text-xs text-gray-500">Uploaded CV/Resume</p>
                  </div>
                </div>
                <button
                  onClick={() => alert('CV viewing would open in a new window or download the file')}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  View CV
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                Original document available for detailed review
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CandidateProfileModal;
