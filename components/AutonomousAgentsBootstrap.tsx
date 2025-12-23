import React, { useEffect } from 'react';
import type { Candidate, Job } from '../types';
import { agentSettingsService } from '../services/AgentSettingsService';
import { autonomousSourcingAgent } from '../services/AutonomousSourcingAgent';
import { autonomousScreeningAgent } from '../services/AutonomousScreeningAgent';
import { autonomousSchedulingAgent } from '../services/AutonomousSchedulingAgent';
import { autonomousInterviewAgent } from '../services/AutonomousInterviewAgent';
import { autonomousAnalyticsAgent } from '../services/AutonomousAnalyticsAgent';

type Props = {
  isInitialized: boolean;
  jobs: Job[];
  allCandidates: Candidate[];
};

const AutonomousAgentsBootstrap: React.FC<Props> = ({ isInitialized, jobs, allCandidates }) => {
  useEffect(() => {
    if (!isInitialized) return;

    const sourcing = agentSettingsService.getAgent('sourcing');
    const screening = agentSettingsService.getAgent('screening');
    const scheduling = agentSettingsService.getAgent('scheduling');
    const interview = agentSettingsService.getAgent('interview');
    const analytics = agentSettingsService.getAgent('analytics');

    autonomousSourcingAgent.initialize(jobs, { enabled: sourcing.enabled, mode: sourcing.mode });
    autonomousScreeningAgent.initialize({ enabled: screening.enabled, mode: screening.mode });
    autonomousSchedulingAgent.initialize({ enabled: scheduling.enabled, mode: scheduling.mode });
    autonomousInterviewAgent.initialize({ enabled: interview.enabled, mode: interview.mode });
    autonomousAnalyticsAgent.initialize(jobs, allCandidates, { enabled: analytics.enabled, mode: analytics.mode });
  }, [isInitialized, jobs, allCandidates]);

  return null;
};

export default AutonomousAgentsBootstrap;

