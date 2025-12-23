import { aiService } from './AIService';
import { supabase } from './supabaseClient';
import { graphQueryService } from './GraphQueryService';
import type { Result } from '../types/result';
import { err, ok } from '../types/result';
import type { AppError } from '../types/errors';
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
     * Search for candidates matching specific skills
     * @param skills Array of required skills
     * @param options Search configuration
     */
	    async searchBySkills(
	        skills: string[],
	        options: SearchOptions = {}
	    ): Promise<Result<SemanticSearchResult[]>> {
	        const query = `Candidate with expertise in: ${skills.join(', ')}`;
	        return this.search(query, { ...options, threshold: 0.7 });
	    }

    /**
     * Search for candidates similar to a job description
     * @param jobDescription Job requirements and description
     * @param options Search configuration
     */
    async searchByJobDescription(
        jobDescription: string,
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {
        return this.search(jobDescription, { ...options, threshold: 0.65 });
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
     * Search candidates with company filter (graph-enhanced)
     * Combines semantic search with company relationship filtering
     */
    async searchWithCompanyFilter(
        query: string,
        companyNames: string[],
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {

        // Get candidates from these companies
        const companyMatches = await Promise.all(companyNames.map((company) => graphQueryService.findCandidatesByCompany(company)));
        const companyErrors: AppError[] = [];
        for (const match of companyMatches) {
            if (!match.success) companyErrors.push(match.error);
        }

        const companyCandidateIds = new Set(
            companyMatches.flatMap((m) => (m.success ? m.data : m.data ?? [])).map((c: any) => c.candidate_id)
        );

        if (companyCandidateIds.size === 0) {
            return ok([]);
        }

        // Perform semantic search
        const semanticResults = await this.search(query, { ...options, limit: 100 });
        if (!semanticResults.success) {
            return err(semanticResults.error, { retryAfterMs: semanticResults.retryAfterMs, data: semanticResults.data ?? [] });
        }

        // Filter to only include candidates from specified companies
        const filtered = semanticResults.data
            .filter(result => companyCandidateIds.has(result.id))
            .slice(0, options.limit || 10);
        if (companyErrors.length) {
            return err(
                upstream('SemanticSearchService', 'Company filter used partial graph data.', companyErrors[0], { filter: 'company' }),
                { data: filtered, warnings: companyErrors }
            );
        }
        return ok(filtered);
    }

    /**
     * Search candidates with school filter (graph-enhanced)
     * Combines semantic search with school relationship filtering
     */
    async searchWithSchoolFilter(
        query: string,
        schoolNames: string[],
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {

        // Get candidates from these schools
        const schoolMatches = await Promise.all(schoolNames.map((school) => graphQueryService.findCandidatesBySchool(school)));
        const schoolErrors: AppError[] = [];
        for (const match of schoolMatches) {
            if (!match.success) schoolErrors.push(match.error);
        }

        const schoolCandidateIds = new Set(
            schoolMatches.flatMap((m) => (m.success ? m.data : m.data ?? [])).map((c: any) => c.candidate_id)
        );

        if (schoolCandidateIds.size === 0) {
            return ok([]);
        }

        // Perform semantic search
        const semanticResults = await this.search(query, { ...options, limit: 100 });
        if (!semanticResults.success) {
            return err(semanticResults.error, { retryAfterMs: semanticResults.retryAfterMs, data: semanticResults.data ?? [] });
        }

        // Filter to only include candidates from specified schools
        const filtered = semanticResults.data
            .filter(result => schoolCandidateIds.has(result.id))
            .slice(0, options.limit || 10);
        if (schoolErrors.length) {
            return err(
                upstream('SemanticSearchService', 'School filter used partial graph data.', schoolErrors[0], { filter: 'school' }),
                { data: filtered, warnings: schoolErrors }
            );
        }
        return ok(filtered);
    }

    /**
     * Search candidates with skill filter (graph-enhanced)
     * Combines semantic search with skill relationship filtering
     */
    async searchWithSkillFilter(
        query: string,
        skillNames: string[],
        minProficiency?: string,
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {

        // Get candidates with these skills
        const skillMatches = await Promise.all(skillNames.map((skill) => graphQueryService.findCandidatesBySkill(skill, minProficiency)));
        const skillErrors: AppError[] = [];
        for (const match of skillMatches) {
            if (!match.success) skillErrors.push(match.error);
        }

        const skillCandidateIds = new Set(
            skillMatches.flatMap((m) => (m.success ? m.data : m.data ?? [])).map((c: any) => c.candidate_id)
        );

        if (skillCandidateIds.size === 0) {
            return ok([]);
        }

        // Perform semantic search
        const semanticResults = await this.search(query, { ...options, limit: 100 });
        if (!semanticResults.success) {
            return err(semanticResults.error, { retryAfterMs: semanticResults.retryAfterMs, data: semanticResults.data ?? [] });
        }

        // Filter to only include candidates with specified skills
        const filtered = semanticResults.data
            .filter(result => skillCandidateIds.has(result.id))
            .slice(0, options.limit || 10);
        if (skillErrors.length) {
            return err(
                upstream('SemanticSearchService', 'Skill filter used partial graph data.', skillErrors[0], { filter: 'skill' }),
                { data: filtered, warnings: skillErrors }
            );
        }
        return ok(filtered);
    }

    /**
     * Hybrid search: Combine vector similarity with graph criteria
     * Example: "Senior developer" + worked at Google + studied at Stanford + has React skills
     */
    async hybridSearch(params: {
        query: string;
        companies?: string[];
        schools?: string[];
        skills?: string[];
        minProficiency?: string;
        options?: SearchOptions;
    }): Promise<Result<SemanticSearchResult[]>> {
        const { query, companies, schools, skills, minProficiency, options = {} } = params;

        console.log('[SemanticSearch] Hybrid search:', { query, companies, schools, skills });

        // Get all graph matches
        const graphCandidates = await graphQueryService.findCandidatesByMultipleCriteria({
            companies,
            schools,
            skills
        });
        const graphCandidateIds = new Set((graphCandidates.success ? graphCandidates.data : graphCandidates.data ?? []).map((c: any) => c.candidate_id));

        if (graphCandidateIds.size === 0) {
            console.log('[SemanticSearch] No graph matches found');
            return ok([]);
        }

        console.log(`[SemanticSearch] Found ${graphCandidateIds.size} candidates matching graph criteria`);

        // Perform semantic search
        const semanticResults = await this.search(query, { ...options, limit: 100 });

        const semanticList = semanticResults.success ? semanticResults.data : semanticResults.data ?? [];
        console.log(`[SemanticSearch] Found ${semanticList.length} semantic matches`);

        // Combine: Keep only candidates that match both semantic AND graph criteria
        const hybridResults = semanticList
            .filter(result => graphCandidateIds.has(result.id))
            .slice(0, options.limit || 10);

        console.log(`[SemanticSearch] Hybrid results: ${hybridResults.length}`);

        if (!graphCandidates.success || !semanticResults.success) {
            const warnings = [];
            if (!graphCandidates.success) warnings.push(graphCandidates.error);
            if (!semanticResults.success) warnings.push(semanticResults.error);
            const cause = !semanticResults.success ? semanticResults.error : !graphCandidates.success ? graphCandidates.error : undefined;
            return err(
                upstream('SemanticSearchService', 'Hybrid search returned partial results.', cause, { filter: 'hybrid' }),
                { data: hybridResults, retryAfterMs: semanticResults.success ? undefined : semanticResults.retryAfterMs, warnings }
            );
        }
        return ok(hybridResults);
    }

    /**
     * Find candidates in a company's alumni network
     * Uses graph traversal to find people who worked at the same company
     */
    async searchCompanyNetwork(
        companyName: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {
        console.log(`[SemanticSearch] Searching ${companyName} alumni network for: ${query}`);

        const alumni = await graphQueryService.findCompanyAlumniNetwork(companyName, 100);
        const alumniIds = new Set((alumni.success ? alumni.data : alumni.data ?? []).map((a: any) => a.candidate_id));

        if (alumniIds.size === 0) {
            return ok([]);
        }

        const semanticResults = await this.search(query, { ...options, limit: 100 });
        const semanticList = semanticResults.success ? semanticResults.data : semanticResults.data ?? [];

        const filtered = semanticList
            .filter(result => alumniIds.has(result.id))
            .slice(0, options.limit || 10);
        if (!alumni.success || !semanticResults.success) {
            const warnings = [];
            if (!alumni.success) warnings.push(alumni.error);
            if (!semanticResults.success) warnings.push(semanticResults.error);
            const cause = !semanticResults.success ? semanticResults.error : !alumni.success ? alumni.error : undefined;
            return err(
                upstream('SemanticSearchService', 'Company network search returned partial results.', cause, { filter: 'company_network' }),
                { data: filtered, retryAfterMs: semanticResults.success ? undefined : semanticResults.retryAfterMs, warnings }
            );
        }
        return ok(filtered);
    }

    /**
     * Find candidates in a school's alumni network
     * Uses graph traversal to find people who studied at the same school
     */
    async searchSchoolNetwork(
        schoolName: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {
        console.log(`[SemanticSearch] Searching ${schoolName} alumni network for: ${query}`);

        const alumni = await graphQueryService.findAlumniNetwork(schoolName, 100);
        const alumniIds = new Set((alumni.success ? alumni.data : alumni.data ?? []).map((a: any) => a.candidate_id));

        if (alumniIds.size === 0) {
            return ok([]);
        }

        const semanticResults = await this.search(query, { ...options, limit: 100 });
        const semanticList = semanticResults.success ? semanticResults.data : semanticResults.data ?? [];

        const filtered = semanticList
            .filter(result => alumniIds.has(result.id))
            .slice(0, options.limit || 10);
        if (!alumni.success || !semanticResults.success) {
            const warnings = [];
            if (!alumni.success) warnings.push(alumni.error);
            if (!semanticResults.success) warnings.push(semanticResults.error);
            const cause = !semanticResults.success ? semanticResults.error : !alumni.success ? alumni.error : undefined;
            return err(
                upstream('SemanticSearchService', 'School network search returned partial results.', cause, { filter: 'school_network' }),
                { data: filtered, retryAfterMs: semanticResults.success ? undefined : semanticResults.retryAfterMs, warnings }
            );
        }
        return ok(filtered);
    }

    /**
     * Find 2nd degree connections (graph traversal)
     * Semantic search within the network of people connected to a candidate
     */
    async search2ndDegreeNetwork(
        candidateId: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {
        console.log(`[SemanticSearch] Searching 2nd degree network for candidate ${candidateId}`);

        const connections = await graphQueryService.find2ndDegreeConnections(candidateId);
        const connectionIds = new Set((connections.success ? connections.data : connections.data ?? []).map((c: any) => c.candidate_id));

        if (connectionIds.size === 0) {
            return ok([]);
        }

        const semanticResults = await this.search(query, { ...options, limit: 100 });
        const semanticList = semanticResults.success ? semanticResults.data : semanticResults.data ?? [];

        const filtered = semanticList
            .filter(result => connectionIds.has(result.id))
            .slice(0, options.limit || 10);
        if (!connections.success || !semanticResults.success) {
            const warnings = [];
            if (!connections.success) warnings.push(connections.error);
            if (!semanticResults.success) warnings.push(semanticResults.error);
            const cause = !semanticResults.success ? semanticResults.error : !connections.success ? connections.error : undefined;
            return err(
                upstream('SemanticSearchService', 'Network search returned partial results.', cause, { filter: '2nd_degree' }),
                { data: filtered, retryAfterMs: semanticResults.success ? undefined : semanticResults.retryAfterMs, warnings }
            );
        }
        return ok(filtered);
    }

    /**
     * Search by career path pattern
     * Find candidates who followed similar company transitions
     */
    async searchByCareerPath(
        fromCompany: string,
        toCompany: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<Result<SemanticSearchResult[]>> {
        console.log(`[SemanticSearch] Searching candidates who moved from ${fromCompany} to ${toCompany}`);

        // This would require a more complex query - simplified version
        const fromAlumni = await graphQueryService.findCompanyAlumniNetwork(fromCompany, 100);
        const toAlumni = await graphQueryService.findCompanyAlumniNetwork(toCompany, 100);

        const fromIds = new Set((fromAlumni.success ? fromAlumni.data : fromAlumni.data ?? []).map((a: any) => a.candidate_id));
        const toIds = new Set((toAlumni.success ? toAlumni.data : toAlumni.data ?? []).map((a: any) => a.candidate_id));

        // Find candidates who worked at both companies
        const pathCandidateIds = new Set(
            [...fromIds].filter(id => toIds.has(id))
        );

        if (pathCandidateIds.size === 0) {
            return ok([]);
        }

        const semanticResults = await this.search(query, { ...options, limit: 100 });
        const semanticList = semanticResults.success ? semanticResults.data : semanticResults.data ?? [];

        const filtered = semanticList
            .filter(result => pathCandidateIds.has(result.id))
            .slice(0, options.limit || 10);
        if (!fromAlumni.success || !toAlumni.success || !semanticResults.success) {
            const warnings = [];
            if (!fromAlumni.success) warnings.push(fromAlumni.error);
            if (!toAlumni.success) warnings.push(toAlumni.error);
            if (!semanticResults.success) warnings.push(semanticResults.error);
            const cause = !semanticResults.success
                ? semanticResults.error
                : !fromAlumni.success
                  ? fromAlumni.error
                  : !toAlumni.success
                    ? toAlumni.error
                    : undefined;
            return err(
                upstream('SemanticSearchService', 'Career-path search returned partial results.', cause, { filter: 'career_path' }),
                { data: filtered, retryAfterMs: semanticResults.success ? undefined : semanticResults.retryAfterMs, warnings }
            );
        }
        return ok(filtered);
    }

    /**
     * Check if the semantic search service is available
     */
    isAvailable(): boolean {
        return supabase !== null && aiService.isAvailable();
    }
}

export const semanticSearchService = new SemanticSearchService();
