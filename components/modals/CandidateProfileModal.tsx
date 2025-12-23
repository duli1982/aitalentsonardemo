import React, { useEffect, useRef } from 'react';
import type { Candidate, Job, InternalCandidate, PastCandidate, UploadedCandidate } from '../../types';
import { X, User, Mail, Briefcase, Star, Target, FileText, Calendar, Building2, TrendingUp, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useToast } from '../../contexts/ToastContext';

interface CandidateProfileModalProps {
  isOpen: boolean;
  candidate: Candidate;
  jobs: Job[];
  jobContext?: Job;
  onClose: () => void;
  onInitiateAnalysis: (type: any, candidate: Candidate, job?: Job) => void;
  onUpdateCandidate: (candidateId: string, data: Partial<Candidate>) => void;
}

const CandidateProfileModal: React.FC<CandidateProfileModalProps> = ({
  isOpen,
  candidate,
  jobs,
  jobContext,
  onClose,
  onInitiateAnalysis,
  onUpdateCandidate
}) => {
  const { showToast } = useToast();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useEscapeKey({ active: isOpen, onEscape: onClose });

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const [showAllJobs, setShowAllJobs] = React.useState(false);
  const [showUnscoredJobs, setShowUnscoredJobs] = React.useState(false);

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

  const primaryJob = jobContext || jobs[0];
  const primaryScore = primaryJob ? candidate.matchScores?.[primaryJob.id] : undefined;
  const primaryRationale = primaryJob ? candidate.matchRationales?.[primaryJob.id] : undefined;

  const scoredJobs = jobs
    .map((job) => ({ job, score: candidate.matchScores?.[job.id], rationale: candidate.matchRationales?.[job.id] }))
    .filter((j) => typeof j.score === 'number')
    .sort((a, b) => (b.score as number) - (a.score as number));

  const matchedSkillsForPrimary =
    primaryJob && Array.isArray(candidate.skills)
      ? candidate.skills.filter((s) =>
          (primaryJob.requiredSkills || []).some((req) => req.toLowerCase() === s.toLowerCase())
        )
      : [];

  const otherSkillsPreview =
    primaryJob && Array.isArray(candidate.skills)
      ? candidate.skills.filter((s) => !matchedSkillsForPrimary.includes(s)).slice(0, 6)
      : [];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onClick={onClose}>
      <div
        className="bg-slate-800 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Candidate profile: ${candidate.name}`}
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
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Primary Job Match */}
          {primaryJob ? (
            <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-sky-300 flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Match for: <span className="ml-2 text-white truncate">{primaryJob.title}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    {primaryJob.department} • {primaryJob.location}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-3xl font-extrabold ${typeof primaryScore === 'number' && primaryScore >= 75 ? 'text-emerald-400' : typeof primaryScore === 'number' && primaryScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {typeof primaryScore === 'number' ? `${primaryScore}%` : '—'}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    {typeof primaryScore === 'number' ? 'Match Score' : 'Not Scored'}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Summary</div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {primaryRationale || 'No analysis summary available yet for this job.'}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => onInitiateAnalysis('FIT_ANALYSIS', candidate, primaryJob)}
                      className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-md transition-colors"
                    >
                      Run Detailed Analysis
                    </button>
                    <button
                      onClick={() => setShowAllJobs((v) => !v)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1"
                    >
                      {showAllJobs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {showAllJobs ? 'Hide other jobs' : 'Show other jobs'}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Skill Alignment</div>
                  {matchedSkillsForPrimary.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {matchedSkillsForPrimary.slice(0, 10).map((skill) => (
                        <span key={skill} className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-500/20">
                          {skill}
                        </span>
                      ))}
                      {matchedSkillsForPrimary.length > 10 && (
                        <span className="px-2 py-1 rounded-full text-xs bg-slate-700 text-slate-200 border border-slate-600">
                          +{matchedSkillsForPrimary.length - 10} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No required-skill overlap detected.</p>
                  )}

                  {otherSkillsPreview.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-3">
                      Other skills: {otherSkillsPreview.join(', ')}…
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-6">
              <p className="text-gray-400 italic">No active jobs to match against.</p>
            </div>
          )}

          {/* Other Jobs */}
          {showAllJobs && jobs.length > 0 && (
            <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-semibold text-sky-300 flex items-center">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Other Job Matches
                </h3>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={showUnscoredJobs}
                    onChange={(e) => setShowUnscoredJobs(e.target.checked)}
                    className="h-4 w-4 rounded bg-slate-800 border-slate-600"
                  />
                  Show unscored jobs
                </label>
              </div>

              <div className="space-y-2">
                {(showUnscoredJobs
                  ? jobs.map((job) => ({ job, score: candidate.matchScores?.[job.id], rationale: candidate.matchRationales?.[job.id] }))
                  : scoredJobs
                )
                  .filter((row) => !primaryJob || row.job.id !== primaryJob.id)
                  .slice(0, 12)
                  .map(({ job, score, rationale }) => (
                    <div key={job.id} className="flex items-start justify-between gap-3 bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate">{job.title}</div>
                        <div className="text-[11px] text-slate-400 truncate">{job.department}</div>
                        {rationale && <div className="text-xs text-slate-400 mt-2 line-clamp-2">{rationale}</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-lg font-bold ${typeof score === 'number' && score >= 75 ? 'text-emerald-400' : typeof score === 'number' && score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {typeof score === 'number' ? `${score}%` : 'N/A'}
                        </div>
                        <button
                          onClick={() => onInitiateAnalysis('FIT_ANALYSIS', candidate, job)}
                          className="mt-2 text-[11px] bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-md transition-colors"
                        >
                          Run Analysis
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              {!showUnscoredJobs && scoredJobs.length === 0 && (
                <p className="text-sm text-slate-400">No scored jobs for this candidate yet.</p>
              )}
            </div>
          )}

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
                const isJobRequirement = jobs.some(job =>
                  job.requiredSkills.some(reqSkill => reqSkill.toLowerCase() === skill.toLowerCase())
                );
                return (
                  <span
                    key={skill}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${isJobRequirement
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
              ✓ indicates skills matching requirements in one or more active jobs
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
                  onClick={() => showToast('CV viewing/downloading is not wired up yet in this demo.', 'info')}
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
