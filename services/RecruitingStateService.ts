import type { Candidate, EvidencePack, Job, RoleContextPack } from '../types';
import type { DecisionArtifactRecord } from './DecisionArtifactService';
import type { RecruitingScorecardRecord } from './RecruitingScorecardService';
import { evidencePackService } from './EvidencePackService';
import { toCandidateSnapshot, toJobSnapshot } from '../utils/snapshots';

export interface CandidateJobRecruitingState {
  jobId: string;
  candidateId: string;
  contextPack?: RoleContextPack | null;
  evidencePack: EvidencePack;
  scorecard?: RecruitingScorecardRecord | null;
  shortlistArtifact?: DecisionArtifactRecord | null;
  screeningArtifact?: DecisionArtifactRecord | null;
  confidence: number; // 0..1
  missing: string[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function computeCandidateJobRecruitingState(params: {
  job: Job;
  candidate: Candidate;
  contextPack?: RoleContextPack | null;
  shortlistArtifact?: DecisionArtifactRecord | null;
  screeningArtifact?: DecisionArtifactRecord | null;
  scorecard?: RecruitingScorecardRecord | null;
}): CandidateJobRecruitingState {
  const { job, candidate, contextPack, shortlistArtifact, screeningArtifact, scorecard } = params;

  const fromArtifact = (shortlistArtifact?.details as any)?.evidencePack as EvidencePack | undefined;
  const jobSnapshot = toJobSnapshot(job);
  const candidateSnapshot = toCandidateSnapshot(candidate);
  const evidencePack =
    fromArtifact && typeof fromArtifact === 'object'
      ? fromArtifact
      : evidencePackService.buildDeterministic({ job: jobSnapshot, candidate: candidateSnapshot, contextPack });

  const scorecardConfidence = typeof scorecard?.confidence === 'number' ? scorecard.confidence : null;
  const confidence = clamp01(scorecardConfidence ?? evidencePack.confidence ?? 0);

  const missing = Array.isArray(evidencePack.missing) ? evidencePack.missing : [];

  return {
    jobId: String(job.id),
    candidateId: String(candidate.id),
    contextPack: contextPack ?? null,
    evidencePack,
    scorecard: scorecard ?? null,
    shortlistArtifact: shortlistArtifact ?? null,
    screeningArtifact: screeningArtifact ?? null,
    confidence,
    missing
  };
}
