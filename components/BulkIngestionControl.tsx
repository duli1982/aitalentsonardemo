import React, { useState, useEffect } from 'react';
import { Zap, Loader2, CheckCircle, AlertCircle, Pause, Play, Square, Trash2, Clock } from 'lucide-react';
import {
    bulkIngestionService,
    BulkIngestionConfig,
    BulkIngestionProgress
} from '../services/BulkIngestionService';

const BulkIngestionControl: React.FC = () => {
    const [config, setConfig] = useState<BulkIngestionConfig>({
        targetCount: 10000,
        batchSize: 500,
        parallelism: 10,
        checkpointInterval: 1000
    });

    const [progress, setProgress] = useState<BulkIngestionProgress | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [allJobs, setAllJobs] = useState<BulkIngestionProgress[]>([]);
    const [showJobHistory, setShowJobHistory] = useState(false);

    // Load job history on mount
    useEffect(() => {
        loadJobs();
    }, []);

    const loadJobs = async () => {
        const jobs = await bulkIngestionService.getAllJobs();
        setAllJobs(jobs);
    };

    const handleStart = async () => {
        setIsRunning(true);
        setProgress(null);

        try {
            const result = await bulkIngestionService.startBulkIngestion(
                config,
                (updatedProgress) => {
                    setProgress(updatedProgress);
                }
            );

            setProgress(result);
            await loadJobs();
        } catch (error) {
            console.error('Bulk ingestion error:', error);
        } finally {
            setIsRunning(false);
        }
    };

    const handlePause = () => {
        bulkIngestionService.pause();
    };

    const handleStop = () => {
        bulkIngestionService.stop();
        setIsRunning(false);
    };

    const handleResume = async (jobId: string) => {
        setIsRunning(true);
        setProgress(null);

        try {
            const result = await bulkIngestionService.startBulkIngestion(
                config,
                (updatedProgress) => {
                    setProgress(updatedProgress);
                },
                jobId
            );

            setProgress(result);
            await loadJobs();
        } catch (error) {
            console.error('Resume error:', error);
        } finally {
            setIsRunning(false);
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        await bulkIngestionService.deleteJob(jobId);
        await loadJobs();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
            case 'paused': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
            case 'completed': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
            case 'failed': return 'text-red-400 bg-red-500/20 border-red-500/30';
            default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString();
    };

    return (
        <div className="p-6 bg-slate-800 rounded-xl border border-slate-700 max-w-4xl mx-auto my-8">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
                <Zap className="mr-2 text-purple-400" size={28} />
                Bulk Candidate Generation
            </h2>
            <p className="text-slate-400 text-sm mb-6">
                Generate 10K - 100K+ profiles in one run with progress tracking and resumability
            </p>

            {/* Configuration */}
            <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-4">Generation Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Target Count</label>
                        <input
                            type="number"
                            value={config.targetCount}
                            onChange={(e) => setConfig({ ...config, targetCount: parseInt(e.target.value) })}
                            disabled={isRunning}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                            placeholder="10000"
                        />
                        <p className="text-xs text-slate-500 mt-1">Total profiles to generate</p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Batch Size</label>
                        <input
                            type="number"
                            value={config.batchSize}
                            onChange={(e) => setConfig({ ...config, batchSize: parseInt(e.target.value) })}
                            disabled={isRunning}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                            placeholder="500"
                        />
                        <p className="text-xs text-slate-500 mt-1">Profiles per batch</p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Parallelism</label>
                        <input
                            type="number"
                            value={config.parallelism}
                            onChange={(e) => setConfig({ ...config, parallelism: parseInt(e.target.value) })}
                            disabled={isRunning}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                            placeholder="10"
                        />
                        <p className="text-xs text-slate-500 mt-1">Concurrent API calls</p>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Checkpoint Interval</label>
                        <input
                            type="number"
                            value={config.checkpointInterval}
                            onChange={(e) => setConfig({ ...config, checkpointInterval: parseInt(e.target.value) })}
                            disabled={isRunning}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                            placeholder="1000"
                        />
                        <p className="text-xs text-slate-500 mt-1">Save progress every N</p>
                    </div>
                </div>
            </div>

            {/* Current Progress */}
            {progress && (
                <div className="mb-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white">Current Job Progress</h3>
                        <span className={`px-2 py-1 text-xs rounded border ${getStatusColor(progress.status)}`}>
                            {progress.status.toUpperCase()}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="flex justify-between text-sm text-slate-400 mb-2">
                            <span>{progress.completed.toLocaleString()} / {progress.total.toLocaleString()} profiles</span>
                            <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-3">
                            <div
                                className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all"
                                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-3 text-sm">
                        <div className="bg-slate-800 p-2 rounded">
                            <div className="text-slate-500 text-xs">Batch</div>
                            <div className="text-white font-semibold">{progress.currentBatch}/{progress.totalBatches}</div>
                        </div>
                        <div className="bg-slate-800 p-2 rounded">
                            <div className="text-slate-500 text-xs">Completed</div>
                            <div className="text-emerald-400 font-semibold">{progress.completed.toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800 p-2 rounded">
                            <div className="text-slate-500 text-xs">Failed</div>
                            <div className="text-red-400 font-semibold">{progress.failed}</div>
                        </div>
                        <div className="bg-slate-800 p-2 rounded">
                            <div className="text-slate-500 text-xs">ETA</div>
                            <div className="text-purple-400 font-semibold flex items-center">
                                <Clock size={12} className="mr-1" />
                                {progress.estimatedTimeRemaining || 'Calculating...'}
                            </div>
                        </div>
                    </div>

                    {/* Errors */}
                    {progress.errors.length > 0 && (
                        <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-300 max-h-20 overflow-y-auto">
                            <div className="font-semibold mb-1">Errors ({progress.errors.length}):</div>
                            {progress.errors.slice(0, 5).map((error, i) => (
                                <div key={i} className="truncate">• {error}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Control Buttons */}
            <div className="flex space-x-3 mb-6">
                {!isRunning ? (
                    <button
                        onClick={handleStart}
                        className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg transition-all flex justify-center items-center space-x-2"
                    >
                        <Play size={18} />
                        <span>Start Bulk Generation</span>
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handlePause}
                            className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-all flex justify-center items-center space-x-2"
                        >
                            <Pause size={18} />
                            <span>Pause</span>
                        </button>
                        <button
                            onClick={handleStop}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all flex justify-center items-center space-x-2"
                        >
                            <Square size={18} />
                            <span>Stop</span>
                        </button>
                    </>
                )}
            </div>

            {/* Job History */}
            <div className="border-t border-slate-700 pt-4">
                <button
                    onClick={() => setShowJobHistory(!showJobHistory)}
                    className="text-sm text-slate-400 hover:text-white transition-colors flex items-center"
                >
                    {showJobHistory ? '▼' : '▶'} Job History ({allJobs.length})
                </button>

                {showJobHistory && (
                    <div className="mt-4 space-y-2">
                        {allJobs.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-4">No previous jobs</div>
                        ) : (
                            allJobs.map((job) => (
                                <div key={job.jobId} className="p-3 bg-slate-900 rounded border border-slate-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs font-mono text-slate-500">{job.jobId}</span>
                                            <span className={`px-2 py-0.5 text-xs rounded border ${getStatusColor(job.status)}`}>
                                                {job.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {job.status === 'paused' && (
                                                <button
                                                    onClick={() => handleResume(job.jobId)}
                                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded transition-colors flex items-center space-x-1"
                                                >
                                                    <Play size={12} />
                                                    <span>Resume</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteJob(job.jobId)}
                                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>{job.completed.toLocaleString()} / {job.total.toLocaleString()} ({Math.round((job.completed / job.total) * 100)}%)</span>
                                        <span>{formatDate(job.startTime)}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-1 mt-2">
                                        <div
                                            className="bg-purple-600 h-1 rounded-full"
                                            style={{ width: `${(job.completed / job.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="mt-6 p-3 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-300">
                <div className="font-semibold mb-1">💡 Pro Tips:</div>
                <ul className="space-y-1 list-disc list-inside">
                    <li>Start with 1K-10K profiles to test performance</li>
                    <li>Increase parallelism (up to 20) for faster generation</li>
                    <li>Jobs auto-save progress every {config.checkpointInterval.toLocaleString()} profiles</li>
                    <li>You can pause/resume at any time - progress is saved</li>
                    <li>Recommended: Run 100K overnight for production dataset</li>
                </ul>
            </div>
        </div>
    );
};

export default BulkIngestionControl;
