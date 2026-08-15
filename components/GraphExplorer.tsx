import React, { useEffect, useState } from 'react';
import { graphEngine } from '../services/GraphEngine';
import { Job, Candidate } from '../types';
import { Network, GitGraph, Share2 } from 'lucide-react';

interface GraphExplorerProps {
    job: Job;
    candidates: Candidate[];
}

const GraphExplorer: React.FC<GraphExplorerProps> = ({ job, candidates }) => {
    const [results, setResults] = useState<{ candidateId: string, score: number, explanation: string[] }[]>([]);

    useEffect(() => {
        // 1. Ingest Data
        graphEngine.ingestJob(job);
        candidates.forEach(c => graphEngine.ingestCandidate(c));

        // 2. Query
        const matches = graphEngine.findTalentForRole(job.id);
        setResults(matches);
    }, [job, candidates]);

    return (
        <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 mt-6">
            <div className="flex items-center mb-4">
                <Share2 className="text-purple-400 mr-2 h-6 w-6" />
                <h3 className="text-xl font-bold text-white">Unified Talent Graph Insights</h3>
            </div>

            <div className="space-y-4">
                {results.slice(0, 3).map((match, idx) => {
                    const candidate = candidates.find(c => c.id === match.candidateId);
                    if (!candidate) return null;

                    return (
                        <div key={match.candidateId} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-semibold text-lg text-sky-300">{candidate.name}</h4>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Graph Match Score: {match.score}</p>
                                </div>
                                <div className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded text-xs border border-purple-500/30 flex items-center">
                                    <Network className="w-3 h-3 mr-1" />
                                    Graph-inferred
                                </div>
                            </div>

                            <ul className="space-y-1">
                                {match.explanation.map((exp, i) => (
                                    <li key={i} className="text-sm text-gray-300 flex items-start">
                                        <span className="text-green-400 mr-2">●</span>
                                        {exp}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GraphExplorer;
