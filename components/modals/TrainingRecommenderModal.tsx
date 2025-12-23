import React, { useState } from 'react';
import { X, GraduationCap, Loader2, Target, Clock, TrendingUp, ExternalLink, BookOpen, Award } from 'lucide-react';
import type { Candidate, Job } from '../../types';
import * as geminiService from '../../services/geminiService';
import { useToast } from '../../contexts/ToastContext';

interface TrainingRecommenderModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: Candidate;
    job: Job;
}

const TrainingRecommenderModal: React.FC<TrainingRecommenderModalProps> = ({ isOpen, onClose, candidate, job }) => {
    const [recommendations, setRecommendations] = useState<geminiService.TrainingRecommendation | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const { showToast } = useToast();

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const result = await geminiService.generateTrainingRecommendations(candidate, job);
            setRecommendations(result);
        } catch (error) {
            console.error('Error generating recommendations:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
            case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'low': return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[110]" onClick={onClose}>
            <div
                className="bg-slate-900 shadow-2xl rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <GraduationCap className="text-sky-400" />
                            Skill Gap Training Recommender
                        </h2>
                        <p className="text-gray-400 mt-1">
                            Personalized learning path for {candidate.name} → {job.title}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-auto custom-scrollbar p-6">
                    {!recommendations ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-12 w-12 animate-spin text-sky-500 mb-4" />
                                    <p className="text-gray-300 font-medium">Analyzing skill gaps...</p>
                                    <p className="text-gray-500 text-sm mt-2">Creating personalized training plan</p>
                                </>
                            ) : (
                                <>
                                    <GraduationCap className="h-16 w-16 text-sky-400 mb-4" />
                                    <p className="text-gray-300 font-medium mb-4">Ready to generate training recommendations</p>
                                    <button
                                        onClick={handleGenerate}
                                        className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <Target size={18} />
                                        Generate Learning Plan
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                                    <BookOpen className="text-sky-400" size={20} />
                                    Training Plan Summary
                                </h3>
                                <p className="text-gray-300 mb-3">{recommendations.summary}</p>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2 text-sky-300">
                                        <Clock size={16} />
                                        <span>Time to Ready: <strong>{recommendations.estimatedTimeToReady}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2 text-purple-300">
                                        <Target size={16} />
                                        <span>{recommendations.skillGaps.length} Skills to Develop</span>
                                    </div>
                                </div>
                            </div>

                            {/* Skill Gaps */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Target className="text-amber-400" size={20} />
                                    Identified Skill Gaps ({recommendations.skillGaps.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {recommendations.skillGaps.map((gap, index) => (
                                        <div
                                            key={index}
                                            className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="text-white font-semibold">{gap.skill}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full uppercase font-bold border ${getPriorityColor(gap.priority)}`}>
                                                    {gap.priority}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                                <div>
                                                    <p className="text-gray-500">Current</p>
                                                    <p className="text-gray-400 capitalize">{gap.currentLevel}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500">Required</p>
                                                    <p className="text-green-400 capitalize font-medium">{gap.requiredLevel}</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                <Clock size={12} />
                                                {gap.estimatedLearningTime}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recommended Courses */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Award className="text-green-400" size={20} />
                                    Recommended Courses ({recommendations.recommendedCourses.length})
                                </h3>
                                <div className="space-y-3">
                                    {recommendations.recommendedCourses.map((course, index) => (
                                        <div
                                            key={index}
                                            className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 hover:border-sky-500/30 transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-grow">
                                                    <h4 className="text-white font-semibold mb-1">{course.title}</h4>
                                                    <p className="text-sm text-gray-400">{course.provider}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded border border-green-500/30">
                                                        {course.relevance}% Match
                                                    </span>
                                                    {course.url && (
                                                        <a
                                                            href={course.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-slate-700 rounded transition-colors"
                                                            title="View course"
                                                        >
                                                            <ExternalLink size={16} />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {course.duration}
                                                </span>
                                                <span className="capitalize">{course.format}</span>
                                                <span className="text-sky-400 font-medium">{course.cost}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Learning Path */}
                            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50">
                                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                                    <TrendingUp className="text-purple-400" size={20} />
                                    Recommended Learning Path
                                </h3>
                                <ol className="space-y-2">
                                    {recommendations.learningPath.map((step, index) => (
                                        <li key={index} className="flex items-start gap-3 text-gray-300">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">
                                                {index + 1}
                                            </span>
                                            <span className="pt-0.5">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                        <GraduationCap size={14} className="inline text-sky-400 mr-1" />
                        Accelerate internal mobility and reduce external hiring costs
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                        >
                            Close
                        </button>
                        {recommendations && (
                            <button
                                onClick={() => {
                                    showToast('Training plan assigned. Candidate notification is a demo placeholder.', 'success');
                                    onClose();
                                }}
                                className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                                <Award size={18} />
                                Assign Training Plan
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrainingRecommenderModal;
