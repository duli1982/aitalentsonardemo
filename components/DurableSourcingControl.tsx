import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Clock, Play, RefreshCw } from 'lucide-react';
import { durableSourcingService, type DurableSourcingMatch, type DurableSourcingRun } from '../services/DurableSourcingService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const DurableSourcingControl: React.FC = () => {
  const { activeOrganization } = useAuth();
  const { showToast } = useToast();
  const [runs, setRuns] = useState<DurableSourcingRun[]>([]);
  const [matches, setMatches] = useState<DurableSourcingMatch[]>([]);
  const [isQueueing, setIsQueueing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!activeOrganization) return;
    try {
      const next = await durableSourcingService.status(activeOrganization.organizationId);
      setRuns(next.runs);
      setMatches(next.matches);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load sourcing worker status.');
    }
  }, [activeOrganization]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const queue = async () => {
    if (!activeOrganization) return;
    setIsQueueing(true);
    try {
      await durableSourcingService.enqueue(activeOrganization.organizationId);
      showToast('Sourcing run queued. The durable worker will claim it shortly.', 'success');
      await refresh();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not queue sourcing.', 'warning');
    } finally {
      setIsQueueing(false);
    }
  };

  const latest = runs[0];
  const byJob = useMemo(() => new Map(matches.map((match) => [`${match.job_id}:${match.candidate_id}`, match])), [matches]);
  return <section className="space-y-6">
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3"><div className="p-2 rounded-lg bg-emerald-600"><Bot className="h-6 w-6 text-white" /></div><div><h3 className="text-lg font-semibold text-white">Durable Sourcing Worker</h3><p className="text-sm text-slate-400">Queued runs and matches persist in the workspace; a server worker processes them outside the browser.</p></div></div>
        <button type="button" onClick={() => void queue()} disabled={!activeOrganization || isQueueing} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium inline-flex gap-2"><Play className="h-4 w-4" />{isQueueing ? 'Queueing…' : 'Queue sourcing run'}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 text-sm"><div className="rounded bg-slate-900/50 p-3"><span className="text-slate-400">Latest status</span><p className="text-white font-semibold mt-1">{latest?.status ?? 'No runs'}</p></div><div className="rounded bg-slate-900/50 p-3"><span className="text-slate-400">Last completed</span><p className="text-white font-semibold mt-1">{latest?.completed_at ? new Date(latest.completed_at).toLocaleString() : '—'}</p></div><div className="rounded bg-slate-900/50 p-3"><span className="text-slate-400">Persisted matches</span><p className="text-emerald-400 font-semibold mt-1">{matches.length}</p></div></div>
      {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}
      {latest?.error_message ? <p className="mt-3 text-sm text-red-300">Latest worker error: {latest.error_message}</p> : null}
    </div>
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6"><div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-white">Recent durable matches</h4><button type="button" onClick={() => void refresh()} className="text-slate-300 hover:text-white text-sm inline-flex gap-2"><RefreshCw className="h-4 w-4" />Refresh</button></div>{matches.length ? <div className="space-y-2">{[...byJob.values()].slice(0, 25).map((match) => <div key={`${match.job_id}:${match.candidate_id}`} className="rounded border border-slate-700 bg-slate-900/50 p-3 flex justify-between gap-3"><div><p className="text-white text-sm font-medium">Candidate {match.candidate_id}</p><p className="text-slate-400 text-xs">Job {match.job_id} • {match.matched_skills.join(', ') || 'No exact required skills recorded'}</p></div><div className="text-right"><p className="text-emerald-300 font-semibold">{match.hybrid_score}%</p><p className="text-slate-500 text-xs">semantic {match.semantic_score}% • structured {match.structured_score}%</p></div></div>)}</div> : <div className="text-sm text-slate-400 py-6 text-center"><Activity className="h-5 w-5 mx-auto mb-2" />No persisted matches yet. Queue a run, then ensure the worker endpoint is scheduled.</div>}</div>
    <div className="text-xs text-slate-500 flex gap-2"><Clock className="h-4 w-4" />A scheduler must call <code>POST /api/worker/sourcing</code> with the worker secret. The UI only queues and observes work.</div>
  </section>;
};

export default DurableSourcingControl;
