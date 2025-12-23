import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertCircle, Bot, ChevronDown } from 'lucide-react';
import { backgroundJobService, type BackgroundJob } from '../services/BackgroundJobService';
import { eventBus, EVENTS } from '../utils/EventBus';
import { useEscapeKey } from '../hooks/useEscapeKey';

type Props = {
  onOpenAutonomousAgents: () => void;
};

function formatClock(date?: Date): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AgentStatusIndicator: React.FC<Props> = ({ onOpenAutonomousAgents }) => {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<BackgroundJob[]>(() => backgroundJobService.getAllJobs());
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEscapeKey({
    active: open,
    onEscape: () => {
      setOpen(false);
      buttonRef.current?.focus();
    }
  });

  useEffect(() => {
    setJobs(backgroundJobService.getAllJobs());
    const sub = eventBus.on(EVENTS.BACKGROUND_JOBS_CHANGED, () => {
      setJobs(backgroundJobService.getAllJobs());
    });
    return () => sub.unsubscribe();
  }, []);

  const summary = useMemo(() => {
    const enabled = jobs.filter((j) => j.enabled);
    const running = enabled.filter((j) => j.status === 'running');
    const failed = enabled.filter((j) => j.status === 'failed');
    const completed = enabled.filter((j) => j.status === 'completed');

    return {
      enabledCount: enabled.length,
      runningCount: running.length,
      failedCount: failed.length,
      completedCount: completed.length
    };
  }, [jobs]);

  const badgeClass = summary.failedCount
    ? 'bg-red-500'
    : summary.runningCount
      ? 'bg-emerald-500'
      : summary.enabledCount
        ? 'bg-sky-500'
        : 'bg-slate-600';

  const label = summary.failedCount
    ? `Agents: ${summary.failedCount} failed`
    : summary.runningCount
      ? `Agents: ${summary.runningCount} running`
      : summary.enabledCount
        ? `Agents: ${summary.enabledCount} enabled`
        : 'Agents: off';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 relative"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bot size={20} aria-hidden="true" />
        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 ${badgeClass} rounded-full border border-slate-900`} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] bg-slate-900 border border-slate-700 shadow-2xl rounded-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2"
          role="dialog"
          aria-label="Autonomous agent status"
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/80 backdrop-blur">
            <div className="flex items-center gap-2">
              <Activity className="text-sky-400" size={18} aria-hidden="true" />
              <div className="text-sm font-semibold text-white">Agents</div>
              <div className="text-[11px] text-slate-400">
                {summary.enabledCount} enabled • {summary.runningCount} running
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenAutonomousAgents();
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold"
            >
              Manage
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto custom-scrollbar p-2 space-y-2">
            {jobs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No agents initialized yet.
              </div>
            ) : (
              jobs
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-lg border border-slate-700 bg-slate-800/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white font-semibold truncate">{job.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {job.enabled ? 'Enabled' : 'Disabled'} • {job.type.toLowerCase()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-300">
                          {job.status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 text-red-300">
                              <AlertCircle className="h-3.5 w-3.5" /> failed
                            </span>
                          ) : (
                            <span className="text-slate-300">{job.status}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Last: {formatClock(job.lastRun)} • Next: {formatClock(job.nextRun)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentStatusIndicator;

