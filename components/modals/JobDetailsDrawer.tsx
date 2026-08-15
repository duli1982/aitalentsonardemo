import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Job, RoleContextPack } from '../../types';
import { Briefcase, FileText, MapPin, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import RoleContextPackModal from './RoleContextPackModal';
import { jobContextPackService } from '../../services/JobContextPackService';

type JobDetailsTab = 'description' | 'requirements' | 'scorecard';

export interface JobDetailsDrawerProps {
  isOpen: boolean;
  job: Job | null;
  onClose: () => void;
}

function tabClass(active: boolean): string {
  return [
    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
    active
      ? 'bg-sky-500/15 border-sky-400/40 text-sky-200'
      : 'bg-slate-900/20 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
  ].join(' ');
}

const JobDetailsDrawer: React.FC<JobDetailsDrawerProps> = ({ isOpen, job, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState<JobDetailsTab>('description');
  const [contextPack, setContextPack] = useState<RoleContextPack | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);

  useEscapeKey({ active: isOpen, onEscape: onClose });

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setTab('description');
  }, [isOpen, job?.id]);

  useEffect(() => {
    if (!isOpen || !job) return;
    let cancelled = false;

    setContextLoading(true);
    jobContextPackService
      .get(job.id)
      .then((pack) => {
        if (!cancelled) setContextPack(pack);
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, job?.id]);

  const requiredSkills = useMemo(() => (job?.requiredSkills || []).filter(Boolean), [job]);

  const hasAnyContext = useMemo(() => {
    if (!contextPack) return false;
    const anyAnswer = Object.values(contextPack.answers || {}).some((a) => Array.isArray((a as any)?.choices) && (a as any).choices.length > 0);
    return anyAnswer || Boolean(String(contextPack.notes || '').trim());
  }, [contextPack]);

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-[130]">
      <button
        type="button"
        aria-label="Close job details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Job details: ${job.title}`}
        className="absolute right-0 top-0 h-full w-full max-w-xl bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col"
      >
        <div className="p-4 border-b border-slate-700 bg-slate-900/80">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-sky-400 shrink-0" />
                <h2 className="text-base font-semibold text-white truncate">{job.title}</h2>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span className="truncate">{job.department}</span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3" />
                  {job.location}
                </span>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button type="button" onClick={() => setTab('description')} className={tabClass(tab === 'description')}>
              Description
            </button>
            <button type="button" onClick={() => setTab('requirements')} className={tabClass(tab === 'requirements')}>
              Requirements
            </button>
            <button type="button" onClick={() => setTab('scorecard')} className={tabClass(tab === 'scorecard')}>
              Scorecard / Notes
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          {tab === 'description' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <FileText className="h-4 w-4 text-sky-400" />
                Full description
              </div>
              <div className="text-sm text-slate-200 whitespace-pre-wrap bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
                {job.description?.trim() ? job.description : 'No job description provided yet.'}
              </div>
            </div>
          )}

          {tab === 'requirements' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
                <div className="text-sm font-semibold text-slate-100 mb-2">At a glance</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-400">Department:</span> {job.department || '—'}
                  </div>
                  <div>
                    <span className="text-slate-400">Location:</span> {job.location || '—'}
                  </div>
                  <div>
                    <span className="text-slate-400">Type:</span> {job.type || '—'}
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span> {job.status || '—'}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Salary range:</span> {job.salaryRange || '—'}
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
                <div className="text-sm font-semibold text-slate-100 mb-2">Must-haves</div>
                {requiredSkills.length ? (
                  <div className="flex flex-wrap gap-2">
                    {requiredSkills.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs px-2 py-1 rounded-full bg-sky-500/15 text-sky-200 border border-sky-400/30"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">No required skills specified yet.</div>
                )}
              </div>

              <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
                <div className="text-sm font-semibold text-slate-100 mb-2">Nice-to-haves</div>
                <div className="text-xs text-slate-400">
                  Not modeled yet. Later, we can store this as `job.niceToHaveSkills` or derive it from AI job analysis.
                </div>
              </div>
            </div>
          )}

          {tab === 'scorecard' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-4 text-sm text-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100">Role Context Pack</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Optional intake improves evidence, truth-check questions, and confidence.
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Status:{' '}
                      {contextLoading ? (
                        <span className="text-slate-300">Loading…</span>
                      ) : hasAnyContext ? (
                        <span className="text-emerald-300">Saved</span>
                      ) : (
                        <span className="text-amber-300">Not added</span>
                      )}
                      {contextPack?.updatedAt ? (
                        <span className="text-slate-600">{` · Updated ${new Date(contextPack.updatedAt).toLocaleDateString()}`}</span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContextModalOpen(true)}
                    className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold whitespace-nowrap"
                  >
                    {hasAnyContext ? 'Edit intake' : 'Add intake'}
                  </button>
                </div>

                {contextPack?.notes ? (
                  <div className="mt-3 text-xs text-slate-300 whitespace-pre-wrap bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                    {contextPack.notes}
                  </div>
                ) : null}
              </div>

              <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-4 text-sm text-slate-200">
                <div className="font-semibold text-slate-100 mb-1">Next</div>
                <div className="text-xs text-slate-400">
                  This tab can also host calibration notes and evidence-backed requirements in a later iteration.
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <RoleContextPackModal
        isOpen={contextModalOpen}
        job={job}
        onClose={() => setContextModalOpen(false)}
        onSaved={(pack) => setContextPack(pack)}
      />
    </div>
  );
};

export default JobDetailsDrawer;
