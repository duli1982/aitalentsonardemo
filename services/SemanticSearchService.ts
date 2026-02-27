
import { aiService } from './AIService';
import { supabase } from './supabaseClient';
import type { Result } from '../types/result';
import { err, ok } from '../types/result';
import { notConfigured, upstream } from './errorHandling';

export interface SemanticSearchResult {
    id: string;
    name: string;
    email?: string;
    type: 'internal' | 'past' | 'uploaded';
    skills: string[];
    similarity: number;
    content: string;
    metadata: any;
}

export interface SearchOptions {
    threshold?: number;  // Minimum similarity score (0-1)
    limit?: number;      // Max results to return
    type?: 'internal' | 'past' | 'uploaded';  // Filter by candidate type
}

class SemanticSearchService {

    /**
     * Performs AI-powered semantic search on the vector database
     * @param query Natural language query (e.g., "senior React developer with leadership experience")
     * @param options Search configuration
     * @returns Array of matching candidates with similarity scores
     */
    async search(
        query: string,
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {

        if (!supabase) {
            return err(notConfigured('SemanticSearchService', 'Supabase is not configured.'), { data: [] });
        }

        const {
            threshold = 0.65,
            limit = 10,
            type
        } = options;

        // Step 1: Convert query to embedding
        const embeddingResult = await aiService.embedText(query);

        if (!embeddingResult.success || !embeddingResult.data) {
            return err(
                upstream('SemanticSearchService', 'Failed to generate query embedding.', embeddingResult.error),
                { retryAfterMs: embeddingResult.retryAfterMs, data: [] }
            );
        }

        // Step 2: Query the vector database
        // Note: match_candidates defaults to active documents only; include_historical can be added if needed.
        const { data, error } = await supabase.rpc('match_candidates', {
            query_embedding: embeddingResult.data,
            match_threshold: threshold,
            match_count: limit * 2  // Request more to account for type filtering
        });

        if (error) {
            return err(upstream('SemanticSearchService', `Vector search failed: ${error.message}`, error), { data: [] });
        }

        if (!data || data.length === 0) {
            return ok([]);
        }

        // Step 3: Parse and filter results
        let results: SemanticSearchResult[] = data.map((row: any) => {
            const meta = row.metadata || {};
            const candidateId = row.candidate_id || meta.id || `unknown-${row.id}`;
            const name = row.name || meta.name || 'Unknown';
            const email = row.email || meta.email;
            const type = row.type || meta.type || 'uploaded';
            const skills = Array.isArray(row.skills) ? row.skills : Array.isArray(meta.skills) ? meta.skills : [];
            return {
                id: String(candidateId),
                name,
                email,
                type,
                skills,
                similarity: row.similarity,
                content: row.content,
                metadata: meta
            };
        });

        // Filter by type if specified
        if (type) {
            results = results.filter(r => r.type === type);
        }

        // Apply limit after filtering
        return ok(results.slice(0, limit));
    }

    /**
     * Find candidates similar to a given candidate (for recommendations)
     * @param candidateId ID of the reference candidate
     * @param options Search configuration
     */
    async findSimilarCandidates(
        candidateId: string,
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {

        if (!supabase) {
            return err(notConfigured('SemanticSearchService', 'Supabase is not configured.'), { data: [] });
        }

        // Get the reference candidate's embedding
        const { data: refData, error: refError } = await supabase
            .from('candidate_documents')
            .select('embedding, content')
            .eq('metadata->>id', candidateId)
            .single();

        if (refError || !refData) {
            return err(
                upstream('SemanticSearchService', 'Could not load reference candidate embedding.', refError),
                { data: [] }
            );
        }

        // Search using the reference candidate's embedding
        const { data, error } = await supabase.rpc('match_candidates', {
            query_embedding: refData.embedding,
            match_threshold: options.threshold || 0.7,
            match_count: (options.limit || 10) + 1  // +1 because reference will match itself
        });

        if (error) {
            return err(upstream('SemanticSearchService', `Similarity search failed: ${error.message}`, error), { data: [] });
        }

        // Parse results and exclude the reference candidate
        const results: SemanticSearchResult[] = data
            .map((row: any) => ({
                id: row.metadata?.id || `unknown-${row.id}`,
                name: row.metadata?.name || 'Unknown',
                email: row.metadata?.email,
                type: row.metadata?.type || 'uploaded',
                skills: row.metadata?.skills || [],
                similarity: row.similarity,
                content: row.content,
                metadata: row.metadata
            }))
            .filter((r: SemanticSearchResult) => r.id !== candidateId);

        return ok(results.slice(0, options.limit || 10));
    }

    /**
     * Get total count of candidates in the vector database
     */
    async getTotalCount(): Promise<Result<number>> {
        if (!supabase) return err(notConfigured('SemanticSearchService', 'Supabase is not configured.'), { data: 0 });

        const { count, error } = await supabase
            .from('candidate_documents')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return err(upstream('SemanticSearchService', 'Failed to read candidate count.', error), { data: 0 });
        }

        return ok(count || 0);
    }

    /**
     * Check if the semantic search service is available
     */
    isAvailable(): boolean {
        return supabase !== null && aiService.isAvailable();
    }
}

export const semanticSearchService = new SemanticSearchService();
