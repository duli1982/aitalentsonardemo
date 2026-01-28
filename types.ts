export type CandidateType = 'internal' | 'past' | 'uploaded';

export interface PipelineHistory {
  jobId: string;
  stage: PipelineStage;
  timestamp: string; // ISO string
  actorType?: 'agent' | 'user' | 'system';
  actorId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface Candidate {
  id: string;
  name: string;

  // Canonical label in this app (many screens branch on this).
  type?: CandidateType;

  // Core profile
  role?: string;
  company?: string; // legacy (past candidates)
  skills: string[];
  location?: string;
  email?: string;
  phone?: string;

  // Experience (both are used across the app; keep both for compatibility)
  experience?: number;
  experienceYears?: number;

  availability?: string;
  notes?: string;
  summary?: string;
  fileName?: string;
  resumeUrl?: string;
  uploadDate?: string;

  // Pipeline + scoring
  matchScore?: number;
  matchScores?: Record<string, number>; // jobId -> score
  matchRationales?: Record<string, string>; // jobId -> rationale
  matchRationale?: string;
  pipelineStage?: Record<string, PipelineStage>; // jobId -> stage
  pipelineHistory?: PipelineHistory[];
  stage?: PipelineStage; // legacy single stage (pipeline view)
  employmentStatus?: 'available' | 'interviewing' | 'hired' | 'passive';
  feedback?: Record<string, 'positive' | 'negative' | 'none'>;

  // Enrichment fields used by UI
  suggestedRoleTitle?: string;
  department?: string;
  currentRole?: string;
  tenure?: number;
  performanceRating?: number;
  careerAspirations?: string;
  developmentGoals?: string;

  // Generic metadata for Supabase/graph candidates.
  metadata?: Record<string, any>;

  isHiddenGem?: boolean;
  education?: string[];
  projects?: string[];

  demographics?: {
    gender: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say';
    educationType: 'Elite' | 'Traditional' | 'Bootcamp' | 'Self-taught';
    university?: string;
  };

  passport?: {
    verifiedSkills: {
      skillName: string;
      proficiencyLevel: number;
      verifiedAt: string;
      source: string;
      confidenceScore?: number;
      evidenceLink?: string;
    }[];
    badges: string[];
  };
}

export interface InternalCandidate extends Candidate {
  type?: 'internal';
  currentRole: string;
  department: string;
  tenure: number;
  performanceRating: number;
  careerAspirations?: string;
}

export interface PastCandidate extends Candidate {
  type?: 'past';
  previousRoleAppliedFor?: string;
  lastContactDate?: string;
  applicationDate?: string;
  rejectionReason?: string;
}

export interface UploadedCandidate extends Candidate {
  type?: 'uploaded';
  uploadDate?: string;
  summary?: string;
}

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type?: 'Full-time' | 'Contract' | 'Internship';
  salaryRange?: string;
  requiredSkills: string[];
  description: string;
  posted?: string;
  postedDate?: string;
  applicants?: number;
  status: 'open' | 'closed' | 'on hold';
  headcount?: number;
  companyContext?: {
    industry?: string;
    companySize?: string;
    reportingStructure?: string;
    roleContextNotes?: string;
    [key: string]: unknown;
  };
}

// --- Normalized snapshots for agents + UI boundaries ---
// These reduce contract drift by freezing a stable, minimal shape that can be safely persisted/logged.
export interface CandidateSnapshot {
  id: string;
  name: string;
  type: CandidateType;
  email: string;
  location: string;
  role: string;
  experienceYears: number;
  skills: string[];
  summary: string;
  capturedAt: string; // ISO
}

export interface JobSnapshot {
  id: string;
  title: string;
  department: string;
  location: string;
  requiredSkills: string[];
  description: string;
  status: Job['status'];
  companyContext?: Job['companyContext'];
  capturedAt: string; // ISO
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
  keyResponsibilities: string[];
  idealCandidateProfile: string;
  suggestedSearchKeywords: string[];
  trueSeniorityLevel: string;
  seniorityRationale: string;
  growthPathways: string[];
  skillRequirements: Array<{ skill: string; level: 'must-have' | 'nice-to-have'; rationale: string }>;
}

export interface MultiDimensionalAnalysis {
  technicalSkillAlignment: { score: number; rationale: string };
  transferableSkillMapping: { score: number; rationale: string };
  careerStageAlignment: { score: number; rationale: string };
  learningAgilityIndicators: { score: number; rationale: string };
  teamFitSignals: { score: number; rationale: string };
}

export interface FitAnalysis {
  matchScore: number; // 0-100
  matchRationale: string;
  strengths: string[];
  gaps: string[];
  multiDimensionalAnalysis?: MultiDimensionalAnalysis;
  skillGapAnalysis?: Array<{ skill: string; gapLevel: number; notes?: string }>;
  futurePotentialProjection?: {
    suggestedFutureRole: string;
    estimatedTimeframe: string;
    potentialScore: number;
    rationale: string;
  };
}

export interface ProfileEnrichmentAnalysis {
  suggestedRoleTitle: string;
  experienceSummary: string;
  inferredSkills: string[];
}

export interface HiddenGemAnalysis {
  gemRationale: string;
  unconventionalFitRationale: string;
  transferableSkillsAnalysis: Array<{
    skill: string;
    candidateEvidence: string;
    relevanceToJob: string;
  }>;
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

// --- Role Context Pack (optional intake) ---
export type RoleContextQuestionId =
  | 'success_90_days'
  | 'must_haves_top3'
  | 'nice_signals_top2'
  | 'dealbreakers'
  | 'location_reality'
  | 'reject_even_if_skills_match';

export interface RoleContextAnswer {
  // Multi-select support (preferred). For legacy data, `choice` may exist and will be normalized into `choices`.
  choices?: string[];
  choice?: string;
  otherText?: string;
}

export interface RoleContextPack {
  jobId: string;
  jobTitle?: string;
  answers: Record<RoleContextQuestionId, RoleContextAnswer>;
  notes?: string;
  updatedAt: string; // ISO
}

export type EvidenceSnippetSource = 'resume' | 'profile' | 'supabase_document' | 'manual_note' | 'inferred';

export interface EvidenceSnippet {
  text: string;
  source: EvidenceSnippetSource;
  ref?: string; // url/doc id/etc
}

export interface EvidenceReason {
  title: string;
  claim: string;
  snippet?: EvidenceSnippet;
}

export interface EvidencePack {
  version: 1;
  jobId: string;
  candidateId: string;
  matchReasons: EvidenceReason[]; // 3
  risk: { statement: string; mitigation: string };
  truthCheckPreviewQuestions: string[]; // 2
  missing: string[];
  confidence: number; // 0..1
  createdAt: string;
  method: 'deterministic' | 'ai';
  conspicuousOmissions?: { topic: string; reason: string }[];
  highStakesQuestions?: { question: string; expectedSignal: string; riskArea: string }[];

  preMortemAnalysis?: { failureMode: string; probability: string; prevention: string }[];
  referenceCheckGuide?: { question: string; context: string }[];
  day90Trajectory?: { period: string; focus: string; potentialRisk: string }[];
}

// --- NEW TYPES ---
export type AppView =
  | 'jobs'
  | 'candidates'
  | 'insights'
  | 'pipeline'
  | 'org-twin'
  | 'health'
  | 'forecast'
  | 'agents'
  | 'autonomous-agents'
  | 'agent-inbox'
  | 'mobility'
  | 'governance'
  | 'war-room';

export interface DepartmentInsight {
  department: string;
  topSkills: { skill: string; count: number }[];
}

export interface Skill {
  name: string;
  category: string;
}
