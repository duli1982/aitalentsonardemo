import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, CircleAlert, ClipboardCheck, MapPin, Play, RefreshCw, Search, Sparkles, Target, UserPlus, Users } from 'lucide-react';
import type { Candidate } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { durableSourcingService, type DurableSourcingMatch } from '../services/DurableSourcingService';
import { hybridCandidateRankingService } from '../services/HybridCandidateRankingService';
import { eventBus, EVENTS } from '../utils/EventBus';
import RequisitionHealthPanel from '../components/RequisitionHealthPanel';
import CareerPublishingPanel from '../components/CareerPublishingPanel';

type Filter = 'all' | 'strong' | 'coverage-gap';

const RequisitionWorkspacePage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates, setSelectedJobId } = useData();
  const [matches, setMatches] = useState<DurableSourcingMatch[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const job = useMemo(() => jobs.find((item) => item.id === jobId), [jobs, jobId]);
  const candidates = useMemo<Candidate[]>(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);

  const refreshEvidence = useCallback(async () => {
    if (!activeOrganization) return;
    setIsLoadingEvidence(true);
    try {
      const status = await durableSourcingService.status(activeOrganization.organizationId);
      setMatches(status.matches.filter((match) => match.job_id === jobId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load persisted sourcing evidence.');
    } finally {
      setIsLoadingEvidence(false);
    }
  }, [activeOrganization, jobId]);

  useEffect(() => { void refreshEvidence(); }, [refreshEvidence]);

  const durableByCandidate = useMemo(() => new Map(matches.map((match) => [match.candidate_id, match])), [matches]);
  const ranked = useMemo(() => {
    if (!job) return [];
    return hybridCandidateRankingService.rankForJob(job, candidates.map((candidate) => {
      const durable = durableByCandidate.get(candidate.id);
      const semanticScore = durable?.semantic_score ?? candidate.matchScores?.[job.id];
      return {
        ...candidate,
        title: candidate.currentRole ?? candidate.role ?? candidate.title,
        experienceYears: candidate.experienceYears ?? candidate.experience,
        semanticSimilarity: typeof semanticScore === 'number' ? semanticScore / 100 : undefined,
      };
    })).map((candidate) => ({ ...candidate, durable: durableByCandidate.get(candidate.id) }));
  }, [candidates, durableByCandidate, job]);

  const filteredRanked = useMemo(() => ranked.filter((candidate) => {
    const searchable = `${candidate.name} ${candidate.title ?? ''} ${(candidate.skills ?? []).join(' ')}`.toLowerCase();
    if (query && !searchable.includes(query.toLowerCase())) return false;
    if (filter === 'strong') return candidate.hybridScore >= 70;
    if (filter === 'coverage-gap') return candidate.missingMustHaveSkills.length > 0;
    return true;
  }), [filter, query, ranked]);

  const strongCount = ranked.filter((candidate) => candidate.hybridScore >= 70).length;
  const completeCoverageCount = ranked.filter((candidate) => candidate.missingMustHaveSkills.length === 0).length;
  const pipelineCount = ranked.filter((candidate) => Boolean(candidate.pipelineStage?.[job?.id ?? ''])).length;

  const openProfile = (candidate: Candidate) => {
    if (!job) return;
    setSelectedJobId(job.id);
    navigate(`/candidates/${candidate.id}`);
  };

  const shortlist = (candidate: Candidate) => {
    if (!job) return;
    eventBus.emit(EVENTS.CANDIDATE_STAGED, { candidateId: candidate.id, jobId: job.id, stage: 'long_list' });
  };

  const queueSourcing = async () => {
    if (!activeOrganization || !job) return;
    setIsQueueing(true);
    try {
      await durableSourcingService.enqueue(activeOrganization.organizationId, [job.id]);
      await refreshEvidence();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not queue sourcing for this role.');
    } finally {
      setIsQueueing(false);
    }
  };

  if (!job) return <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center text-center"><BriefcaseBusiness className="h-10 w-10 text-slate-500" /><h1 className="mt-4 text-2xl font-bold text-white">Requisition not found</h1><p className="mt-2 text-slate-400">This role may have been removed or you may not have access to its workspace.</p><button type="button" onClick={() => navigate('/jobs')} className="mt-5 rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white hover:bg-sky-400">Return to roles</button></div>;

  return <div className="mx-auto w-full max-w-7xl space-y-6">
    <button type="button" onClick={() => navigate('/jobs')} className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> All roles</button>
    <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-900 to-sky-950 p-6 sm:p-8"><div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between"><div><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${job.status === 'open' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-slate-500/30 bg-slate-500/10 text-slate-300'}`}>{job.status}</span><span className="text-sm text-slate-400">{job.department}</span></div><h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{job.title}</h1><p className="mt-3 flex items-center gap-2 text-sm text-slate-300"><MapPin className="h-4 w-4 text-sky-300" />{job.location} · {job.type ?? 'Employment type not specified'}{job.headcount ? ` · ${job.headcount} opening${job.headcount === 1 ? '' : 's'}` : ''}</p><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">{job.description || 'No role description has been added.'}</p></div><div className="flex flex-wrap gap-3"><button type="button" onClick={() => void refreshEvidence()} disabled={isLoadingEvidence} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isLoadingEvidence ? 'animate-spin' : ''}`} /> Refresh</button><button type="button" onClick={() => void queueSourcing()} disabled={isQueueing || !activeOrganization} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50"><Play className="h-4 w-4" /> {isQueueing ? 'Queueing…' : 'Source talent'}</button></div></div><div className="mt-6 border-t border-slate-700 pt-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Required skills</p><div className="mt-2 flex flex-wrap gap-2">{job.requiredSkills.length ? job.requiredSkills.map((skill) => <span key={skill} className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">{skill}</span>) : <span className="text-sm text-slate-500">No required skills defined</span>}</div></div></section>

    <RequisitionHealthPanel job={job} />
    <CareerPublishingPanel job={job} />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Ranked talent" value={ranked.length} detail="Candidates evaluated for this role" icon={<Users className="h-5 w-5" />} tone="sky" /><Metric label="Strong matches" value={strongCount} detail="Hybrid score of 70 or higher" icon={<Sparkles className="h-5 w-5" />} tone="emerald" /><Metric label="Full skill coverage" value={completeCoverageCount} detail="All required skills matched" icon={<Check className="h-5 w-5" />} tone="violet" /><Metric label="In process" value={pipelineCount} detail="Candidates already in the funnel" icon={<ClipboardCheck className="h-5 w-5" />} tone="amber" /></section>
    {error && <div className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><CircleAlert className="h-5 w-5 shrink-0" /><span>{error}</span></div>}

    <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-medium text-sky-300">Ranked talent</p><h2 className="mt-1 text-2xl font-bold text-white">Make the next shortlist decision</h2><p className="mt-1 text-sm text-slate-400">The order is deterministic: structured role fit is blended with persisted semantic evidence when available.</p></div><div className="relative w-full lg:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search talent" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-9 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" /></div></div><div className="mt-5 flex flex-wrap gap-2">{([['all', `All (${ranked.length})`], ['strong', `Strong match (${strongCount})`], ['coverage-gap', 'Skill gaps']] as [Filter, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === value ? 'border-sky-400/40 bg-sky-400/15 text-sky-200' : 'border-slate-600 text-slate-400 hover:text-white'}`}>{label}</button>)}</div><div className="mt-5 divide-y divide-slate-700">{filteredRanked.slice(0, 20).map((candidate, index) => <RankedCandidateRow key={candidate.id} candidate={candidate} rank={index + 1} isInPipeline={Boolean(candidate.pipelineStage?.[job.id])} onOpenProfile={() => openProfile(candidate)} onShortlist={() => shortlist(candidate)} />)}{!filteredRanked.length && <div className="py-12 text-center"><Target className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-3 font-semibold text-white">No candidates match this view</p><p className="mt-1 text-sm text-slate-400">Adjust the filter or source more talent for this role.</p></div>}</div></section>
  </div>;
};

const Metric: React.FC<{ label: string; value: number; detail: string; icon: React.ReactNode; tone: 'sky' | 'emerald' | 'violet' | 'amber' }> = ({ label, value, detail, icon, tone }) => { const tones = { sky: 'bg-sky-400/10 text-sky-300', emerald: 'bg-emerald-400/10 text-emerald-300', violet: 'bg-violet-400/10 text-violet-300', amber: 'bg-amber-400/10 text-amber-300' }; return <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5"><div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-400">{label}</p><span className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</span></div><p className="mt-4 text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; };

type RankedRowCandidate = Candidate & { hybridScore: number; semanticScore: number; structuredScore: number; matchedMustHaveSkills: string[]; missingMustHaveSkills: string[]; durable?: DurableSourcingMatch };
const RankedCandidateRow: React.FC<{ candidate: RankedRowCandidate; rank: number; isInPipeline: boolean; onOpenProfile: () => void; onShortlist: () => void }> = ({ candidate, rank, isInPipeline, onOpenProfile, onShortlist }) => <div className="flex flex-col gap-4 py-5 first:pt-0 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 gap-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">{rank}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-white">{candidate.name}</p>{isInPipeline && <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-xs font-semibold text-violet-200">In process</span>}</div><p className="mt-1 text-sm text-slate-400">{candidate.currentRole ?? candidate.role ?? candidate.title ?? 'Role not recorded'}{candidate.location ? ` · ${candidate.location}` : ''}{candidate.experienceYears ?? candidate.experience ? ` · ${candidate.experienceYears ?? candidate.experience} yrs` : ''}</p><div className="mt-2 flex flex-wrap gap-1.5">{candidate.matchedMustHaveSkills.slice(0, 4).map((skill) => <span key={skill} className="rounded bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-200">{skill}</span>)}{candidate.missingMustHaveSkills.slice(0, 2).map((skill) => <span key={skill} className="rounded bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">Missing {skill}</span>)}</div></div></div><div className="flex flex-wrap items-center gap-3 lg:justify-end"><div className="min-w-20 text-left lg:text-right"><p className="text-xl font-bold text-emerald-300">{candidate.hybridScore}%</p><p className="text-xs text-slate-500">Hybrid score</p></div><button type="button" onClick={onOpenProfile} className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700">Review</button><button type="button" disabled={isInPipeline} onClick={onShortlist} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-bold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="h-4 w-4" /> {isInPipeline ? 'Shortlisted' : 'Shortlist'}<ArrowRight className="h-4 w-4" /></button></div></div>;

export default RequisitionWorkspacePage;
