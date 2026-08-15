import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CalendarClock, CheckCircle2, Clock3, Gauge, Target, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { sharedOperationsService, type EngagementMessage, type SharedTalentPool, type SharedTask } from '../services/SharedOperationsService';
import { calculateRecruiterKpis, workforceOperatingService, type RecruiterKpiSnapshot, type RecruiterProfile, type WorkAllocation } from '../services/WorkforceOperatingService';

const MyWorkPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeOrganization } = useAuth();
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates } = useData();
  const candidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);
  const actor = useMemo(() => ({ userId: user.id, role: activeOrganization.role }), [activeOrganization.role, user.id]);
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [allocations, setAllocations] = useState<WorkAllocation[]>([]);
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [history, setHistory] = useState<RecruiterKpiSnapshot[]>([]);
  const [pools, setPools] = useState<SharedTalentPool[]>([]);
  const [messages, setMessages] = useState<EngagementMessage[]>([]);

  const load = useCallback(async () => {
    const organizationId = activeOrganization.organizationId;
    const ownProfile = workforceOperatingService.getOwnProfile(organizationId, actor);
    const [nextTasks, nextPools, nextMessages] = await Promise.all([sharedOperationsService.listTasks(organizationId), sharedOperationsService.listPools(organizationId), sharedOperationsService.listMessages(organizationId)]);
    const nextAllocations = workforceOperatingService.listAllocations(organizationId, actor);
    nextPools.forEach((pool) => workforceOperatingService.capturePoolHealth(organizationId, pool, candidates, nextMessages));
    if (ownProfile) {
      const metrics = calculateRecruiterKpis(ownProfile, jobs, candidates, nextAllocations, nextPools, workforceOperatingService.listPoolHealth(organizationId), nextMessages);
      workforceOperatingService.captureKpiSnapshot(organizationId, actor, ownProfile, metrics);
      setHistory(workforceOperatingService.listKpiSnapshots(organizationId, actor));
    }
    setProfile(ownProfile);
    setAllocations(nextAllocations.filter((allocation) => allocation.status === 'assigned'));
    setTasks(workforceOperatingService.getTasksForRecruiter(nextTasks, user.id));
    setPools(nextPools);
    setMessages(nextMessages);
  }, [activeOrganization.organizationId, actor, candidates, jobs, user.id]);

  useEffect(() => { void load(); const unsubscribe = workforceOperatingService.subscribe(activeOrganization.organizationId, () => void load()); return unsubscribe; }, [activeOrganization.organizationId, load]);

  if (!profile) return <div className="mx-auto max-w-4xl rounded-2xl border border-amber-400/25 bg-amber-400/10 p-8 text-center"><Users className="mx-auto h-9 w-9 text-amber-300" /><h1 className="mt-3 text-xl font-bold text-white">Your operating profile is not configured</h1><p className="mt-2 text-sm text-slate-300">Ask a sourcing manager to add your capacity, skills, location and reporting line before work can be allocated.</p></div>;

  const availableHours = Math.max(1, profile.weeklyCapacityHours * (1 - profile.unavailablePercent / 100));
  const allocatedHours = allocations.reduce((sum, allocation) => sum + allocation.allocatedHours, 0);
  const utilization = Math.round((allocatedHours / availableHours) * 100);
  const latest = history.at(-1);

  return <div className="mx-auto w-full max-w-7xl space-y-6"><section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-900 to-sky-950 p-6 sm:p-8"><p className="text-sm font-medium text-sky-300">Recruiter workspace · private to you</p><h1 className="mt-1 text-3xl font-bold text-white">My Work</h1><p className="mt-2 text-sm text-slate-300">Your assignments, capacity, deadlines and personal performance signals. Team comparisons remain manager-only.</p><div className="mt-5 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-sky-400/10 px-3 py-1 text-sky-200">{profile.team}</span><span className="rounded-full bg-violet-400/10 px-3 py-1 text-violet-200">{profile.location}</span><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-200">{profile.weeklyCapacityHours} weekly hours</span>{profile.configurationSource === 'starter' && <span className="rounded-full bg-amber-400/10 px-3 py-1 text-amber-200">Starter profile · configure before production use</span>}</div></section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><Kpi icon={<Gauge />} label="Capacity used" value={`${utilization}%`} detail={`${allocatedHours}/${Math.round(availableHours)} hours`} warning={utilization > 90} /><Kpi icon={<BriefcaseBusiness />} label="Active roles" value={allocations.length} detail="Assigned to you" /><Kpi icon={<CalendarClock />} label="Open tasks" value={tasks.length} detail="Owned follow-ups" warning={tasks.some((task) => task.dueAt && Date.parse(task.dueAt) < Date.now())} /><Kpi icon={<Clock3 />} label="Time to submit" value={latest?.timeToSubmitDays === null || latest?.timeToSubmitDays === undefined ? '—' : `${latest.timeToSubmitDays}d`} detail="Assigned roles" /><Kpi icon={<Target />} label="Pool health" value={latest?.talentPoolHealth === null || latest?.talentPoolHealth === undefined ? '—' : `${latest.talentPoolHealth}%`} detail={`${pools.filter((pool) => pool.ownerUserId === profile.userId).length} owned pools`} /><Kpi icon={<TrendingUp />} label="Engagement success" value={latest?.engagementSuccess === null || latest?.engagementSuccess === undefined ? '—' : `${latest.engagementSuccess}%`} detail={`${messages.filter((message) => message.createdByUserId === profile.userId).length} messages`} /></section>

    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5"><div><p className="text-sm font-medium text-sky-300">Allocated work</p><h2 className="mt-1 text-xl font-bold text-white">My requisitions</h2></div><div className="mt-4 divide-y divide-slate-700">{allocations.map((allocation) => { const job = jobs.find((item) => item.id === allocation.jobId); return <button key={allocation.id} type="button" onClick={() => job && navigate(`/requisitions/${job.id}`)} className="flex w-full items-center gap-4 py-4 text-left hover:bg-slate-700/20"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300"><BriefcaseBusiness className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-bold text-white">{job?.title ?? 'Requisition unavailable'}</p><p className="mt-1 text-xs text-slate-400">Complexity {allocation.complexity}/5 · {allocation.allocatedHours} hours · recommendation {allocation.recommendationScore}%</p></div><span className="text-xs font-semibold text-sky-300">Open</span></button>; })}{!allocations.length && <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" /><p className="mt-3 font-semibold text-white">No requisitions currently assigned</p><p className="mt-1 text-sm text-slate-500">A manager-approved allocation will appear here.</p></div>}</div></div>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5"><p className="text-sm font-medium text-amber-300">Next actions</p><h2 className="mt-1 text-xl font-bold text-white">My task queue</h2><div className="mt-4 space-y-2">{tasks.slice(0, 8).map((task) => <button key={task.id} type="button" onClick={() => navigate('/follow-ups')} className="w-full rounded-xl border border-slate-700 bg-slate-900/35 p-3 text-left hover:bg-slate-800"><div className="flex items-start justify-between gap-2"><p className="font-semibold text-white">{task.title}</p>{task.dueAt && <span className={`text-[10px] ${Date.parse(task.dueAt) < Date.now() ? 'text-red-300' : 'text-slate-500'}`}>{new Date(task.dueAt).toLocaleDateString()}</span>}</div><p className="mt-1 line-clamp-2 text-xs text-slate-400">{task.detail}</p></button>)}{!tasks.length && <p className="py-10 text-center text-sm text-slate-500">No owned follow-ups.</p>}</div></div></section>

    <section className="rounded-xl border border-slate-700 bg-slate-900/45 p-4 text-xs leading-5 text-slate-500"><strong className="text-slate-300">Personal metric definitions:</strong> Capacity is assigned weekly hours divided by configured available hours. Time to submit is the elapsed time from requisition posting to the first shortlist-or-later event. Engagement success is replies divided by sent messages. Pool health uses completeness, target-skill coverage, availability and recorded engagement.</section>
  </div>;
};

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; warning?: boolean }> = ({ icon, label, value, detail, warning }) => <div className={`rounded-2xl border p-4 ${warning ? 'border-red-400/30 bg-red-400/10' : 'border-slate-700 bg-slate-800/70'}`}><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${warning ? 'bg-red-400/10 text-red-300' : 'bg-sky-400/10 text-sky-300'}`}>{React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' }) : icon}</div><p className="mt-3 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-xs font-semibold text-slate-300">{label}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></div>;

export default MyWorkPage;
