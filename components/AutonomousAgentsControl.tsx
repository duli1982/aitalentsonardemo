import React, { useState, useEffect } from 'react';
import { Bot, Play, Pause, Activity, Clock, CheckCircle, AlertCircle, Zap, TrendingUp } from 'lucide-react';
import { autonomousSourcingAgent, SourcingMatch } from '../services/AutonomousSourcingAgent';
import { backgroundJobService } from '../services/BackgroundJobService';

interface AutonomousAgentsControlProps {
    jobs: any[];
}

const AutonomousAgentsControl: React.FC<AutonomousAgentsControlProps> = ({ jobs }) => {
    const [status, setStatus] = useState<any>(null);
    const [matches, setMatches] = useState<SourcingMatch[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Initialize agent on mount
    useEffect(() => {
        autonomousSourcingAgent.initialize(jobs);
        refreshStatus();

        // Refresh status every 30 seconds
        const interval = setInterval(refreshStatus, 30000);
        return () => clearInterval(interval);
    }, [jobs]);

    const refreshStatus = () => {
        setStatus(autonomousSourcingAgent.getStatus());
        setMatches(autonomousSourcingAgent.getMatches());
    };

    const handleToggle = () => {
        const newState = !status?.enabled;
        autonomousSourcingAgent.setEnabled(newState);
        setTimeout(refreshStatus, 100);
    };

    const handleManualScan = async () => {
        setIsRefreshing(true);
        try {
            await autonomousSourcingAgent.triggerScan(jobs);
            setTimeout(refreshStatus, 1000);
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
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2 text-emerald-400" />
                        Discovered Matches ({matches.length})
                    </h4>

                    <div className="space-y-3">
                        {matches.slice(0, 10).map((match, idx) => (
                            <div
                                key={idx}
                                className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-emerald-500/50 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <h5 className="font-medium text-white">{match.candidateName}</h5>
                                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded border border-emerald-500/30">
                                                {Math.round(match.matchScore * 100)}% match
                                            </span>
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
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="text-xs text-slate-500">
                                            {new Date(match.discoveredAt).toLocaleDateString()}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(match.discoveredAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {matches.length > 10 && (
                        <p className="text-sm text-slate-400 mt-4 text-center">
                            + {matches.length - 10} more matches
                        </p>
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
                            The agent works 24/7 in the background - no manual searching required!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutonomousAgentsControl;
