import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [popoverPosition, setPopoverPosition] = useState({ left: 16, top: 64, width: 360 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const positionPopover = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;

    const viewportPadding = 16;
    const triggerGap = 8;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - width - viewportPadding
    );

    setPopoverPosition({ left, top: rect.bottom + triggerGap, width });
  }, []);

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

  useLayoutEffect(() => {
    if (!open) return;

    positionPopover();
    const closeOnOutsideInteraction = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);
    document.addEventListener('pointerdown', closeOnOutsideInteraction);
    return () => {
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
      document.removeEventListener('pointerdown', closeOnOutsideInteraction);
    };
  }, [open, positionPopover]);

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

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[200] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl animate-in fade-in slide-in-from-top-2"
          style={popoverPosition}
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default AgentStatusIndicator;
