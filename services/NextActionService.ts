import type { Job } from '../types';
import type { PipelineEventRecord } from './PipelineEventService';
import type { DecisionArtifactRecord } from './DecisionArtifactService';
import type { RecruitingScorecardRecord } from './RecruitingScorecardService';

export type NextActionType = 'add_pipeline' | 'request_screening' | 'schedule_interview' | 'move_rejected';

export interface NextActionSuggestion {
  job: Job;
  label: string;
  description: string;
  type: NextActionType;
}

interface NextActionContext {
  candidateId: string;
  pipelineStageByJobId?: Record<string, string | undefined>;
  jobMatches: Array<{
    job: Job;
    score: number;
  }>;
  pipelineEvents: PipelineEventRecord[];
  screeningsByJob: Map<string, { passed: boolean }[]>;
  shortlistByJob: Map<string, DecisionArtifactRecord[]>;
  scorecards: Record<string, RecruitingScorecardRecord>;
}

function getLatestEventForJob(events: PipelineEventRecord[], jobId: string): PipelineEventRecord | null {
  return events
    .filter((event) => event.jobId === jobId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

function normalizeStage(raw: unknown): string {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (value === 'longlist') return 'long_list';
  if (value === 'long_list') return 'long_list';
  if (value === 'offer_stage') return 'offer';
  return value;
}

function inferStageFromEvent(event: PipelineEventRecord | null): string {
  if (!event) return 'new';
  const fromTo = normalizeStage(event.toStage ?? event.fromStage ?? '');
  if (fromTo) return fromTo;

  const type = normalizeStage(event.eventType);
  if (type === 'rejected') return 'rejected';
  if (type === 'hired') return 'hired';
  return 'new';
}

export function determineNextAction(context: NextActionContext): NextActionSuggestion | null {
  const sortedJobs = context.jobMatches
    .map(({ job, score }) => ({ job, score }))
    .sort((a, b) => b.score - a.score);

  for (const { job, score } of sortedJobs) {
    const latestEvent = getLatestEventForJob(context.pipelineEvents, job.id);
    const stageFromCandidate = normalizeStage(context.pipelineStageByJobId?.[job.id]);
    const stage = stageFromCandidate || inferStageFromEvent(latestEvent);
    const hasPipelineSignal = Boolean(stageFromCandidate) || Boolean(latestEvent);
    const screening = context.screeningsByJob.get(job.id)?.[0];
    const shortlist = context.shortlistByJob.get(job.id)?.[0];
    const scorecard = context.scorecards[job.id];
    const overallScore = scorecard?.overallScore ?? score;

    if (screening && !screening.passed) {
      return {
        job,
        type: 'move_rejected',
        label: 'Move to Rejected',
        description: 'Screening failed. Log rejection and notify hiring team.'
      };
    }

    if (screening && screening.passed && stage !== 'interview' && stage !== 'hired') {
      return {
        job,
        type: 'schedule_interview',
        label: 'Schedule Interview',
        description: 'Screening passed; next step is to schedule the hiring manager interview.'
      };
    }

    if (!screening && stage === 'long_list') {
      return {
        job,
        type: 'request_screening',
        label: 'Request Screening',
        description: 'Candidate is on the Long List; time to capture screening data.'
      };
    }

    if (!screening && overallScore >= 75) {
      return {
        job,
        type: 'request_screening',
        label: 'Request Screening',
        description: 'Strong scorecard; let the Screening Agent handle the call.'
      };
    }

    if (!hasPipelineSignal || stage === 'new' || stage === 'sourced') {
      return {
        job,
        type: 'add_pipeline',
        label: 'Add to Long List',
        description: 'Bring this candidate into the pipeline to track progress.'
      };
    }
  }

  return null;
}
