// ... (keep existing interfaces)
export interface Candidate {
  id: string;
  name: string;
  role: string;
  type?: string;
  company?: string; // For past candidates
  skills: string[];
  experience: number;
  location: string;
  availability: string;
  matchScore?: number;
  matchScores?: Record<string, number>; // Job ID -> Score map
  matchRationales?: Record<string, string>; // Job ID -> rationale map
  matchRationale?: string;
  stage?: PipelineStage; // For pipeline view
  pipelineStage?: Record<string, PipelineStage>; // Job ID -> stage map
  source?: 'internal' | 'past' | 'uploaded';
  resumeUrl?: string;
  fileName?: string;
  education?: string[];
  projects?: string[];
  email?: string;
  phone?: string;
  employmentStatus?: 'available' | 'interviewing' | 'hired' | 'passive';
  notes?: string;
  feedback?: Record<string, 'positive' | 'negative' | 'none'>;
  isHiddenGem?: boolean;
  demographics?: {
    gender: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say';
    educationType: 'Elite' | 'Traditional' | 'Bootcamp' | 'Self-taught';
    university?: string;
  };
  passport?: {
    verifiedSkills: { skillName: string; proficiencyLevel: number; verifiedAt: string; source: string; }[];
    badges: string[];
  };
}

export interface InternalCandidate extends Candidate {
  currentRole: string;
  department: string;
  tenure: number;
  performanceRating: number;
  careerAspirations?: string;
}

export interface UploadedCandidate extends Candidate {
  uploadDate: string;
  source: 'uploaded';
  summary?: string;
}

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Internship';
  salaryRange: string;
  requiredSkills: string[];
  description: string;
  posted: string;
  applicants: number;
  status: 'open' | 'closed' | 'on hold';
}

// Recruiting phases:
// new -> long list -> screening -> interview scheduling -> interview -> offer -> hired -> rejected
export type PipelineStage =
  | 'sourced'
  | 'new'
  | 'long_list'
  | 'screening'
  | 'scheduling'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected';

export interface AnalysisResult {
  score: number;
  rationale: string[];
  strengths: string[];
  weaknesses: string[];
  culturalFit?: string;
  growthPotential?: string;
}

export type AnalysisType = 'JOB_SUMMARY' | 'FIT_ANALYSIS' | 'INTERVIEW_GUIDE' | 'COMPARE_CANDIDATES' | 'SMART_SEARCH_QUERY';

export interface JobAnalysis {
  keyRequirements: string[];
  technicalStack: string[];
  softSkills: string[];
  suggestedScreeningQuestions: string[];
  seniorityLevel: string;
}

export interface FitAnalysis {
  overallScore: number;
  technicalMatch: number;
  softSkillsMatch: number;
  culturalMatch: number;
  summary: string;
  pros: string[];
  cons: string[];
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'REJECT';
}

export interface InterviewGuide {
  candidateName: string;
  jobTitle: string;
  sections: {
    category: string;
    questions: {
      id: string;
      text: string;
      context: string; // Why ask this? based on resume/job delta
      expectedSignal: string; // What a good answer looks like
    }[];
  }[];
}

// --- NEW TYPES ---
export type AppView = 'jobs' | 'candidates' | 'insights' | 'pipeline' | 'org-twin' | 'health' | 'forecast' | 'agents' | 'autonomous-agents' | 'mobility' | 'governance' | 'war-room';

export interface DepartmentInsight {
  department: string;
  topSkills: { skill: string; count: number }[];
}

export interface Skill {
  name: string;
  category: string;
}
