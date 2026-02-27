import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, BarChart3, Clock, Pause, Play, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { autonomousAnalyticsAgent, PipelineSnapshot, AnalyticsAlert } from '../services/AutonomousAnalyticsAgent';
import { useData } from '../contexts/DataContext';
import { agentSettingsService } from '../services/AgentSettingsService';
import { TIMING } from '../config/timing';

interface AutonomousAnalyticsControlProps {
    jobs: any[];
}

const formatTime = (date: Date | string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
};

const formatNextRun = (date: Date | string | null) => {
    if (!date) return 'Disabled';
    const now = Date.now();
    const next = new Date(date).getTime();
    const diff = next - now;
    if (diff <= 0) return 'Running soon...';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
};

const pill = (text: string, tone: 'info' | 'warning' | 'error') => {
    const cls =
        tone === 'error'
            ? 'bg-red-500/15 text-red-300 border-red-500/30'
            : tone === 'warning'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-sky-500/15 text-sky-300 border-sky-500/30';

    return (
        <span className={`px-2 py-0.5 text-xs rounded border ${cls}`}>
            {text}
        </span>
    );
};

const AutonomousAnalyticsControl: React.FC<AutonomousAnalyticsControlProps> = ({ jobs }) => {
    const { internalCandidates, pastCandidates, uploadedCandidates } = useData();
    const allCandidates = useMemo(() => [...internalCandidates, ...pastCandidates, ...uploadedCandidates], [internalCandidates, pastCandidates, uploadedCandidates]);

    const [status, setStatus] = useState<any>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [snapshots, setSnapshots] = useState<PipelineSnapshot[]>([]);
    const [alerts, setAlerts] = useState<AnalyticsAlert[]>([]);

    useEffect(() => {
        const settings = agentSettingsService.getAgent('analytics');
        autonomousAnalyticsAgent.initialize(jobs, allCandidates, { enabled: settings.enabled, mode: settings.mode });
        refresh();

        const interval = setInterval(refresh, TIMING.ANALYTICS_CONTROL_REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobs, allCandidates.length]);

    const refresh = () => {
        setStatus(autonomousAnalyticsAgent.getStatus());
        setSnapshots(autonomousAnalyticsAgent.getSnapshots(24));
        setAlerts(autonomousAnalyticsAgent.getAlerts(20));
    };

    const latest = snapshots[0] || null;
    const previous = snapshots[1] || null;

    const pipelineDelta = useMemo(() => {
        if (!latest || !previous) return null;
        const cur = latest.pipeline.totalInPipeline;
        const prev = previous.pipeline.totalInPipeline;
        return { cur, prev, delta: cur - prev };
    }, [latest, previous]);

    const handleToggle = () => {
        const enabled = !status?.enabled;
        agentSettingsService.setEnabled('analytics', enabled);
        autonomousAnalyticsAgent.setEnabled(enabled);
        setTimeout(refresh, TIMING.UI_DELAY_MS);
    };

    const handleManualRun = async () => {
        setIsRunning(true);
        try {
            await autonomousAnalyticsAgent.triggerRun(jobs, allCandidates);
            setTimeout(refresh, TIMING.LONG_UI_DELAY_MS);
        } finally {
            setIsRunning(false);
        }
    };

    if (!status) return <div className="text-slate-400">Loading agent status...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${status.enabled ? 'bg-purple-600' : 'bg-slate-700'}`}>
                            <BarChart3 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Autonomous Analytics Agent</h3>
                            <p className="text-sm text-slate-400">
                                {status.enabled ? 'Monitoring pipeline health' : 'Paused'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleManualRun}
                            disabled={isRunning}
                            className="px-4 py-2 rounded-lg font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                            {isRunning ? 'Running...' : 'Run Now'}
                        </button>
                        <button
                            onClick={handleToggle}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                status.enabled
                                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                        >
                            {status.enabled ? (
                                <>
                                    <Pause className="h-4 w-4" />
                                    Pause
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4" />
                                    Start
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Last Run</span>
                        </div>
                        <p className="text-white font-semibold">{formatTime(status.lastRun)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <Activity className="h-4 w-4" />
                            <span className="text-sm">Next Run</span>
                        </div>
                        <p className="text-white font-semibold">{formatNextRun(status.nextRun)}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <BarChart3 className="h-4 w-4" />
                            <span className="text-sm">Pipeline Candidates</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-white font-semibold">{latest?.pipeline.totalInPipeline ?? 0}</p>
                            {pipelineDelta && (
                                <div className="flex items-center gap-1 text-sm">
                                    {pipelineDelta.delta >= 0 ? (
                                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                                    ) : (
                                        <TrendingDown className="h-4 w-4 text-red-400" />
                                    )}
                                    <span className={pipelineDelta.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                                        {pipelineDelta.delta >= 0 ? '+' : ''}
                                        {pipelineDelta.delta}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">Supabase Pool</span>
                        </div>
                        <p className="text-white font-semibold">
                            {typeof latest?.talentPool.supabaseCandidateCount === 'number'
                                ? latest.talentPool.supabaseCandidateCount.toLocaleString()
                                : '—'}
                        </p>
                    </div>
                </div>
            </div>

            {latest && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Latest Snapshot</h4>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(latest.pipeline.stageCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 10)
                            .map(([stage, count]) => (
                                <span key={stage} className="px-2 py-1 rounded border border-slate-600 bg-slate-900/40 text-sm text-slate-200">
                                    <span className="text-slate-400 mr-2">{stage}</span>
                                    <span className="font-semibold">{count}</span>
                                </span>
                            ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Captured: {formatTime(latest.createdAt)}</p>
                </div>
            )}

            {alerts.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Recent Alerts</h4>
                    <div className="space-y-3">
                        {alerts.slice(0, 10).map((a) => (
                            <div key={a.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {pill(a.severity.toUpperCase(), a.severity)}
                                            <h5 className="text-white font-medium truncate">{a.title}</h5>
                                        </div>
                                        <p className="text-sm text-slate-300">{a.message}</p>
                                    </div>
                                    <div className="text-xs text-slate-500 whitespace-nowrap">{formatTime(a.createdAt)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {alerts.length > 10 && (
                        <p className="text-sm text-slate-400 mt-4 text-center">+ {alerts.length - 10} more</p>
                    )}
                </div>
            )}

            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-purple-300 mt-0.5" />
                    <div>
                        <h5 className="font-medium text-purple-200 mb-1">How it works</h5>
                        <p className="text-sm text-slate-300">
                            The Analytics Agent captures pipeline snapshots every 30 minutes, detects sudden changes (bottlenecks, velocity drops),
                            and posts alerts into Talent Pulse. It also tracks your Supabase candidate pool size as a sanity check for ingestion/migration.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutonomousAnalyticsControl;
