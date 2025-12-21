import { aiService } from './AIService';
import { supabase } from './supabaseClient';
import { graphQueryService } from './GraphQueryService';

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
    ): Promise<SemanticSearchResult[]> {

        if (!supabase) {
            throw new Error('Supabase is not configured. Vector search is unavailable.');
        }

        const {
            threshold = 0.65,
            limit = 10,
            type
        } = options;

        // Step 1: Convert query to embedding
        const embeddingResult = await aiService.embedText(query);

        if (!embeddingResult.success || !embeddingResult.data) {
            throw new Error(`Failed to generate query embedding: ${embeddingResult.error}`);
        }

        // Step 2: Query the vector database
        const { data, error } = await supabase.rpc('match_candidates', {
            query_embedding: embeddingResult.data,
            match_threshold: threshold,
            match_count: limit * 2  // Request more to account for type filtering
        });

        if (error) {
            throw new Error(`Vector search failed: ${error.message}`);
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Step 3: Parse and filter results
        let results: SemanticSearchResult[] = data.map((row: any) => ({
            id: row.metadata?.id || `unknown-${row.id}`,
            name: row.metadata?.name || 'Unknown',
            email: row.metadata?.email,
            type: row.metadata?.type || 'uploaded',
            skills: row.metadata?.skills || [],
            similarity: row.similarity,
            content: row.content,
            metadata: row.metadata
        }));

        // Filter by type if specified
        if (type) {
            results = results.filter(r => r.type === type);
        }

        // Apply limit after filtering
        return results.slice(0, limit);
    }

    /**
     * Search for candidates matching specific skills
     * @param skills Array of required skills
     * @param options Search configuration
     */
    async searchBySkills(
        skills: string[],
        options: SearchOptions = {}
    ): Promise<SemanticSearchResult[]> {
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
    ): Promise<SemanticSearchResult[]> {
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
    ): Promise<SemanticSearchResult[]> {

        if (!supabase) {
            throw new Error('Supabase is not configured.');
        }

        // Get the reference candidate's embedding
        const { data: refData, error: refError } = await supabase
            .from('candidate_documents')
            .select('embedding, content')
            .eq('metadata->>id', candidateId)
            .single();

        if (refError || !refData) {
            throw new Error(`Could not find candidate ${candidateId} in vector database`);
        }

        // Search using the reference candidate's embedding
        const { data, error } = await supabase.rpc('match_candidates', {
            query_embedding: refData.embedding,
            match_threshold: options.threshold || 0.7,
            match_count: (options.limit || 10) + 1  // +1 because reference will match itself
        });

        if (error) {
            throw new Error(`Similarity search failed: ${error.message}`);
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

        return results.slice(0, options.limit || 10);
    }

    /**
     * Get total count of candidates in the vector database
     */
    async getTotalCount(): Promise<number> {
        if (!supabase) return 0;

        const { count, error } = await supabase
            .from('candidate_documents')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error getting count:', error);
            return 0;
        }

        return count || 0;
    }

    /**
     * Search candidates with company filter (graph-enhanced)
     * Combines semantic search with company relationship filtering
     */
    async searchWithCompanyFilter(
        query: string,
        companyNames: string[],
        options: SearchOptions = {}
    ): Promise<SemanticSearchResult[]> {
        if (!supabase) {
            throw new Error('Supabase is not configured.');
        }

        // Get candidates from these companies
        const companyMatches = await Promise.all(
            companyNames.map(company => graphQueryService.findCandidatesByCompany(company))
        );

        const companyCandidateIds = new Set(
            companyMatches.flat().map(c => c.candidate_id)
        );

        if (companyCandidateIds.size === 0) {
            return [];
        }

        // Perform semantic search
        const semanticResults = await this.search(query, { ...options, limit: 100 });

        // Filter to only include candidates from specified companies
        return semanticResults
            .filter(result => companyCandidateIds.has(result.id))
            .slice(0, options.limit || 10);
    }

    /**
     * Search candidates with school filter (graph-enhanced)
     * Combines semantic search with school relationship filtering
     */
    async searchWithSchoolFilter(
        query: string,
        schoolNames: string[],
        options: SearchOptions = {}
    ): Promise<SemanticSearchResult[]> {
        if (!supabase) {
            throw new Error('Supabase is not configured.');
        }

        // Get candidates from these schools
        const schoolMatches = await Promise.all(
            schoolNames.map(school => graphQueryService.findCandidatesBySchool(school))
        );

        const schoolCandidateIds = new Set(
            schoolMatches.flat().map(c => c.candidate_id)
        );

        if (schoolCandidateIds.size === 0) {
            return [];
        }

        // Perform semantic search
        const semanticResults = await this.search(query, { ...options, limit: 100 });

        // Filter to only include candidates from specified schools
        return semanticResults
            .filter(result => schoolCandidateIds.has(result.id))
            .slice(0, options.limit || 10);
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
    ): Promise<SemanticSearchResult[]> {
        if (!supabase) {
            throw new Error('Supabase is not configured.');
        }

        // Get candidates with these skills
        const skillMatches = await Promise.all(
            skillNames.map(skill => graphQueryService.findCandidatesBySkill(skill, minProficiency))
        );

        const skillCandidateIds = new Set(
            skillMatches.flat().map(c => c.candidate_id)
        );

        if (skillCandidateIds.size === 0) {
            return [];
        }

        // Perform semantic search
        const semanticResults = await this.search(query, { ...options, limit: 100 });

        // Filter to only include candidates with specified skills
        return semanticResults
            .filter(result => skillCandidateIds.has(result.id))
            .slice(0, options.limit || 10);
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
    }): Promise<SemanticSearchResult[]> {
        const { query, companies, schools, skills, minProficiency, options = {} } = params;

        if (!supabase) {
            throw new Error('Supabase is not configured.');
        }

        console.log('[SemanticSearch] Hybrid search:', { query, companies, schools, skills });

        // Get all graph matches
        const graphCandidates = await graphQueryService.findCandidatesByMultipleCriteria({
            companies,
            schools,
            skills
        });

        const graphCandidateIds = new Set(graphCandidates.map(c => c.candidate_id));

        if (graphCandidateIds.size === 0) {
            console.log('[SemanticSearch] No graph matches found');
            return [];
        }

        console.log(`[SemanticSearch] Found ${graphCandidateIds.size} candidates matching graph criteria`);

        // Perform semantic search
        const semanticResults = await this.search(query, { ...options, limit: 100 });

        console.log(`[SemanticSearch] Found ${semanticResults.length} semantic matches`);

        // Combine: Keep only candidates that match both semantic AND graph criteria
        const hybridResults = semanticResults
            .filter(result => graphCandidateIds.has(result.id))
            .slice(0, options.limit || 10);

        console.log(`[SemanticSearch] Hybrid results: ${hybridResults.length}`);

        return hybridResults;
    }

    /**
     * Find candidates in a company's alumni network
     * Uses graph traversal to find people who worked at the same company
     */
    async searchCompanyNetwork(
        companyName: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<SemanticSearchResult[]> {
        console.log(`[SemanticSearch] Searching ${companyName} alumni network for: ${query}`);

        const alumni = await graphQueryService.findCompanyAlumniNetwork(companyName, 100);
        const alumniIds = new Set(alumni.map(a => a.candidate_id));

        if (alumniIds.size === 0) {
            return [];
        }

        const semanticResults = await this.search(query, { ...options, limit: 100 });

        return semanticResults
            .filter(result => alumniIds.has(result.id))
            .slice(0, options.limit || 10);
    }

    /**
     * Find candidates in a school's alumni network
     * Uses graph traversal to find people who studied at the same school
     */
    async searchSchoolNetwork(
        schoolName: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<SemanticSearchResult[]> {
        console.log(`[SemanticSearch] Searching ${schoolName} alumni network for: ${query}`);

        const alumni = await graphQueryService.findAlumniNetwork(schoolName, 100);
        const alumniIds = new Set(alumni.map(a => a.candidate_id));

        if (alumniIds.size === 0) {
            return [];
        }

        const semanticResults = await this.search(query, { ...options, limit: 100 });

        return semanticResults
            .filter(result => alumniIds.has(result.id))
            .slice(0, options.limit || 10);
    }

    /**
     * Find 2nd degree connections (graph traversal)
     * Semantic search within the network of people connected to a candidate
     */
    async search2ndDegreeNetwork(
        candidateId: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<SemanticSearchResult[]> {
        console.log(`[SemanticSearch] Searching 2nd degree network for candidate ${candidateId}`);

        const connections = await graphQueryService.find2ndDegreeConnections(candidateId);
        const connectionIds = new Set(connections.map(c => c.candidate_id));

        if (connectionIds.size === 0) {
            return [];
        }

        const semanticResults = await this.search(query, { ...options, limit: 100 });

        return semanticResults
            .filter(result => connectionIds.has(result.id))
            .slice(0, options.limit || 10);
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
    ): Promise<SemanticSearchResult[]> {
        console.log(`[SemanticSearch] Searching candidates who moved from ${fromCompany} to ${toCompany}`);

        // This would require a more complex query - simplified version
        const fromAlumni = await graphQueryService.findCompanyAlumniNetwork(fromCompany, 100);
        const toAlumni = await graphQueryService.findCompanyAlumniNetwork(toCompany, 100);

        const fromIds = new Set(fromAlumni.map(a => a.candidate_id));
        const toIds = new Set(toAlumni.map(a => a.candidate_id));

        // Find candidates who worked at both companies
        const pathCandidateIds = new Set(
            [...fromIds].filter(id => toIds.has(id))
        );

        if (pathCandidateIds.size === 0) {
            return [];
        }

        const semanticResults = await this.search(query, { ...options, limit: 100 });

        return semanticResults
            .filter(result => pathCandidateIds.has(result.id))
            .slice(0, options.limit || 10);
    }

    /**
     * Check if the semantic search service is available
     */
    isAvailable(): boolean {
        return supabase !== null && aiService.isAvailable();
    }
}

export const semanticSearchService = new SemanticSearchService();
