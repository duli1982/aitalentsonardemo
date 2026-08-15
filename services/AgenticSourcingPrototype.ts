
import { agenticTools } from './AgenticSearchTools';
import { jobContextPackService } from './JobContextPackService';
import { Result, ok, err } from '../types/result';
import type { Job } from '../types';
import { hybridCandidateRankingService } from './HybridCandidateRankingService';


export interface AgenticSearchResult {
    candidateId: string;
    candidateName: string;
    candidateSkills: string[];
    score: number;
    reasoning: string[];
    sources: string[]; // 'keyword', 'vector', 'graph'
    fullCandidate?: Record<string, unknown>; // The original candidate object from the search tool
    semanticSimilarity?: number;
    verificationAdjustment?: number;
}

export class AgenticSourcingPrototype {


    /**
     * The "Brain" of the agent.
     * Unlike the standard agent which just calls `vectorSearch.search(query)`,
     * this method reasons about the best way to find candidates.
     */
    async findCandidatesForJob(job: Job): Promise<Result<AgenticSearchResult[]>> {
        console.log(`[AgenticSourcing] 🕵️ Starting investigation for: ${job.title}`);

        const candidates = new Map<string, AgenticSearchResult>();
        const reasoningLog: string[] = [];

        // Step 1: Analyze the Request
        // In a full agent, an LLM would do this. Here we use heuristics.
        const mustHaveSkills = job.requiredSkills || [];
        const isSenior = job.title.toLowerCase().includes('senior') ||
            job.title.toLowerCase().includes('lead') ||
            (job.description && job.description.includes('5+ years'));

        reasoningLog.push(`Analysis: Job requires [${mustHaveSkills.join(', ')}]. Seniority: ${isSenior ? 'High' : 'Normal'}.`);

        // Step 2: High-Precision Search (Keyword/Grep)
        // "Let's first check if we have anyone who explicitly lists the required skills."
        if (mustHaveSkills.length > 0) {
            // We search for the top 2 most critical skills (heuristic)
            const skillsToSearch = mustHaveSkills.slice(0, 2);
            const query = skillsToSearch.join(' ');

            console.log(`[AgenticSourcing] 🔧 Executing Keyword Tool with query: "${query}"`);
            const keywordRes = await agenticTools.keyword.execute({ query, limit: 5 });

            if (keywordRes.success) {
                reasoningLog.push(`Keyword Search ("${query}") found ${keywordRes.data.results.length} results.`);

                for (const c of keywordRes.data.results) {
                    this.mergeResult(candidates, c.id, c.name, c.skills || [], c, 80, `Matched keywords: ${query}`, 'keyword');
                }
            }
        }

        // Step 3: Semantic Broad Search (Vector)
        // "Now let's cast a wider net to find people who might not have exact keywords but fit the vibe."
        console.log(`[AgenticSourcing] 🔧 Executing Vector Tool with query: "${job.title}"`);
        const vectorRes = await agenticTools.vector.execute({ query: job.title, limit: 10 });

        if (vectorRes.success) {
            reasoningLog.push(`Vector Search found ${vectorRes.data.results.length} results.`);

            for (const c of vectorRes.data.results) {
                // Vector scores are 0-1, we map to 0-100.
                const score = Math.round((c.similarity || 0) * 100);
                    this.mergeResult(candidates, c.id, c.name, c.skills || [], c, score, `Vector similarity: ${score}%`, 'vector', c.similarity);
            }
        }

        // Step 4: Verification (Reading)
        // "If we're looking for a specific seniority, let's verify."
        if (isSenior) {
            // Filter our current candidate list for those who haven't been "verified" by keyword (heuristically assume keyword matches might be better)
            // Or just verify the top 3 vector matches.

            const topCandidates = Array.from(candidates.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            for (const cand of topCandidates) {
                console.log(`[AgenticSourcing] 📖 Reading profile for verification: ${cand.candidateId}`);
                const readRes = await agenticTools.reader.execute({ candidateId: cand.candidateId });

                if (readRes.success && readRes.data.results.length > 0) {
                    const content = readRes.data.results[0].content || '';
                    if (!content.toLowerCase().includes('senior') && !content.toLowerCase().includes('lead')) {
                        cand.verificationAdjustment = -10;
                        cand.reasoning.push("Verification: 'Senior/Lead' keyword missing in full profile.");
                    } else {
                        cand.verificationAdjustment = 5;
                        cand.reasoning.push("Verification: Seniority confirmed in profile text.");
                    }
                }
            }
        }

        const ranked = hybridCandidateRankingService.rankForJob(job, Array.from(candidates.values()).map((candidate) => ({
            id: candidate.candidateId,
            name: candidate.candidateName,
            skills: candidate.candidateSkills,
            semanticSimilarity: candidate.semanticSimilarity,
            title: typeof candidate.fullCandidate?.role === 'string'
                ? candidate.fullCandidate.role
                : typeof candidate.fullCandidate?.title === 'string' ? candidate.fullCandidate.title : undefined,
        })));
        const results = ranked.map((rankedCandidate) => {
            const candidate = candidates.get(rankedCandidate.id)!;
            const score = Math.max(0, Math.min(100, rankedCandidate.hybridScore + (candidate.verificationAdjustment ?? 0)));
            return {
                ...candidate,
                score,
                reasoning: [...candidate.reasoning, ...rankedCandidate.reasons],
            };
        });
        console.log(`[AgenticSourcing] ✅ Investigation complete. Found ${results.length} candidates.`);

        return ok(results);
    }

    private mergeResult(
        map: Map<string, AgenticSearchResult>,
        id: string,
        name: string,
        skills: string[],
        fullCandidate: Record<string, unknown>,
        score: number,
        reason: string,
        source: string,
        semanticSimilarity?: number
    ) {
        if (!map.has(id)) {
            map.set(id, {
                candidateId: id,
                candidateName: name,
                candidateSkills: skills,
                fullCandidate,
                score,
                reasoning: [reason],
                sources: [source],
                semanticSimilarity
            });
        } else {
            const existing = map.get(id)!;
            // Boost score if found by multiple sources
            existing.score = Math.max(existing.score, score) + 5;
            existing.reasoning.push(reason);
            if (!existing.sources.includes(source)) {
                existing.sources.push(source);
            }
            if (semanticSimilarity !== undefined) {
                existing.semanticSimilarity = Math.max(existing.semanticSimilarity ?? 0, semanticSimilarity);
            }
            // Update full candidate if the new one has more info (heuristic)
            if (!existing.fullCandidate && fullCandidate) {
                existing.fullCandidate = fullCandidate;
            }
        }
    }
}

export const agenticSourcingPrototype = new AgenticSourcingPrototype();
