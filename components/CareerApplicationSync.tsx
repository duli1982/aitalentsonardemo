import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import type { UploadedCandidate } from '../types';
import { consentExpiresAt, normalizeUploadedCandidate } from '../services/CandidateRecordService';
import { careerSiteService } from '../services/CareerSiteService';
import { sharedOperationsService } from '../services/SharedOperationsService';

const CareerApplicationSync: React.FC = () => {
  const { activeOrganization } = useAuth();
  const { isInitialized, setUploadedCandidates } = useData();
  const running = useRef(false);
  useEffect(() => {
    if (!isInitialized) return;
    const organizationId = activeOrganization.organizationId;
    const sync = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const store = await careerSiteService.admin(organizationId);
        for (const application of store.applications.filter((item) => item.status !== 'withdrawn')) {
          const timestamp = application.submittedAt;
          const candidate = normalizeUploadedCandidate({
            id: application.candidateId, type: 'uploaded', name: application.candidate.name, email: application.candidate.email,
            phone: application.candidate.phone, role: application.candidate.role, currentRole: application.candidate.role,
            location: application.candidate.location, experienceYears: application.candidate.experienceYears, experience: application.candidate.experienceYears,
            skills: application.candidate.skills, summary: application.candidate.summary, education: application.candidate.education,
            languages: application.candidate.languages.map((item) => ({ language: item.language, level: item.level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'native' | 'unknown', source: 'candidate', verified: false })),
            fileName: application.candidate.fileName, uploadDate: timestamp, applicationDate: timestamp, availability: application.answers.availability,
            linkedInProfileUrl: application.answers.profileUrl, pipelineStage: { [application.jobId]: 'new' }, lastActiveAt: timestamp,
            consent: { status: 'permitted', capturedAt: timestamp, expiresAt: consentExpiresAt(timestamp), source: 'candidate' }, profileStatus: 'complete',
            resumeProvenance: { parser: application.candidate.fileName ? 'server-ai-gateway' : 'candidate-entered', parserVersion: 1, fileName: application.candidate.fileName, parsedAt: timestamp, reviewedAt: timestamp, validationIssues: application.status === 'duplicate_review' ? ['Possible duplicate application requires recruiter review.'] : [] },
            metadata: { careerApplicationId: application.id, careerJobId: application.publishedJobId, eligibility: application.answers.eligibility, source: 'public-careers-site' },
          } as UploadedCandidate);
          setUploadedCandidates((current) => current.some((item) => item.id === candidate.id)
            ? current.map((item) => item.id === candidate.id ? { ...item, ...candidate, pipelineStage: { ...item.pipelineStage, [application.jobId]: item.pipelineStage?.[application.jobId] ?? 'new' } } : item)
            : [candidate, ...current]);
          await sharedOperationsService.upsertTasks(organizationId, [{ sourceKey: `career-application:${application.id}`, taskType: 'review', title: `Review application: ${application.candidate.name}`, detail: `${application.jobTitle}${application.status === 'duplicate_review' ? ' · possible duplicate record' : ''}`, candidateId: application.candidateId, jobId: application.jobId, ownerUserId: application.recruiterUserId, ownerRole: application.recruiterUserId ? 'recruiter' : 'sourcing_manager', dueAt: new Date(Date.parse(timestamp) + 86400000).toISOString() }]);
          if (application.status !== 'synced') await careerSiteService.markSynced(organizationId, application.id);
        }
      } catch (error) { console.warn('[CareerApplicationSync]', error); }
      finally { running.current = false; }
    };
    void sync();
    const interval = window.setInterval(() => void sync(), 30_000);
    const onFocus = () => void sync(); window.addEventListener('focus', onFocus);
    const onApplicationCreated = () => {
      const retry = () => { if (running.current) window.setTimeout(retry, 250); else void sync(); };
      retry();
    }; window.addEventListener('talentSonar:career-application-created', onApplicationCreated);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus); window.removeEventListener('talentSonar:career-application-created', onApplicationCreated); };
  }, [activeOrganization.organizationId, isInitialized, setUploadedCandidates]);
  return null;
};
export default CareerApplicationSync;
