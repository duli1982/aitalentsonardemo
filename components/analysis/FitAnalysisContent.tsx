import React from 'react';
import type { FitAnalysis, Job, Candidate, MultiDimensionalAnalysis } from '../../types';
import { Target, TrendingUp, Gauge, ThumbsUp, ThumbsDown, ShieldCheck, Zap, Brain, Users } from 'lucide-react';
import SkillGapChart from '../SkillGapChart';

const DimensionBreakdown: React.FC<{ analysis: MultiDimensionalAnalysis }> = ({ analysis }) => {
    const dimensions = [
        { title: "Technical Skill Alignment", data: analysis.technicalSkillAlignment, icon: <ShieldCheck size={20} className="mr-3 text-blue-400" /> },
        { title: "Transferable Skill Mapping", data: analysis.transferableSkillMapping, icon: <Zap size={20} className="mr-3 text-yellow-400" /> },
        { title: "Career Stage Alignment", data: analysis.careerStageAlignment, icon: <TrendingUp size={20} className="mr-3 text-green-400" /> },
        { title: "Learning Agility Indicators", data: analysis.learningAgilityIndicators, icon: <Brain size={20} className="mr-3 text-purple-400" /> },
        { title: "Team Fit Signals", data: analysis.teamFitSignals, icon: <Users size={20} className="mr-3 text-teal-400" /> }
    ];

    return (
        <section>
            <h4 className="font-semibold text-lg text-sky-300 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m12 12-4 6"></path><path d="m16 6-4 6"></path></svg>
                Multi-Dimensional Analysis
            </h4>
            <div className="space-y-4">
                {dimensions.map(({ title, data, icon }) => (
                    <div key={title} className="p-3 rounded-lg bg-slate-700/40 border-l-4 border-slate-600">
                        <div className="flex justify-between items-center mb-1">
                            <h5 className="font-semibold text-sky-400 flex items-center">{icon} {title}</h5>
                            <span className="font-bold text-xl text-sky-300">{data.score}<span className="text-sm">/100</span></span>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-1.5 mb-2">
                            <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${data.score}%` }}></div>
                        </div>
                        <p className="text-xs text-gray-400 italic">{data.rationale}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

const FitAnalysisContent: React.FC<{ analysis: FitAnalysis; job: Job; candidate: Candidate; }> = ({ analysis, job, candidate }) => (
    <div className="space-y-6 text-sm">
        <section>
            <h4 className="font-semibold text-lg text-purple-300 mb-2 flex items-center">
                <Target size={20} className="mr-2" /> Overall Fit Assessment
            </h4>
            <div className="p-4 rounded-lg bg-slate-700/40 space-y-3">
                <div className="text-center mb-2">
                    <h4 className="font-semibold text-sky-400/90 mb-1">Overall Match Score</h4>
                    <p className={`font-bold text-5xl ${analysis.matchScore > 75 ? 'text-green-400' : analysis.matchScore > 50 ? 'text-yellow-400' : 'text-red-400'}`}>{analysis.matchScore}<span className="text-2xl">%</span></p>
                </div>
                <div>
                    <h4 className="font-semibold text-sky-400/90 mb-1">Summary Rationale:</h4>
                    <p className="text-gray-300 italic">{analysis.matchRationale}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-600/50">
                    <div>
                        <h4 className="font-semibold text-green-400 mb-1">Strengths:</h4>
                        <ul className="list-disc list-inside text-gray-300 space-y-1">
                            {analysis.strengths?.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-red-400 mb-1">Potential Gaps:</h4>
                        <ul className="list-disc list-inside text-gray-300 space-y-1">
                            {analysis.gaps?.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        {analysis.multiDimensionalAnalysis && <DimensionBreakdown analysis={analysis.multiDimensionalAnalysis} />}

        {analysis.skillGapAnalysis && analysis.skillGapAnalysis.length > 0 && (
            <section>
                <h4 className="font-semibold text-lg text-teal-300 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m12 3-1.9 1.9a2 2 0 0 0 0 2.82L12 9.5l1.9-1.78a2 2 0 0 0 0-2.82Z" /><path d="m21.08 11.92-1.9-1.9a2 2 0 0 0-2.82 0L14.5 12l1.78 1.9a2 2 0 0 0 2.82 0Z" /><path d="M3 11.92 4.9 10a2 2 0 0 1 2.82 0L9.5 12 7.72 13.9a2 2 0 0 1-2.82 0Z" /><path d="m12 21-1.9-1.9a2 2 0 0 1 0-2.82L12 14.5l1.9 1.78a2 2 0 0 1 0 2.82Z" /></svg>
                    Skill Gap Visualization
                </h4>
                <div className="p-3 rounded-md bg-slate-700/40 flex justify-center items-center">
                    {job.requiredSkills && job.requiredSkills.length > 0 ? (
                        <SkillGapChart analysis={analysis.skillGapAnalysis} jobSkills={job.requiredSkills} />
                    ) : (
                        <p className="text-gray-400 italic">No job skills defined for gap analysis.</p>
                    )}
                </div>
            </section>
        )}

        {analysis.futurePotentialProjection && (
            <section>
                <h4 className="font-semibold text-lg text-green-300 mb-2 flex items-center">
                    <Gauge size={20} className="mr-2" /> Future Potential Projection
                </h4>
                <div className="p-3 rounded-md bg-slate-700/40 space-y-2">
                    <p><span className="font-medium text-green-400/90">Suggested Future Role:</span> {analysis.futurePotentialProjection.suggestedFutureRole}</p>
                    <p><span className="font-medium text-green-400/90">Projected Timeframe:</span> {analysis.futurePotentialProjection.estimatedTimeframe}</p>
                    <p><span className="font-medium text-green-400/90">Potential Score:</span> <span className="font-bold text-xl text-green-400">{analysis.futurePotentialProjection.potentialScore}</span>/100</p>
                    <p><span className="font-medium text-green-400/90">Rationale:</span> {analysis.futurePotentialProjection.rationale}</p>
                </div>
            </section>
        )}
        <section>
            <h4 className="font-semibold text-lg text-sky-300 mb-2 flex items-center">Feedback</h4>
            <div className="p-4 rounded-lg bg-slate-700/40 flex items-center justify-between">
                <p className="text-gray-300">Was this AI analysis helpful?</p>
                <div className="flex items-center space-x-3">
                    <button onClick={() => console.log(`FEEDBACK LOOP (Analysis Quality): User found FIT_ANALYSIS for Candidate ${candidate.id} on Job ${job.id} HELPFUL.`)} className="flex items-center space-x-2 px-4 py-2 rounded-md bg-green-500/20 hover:bg-green-500/40 text-green-300 font-medium transition-colors"><ThumbsUp size={16} /> <span>Helpful</span></button>
                    <button onClick={() => console.log(`FEEDBACK LOOP (Analysis Quality): User found FIT_ANALYSIS for Candidate ${candidate.id} on Job ${job.id} NOT HELPFUL.`)} className="flex items-center space-x-2 px-4 py-2 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-300 font-medium transition-colors"><ThumbsDown size={16} /> <span>Not Helpful</span></button>
                </div>
            </div>
        </section>
    </div>
);

export default FitAnalysisContent;
