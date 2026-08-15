import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { seedConnectedShowcaseStory } from '../services/ShowcaseStoryService';

const ConnectedShowcaseBootstrap: React.FC = () => {
  const { activeOrganization, user } = useAuth();
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates, isInitialized } = useData();
  const runningFor = useRef('');
  useEffect(() => {
    if (!isInitialized || runningFor.current === activeOrganization.organizationId) return;
    runningFor.current = activeOrganization.organizationId;
    void seedConnectedShowcaseStory({
      organizationId: activeOrganization.organizationId,
      organizationSlug: activeOrganization.organizationSlug,
      userId: user.id,
      role: activeOrganization.role,
      jobs,
      candidates: [...internalCandidates, ...pastCandidates, ...uploadedCandidates],
    }).catch((error) => {
      runningFor.current = '';
      console.warn('[ConnectedShowcaseBootstrap]', error);
    });
  }, [activeOrganization, internalCandidates, isInitialized, jobs, pastCandidates, uploadedCandidates, user.id]);
  return null;
};

export default ConnectedShowcaseBootstrap;
