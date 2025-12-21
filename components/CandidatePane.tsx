import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Candidate, Job } from '../types';
import GraphExplorer from './GraphExplorer';
import SkillsPassport from './SkillsPassport';
import { skillsInferenceService } from '../services/SkillsInferenceService';
import { Users, UserCheck, UploadCloud, Loader2, Diamond, TrendingUp, MessageSquare, Briefcase, ThumbsUp, ThumbsDown, Sparkles, Zap, Trophy, ArrowRight, Microscope, Building2, Clock, Globe, FileText, CheckCircle, Search, Mail, Phone, MapPin, Calendar, Download, ExternalLink, ChevronDown, ChevronUp, Play, Award, X, Database, RefreshCw, Filter, GraduationCap, Star, PlusCircle } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useSupabaseCandidates } from '../hooks/useSupabaseCandidates';
import { decisionArtifactService } from '../services/DecisionArtifactService';
import { pipelineEventService } from '../services/PipelineEventService';
import { fitAnalysisService } from '../services/FitAnalysisService';

interface CandidatePaneProps {
  job: Job | null;
  onInitiateAnalysis: (type: string, candidate: Candidate) => void;
  onFeedback: (candidateId: string, jobId: string, feedback: 'positive' | 'negative') => void;
  onAddToPipeline: (candidate: Candidate, jobId: string) => void;
  onBatchAnalysis?: (candidates: Candidate[]) => void;
  onViewProfile?: (candidate: Candidate) => void;
  onOpenCandidateJobDrawer?: (candidate: Candidate, job: Job) => void;
  isLoading: boolean;
  loadingCandidateId: string | null;
  isBatchAnalyzing?: boolean;
}

/**
 * Build candidate subtitle from graph data
 */
function buildCandidateSubtitle(candidate: any): string {
  const parts: string[] = [];

  if (candidate.companies && candidate.companies.length > 0) {
    parts.push(candidate.companies[0]);
  }

  if (candidate.schools && candidate.schools.length > 0) {
    parts.push(candidate.schools[0]);
  }

  if (parts.length === 0) {
    return 'Supabase Database';
  }

  return parts.join(' • ');
}

type CandidateSource = 'all' | 'supabase' | 'internal' | 'past' | 'uploaded';

