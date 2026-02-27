import React, { useMemo, useState, useEffect } from 'react';
import { Bot, Play, Pause, Activity, Clock, CheckCircle, AlertCircle, Zap, TrendingUp, Inbox, ChevronDown, ChevronUp } from 'lucide-react';
import { autonomousSourcingAgent, SourcingMatch } from '../services/AutonomousSourcingAgent';
import { backgroundJobService } from '../services/BackgroundJobService';
import { agentSettingsService } from '../services/AgentSettingsService';
import { proposedActionService, type ProposedAction, type ProposedActionStatus } from '../services/ProposedActionService';
import { eventBus, EVENTS } from '../utils/EventBus';
import ConfirmModal from './modals/ConfirmModal';
import { TIMING } from '../config/timing';

interface AutonomousAgentsControlProps {
    jobs: any[];
}

const AutonomousAgentsControl: React.FC<AutonomousAgentsControlProps> = ({ jobs }) => {
    const [status, setStatus] = useState<any>(null);
    const [matches, setMatches] = useState<SourcingMatch[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAllMatches, setShowAllMatches] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ProposedAction | null>(null);
    const [proposalCounts, setProposalCounts] = useState<Record<ProposedActionStatus, number>>({
        proposed: 0,
        applied: 0,
        dismissed: 0
    });
    const [sourcingActions, setSourcingActions] = useState<ProposedAction[]>(() =>
        proposedActionService.list().filter((a) => a.agentType === 'SOURCING')
    );

    // Initialize agent on mount
    useEffect(() => {
        const settings = agentSettingsService.getAgent('sourcing');
        autonomousSourcingAgent.initialize(jobs, { enabled: settings.enabled, mode: settings.mode });
        refreshStatus();
        refreshProposalCounts();

        const interval = setInterval(refreshStatus, TIMING.AGENT_STATUS_REFRESH_INTERVAL_MS);
        const proposalsSub = eventBus.on(EVENTS.PROPOSED_ACTIONS_CHANGED, refreshProposalCounts);
        return () => {
            clearInterval(interval);
            proposalsSub.unsubscribe();
        };
    }, [jobs]);

    const refreshStatus = () => {
        setStatus(autonomousSourcingAgent.getStatus());
        setMatches(autonomousSourcingAgent.getMatches());
    };

    const refreshProposalCounts = () => {
        const list = proposedActionService.list().filter((a) => a.agentType === 'SOURCING');
        setSourcingActions(list);
        const next: Record<ProposedActionStatus, number> = { proposed: 0, applied: 0, dismissed: 0 };
        list.forEach((a) => next[a.status]++);
        setProposalCounts(next);
    };

    const pendingProposals = useMemo(() => proposalCounts.proposed, [proposalCounts.proposed]);
    const visibleMatches = useMemo(() => (showAllMatches ? matches : matches.slice(0, 10)), [matches, showAllMatches]);

    const actionByCandidateJob = useMemo(() => {
        const map = new Map<string, ProposedAction>();
        for (const action of sourcingActions) {
            if (!action.candidateId || !action.jobId) continue;
            const key = `${action.candidateId}:${action.jobId}`;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, action);
                continue;
            }
            if (new Date(action.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
                map.set(key, action);
            }
        }
        return map;
    }, [sourcingActions]);

    const stageLabel = (stage: any): string => String(stage || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

    const applyAction = (action: ProposedAction) => {
        if (action.payload.type !== 'MOVE_CANDIDATE_TO_STAGE') return;
        const { candidate, jobId, stage } = action.payload;

        eventBus.emit(EVENTS.CANDIDATE_STAGED, {
            candidateId: String(candidate.id),
            candidateName: candidate.name,
            jobId,
            stage,
            source: `agent:${action.agentType.toLowerCase()}`,
            candidate
        });

        proposedActionService.markStatus(action.id, 'applied');
    };

    const dismissAction = (action: ProposedAction) => {
        proposedActionService.markStatus(action.id, 'dismissed');
    };

    const handleToggle = () => {
        const newState = !status?.enabled;
        agentSettingsService.setEnabled('sourcing', newState);
        autonomousSourcingAgent.setEnabled(newState);
        setTimeout(refreshStatus, TIMING.UI_DELAY_MS);
    };

    const handleManualScan = async () => {
        setIsRefreshing(true);
        try {
            await autonomousSourcingAgent.triggerScan(jobs);
            setTimeout(refreshStatus, TIMING.EXTRA_LONG_UI_DELAY_MS);
        } catch (error) {
            console.error('Manual scan failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const formatTime = (date: Date | null) => {
        if (!date) return 'Never';
        return new Date(date).toLocaleTimeString();
    };

    const formatNextRun = (date: Date | null) => {
        if (!date) return 'Disabled';
        const now = Date.now();
        const next = new Date(date).getTime();
        const diff = next - now;

        if (diff < 0) return 'Running soon...';

        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Less than 1 minute';
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;

        const hours = Math.floor(minutes / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    };

    if (!status) {
        return <div className="text-slate-400">Loading agent status...</div>;
    }

    return (
        <div className="space-y-6">
            <ConfirmModal
                isOpen={confirmAction !== null}
                title="Apply this agent proposal?"
                message={
                    confirmAction?.payload.type === 'MOVE_CANDIDATE_TO_STAGE' ? (
                        <div className="space-y-2">
                            <div className="text-slate-200">Apply the following change to your pipeline?</div>
                            <div className="text-sm bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                                <div className="font-semibold text-white">{confirmAction.payload.candidate.name}</div>
                                <div className="text-xs text-slate-400 mt-1">
                                    → <span className="text-sky-300">{stageLabel(confirmAction.payload.stage)}</span> (job {confirmAction.payload.jobId})
                                </div>
                            </div>
                            <div className="text-xs text-slate-400">
                                This is a write action. You can dismiss instead if you don’t want to apply it.
                            </div>
                        </div>
                    ) : null
                }
                confirmLabel="Apply"
                cancelLabel="Cancel"
                onCancel={() => setConfirmAction(null)}
                onConfirm={() => {
                    if (!confirmAction) return;
                    applyAction(confirmAction);
                    setConfirmAction(null);
                }}
            />
            {/* Agent Status Card */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${status.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                            <Bot className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Autonomous Sourcing Agent</h3>
                            <p className="text-sm text-slate-400">
                                {status.enabled ? 'Running in background' : 'Paused'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => eventBus.emit(EVENTS.PULSE_NAVIGATE, { to: 'agent-inbox' })}
                            className="px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 hover:bg-slate-900/60 text-slate-200 text-sm font-medium inline-flex items-center gap-2"
                            title="Review and apply agent proposals"
                        >
                            <Inbox className="h-4 w-4 text-emerald-300" />
                            Review in Inbox
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                pendingProposals > 0
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                                {pendingProposals}
                            </span>
                        </button>
                        <button
                            onClick={handleToggle}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                                status.enabled
                                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                        >
                            {status.enabled ? (
                                <>
                                    <Pause className="h-4 w-4" />
                                    <span>Pause Agent</span>
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4" />
                                    <span>Start Agent</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Last Scan</span>
                        </div>
                        <p className="text-lg font-semibold text-white">
                            {formatTime(status.lastRun)}
                        </p>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <Activity className="h-4 w-4" />
                            <span className="text-sm">Next Scan</span>
                        </div>
                        <p className="text-lg font-semibold text-white">
                            {formatNextRun(status.nextRun)}
                        </p>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-slate-400 mb-2">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm">Total Matches Found</span>
                        </div>
                        <p className="text-lg font-semibold text-emerald-400">
                            {status.totalMatches}
                        </p>
                    </div>
                </div>

                {/* Manual Scan Button */}
                <div className="mt-4">
                    <button
                        onClick={handleManualScan}
                        disabled={isRefreshing || !status.enabled}
                        className="w-full py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                        {isRefreshing ? (
                            <>
                                <Activity className="h-4 w-4 animate-spin" />
                                <span>Scanning...</span>
                            </>
                        ) : (
                            <>
                                <Zap className="h-4 w-4" />
                                <span>Run Manual Scan Now</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Recent Matches */}
            {matches.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h4 className="text-lg font-semibold text-white flex items-center">
                            <CheckCircle className="h-5 w-5 mr-2 text-emerald-400" />
                            Discovered Matches ({matches.length})
                        </h4>
                        {matches.length > 10 && (
                            <button
                                type="button"
                                onClick={() => setShowAllMatches((v) => !v)}
                                className="px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 hover:bg-slate-900/60 text-slate-200 text-xs font-semibold inline-flex items-center gap-2"
                            >
                                {showAllMatches ? (
                                    <>
                                        <ChevronUp className="h-4 w-4" />
                                        Show less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="h-4 w-4" />
                                        Show all
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className={`space-y-3 ${showAllMatches ? 'max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar' : ''}`}>
                        {visibleMatches.map((match, idx) => {
                            const action = actionByCandidateJob.get(`${match.candidateId}:${match.jobId}`);
                            const proposedStage =
                                action?.payload.type === 'MOVE_CANDIDATE_TO_STAGE' ? action.payload.stage : undefined;

                            return (
                                <div
                                    key={idx}
                                    className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-emerald-500/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <h5 className="font-medium text-white truncate">{match.candidateName}</h5>
                                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded border border-emerald-500/30">
                                                    {Math.round(match.matchScore)}% match
                                                </span>
                                                {action?.status && action.status !== 'proposed' && (
                                                    <span
                                                        className={`px-2 py-0.5 text-xs rounded border ${
                                                            action.status === 'applied'
                                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                                : 'bg-slate-800 text-slate-200 border-slate-700'
                                                        }`}
                                                    >
                                                        {action.status === 'applied' ? 'Applied' : 'Dismissed'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-400 mb-2">
                                                For: <span className="text-sky-400">{match.jobTitle}</span>
                                            </p>

                                            <div className="flex flex-wrap gap-1">
                                                {match.skills.slice(0, 5).map((skill, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>

                                            {proposedStage && (
                                                <div className="mt-3 text-[11px] text-slate-400">
                                                    Proposed stage: <span className="text-sky-300">{stageLabel(proposedStage)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-slate-500">
                                                {new Date(match.discoveredAt).toLocaleDateString()}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(match.discoveredAt).toLocaleTimeString()}
                                            </p>

                                            <div className="mt-3 flex flex-col gap-2 items-end">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        eventBus.emit(EVENTS.PULSE_NAVIGATE, {
                                                            to: 'candidates',
                                                            candidateId: match.candidateId,
                                                            jobId: match.jobId
                                                        });
                                                    }}
                                                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                                                >
                                                    Open Candidate
                                                </button>

                                                {action?.status === 'proposed' ? (
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => dismissAction(action)}
                                                            className="px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-700 hover:bg-slate-900/60 text-slate-200 text-xs font-semibold"
                                                        >
                                                            Dismiss
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmAction(action)}
                                                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                                                        >
                                                            Apply
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {matches.length > 10 && !showAllMatches && (
                        <button
                            type="button"
                            onClick={() => setShowAllMatches(true)}
                            className="w-full mt-4 text-sm text-slate-300 hover:text-white rounded-lg border border-slate-700 bg-slate-900/30 hover:bg-slate-900/50 py-2 inline-flex items-center justify-center gap-2"
                        >
                            <ChevronDown className="h-4 w-4" />
                            + {matches.length - 10} more matches
                        </button>
                    )}
                </div>
            )}

            {/* Info Box */}
            <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-sky-400 mt-0.5" />
                    <div>
                        <h5 className="font-medium text-sky-300 mb-1">How it works</h5>
                        <p className="text-sm text-slate-300">
                            This autonomous agent scans your vector database every 5 minutes to find candidates
                            matching your open jobs. When a match is found, you'll see a notification in the Pulse Feed.
                            The agent runs while the app is open, and proposes actions for you to review in the Agent Inbox.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutonomousAgentsControl;
