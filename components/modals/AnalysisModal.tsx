import React, { useState, useEffect, useMemo } from 'react';
import type { Job, Candidate, AnalysisResult, JobAnalysis, FitAnalysis, HiddenGemAnalysis, MultiDimensionalAnalysis } from '../../types';
import { X, Loader2, Sparkles, TrendingUp, Target, MessageSquare, Diamond, Zap, Brain, Gauge, ShieldCheck, ListChecks, CheckCircle, Star, Users, ThumbsUp, ThumbsDown } from 'lucide-react';
import SkillGapChart from '../SkillGapChart';

interface AnalysisModalProps {
  type: string;
  job: Job;
  candidate?: Candidate;
  isLoading: boolean;
  analysisResult: AnalysisResult | null;
  onClose: () => void;
}

const JobAnalysisContent: React.FC<{ analysis: JobAnalysis }> = ({ analysis }) => {
    const mustHaveSkills = useMemo(() => analysis.skillRequirements?.filter(s => s.level === 'must-have') || [], [analysis.skillRequirements]);
    const niceToHaveSkills = useMemo(() => analysis.skillRequirements?.filter(s => s.level === 'nice-to-have') || [], [analysis.skillRequirements]);

    return (
        <div className="space-y-6 text-sm">
            <section>
                <h4 className="font-semibold text-lg text-green-300 mb-2 flex items-center"><ShieldCheck size={20} className="mr-2"/> Seniority Analysis</h4>
                <div className="p-3 rounded-md bg-slate-700/40 space-y-2">
                    <p><span className="font-medium text-green-400/90">Determined Seniority:</span> <span className="font-bold text-lg text-green-400">{analysis.trueSeniorityLevel}</span></p>
                    <p><span className="font-medium text-green-400/90">Rationale:</span> {analysis.seniorityRationale}</p>
                </div>
            </section>
             <section>
                <h4 className="font-semibold text-lg text-purple-300 mb-2 flex items-center"><TrendingUp size={20} className="mr-2"/> Potential Growth Pathways</h4>
                <div className="p-3 rounded-md bg-slate-700/40">
                     <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {analysis.growthPathways?.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </div>
            </section>
            <section>
                <h4 className="font-semibold text-lg text-sky-300 mb-2 flex items-center"><ListChecks size={20} className="mr-2"/> Skill Requirements</h4>
                <div className="space-y-3">
                    <div>
                        <h5 className="font-semibold text-sky-400 mb-1 flex items-center"><CheckCircle size={16} className="mr-2 text-green-400"/>Must-Haves</h5>
                        <ul className="space-y-2">
                            {mustHaveSkills.map(s => (
                                <li key={s.skill} className="p-2 rounded bg-slate-700/30 border-l-2 border-green-500">
                                    <p className="font-semibold text-sky-400">{s.skill}</p>
                                    <p className="text-xs text-gray-400">{s.rationale}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div>
                        <h5 className="font-semibold text-sky-400 mb-1 flex items-center"><Star size={16} className="mr-2 text-yellow-400"/>Nice-to-Haves</h5>
                         <ul className="space-y-2">
                            {niceToHaveSkills.map(s => (
                                <li key={s.skill} className="p-2 rounded bg-slate-700/30 border-l-2 border-yellow-500">
                                    <p className="font-semibold text-sky-400">{s.skill}</p>
                                    <p className="text-xs text-gray-400">{s.rationale}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>
            <section>
                <h4 className="font-semibold text-lg text-teal-300 mb-2 flex items-center"><Sparkles size={20} className="mr-2"/> Ideal Candidate Profile</h4>
                <div className="p-3 rounded-md bg-slate-700/40">
                    <p className="text-gray-300 italic">{analysis.idealCandidateProfile}</p>
                </div>
            </section>
        </div>
    );
};

const DimensionBreakdown: React.FC<{ analysis: MultiDimensionalAnalysis }> = ({ analysis }) => {
    const dimensions = [
        { title: "Technical Skill Alignment", data: analysis.technicalSkillAlignment, icon: <ShieldCheck size={20} className="mr-3 text-blue-400"/> },
        { title: "Transferable Skill Mapping", data: analysis.transferableSkillMapping, icon: <Zap size={20} className="mr-3 text-yellow-400"/> },
        { title: "Career Stage Alignment", data: analysis.careerStageAlignment, icon: <TrendingUp size={20} className="mr-3 text-green-400"/> },
        { title: "Learning Agility Indicators", data: analysis.learningAgilityIndicators, icon: <Brain size={20} className="mr-3 text-purple-400"/> },
        { title: "Team Fit Signals", data: analysis.teamFitSignals, icon: <Users size={20} className="mr-3 text-teal-400"/> }
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
                <Target size={20} className="mr-2"/> Overall Fit Assessment
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
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="m12 3-1.9 1.9a2 2 0 0 0 0 2.82L12 9.5l1.9-1.78a2 2 0 0 0 0-2.82Z"/><path d="m21.08 11.92-1.9-1.9a2 2 0 0 0-2.82 0L14.5 12l1.78 1.9a2 2 0 0 0 2.82 0Z"/><path d="M3 11.92 4.9 10a2 2 0 0 1 2.82 0L9.5 12 7.72 13.9a2 2 0 0 1-2.82 0Z"/><path d="m12 21-1.9-1.9a2 2 0 0 1 0-2.82L12 14.5l1.9 1.78a2 2 0 0 1 0 2.82Z"/></svg>
                    Skill Gap Visualization
                </h4>
                <div className="p-3 rounded-md bg-slate-700/40 flex justify-center items-center">
                    <SkillGapChart analysis={analysis.skillGapAnalysis} jobSkills={job.requiredSkills} />
                </div>
            </section>
        )}

        {analysis.futurePotentialProjection && (
             <section>
                <h4 className="font-semibold text-lg text-green-300 mb-2 flex items-center">
                    <Gauge size={20} className="mr-2"/> Future Potential Projection
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


const HiddenGemAnalysisContent: React.FC<{ analysis: HiddenGemAnalysis }> = ({ analysis }) => (
    <div className="space-y-5 text-sm">
        <div>
            <h4 className="font-semibold text-lg text-amber-300 mb-1 flex items-center">
                <Sparkles size={18} className="mr-2"/> Gem Rationale
            </h4>
            <p className="text-gray-300 bg-slate-700/30 p-3 rounded-md">{analysis.gemRationale || "N/A"}</p>
        </div>
        <div>
            <h4 className="font-semibold text-lg text-amber-300 mb-2 flex items-center">
                <Zap size={18} className="mr-2"/> Transferable Skills Analysis
            </h4>
            {analysis.transferableSkillsAnalysis?.length > 0 ? (
                <ul className="space-y-3">
                    {analysis.transferableSkillsAnalysis.map((item, index) => (
                        <li key={index} className="p-3 rounded-md bg-slate-700/30">
                            <p className="font-semibold text-sky-400">{item.skill}</p>
                            <p className="text-xs text-gray-400 mt-0.5 mb-1"><span className="font-medium text-gray-500">Evidence:</span> {item.candidateEvidence}</p>
                            <p className="text-xs text-gray-300"><span className="font-medium text-gray-500">Relevance to Job:</span> {item.relevanceToJob}</p>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-gray-400">No specific transferable skills highlighted.</p>}
        </div>
        <div>
            <h4 className="font-semibold text-lg text-amber-300 mb-1 flex items-center">
               <Brain size={18} className="mr-2" /> Unconventional Fit Rationale
            </h4>
            <p className="text-gray-300 bg-slate-700/30 p-3 rounded-md">{analysis.unconventionalFitRationale || "N/A"}</p>
        </div>
    </div>
);

const OutreachContent: React.FC<{ message: string }> = ({ message }) => {
    const [editedMessage, setEditedMessage] = useState(message);
    useEffect(() => setEditedMessage(message), [message]);

    return (
        <textarea
            value={editedMessage}
            onChange={(e) => setEditedMessage(e.target.value)}
            className="w-full h-64 p-3 rounded-md bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none resize-none text-sm text-gray-200 custom-scrollbar"
        />
    );
};


const AnalysisModal: React.FC<AnalysisModalProps> = ({ type, job, candidate, isLoading, analysisResult, onClose }) => {
  const TITLES: { [key: string]: { icon: React.ReactNode, text: string } } = {
    JOB_SUMMARY: { icon: <Target className="h-6 w-6 mr-2 text-sky-400"/>, text: "AI Job Analysis" },
    FIT_ANALYSIS: { icon: <TrendingUp className="h-6 w-6 mr-2 text-purple-400"/>, text: "AI Fit Analysis" },
    HIDDEN_GEM_ANALYSIS: { icon: <Diamond className="h-6 w-6 mr-2 text-amber-400"/>, text: "Hidden Gem Deep Dive" },
    OUTREACH: { icon: <MessageSquare className="h-6 w-6 mr-2 text-blue-400"/>, text: "AI Outreach Message" }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-sky-500" /> Generating...
        </div>
      );
    }
    if (!analysisResult) return <p className="text-center text-gray-400 py-10">No analysis result available.</p>;

    switch(type) {
        case 'JOB_SUMMARY':
            return <JobAnalysisContent analysis={analysisResult as JobAnalysis} />;
        case 'FIT_ANALYSIS':
            return <FitAnalysisContent analysis={analysisResult as FitAnalysis} job={job} candidate={candidate!} />;
        case 'HIDDEN_GEM_ANALYSIS':
            return <HiddenGemAnalysisContent analysis={analysisResult as HiddenGemAnalysis} />;
        case 'OUTREACH':
            return <OutreachContent message={analysisResult as string} />;
        default:
            return <p>Invalid analysis type.</p>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-sky-400 flex items-center">
            {TITLES[type]?.icon || <Sparkles className="h-6 w-6 mr-2" />} {TITLES[type]?.text || "AI Analysis"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors"><X size={24} /></button>
        </div>
        <div className="mb-3 p-3 bg-slate-700/50 rounded-md text-sm">
            <p><span className="font-semibold text-sky-400/80">Role:</span> {job.title}</p>
            {candidate && <p><span className="font-semibold text-sky-400/80">Candidate:</span> {candidate.name}</p>}
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-grow pr-2">
            {renderContent()}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors">Close</button>
           {type === 'OUTREACH' && <button onClick={() => alert(`Simulated: Message sent to ${candidate?.name}!`)} className="px-6 py-2 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold">Send Message</button>}
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;