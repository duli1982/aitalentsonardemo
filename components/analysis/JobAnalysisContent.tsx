import React, { useMemo } from 'react';
import type { JobAnalysis } from '../../types';
import { ShieldCheck, TrendingUp, ListChecks, CheckCircle, Star, Sparkles } from 'lucide-react';

const JobAnalysisContent: React.FC<{ analysis: JobAnalysis }> = ({ analysis }) => {
    const mustHaveSkills = useMemo(() => analysis.skillRequirements?.filter(s => s.level === 'must-have') || [], [analysis.skillRequirements]);
    const niceToHaveSkills = useMemo(() => analysis.skillRequirements?.filter(s => s.level === 'nice-to-have') || [], [analysis.skillRequirements]);

    return (
        <div className="space-y-6 text-sm">
            <section>
                <h4 className="font-semibold text-lg text-green-300 mb-2 flex items-center"><ShieldCheck size={20} className="mr-2" /> Seniority Analysis</h4>
                <div className="p-3 rounded-md bg-slate-700/40 space-y-2">
                    <p><span className="font-medium text-green-400/90">Determined Seniority:</span> <span className="font-bold text-lg text-green-400">{analysis.trueSeniorityLevel}</span></p>
                    <p><span className="font-medium text-green-400/90">Rationale:</span> {analysis.seniorityRationale}</p>
                </div>
            </section>
            <section>
                <h4 className="font-semibold text-lg text-purple-300 mb-2 flex items-center"><TrendingUp size={20} className="mr-2" /> Potential Growth Pathways</h4>
                <div className="p-3 rounded-md bg-slate-700/40">
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {analysis.growthPathways?.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </div>
            </section>
            <section>
                <h4 className="font-semibold text-lg text-sky-300 mb-2 flex items-center"><ListChecks size={20} className="mr-2" /> Skill Requirements</h4>
                <div className="space-y-3">
                    <div>
                        <h5 className="font-semibold text-sky-400 mb-1 flex items-center"><CheckCircle size={16} className="mr-2 text-green-400" />Must-Haves</h5>
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
                        <h5 className="font-semibold text-sky-400 mb-1 flex items-center"><Star size={16} className="mr-2 text-yellow-400" />Nice-to-Haves</h5>
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
                <h4 className="font-semibold text-lg text-teal-300 mb-2 flex items-center"><Sparkles size={20} className="mr-2" /> Ideal Candidate Profile</h4>
                <div className="p-3 rounded-md bg-slate-700/40">
                    <p className="text-gray-300 italic">{analysis.idealCandidateProfile}</p>
                </div>
            </section>
        </div>
    );
};

export default JobAnalysisContent;
