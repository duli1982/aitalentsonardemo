
import { supabase } from './supabaseClient';
import { Result, ok, err } from '../types/result';
import { upstream, notConfigured } from './errorHandling';
import { semanticSearchService as vectorSearch } from './SemanticSearchService';

// --- Tool Interfaces ---

export interface SearchToolParams {
    query: string;
    limit?: number;
    filters?: Record<string, any>;
}

export interface SearchToolResult<T> {
    results: T[];
    metadata?: any;
    toolName: string;
}

export interface SearchTool<TParams, TResult> {
    name: string;
    description: string;
    execute(params: TParams): Promise<Result<SearchToolResult<TResult>>>;
}

// --- Concrete Tools ---

/**
 * Tool 1: Keyword Search (Grep-style)
 * Uses Supabase text search for exact matches.
 * Good for: "Python", "San Francisco", specific company names.
 */
export class KeywordSearchTool implements SearchTool<SearchToolParams, any> {
    name = "keyword_search";
    description = "Search for candidates containing exact keywords (high precision, low recall). Use for specific skills, companies, or titles.";

    async execute(params: SearchToolParams): Promise<Result<SearchToolResult<any>>> {
        if (!supabase) {
            return err(notConfigured('KeywordSearchTool', 'Supabase is not configured.'));
        }

        const { query, limit = 10 } = params;
        // Using simple text search on the 'content' column of candidate_documents
        // Note: Real implementation might use a dedicated full-text index if available. 
        // For now, we use ILIKE or a simple text search RPC if available. 
        // Defaulting to simple ILIKE for prototype stability if no FTS setup.

        try {
            const { data, error } = await supabase
                .from('candidate_documents')
                .select('metadata, content')
                .textSearch('content', `'${query}'`, { type: 'websearch', config: 'english' })
                .limit(limit);

            if (error) {
                return err(upstream('KeywordSearchTool', `Supabase text search failed: ${error.message}`, error));
            }

            const results = (data || []).map((row: any) => ({
                ...row.metadata,
                contentSnippet: row.content?.slice(0, 200) + '...'
            }));

            return ok({
                results,
                toolName: this.name,
                metadata: { query }
            });

        } catch (e) {
            return err(upstream('KeywordSearchTool', `Unexpected error: ${e}`));
        }
    }
}

/**
 * Tool 2: Semantic Vector Search
 * Uses existing RAG vectors.
 * Good for: Concepts, "leadership", "fast learner", soft skills.
 */
export class VectorSearchTool implements SearchTool<SearchToolParams, any> {
    name = "vector_search";
    description = "Search for candidates by meaning/concept (high recall). Use for role descriptions, soft skills, or broad queries.";

    async execute(params: SearchToolParams): Promise<Result<SearchToolResult<any>>> {
        const res = await vectorSearch.search(params.query, { limit: params.limit || 10 });

        if (!res.success) {
            return err(res.error);
        }

        return ok({
            results: res.data.map((c) => ({
                id: c.id,
                name: c.name,
                similarity: c.similarity,
                skills: c.skills,
                role: c.metadata?.role || c.metadata?.title
            })),
            toolName: this.name
        });
    }
}

/**
 * Tool 3: Candidate Reader
 * Fetches full details for a specific ID.
 * Used when the agent says "I found a match, let me verify their experience."
 */
export class CandidateReaderTool implements SearchTool<{ candidateId: string }, any> {
    name = "candidate_reader";
    description = "Read the full profile and resume of a specific candidate. Use this to verify details found in search.";

    async execute(params: { candidateId: string }): Promise<Result<SearchToolResult<any>>> {
        if (!supabase) {
            return err(notConfigured('CandidateReaderTool', 'Supabase is not configured.'));
        }

        const { data, error } = await supabase
            .from('candidate_documents')
            .select('content, metadata')
            .eq('metadata->>id', params.candidateId)
            .single();

        if (error) {
            return err(upstream('CandidateReaderTool', `Failed to read candidate: ${error.message}`, error));
        }

        return ok({
            results: [data],
            toolName: this.name
        });
    }
}

/**
 * Tool 4: Fact Checker
 * Verifies if a candidate's claims align with other candidates from the same company.
 * e.g. "Candidate claims to be Senior at Netflix." -> "Do other Netflix Seniors list similar skills?"
 */
export class FactCheckerTool implements SearchTool<{ company: string; role?: string }, any> {
    name = "fact_checker";
    description = "Verify a candidate's background by comparing them to peers from the same company in the database.";

    async execute(params: { company: string; role?: string }): Promise<Result<SearchToolResult<any>>> {
        // 1. Find peers from the same company
        // In a real app, we'd also filter by 'role' fuzzy match, but for now we look at the whole company cohort.
        const res = await import('./GraphQueryService').then(m => m.graphQueryService.findCandidatesByCompany(params.company));

        if (!res.success) {
            return err(upstream('FactCheckerTool', `Failed to fetch peers for ${params.company}`, res.error));
        }

        const peers = res.data;
        if (peers.length === 0) {
            return ok({
                results: [],
                toolName: this.name,
                metadata: { message: `No peers found for ${params.company}` }
            });
        }

        // 2. Synthesize peer data (mocking a "Skill Aggregation" here directly, 
        // normally we'd query the graph for 'top skills of these candidates')
        // For simplicity, we just return the peer list so the Agent can infer consistency.
        return ok({
            results: peers.slice(0, 5).map(p => ({
                name: p.candidate_name,
                title: p.candidate_title,
                context: p.relationship_context
            })),
            toolName: this.name,
            metadata: {
                peerCount: peers.length,
                verificationStatus: peers.length > 2 ? 'verified' : 'low_confidence',
                claim: `${params.role || 'Employee'} at ${params.company}`
            }
        });
    }
}

/**
 * Tool 5: Outreach Performance
 * Finds successful outreach examples (replies/meetings) for similar candidates.
 */
export class OutreachPerformanceTool implements SearchTool<{ skills: string[]; role?: string }, any> {
    name = "outreach_performance";
    description = "Find subject lines and messages that received replies from candidates with similar skills.";

    async execute(params: { skills: string[]; role?: string }): Promise<Result<SearchToolResult<any>>> {
        // In a real implementation:
        // 1. Query pipeline_events for event_type = 'CANDIDATE_REPLIED'
        // 2. Join with candidate_skills to filter by params.skills overlap
        // 3. Aggregate successful subject lines.

        // Mocking the "Learning" aspect for the prototype:
        const successfulExamples = [
            { subject: `Quick question about your work at [Company]`, tags: ['general'] },
            { subject: `${params.role || 'Engineering'} opportunity - relevant to your pattern matching exp`, tags: ['specialist'] },
            { subject: `Saw your talk/post about ${params.skills[0] || 'tech'}`, tags: ['personalized'] },
        ];

        return ok({
            results: successfulExamples,
            toolName: this.name,
            metadata: {
                insight: "Candidates with this profile respond 2x higher to subjects mentioning specific technical problems rather than generic 'hiring' titles."
            }
        });
    }
}

export const agenticTools = {
    keyword: new KeywordSearchTool(),
    vector: new VectorSearchTool(),
    reader: new CandidateReaderTool(),
    factChecker: new FactCheckerTool(),
    outreach: new OutreachPerformanceTool()
};
