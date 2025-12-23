import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Copy, X } from 'lucide-react';
import { useDegradedMode } from '../contexts/DegradedModeContext';
import { useToast } from '../contexts/ToastContext';
import { getClientVersion } from '../utils/clientVersion';

function formatTime(iso?: string) {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function isAdminMode() {
  try {
    return (
      import.meta.env.DEV ||
      String(import.meta.env.VITE_ADMIN_MODE || '').toLowerCase() === 'true' ||
      localStorage.getItem('ts_admin') === 'true'
    );
  } catch {
    return import.meta.env.DEV;
  }
}

const DegradedModeBanner: React.FC = () => {
  const { events, latestByFeature, clear } = useDegradedMode();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const latest = useMemo(() => Object.values(latestByFeature), [latestByFeature]);
  if (!latest.length) return null;

  const primary = latest[0];

  const handleCopy = async () => {
    const bundle = {
      errorCode: primary.error?.code,
      message: primary.error?.message,
      debugId: primary.error?.debugId,
      feature: primary.feature,
      jobId: primary.jobId ?? primary.error?.context?.jobId,
      candidateId: primary.candidateId ?? primary.error?.context?.candidateId,
      timestamp: primary.error?.timestamp,
      occurredAt: primary.occurredAt,
      lastUpdatedAt: primary.lastUpdatedAt,
      whatMightBeMissing: primary.whatMightBeMissing,
      retryAfterMs: primary.retryAfterMs,
      correlationId: primary.correlationId ?? primary.error?.context?.correlationId,
      clientVersion: getClientVersion(),
      details: primary.error?.details,
      redactedInputSummary: primary.redactedInputSummary
    };

    const text = JSON.stringify(bundle, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      showToast('Debug bundle copied to clipboard.', 'success');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '1px';
        textarea.style.height = '1px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (!ok) throw new Error('execCommand copy returned false');

        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        showToast('Debug bundle copied to clipboard.', 'success');
      } catch {
        showToast('Could not copy debug bundle (clipboard blocked). Try again on https/localhost.', 'warning');
      }
    }
  };

  const admin = isAdminMode();

  return (
    <div className="w-full">
      <div className="bg-amber-500/15 border border-amber-500/30 text-amber-100 rounded-lg p-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Degraded mode: some data may be missing</div>
            <div className="text-xs text-amber-200/90">
              Last updated at {formatTime(primary.lastUpdatedAt ?? primary.occurredAt)} — {primary.whatMightBeMissing}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-2 py-1 rounded border border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/10 text-xs flex items-center gap-1"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy debug bundle'}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-2 py-1 rounded border border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/10 text-xs flex items-center gap-1"
          >
            Details <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => {
              clear();
              setOpen(false);
            }}
            className="p-1 rounded hover:bg-amber-500/10"
            aria-label="Dismiss degraded mode banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-2 bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-100">Degraded mode details</div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-slate-700"
              aria-label="Close details"
            >
              <X className="h-4 w-4 text-slate-300" />
            </button>
          </div>

          <div className="space-y-3">
            {latest.map((ev) => (
              <div key={`${ev.feature}:${ev.error?.debugId ?? ev.occurredAt}`} className="border border-slate-700 rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-slate-100 font-medium">{ev.feature}</div>
                    <div className="text-slate-300 text-xs mt-0.5">{ev.error?.message}</div>
                  </div>
                  <button
                    onClick={() => clear(ev.feature)}
                    className="text-xs px-2 py-1 rounded border border-slate-600 hover:bg-slate-700 text-slate-200"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-400">Code:</span> {ev.error?.code}
                  </div>
                  <div>
                    <span className="text-slate-400">Debug ID:</span> {ev.error?.debugId}
                  </div>
                  <div>
                    <span className="text-slate-400">Last updated:</span> {formatTime(ev.lastUpdatedAt ?? ev.occurredAt)}
                  </div>
                  <div>
                    <span className="text-slate-400">Retry after:</span> {typeof ev.retryAfterMs === 'number' ? `${Math.ceil(ev.retryAfterMs / 1000)}s` : '—'}
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-300">
                  <span className="text-slate-400">What might be missing:</span> {ev.whatMightBeMissing}
                </div>

                {ev.redactedInputSummary && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-200">Redacted input summary</summary>
                    <pre className="mt-2 text-xs bg-slate-900/60 border border-slate-700 rounded p-2 overflow-auto whitespace-pre-wrap">
                      {ev.redactedInputSummary}
                    </pre>
                  </details>
                )}

                {admin && ev.error?.cause !== undefined && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-amber-200">Admin-only: upstream cause</summary>
                    <pre className="mt-2 text-xs bg-slate-900/60 border border-slate-700 rounded p-2 overflow-auto whitespace-pre-wrap">
                      {typeof (ev.error.cause as any)?.stack === 'string'
                        ? String((ev.error.cause as any).stack)
                        : JSON.stringify(ev.error.cause, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>

          {events.length > latest.length && (
            <div className="mt-3 text-xs text-slate-400">Recent events stored: {events.length}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DegradedModeBanner;
