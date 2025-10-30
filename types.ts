

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requiredSkills: string[];
  postedDate: string;
  status: 'open' | 'closed' | 'on hold';
  companyContext?: {
    industry?: string;
    companySize?: string;
    reportingStructure?: string;
    roleContextNotes?: string;
  }
}

export interface CandidateBase {
  id: string;
  name: string;
  skills: string[];
  email: string;
  isHiddenGem?: boolean;
  matchScores?: { [jobId: string]: number };
  matchRationales?: { [jobId: string]: string };
  linkedInProfileUrl?: string;
  githubProfileUrl?: string;
  profileStatus?: 'complete' | 'partial' | 'placeholder';
  suggestedRoleTitle?: string;
  experienceSummary?: string;
  employmentStatus?: 'available' | 'interviewing' | 'hired';
  feedback?: { [jobId: string]: 'positive' | 'negative' | 'none' };
}

export interface InternalCandidate extends CandidateBase {
  type: 'internal';
  currentRole: string;
  department: string;
  experienceYears: number;
  performanceRating: number;
  careerAspirations: string;
  developmentGoals: string;
  learningAgility: number;
}

export interface PastCandidate extends CandidateBase {
  type: 'past';
  previousRoleAppliedFor: string;
  lastContactDate: string;
  notes: string;
}

export interface UploadedCandidate extends CandidateBase {
  type: 'uploaded';
  summary: string;
  experienceYears: number;
  fileName: string;
}

export type Candidate = InternalCandidate | PastCandidate | UploadedCandidate;

export enum AnalysisType {
  JOB_SUMMARY = 'JOB_SUMMARY',
  CANDIDATE_SUMMARY = 'CANDIDATE_SUMMARY',
  FIT_ANALYSIS = 'FIT_ANALYSIS',
  OUTREACH = 'OUTREACH',
  HIDDEN_GEM_ANALYSIS = 'HIDDEN_GEM_ANALYSIS',
  PROFILE_ENRICHMENT = 'PROFILE_ENRICHMENT',
}

export interface SkillRequirement {
    skill: string;
    level: 'must-have' | 'nice-to-have';
    rationale: string;
}

export interface JobAnalysis {
  keyResponsibilities: string[];
  idealCandidateProfile: string;
  suggestedSearchKeywords: string[];
  trueSeniorityLevel: string;
  seniorityRationale: string;
  growthPathways: string[];
  skillRequirements: SkillRequirement[];
}

export interface SkillGapAnalysisItem {
    skill: string;
    candidateProficiency: number;
    rationale: string;
}

export interface MultiDimensionalAnalysis {
    technicalSkillAlignment: {
        score: number;
        rationale: string;
    };
    transferableSkillMapping: {
        score: number;
        rationale: string;
    };
    careerStageAlignment: {
        score: number;
        rationale: string;
    };
    learningAgilityIndicators: {
        score: number;
        rationale: string;
    };
    teamFitSignals: {
        score: number;
        rationale: string;
    };
}

export interface FitAnalysis {
    matchScore: number;
    matchRationale: string;
    strengths: string[];
    gaps: string[];
    skillGapAnalysis: SkillGapAnalysisItem[];
    futurePotentialProjection: {
        suggestedFutureRole: string;
        estimatedTimeframe: string;
        potentialScore: number;
        rationale: string;
    };
    multiDimensionalAnalysis: MultiDimensionalAnalysis;
}

export interface HiddenGemAnalysis {
    gemRationale: string;
    transferableSkillsAnalysis: {
        skill: string;
        candidateEvidence: string;
        relevanceToJob: string;
    }[];
    unconventionalFitRationale: string;
}

export interface ProfileEnrichmentAnalysis {
    suggestedRoleTitle: string;
    experienceSummary: string;
    inferredSkills: string[];
}

export type AnalysisResult = JobAnalysis | FitAnalysis | HiddenGemAnalysis | ProfileEnrichmentAnalysis | string;