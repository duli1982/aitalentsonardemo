export type FairnessReportStatus = 'OK' | 'INSUFFICIENT_SAMPLE' | 'INSUFFICIENT_COVERAGE';

export type FairnessAlert = {
  type: 'GENDER_IMBALANCE' | 'EDUCATION_CONCENTRATION';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  suggestion: string;
};

export type FairnessBucket = { count: number; pct: number };

export type PipelineFairnessReport = {
  status: FairnessReportStatus;
  sampleSize: number;
  genderKnownCount: number;
  educationKnownCount: number;
  genderCoveragePct: number; // 0..1
  educationCoveragePct: number; // 0..1
  genderDistribution: Record<string, FairnessBucket>;
  educationDistribution: Record<string, FairnessBucket>;
  alerts: FairnessAlert[];
  diversityScore: number | null;
};

