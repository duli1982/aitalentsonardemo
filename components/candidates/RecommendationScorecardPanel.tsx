import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Shield, Sparkles } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import { computeMatchScorecard, type EvidenceStrength, type MatchScorecard } from '../../services/MatchScorecardService';

function badgeForStrength(strength: EvidenceStrength): string {
  if (strength === 'strong') return 'bg-green-500/15 text-green-200 border-green-500/30';
  if (strength === 'medium') return 'bg-sky-500/15 text-sky-200 border-sky-500/30';
  return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
}

function barColor(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-sky-500';
  if (value >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

const MetricRow: React.FC<{ label: string; value: number; hint?: string }> = ({ label, value, hint }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs font-semibold text-slate-200">{label}</div>
      <div className="text-xs text-slate-300 tabular-nums">{Math.round(value)}%</div>
    </div>
    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700">
      <div className={`h-2 ${barColor(value)}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
    {hint ? <div className="text-[11px] text-slate-500">{hint}</div> : null}
  </div>
);

const RiskRow: React.FC<{ risks: string[] }> = ({ risks }) => {
  if (!risks.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-400" />
        No major risk flags detected.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {risks.map((r) => (
        <div key={r} className="flex items-start gap-2 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5" />
          <span>{r}</span>
        </div>
      ))}
    </div>
  );
};

export const RecommendationScorecardPanel: React.FC<{
  candidate: Candidate;
  job: Job;
  title?: string;
}> = ({ candidate, job, title = 'Why this recommendation?' }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'scorecard' | 'evidence'>('scorecard');

  const scorecard = useMemo<MatchScorecard>(() => computeMatchScorecard({ candidate, job }), [candidate, job]);

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Shield className="h-4 w-4 text-sky-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{title}</div>
            <div className="text-xs text-slate-400 truncate">
              Score {scorecard.overallScore}% · Skills {scorecard.subscores.skillFit}% · Seniority {scorecard.subscores.seniorityFit}%
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
      </button>

      {open ? (
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setTab('scorecard')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  tab === 'scorecard' ? 'bg-sky-500/20 text-sky-200' : 'text-slate-300 hover:text-white'
                }`}
              >
                Scorecard
              </button>
              <button
                type="button"
                onClick={() => setTab('evidence')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  tab === 'evidence' ? 'bg-sky-500/20 text-sky-200' : 'text-slate-300 hover:text-white'
                }`}
              >
                Evidence
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="h-4 w-4 text-purple-300" />
              Deterministic (rules-based)
            </div>
          </div>

          {tab === 'scorecard' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
                <MetricRow
                  label="Skill fit"
                  value={scorecard.subscores.skillFit}
                  hint={
                    scorecard.missingRequiredSkills.length
                      ? `Missing: ${scorecard.missingRequiredSkills.slice(0, 6).join(', ')}${scorecard.missingRequiredSkills.length > 6 ? '…' : ''}`
                      : 'No required skills missing.'
                  }
                />
                <MetricRow
                  label="Seniority fit"
                  value={scorecard.subscores.seniorityFit}
                  hint={`Expected: ${scorecard.expectedSeniority} · Inferred: ${scorecard.inferredSeniority}`}
                />
                <MetricRow label="Domain fit" value={scorecard.subscores.domainFit} hint="Based on keyword overlap (role/title + skills)." />
                <MetricRow label="Evidence quality" value={scorecard.subscores.evidenceQuality} hint="Higher is better when profile has concrete signals." />
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-200">Risk flags</div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                  <RiskRow risks={scorecard.risks} />
                </div>

                {scorecard.matchedSkills.length ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                    <div className="text-xs font-semibold text-slate-200 mb-2">Matched skills</div>
                    <div className="flex flex-wrap gap-2">
                      {scorecard.matchedSkills.slice(0, 16).map((s) => (
                        <span
                          key={s}
                          className="text-[11px] px-2 py-1 rounded-full bg-green-500/10 text-green-200 border border-green-500/20"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {scorecard.evidence.map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100">{e.title}</div>
                      <div className="text-xs text-slate-300 mt-1">{e.detail}</div>
                      <div className="text-[11px] text-slate-500 mt-1">Source: {e.source}</div>
                    </div>
                    <span className={`flex-shrink-0 text-[11px] px-2 py-1 rounded-full border ${badgeForStrength(e.strength)}`}>
                      {e.strength}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default RecommendationScorecardPanel;