const SourceChip: React.FC<{
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, count, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
      ${isActive ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-900/40 text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white'}`}
  >
    <span>{label}</span>
    <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-sky-500 text-slate-900' : 'bg-slate-700 text-slate-200'}`}>
      {count}
    </span>
  </button>
);

const CandidateCard: React.FC<{
  candidate: Candidate;
  job: Job;
  onSelect?: (candidate: Candidate) => void;
  onInitiateAnalysis: (type: string, candidate: Candidate) => void;
  onFeedback: (candidateId: string, jobId: string, feedback: 'positive' | 'negative') => void;
  onAddToPipeline: (candidate: Candidate, jobId: string) => void;
  onViewProfile?: (candidate: Candidate) => void;
  isLoading: boolean;
  loadingCandidateId: string | null;
}> = ({ candidate, job, onSelect, onInitiateAnalysis, onFeedback, onAddToPipeline, onViewProfile, isLoading, loadingCandidateId }) => {
  const isCurrentCardLoading = isLoading && loadingCandidateId === candidate.id;
  const matchScore = candidate.matchScores?.[job.id];
  const matchRationale = candidate.matchRationales?.[job.id];
  const feedback = candidate.feedback?.[job.id] ?? 'none';
  const isInPipeline = Boolean((candidate as any).pipelineStage?.[job.id]);

  // Extract company and school data
  const getCompanySchoolData = () => {
    const companies: string[] = [];
    const schools: string[] = [];

    // Try to get from metadata first (for Supabase candidates)
    if ((candidate as any).companies) {
      companies.push(...(candidate as any).companies);
    }
    if ((candidate as any).schools) {
      schools.push(...(candidate as any).schools);
    }

    // Fallback: parse from fileName subtitle
    if (companies.length === 0 && schools.length === 0 && candidate.fileName && candidate.fileName !== 'Supabase Database') {
      const parts = candidate.fileName.split(' • ');
      if (parts.length > 0) companies.push(parts[0]);
      if (parts.length > 1) schools.push(parts[1]);
    }

    return { companies, schools };
  };

  const { companies, schools } = getCompanySchoolData();
  const experienceYears = (candidate as any).experienceYears || 0;
  const location = (candidate as any).location || candidate.location || '';

  // Get match quality badge
  const getMatchQuality = () => {
    if (typeof matchScore !== 'number') return null;
    if (matchScore >= 80) return { text: 'Excellent', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: '⭐' };
    if (matchScore >= 60) return { text: 'Good', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: '✓' };
    if (matchScore >= 40) return { text: 'Moderate', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: '○' };
    return { text: 'Fair', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: '·' };
  };

  const matchQuality = getMatchQuality();

  // Check if skill matches job requirements
  const isMatchingSkill = (skill: string) => {
    const jobSkills = [...(job.requiredSkills || []), ...(job.niceToHaveSkills || [])];
    return jobSkills.some(jobSkill =>
      jobSkill.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(jobSkill.toLowerCase())
    );
  };

  return (
    <div
      onClick={() => (onSelect ? onSelect(candidate) : onViewProfile?.(candidate))}
      className="bg-slate-800 shadow-lg rounded-xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-sky-500/20 hover:ring-2 hover:ring-sky-500/30 cursor-pointer relative group"
    >
      <div>
        {/* Header with name and quick info */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-sky-400 group-hover:text-sky-300 transition-colors mb-1">
              {candidate.name}
            </h3>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {experienceYears > 0 && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {experienceYears} yrs
                </span>
              )}
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {location}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1 opacity-50 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onFeedback(candidate.id, job.id, 'positive'); }} className={`p-1.5 rounded-full transition-colors ${feedback === 'positive' ? 'bg-green-500/30 text-green-300' : 'text-gray-400 hover:text-green-400 hover:bg-slate-700'}`} aria-label="Good match"><ThumbsUp size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); onFeedback(candidate.id, job.id, 'negative'); }} className={`p-1.5 rounded-full transition-colors ${feedback === 'negative' ? 'bg-red-500/30 text-red-300' : 'text-gray-400 hover:text-red-400 hover:bg-slate-700'}`} aria-label="Bad match"><ThumbsDown size={14} /></button>
          </div>
        </div>

        {/* Company and School Badges */}
        {(companies.length > 0 || schools.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {companies.slice(0, 2).map((company, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-300 text-[10px] px-2 py-1 rounded-full border border-purple-500/20">
                <Building2 className="h-3 w-3" />
                {company}
              </span>
            ))}
            {schools.slice(0, 1).map((school, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-300 text-[10px] px-2 py-1 rounded-full border border-sky-500/20">
                <GraduationCap className="h-3 w-3" />
                {school}
              </span>
            ))}
          </div>
        )}

        {/* Match Score with Quality Badge */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {typeof matchScore === 'number' ? (
              <>
                <div className={`text-2xl font-bold ${matchScore > 75 ? 'text-green-400' : matchScore > 50 ? 'text-yellow-400' : 'text-orange-400'}`}>
                  {matchScore}%
                </div>
                {matchQuality && (
                  <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border ${matchQuality.color}`}>
                    {matchQuality.text}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-slate-500 italic">Analysis Pending</span>
            )}
          </div>
          {candidate.isHiddenGem && (
            <span className="inline-flex items-center bg-amber-500/10 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20">
              <Diamond className="h-3 w-3 mr-1" /> Hidden Gem
            </span>
          )}
        </div>

        {/* Match Rationale */}
        <p className="text-xs text-gray-400 mb-4 min-h-[2.5rem] leading-relaxed">
          {matchRationale || 'No analysis data available. Run detailed analysis to inspect fit.'}
        </p>

        {/* Skills with highlighting */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.slice(0, 5).map(skill => {
              const isMatch = isMatchingSkill(skill);
              return (
                <span
                  key={skill}
                  className={`text-[10px] px-2 py-1 rounded border ${
                    isMatch
                      ? 'bg-green-500/20 border-green-500/40 text-green-300'
                      : 'bg-slate-700/50 border-slate-600/50 text-gray-300'
                  }`}
                >
                  {skill}
                </span>
              );
            })}
            {candidate.skills.length > 5 && (
              <span className="text-gray-500 text-[10px] px-2 py-1">
                +{candidate.skills.length - 5} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto grid grid-cols-5 gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onInitiateAnalysis('FIT_ANALYSIS', candidate); }}
          disabled={isCurrentCardLoading}
          className="col-span-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-medium py-2 px-3 rounded-lg flex items-center justify-center transition-all text-xs disabled:opacity-50 shadow-lg shadow-sky-900/30"
        >
          {isCurrentCardLoading ? (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <TrendingUp className="h-3 w-3 mr-1.5" />
          )}
          {typeof matchScore === 'number' ? 'Details' : 'Analyze'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAddToPipeline(candidate, job.id); }}
          disabled={isCurrentCardLoading || isInPipeline}
          className="bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white border border-slate-600 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title={isInPipeline ? 'Already in pipeline' : 'Add to pipeline'}
        >
          <PlusCircle className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onInitiateAnalysis('OUTREACH', candidate); }}
          disabled={isCurrentCardLoading}
          className="bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white border border-slate-600 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
          title="Generate Outreach Email"
        >
          <Mail className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onViewProfile?.(candidate); }}
          className="bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white border border-slate-600 rounded-lg flex items-center justify-center transition-all"
          title="View Full Profile"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};


const CandidatePane: React.FC<CandidatePaneProps> = ({ job, onInitiateAnalysis, onFeedback, onAddToPipeline, onBatchAnalysis, onViewProfile, onOpenCandidateJobDrawer, isLoading, loadingCandidateId, isBatchAnalyzing }) => {
  const { internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const [activeSource, setActiveSource] = useState<CandidateSource>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [drawerTab, setDrawerTab] = useState<'summary' | 'pipeline'>('summary');
  const [showFilters, setShowFilters] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    setSelectedCandidate(null);
    setDrawerTab('summary');
    setActionsOpen(false);
  }, [job?.id]);

  // Filter states
  const [experienceFilter, setExperienceFilter] = useState<'junior' | 'mid' | 'senior' | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [skillsFilter, setSkillsFilter] = useState<string[]>([]);

  const [shortlistAnalysisByCandidateId, setShortlistAnalysisByCandidateId] = useState<Record<string, { matchScore: number; matchRationale: string; semanticScore: number }>>({});
  const [isShortlistAnalyzing, setIsShortlistAnalyzing] = useState(false);
  const [shortlistProgress, setShortlistProgress] = useState({ current: 0, total: 0 });
  const [shortlistError, setShortlistError] = useState<string | null>(null);

  const shortlistStorageKey = useMemo(() => (job ? `shortlist_ai_${job.id}` : null), [job]);

  // Rehydrate shortlist AI results when returning to this page/job.
  useEffect(() => {
    if (!shortlistStorageKey) return;
    try {
      const raw = localStorage.getItem(shortlistStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const data = parsed?.data as Record<string, { matchScore: number; matchRationale: string; semanticScore: number; analyzedAt?: string }> | undefined;
      if (!data) return;

      // Prune very old entries (7 days) to avoid unbounded growth.
      const now = Date.now();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      const cleaned: Record<string, { matchScore: number; matchRationale: string; semanticScore: number }> = {};
      Object.entries(data).forEach(([candidateId, value]) => {
        const analyzedAt = value?.analyzedAt ? Date.parse(value.analyzedAt) : now;
        if (!Number.isFinite(analyzedAt) || now - analyzedAt <= maxAgeMs) {
          cleaned[candidateId] = {
            matchScore: value.matchScore,
            matchRationale: value.matchRationale,
            semanticScore: value.semanticScore
          };
        }
      });

      setShortlistAnalysisByCandidateId(cleaned);
    } catch (e) {
      console.warn('[CandidatePane] Failed to rehydrate shortlist analysis:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortlistStorageKey]);

  // Hydrate shortlist results from Supabase "system of truth" (decision_artifacts).
  // This keeps results consistent across devices/sessions when analysis was persisted.
  useEffect(() => {
    if (!job) return;

    let cancelled = false;

    (async () => {
      try {
        const artifacts = await decisionArtifactService.listArtifactsForJob({
          jobId: job.id,
          decisionType: 'shortlist_analysis',
          limit: 500
        });

        if (cancelled || artifacts.length === 0) return;

        // Already ordered by created_at DESC; keep latest per candidate.
        const latestByCandidateId = new Map<string, (typeof artifacts)[number]>();
        for (const artifact of artifacts) {
          if (!latestByCandidateId.has(artifact.candidateId)) {
            latestByCandidateId.set(artifact.candidateId, artifact);
          }
        }

        setShortlistAnalysisByCandidateId((prev) => {
          const next = { ...prev };

          for (const [candidateId, artifact] of latestByCandidateId.entries()) {
            const rawSemantic = (artifact.details as any)?.semanticScore;
            const semanticScore = Number(rawSemantic);

            next[candidateId] = {
              matchScore: typeof artifact.score === 'number' ? artifact.score : (next[candidateId]?.matchScore ?? 0),
              matchRationale: artifact.summary ?? (next[candidateId]?.matchRationale ?? ''),
              semanticScore: Number.isFinite(semanticScore) ? semanticScore : (next[candidateId]?.semanticScore ?? 0)
            };
          }

          return next;
        });
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[CandidatePane] Failed to hydrate shortlist artifacts:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [job?.id]);

  // Persist shortlist AI results so navigation doesn't lose them.
  useEffect(() => {
    if (!shortlistStorageKey) return;
    try {
      const payload: Record<string, { matchScore: number; matchRationale: string; semanticScore: number; analyzedAt: string }> = {};
      Object.entries(shortlistAnalysisByCandidateId).forEach(([candidateId, value]) => {
        payload[candidateId] = { ...value, analyzedAt: new Date().toISOString() };
      });
      localStorage.setItem(shortlistStorageKey, JSON.stringify({ data: payload, updatedAt: Date.now() }));
    } catch (e) {
      // non-fatal (private mode / quota)
      console.warn('[CandidatePane] Failed to persist shortlist analysis:', e);
    }
  }, [shortlistStorageKey, shortlistAnalysisByCandidateId]);

  // Fetch candidates from Supabase for Best Matches tab
  const {
    candidates: supabaseCandidates,
    isLoading: isLoadingSupabase,
    hasMore,
    loadMore,
    refresh,
    total: supabaseTotal
  } = useSupabaseCandidates(job, {
    enabled: activeSource === 'all' || activeSource === 'supabase',
    limit: 50,
    threshold: 0.3,
    experienceLevel: experienceFilter,
    location: locationFilter || null,
    requiredSkills: skillsFilter.length > 0 ? skillsFilter : null
  });

  // Transform Supabase candidates to Candidate type
  const transformedSupabaseCandidates = useMemo(() => {
    if (!job) return [];

    return supabaseCandidates.map(sc => ({
      id: sc.id,
      name: sc.name,
      email: sc.email,
      type: 'uploaded' as const,
      skills: sc.skills,
      fileName: buildCandidateSubtitle(sc),
      matchScores: {
        [job.id]: shortlistAnalysisByCandidateId[sc.id]?.matchScore ?? sc.matchScore
      },
      matchRationales: {
        [job.id]: shortlistAnalysisByCandidateId[sc.id]
          ? `AI Score: ${shortlistAnalysisByCandidateId[sc.id].matchScore}/100 (semantic: ${shortlistAnalysisByCandidateId[sc.id].semanticScore}%) — ${shortlistAnalysisByCandidateId[sc.id].matchRationale}`
          : (sc.matchReason || `${sc.matchScore}% semantic match`)
      },
      feedback: {},
      isHiddenGem: sc.matchScore > 70 && sc.matchScore < 80,
      location: sc.location,
      ...sc.metadata
    } as Candidate));
  }, [supabaseCandidates, job, shortlistAnalysisByCandidateId]);

  const allSortedCandidates = useMemo(() => {
    if (!job) return [];
    const allCandidates = [...internalCandidates, ...pastCandidates, ...uploadedCandidates];
    return allCandidates.sort((a, b) => (b.matchScores?.[job.id] || 0) - (a.matchScores?.[job.id] || 0));
  }, [job, internalCandidates, pastCandidates, uploadedCandidates]);

  const sortedCandidates = useMemo(() => {
    if (!job) return [];

    if (activeSource === 'all' || activeSource === 'supabase') {
      if (transformedSupabaseCandidates.length > 0) return transformedSupabaseCandidates;
      return [...internalCandidates].sort((a, b) => (b.matchScores?.[job.id] || 0) - (a.matchScores?.[job.id] || 0));
    }

    if (activeSource === 'internal') {
      return [...internalCandidates].sort((a, b) => (b.matchScores?.[job.id] || 0) - (a.matchScores?.[job.id] || 0));
    }

    if (activeSource === 'past') {
      return [...pastCandidates].sort((a, b) => (b.matchScores?.[job.id] || 0) - (a.matchScores?.[job.id] || 0));
    }

    return [...uploadedCandidates].sort((a, b) => (b.matchScores?.[job.id] || 0) - (a.matchScores?.[job.id] || 0));
  }, [job, activeSource, internalCandidates, pastCandidates, uploadedCandidates, transformedSupabaseCandidates]);

  const handleBatchAnalyze = () => {
    const topCandidates = allSortedCandidates.slice(0, 10);
    if (onBatchAnalysis && topCandidates.length > 0) {
      onBatchAnalysis(topCandidates);
    }
  };

  const handleFindMatches = useCallback(() => {
    setShortlistError(null);
    setActiveSource('supabase');
    refresh();
  }, [refresh]);

  const handleAnalyzeShortlist = useCallback(async () => {
    if (!job) return;

    const shortlistLimit = Math.min(10, transformedSupabaseCandidates.length);
    if (shortlistLimit === 0) return;

    setShortlistError(null);
    setIsShortlistAnalyzing(true);
    setShortlistProgress({ current: 0, total: shortlistLimit });

    for (let i = 0; i < shortlistLimit; i++) {
      const candidate = transformedSupabaseCandidates[i];
      setShortlistProgress({ current: i + 1, total: shortlistLimit });

      try {
        const semanticScore = supabaseCandidates.find(sc => sc.id === candidate.id)?.matchScore ?? candidate.matchScores?.[job.id] ?? 0;
        const fit = await fitAnalysisService.analyze(job, candidate, semanticScore);
        const matchScore = fit.score;
        const matchRationale = fit.rationale;

        const decision = fitAnalysisService.decisionFromScore(matchScore) as any;
        const externalId = fitAnalysisService.getExternalIdForJob(job, 'ui');

        void decisionArtifactService.saveShortlistAnalysis({
          candidateId: String(candidate.id),
          candidateName: candidate.name,
          jobId: job.id,
          jobTitle: job.title,
          score: matchScore,
          decision,
          summary: matchRationale,
          details: {
            semanticScore,
            method: fit.method,
            confidence: fit.confidence,
            reasons: fit.reasons ?? []
          },
          externalId
        });

        void pipelineEventService.logEvent({
          candidateId: String(candidate.id),
          candidateName: candidate.name,
          jobId: job.id,
          jobTitle: job.title,
          eventType: 'SHORTLIST_ANALYZED',
          actorType: 'user',
          actorId: 'ui',
          summary: `Shortlist analyzed (${matchScore}/100, ${decision}).`,
          metadata: { matchScore, semanticScore, decision, method: fit.method }
        });

        setShortlistAnalysisByCandidateId(prev => ({
          ...prev,
          [candidate.id]: { matchScore, matchRationale, semanticScore }
        }));
      } catch (e) {
        console.error('[CandidatePane] Shortlist analysis failed:', e);
        const message = e instanceof Error ? e.message : 'Shortlist analysis failed.';
        setShortlistError(message);
        break;
      }

      // Light throttling to reduce rate-limit risk
      await new Promise(resolve => setTimeout(resolve, 900));
    }

    setIsShortlistAnalyzing(false);
    setShortlistProgress({ current: 0, total: 0 });
  }, [job, transformedSupabaseCandidates, supabaseCandidates]);

  if (!job) {
    return (
      <div className="flex justify-center items-center h-full bg-slate-800 shadow-xl rounded-xl p-6">
        <p className="text-xl text-gray-400 flex items-center"><Briefcase className="mr-3" /> Select a job to see potential matches.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 shadow-xl rounded-xl p-1 h-full flex flex-col relative">
      <div className="px-4 sm:px-6 pt-4 flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-700">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-white">Matches</span>
              <span className="text-slate-500"> → </span>
              <span className="text-slate-400">{job.title}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`md:hidden p-2 rounded-lg border ${showFilters ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-900/30 text-slate-200 hover:bg-slate-900/60'}`}
              title="Filters"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFindMatches}
              disabled={isLoadingSupabase || !job}
              className="flex-1 md:flex-none bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingSupabase ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finding...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Find Matches
                </>
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setActionsOpen((v) => !v)}
                className={`p-2 rounded-lg border ${actionsOpen ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-900/30 text-slate-200 hover:bg-slate-900/60'}`}
                title="More actions"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${actionsOpen ? 'rotate-180' : ''}`} />
              </button>

              {actionsOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      handleAnalyzeShortlist();
                    }}
                    disabled={isShortlistAnalyzing || isLoadingSupabase || transformedSupabaseCandidates.length === 0}
                    className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4 text-pink-300" />
                    {isShortlistAnalyzing ? `Analyzing (${shortlistProgress.current}/${shortlistProgress.total})` : 'Analyze Shortlist (AI)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionsOpen(false);
                      handleBatchAnalyze();
                    }}
                    disabled={!onBatchAnalysis || allSortedCandidates.length === 0}
                    className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Trophy className="h-4 w-4 text-yellow-300" />
                    Batch Analyze Top 10
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`hidden md:inline-flex p-2 rounded-lg border ${showFilters ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-900/30 text-slate-200 hover:bg-slate-900/60'}`}
              title="Filters"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Source chips */}
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <SourceChip
            label="All"
            count={supabaseTotal || (internalCandidates.length + pastCandidates.length + uploadedCandidates.length)}
            isActive={activeSource === 'all'}
            onClick={() => setActiveSource('all')}
          />
          <SourceChip
            label="Supabase"
            count={supabaseTotal}
            isActive={activeSource === 'supabase'}
            onClick={() => setActiveSource('supabase')}
          />
          <SourceChip
            label="Internal"
            count={internalCandidates.length}
            isActive={activeSource === 'internal'}
            onClick={() => setActiveSource('internal')}
          />
          <SourceChip
            label="Applicants"
            count={pastCandidates.length}
            isActive={activeSource === 'past'}
            onClick={() => setActiveSource('past')}
          />
          <SourceChip
            label="Uploaded"
            count={uploadedCandidates.length}
            isActive={activeSource === 'uploaded'}
            onClick={() => setActiveSource('uploaded')}
          />

          <div className="ml-auto text-xs text-slate-400">
            {(activeSource === 'all' || activeSource === 'supabase') ? 'Semantic search results' : 'Local dataset'}
          </div>
        </div>

        {shortlistError && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-200">
            {shortlistError}
          </div>
        )}

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase mr-1">Filters</span>
              <select
                value={experienceFilter || ''}
                onChange={(e) => setExperienceFilter(e.target.value as any || null)}
                className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">All Levels</option>
                <option value="junior">Junior (0-3 yrs)</option>
                <option value="mid">Mid (3-7 yrs)</option>
                <option value="senior">Senior (7+ yrs)</option>
              </select>

              <input
                type="text"
                placeholder="Location..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 w-40"
              />

              {(experienceFilter || locationFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setExperienceFilter(null);
                    setLocationFilter('');
                    setSkillsFilter([]);
                  }}
                  className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-xs text-red-400 flex items-center space-x-1"
                >
                  <X className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-grow min-h-0 flex gap-4 pt-4">
          <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedCandidates.length > 0 ? (
                sortedCandidates.map(candidate => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    job={job}
                    onSelect={(c) => {
                      if (onOpenCandidateJobDrawer) {
                        onOpenCandidateJobDrawer(c, job);
                        return;
                      }
                      setSelectedCandidate(c);
                      setDrawerTab('summary');
                    }}
                    onInitiateAnalysis={onInitiateAnalysis}
                    onFeedback={onFeedback}
                    onAddToPipeline={onAddToPipeline}
                    onViewProfile={onViewProfile}
                    isLoading={isLoading}
                    loadingCandidateId={loadingCandidateId}
                  />
                ))
              ) : (
                <p className="text-center text-gray-400 py-8 col-span-full">
                  {isLoadingSupabase ? 'Loading candidates...' : 'No candidates to show.'}
                </p>
              )}
            </div>

            {(activeSource === 'all' || activeSource === 'supabase') && hasMore && !isLoadingSupabase && (
              <div className="flex justify-center mt-6 mb-4">
                <button
                  onClick={loadMore}
                  className="px-6 py-3 bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white font-semibold rounded-lg flex items-center space-x-2 transition-all shadow-lg"
                >
                  <RefreshCw className="h-5 w-5" />
                  <span>Load More</span>
                </button>
              </div>
            )}
          </div>

          {/* Side drawer (desktop) */}
          {selectedCandidate && (
            <div className="hidden lg:flex w-[420px] flex-shrink-0 bg-slate-900/40 border border-slate-700 rounded-xl overflow-hidden">
              <div className="w-full flex flex-col">
                <div className="p-4 border-b border-slate-700 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-white truncate">{selectedCandidate.name}</div>
                    <div className="text-xs text-slate-400 truncate">{selectedCandidate.role || selectedCandidate.type}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCandidate(null)}
                    className="p-2 rounded-lg border border-slate-700 bg-slate-900/30 text-slate-200 hover:bg-slate-900/60"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-4 pt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('summary')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${drawerTab === 'summary' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:text-white'}`}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab('pipeline')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${drawerTab === 'pipeline' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-slate-900/30 text-slate-300 border-slate-700 hover:text-white'}`}
                  >
                    Pipeline
                  </button>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar">
                  {drawerTab === 'summary' ? (
                    <div className="space-y-4">
                      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-slate-400 uppercase">Match</div>
                          <div className="text-lg font-bold text-white">
                            {typeof selectedCandidate.matchScores?.[job.id] === 'number' ? `${selectedCandidate.matchScores?.[job.id]}%` : '—'}
                          </div>
                        </div>
                        <div className="text-sm text-slate-200 leading-relaxed">
                          {selectedCandidate.matchRationales?.[job.id] ?? 'No match rationale available.'}
                        </div>
                      </div>

                      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                        <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Skills</div>
                        <div className="flex flex-wrap gap-2">
                          {(selectedCandidate.skills ?? []).slice(0, 12).map((s) => (
                            <span key={s} className="text-xs bg-slate-900/40 border border-slate-700 text-slate-200 px-2 py-1 rounded-full">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onInitiateAnalysis('FIT_ANALYSIS', selectedCandidate)}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-200 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Run Detailed Analysis
                      </button>

                      <button
                        type="button"
                        onClick={() => onViewProfile?.(selectedCandidate)}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open Full Profile
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                        <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Status</div>
                        <div className="text-sm text-slate-200">
                          {String((selectedCandidate as any).pipelineStage?.[job.id] || 'Not in pipeline')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onAddToPipeline(selectedCandidate, job.id)}
                        disabled={Boolean((selectedCandidate as any).pipelineStage?.[job.id])}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Add to Pipeline
                      </button>

                      <div className="text-xs text-slate-400">
                        Tip: use the Pipeline tab to move candidates across stages.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidatePane;
