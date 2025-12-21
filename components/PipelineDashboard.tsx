import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, TrendingUp, Clock, Users, Target, Zap, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Candidate, Job } from '../types';
import { useData } from '../contexts/DataContext';
import * as geminiService from '../services/geminiService';
import Skeleton from './ui/Skeleton';

const PipelineDashboard: React.FC = () => {
    const { internalCandidates, pastCandidates, uploadedCandidates, jobs } = useData();
    const [analysis, setAnalysis] = useState<geminiService.PipelineHealthAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const allCandidates = [...internalCandidates, ...pastCandidates, ...uploadedCandidates];

    useEffect(() => {
        analyzePipeline();
    }, [allCandidates.length, jobs.length]);

    const analyzePipeline = async () => {
        setIsLoading(true);
        try {
            const result = await geminiService.analyzePipelineHealth(allCandidates, jobs);
            setAnalysis(result);
        } catch (error) {
            console.error('Error analyzing pipeline:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getHealthColor = (health: string) => {
        switch (health) {
            case 'excellent': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'good': return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
            case 'fair': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'poor': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'bottleneck': return <Clock className="text-amber-400" size={20} />;
            case 'risk': return <AlertTriangle className="text-red-400" size={20} />;
            case 'opportunity': return <Target className="text-green-400" size={20} />;
            case 'urgent': return <Zap className="text-orange-400" size={20} />;
            default: return <AlertCircle className="text-gray-400" size={20} />;
        }
    };

    const getAlertColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'border-red-500/50 bg-red-500/10';
            case 'high': return 'border-orange-500/50 bg-orange-500/10';
            case 'medium': return 'border-amber-500/50 bg-amber-500/10';
            case 'low': return 'border-sky-500/50 bg-sky-500/10';
            default: return 'border-gray-500/50 bg-gray-500/10';
        }
    };

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton width="40%" height="2rem" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} width="100%" height="8rem" />
                    ))}
                </div>
                <Skeleton width="100%" height="20rem" />
            </div>
        );
    }

    if (!analysis) return null;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Activity className="text-sky-400" />
                        Pipeline Health Dashboard
                    </h1>
                    <p className="text-gray-400 mt-1">Real-time insights and early warning system</p>
                </div>
                <div className={`px-6 py-3 rounded-xl border font-bold uppercase text-sm ${getHealthColor(analysis.overallHealth)}`}>
                    {analysis.overallHealth} • {analysis.healthScore}%
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <Users className="text-sky-400" size={24} />
                        <span className="text-2xl font-bold text-white">{analysis.metrics.totalCandidates}</span>
                    </div>
                    <p className="text-sm text-gray-400">Total Candidates</p>
                    <p className="text-xs text-gray-500 mt-1">{analysis.metrics.activeInPipeline} active</p>
                </div>

                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <Clock className="text-amber-400" size={24} />
                        <span className="text-2xl font-bold text-white">{analysis.metrics.avgTimeToHire}d</span>
                    </div>
                    <p className="text-sm text-gray-400">Avg Time to Hire</p>
                    <p className="text-xs text-gray-500 mt-1">Industry avg: 30d</p>
                </div>

                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="text-green-400" size={24} />
                        <span className="text-2xl font-bold text-white">{analysis.metrics.conversionRate}%</span>
                    </div>
                    <p className="text-sm text-gray-400">Conversion Rate</p>
                    <p className="text-xs text-gray-500 mt-1">Interview → Offer</p>
                </div>

                <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <AlertTriangle className="text-red-400" size={24} />
                        <span className="text-2xl font-bold text-white">{analysis.metrics.atRiskCount}</span>
                    </div>
                    <p className="text-sm text-gray-400">At-Risk Candidates</p>
                    <p className="text-xs text-gray-500 mt-1">Needs attention</p>
                </div>
            </div>

            {/* Alerts */}
            <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-amber-400" />
                    Active Alerts ({analysis.alerts.length})
                </h2>
                <div className="space-y-3">
                    {analysis.alerts.map((alert, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-xl border ${getAlertColor(alert.severity)}`}
                        >
                            <div className="flex items-start gap-3">
                                {getAlertIcon(alert.type)}
                                <div className="flex-grow">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-semibold text-white">{alert.title}</h3>
                                        <span className="text-xs px-2 py-1 bg-slate-900/50 rounded uppercase font-bold text-gray-300">
                                            {alert.severity}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300 mb-2">{alert.description}</p>
                                    {alert.affectedCandidates.length > 0 && (
                                        <p className="text-xs text-gray-500 mb-2">
                                            Affected: {alert.affectedCandidates.join(', ')}
                                        </p>
                                    )}
                                    <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
                                        <p className="text-xs text-sky-300 font-medium flex items-center gap-2">
                                            <CheckCircle size={14} />
                                            Recommendation: {alert.recommendation}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Insights & Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Key Insights */}
                <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="text-sky-400" />
                        Key Insights
                    </h2>
                    <ul className="space-y-3">
                        {analysis.insights.map((insight, index) => (
                            <li key={index} className="flex items-start gap-3 text-gray-300 text-sm">
                                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                                <span>{insight}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Recommendations */}
                <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Target className="text-purple-400" />
                        Recommendations
                    </h2>
                    <ul className="space-y-3">
                        {analysis.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start gap-3 text-gray-300 text-sm">
                                <Zap size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                <span>{rec}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Refresh Button */}
            <div className="flex justify-center">
                <button
                    onClick={analyzePipeline}
                    className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                    <Activity size={18} />
                    Refresh Analysis
                </button>
            </div>
        </div>
    );
};

export default PipelineDashboard;
