import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, X } from 'lucide-react';
import type { PipelineStage } from '../../types';
import { pipelineFairnessService } from '../../services/PipelineFairnessService';
import type { PipelineFairnessReport } from '../../types/pipelineFairness';
import { useToast } from '../../contexts/ToastContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
};

const STAGE_OPTIONS: Array<{ id: PipelineStage; label: string }> = [
  { id: 'sourced', label: 'Sourced' },
  { id: 'new', label: 'New' },
  { id: 'long_list', label: 'Long List' },
  { id: 'screening', label: 'Screening' },
  { id: 'scheduling', label: 'Interview Scheduling' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'hired', label: 'Hired' },
  { id: 'rejected', label: 'Rejected' }
];

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function renderDistribution(title: string, dist: Record<string, { count: number; pct: number }>) {
  const entries = Object.entries(dist).sort((a, b) => (b[1]?.pct ?? 0) - (a[1]?.pct ?? 0));
  if (!entries.length) {
    return <div className="text-xs text-slate-400">No data available.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-200">{title}</div>
      {entries.map(([key, v]) => (
        <div key={key} className="flex items-center gap-3">
          <div className="w-28 text-xs text-slate-300 truncate">{key}</div>
          <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden border border-slate-700">
            <div className="h-full bg-sky-500/70" style={{ width: `${Math.max(0, Math.min(100, v.pct))}%` }} />
          </div>
          <div className="w-16 text-right text-xs text-slate-200">{v.pct}%</div>
          <div className="w-10 text-right text-[11px] text-slate-400">{v.count}</div>
        </div>
      ))}
    </div>
  );
}

const PipelineFairnessModal: React.FC<Props> = ({ isOpen, onClose, jobId, jobTitle }) => {
  const { showToast } = useToast();
  const [stage, setStage] = useState<PipelineStage>('long_list');
  const [windowDays, setWindowDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<PipelineFairnessReport | null>(null);

  useEscapeKey({ active: isOpen, onEscape: onClose });

  const canShowReport = useMemo(() => report?.status === 'OK', [report?.status]);

  const load = async () => {
    setIsLoading(true);
    const res = await pipelineFairnessService.getReport({
      jobId,
      stage,
      windowDays,
      minSample: 10,
      minCoveragePct: 0.3
    });
    setIsLoading(false);

    if (!res.success) {
      showToast(res.error.message, 'warning');
      setReport(null);
      return;
    }

    setReport(res.data);
  };

  useEffect(() => {
    if (!isOpen) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, jobId, stage, windowDays]);

  if (!isOpen) return null;

  const headerTone = report?.status === 'OK' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30';
  const Icon = report?.status === 'OK' ? ShieldCheck : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close" />

      <div className="relative w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg border ${headerTone}`}>
              <Icon className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-white truncate">Fairness (Aggregate)</div>
              <div className="text-xs text-slate-400 truncate">{jobTitle}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-700 bg-slate-900/70 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="text-xs text-slate-400">Stage cohort</div>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as PipelineStage)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="text-xs text-slate-400 ml-2">Window</div>
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-700 inline-flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-auto custom-scrollbar">
          {!report ? (
            <div className="text-sm text-slate-300">
              {isLoading ? 'Loading fairness report…' : 'No report available.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div className="text-xs text-slate-400">Cohort size</div>
                  <div className="text-lg font-semibold text-white">{report.sampleSize}</div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div className="text-xs text-slate-400">Gender known</div>
                  <div className="text-lg font-semibold text-white">
                    {report.genderKnownCount} <span className="text-xs text-slate-400">({pct(report.genderCoveragePct)})</span>
                  </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div className="text-xs text-slate-400">Education known</div>
                  <div className="text-lg font-semibold text-white">
                    {report.educationKnownCount} <span className="text-xs text-slate-400">({pct(report.educationCoveragePct)})</span>
                  </div>
                </div>
              </div>

              {report.status !== 'OK' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-100">
                  {report.status === 'INSUFFICIENT_SAMPLE' && (
                    <div>
                      Insufficient sample size to assess fairness safely. Add more candidates to this stage or widen the time window.
                    </div>
                  )}
                  {report.status === 'INSUFFICIENT_COVERAGE' && (
                    <div>
                      Insufficient demographics coverage to assess fairness reliably. Coverage is shown above; distributions are withheld.
                    </div>
                  )}
                </div>
              )}

              {canShowReport && (
                <>
                  {typeof report.diversityScore === 'number' && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400">Diversity score (heuristic)</div>
                        <div className="text-xs text-slate-500">Shown only when sample + coverage thresholds are met.</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{report.diversityScore}/100</div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                      {renderDistribution('Gender distribution', report.genderDistribution)}
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                      {renderDistribution('Education distribution', report.educationDistribution)}
                    </div>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <div className="text-xs font-semibold text-slate-200 mb-2">Alerts</div>
                    {report.alerts.length === 0 ? (
                      <div className="text-xs text-slate-400">No fairness risks detected for this cohort.</div>
                    ) : (
                      <div className="space-y-2">
                        {report.alerts.map((a, idx) => (
                          <div key={idx} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-white">{a.type.replace(/_/g, ' ')}</div>
                              <div
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                  a.severity === 'CRITICAL'
                                    ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {a.severity}
                              </div>
                            </div>
                            <div className="text-xs text-slate-200 mt-1">{a.message}</div>
                            <div className="text-xs text-slate-400 mt-1">{a.suggestion}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineFairnessModal;

