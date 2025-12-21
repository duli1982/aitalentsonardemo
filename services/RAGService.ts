/**
 * RAG (Retrieval-Augmented Generation) Service
 * Combines vector search with AI generation for context-aware responses
 *
 * Example queries:
 * - "Write a personalized outreach email to senior React developers in California"
 * - "Generate interview questions for candidates matching 'ML engineer with Python'"
 * - "Summarize the top 3 candidates for a DevOps role"
 */

import { semanticSearchService } from './SemanticSearchService';
import { aiService } from './AIService';
import { supabase } from './supabaseClient';
import { graphQueryService } from './GraphQueryService';

export interface RAGQuery {
    query: string;
    searchThreshold?: number;
    maxCandidates?: number;
}

export interface RAGResult {
    query: string;
    response: string;
    generationMode?: 'ai' | 'template';
    sourceCandidates: {
        id: string;
        name: string;
        title: string;
        similarity: number;
    }[];
    timestamp: Date;
}

class RAGService {
    private log(...args: any[]) {
        if (import.meta.env.DEV) console.log(...args);
    }

    /**
     * Execute a RAG query: search vector DB + generate AI response with context
     */
    async query(params: RAGQuery): Promise<RAGResult> {
        const { query, searchThreshold = 0.45, maxCandidates = 5 } = params;

        this.log(`[RAGService] Processing query: "${query}"`);

        // Step 1: Retrieve relevant candidates from vector database
        const fallbackThresholds = [searchThreshold, 0.6, 0.45, 0.35, 0.25]
            .filter((value, index, list) => list.indexOf(value) === index)
            .filter(value => value > 0 && value <= 1);

        let searchResults: any[] = [];
        let usedThreshold = searchThreshold;

        for (const threshold of fallbackThresholds) {
            usedThreshold = threshold;
            searchResults = await semanticSearchService.search(query, {
                threshold,
                limit: maxCandidates
            });

            if (searchResults.length > 0) break;
        }

        this.log(`[RAGService] Found ${searchResults.length} relevant candidates (threshold=${usedThreshold})`);

        if (searchResults.length === 0) {
            let totalCandidatesInDb: number | null = null;
            try {
                totalCandidatesInDb = await semanticSearchService.getTotalCount();
            } catch {
                totalCandidatesInDb = null;
            }

            const thresholdText = fallbackThresholds.length > 1
                ? `I tried similarity thresholds ${fallbackThresholds.map(t => Math.round(t * 100)).join('% → ')}%.`
                : `I used a similarity threshold of ${Math.round(usedThreshold * 100)}%.`;

            const dbHint = totalCandidatesInDb === 0
                ? 'It looks like your vector database is empty (0 candidate_documents). Run ingestion/migration first.'
                : 'Try using more candidate-like keywords (skills, role title, location) instead of a long instruction, or lower the similarity threshold.';

            return {
                query,
                response: `I couldn't find any candidates matching your criteria in the database. ${thresholdText}\n\n${dbHint}`,
                sourceCandidates: [],
                timestamp: new Date()
            };
        }

        // Step 2: Build context from retrieved candidates (with graph relationships)
        const context = await this.buildContext(searchResults);

        // Step 3: Generate AI response using context
        const generated = await this.generateResponse(query, searchResults, context);

        // Step 4: Return structured result
        return {
            query,
            response: generated.text,
            generationMode: generated.mode,
            sourceCandidates: searchResults.map(result => ({
                id: result.id,
                name: result.name,
                title: result.title,
                similarity: result.similarity
            })),
            timestamp: new Date()
        };
    }

    /**
     * Build context string from search results with graph relationships
     */
    private async buildContext(searchResults: any[]): Promise<string> {
        let context = "Here are the relevant candidate profiles from the database:\n\n";

        for (let index = 0; index < searchResults.length; index++) {
            const result = searchResults[index];
            context += `Candidate ${index + 1}: ${result.name}\n`;
            context += `- Current Title: ${result.title}\n`;
            context += `- Location: ${result.location || 'Not specified'}\n`;
            context += `- Years of Experience: ${result.yearsOfExperience || 'Not specified'}\n`;
            context += `- Key Skills: ${result.skills?.join(', ') || 'Not specified'}\n`;

            if (result.resumeSummary) {
                context += `- Summary: ${result.resumeSummary}\n`;
            }

            if (result.linkedinUrl) {
                context += `- LinkedIn: ${result.linkedinUrl}\n`;
            }

            // Add graph relationship context
            try {
                const relationships = await this.getCandidateRelationships(result.id);
                if (relationships.companies.length > 0) {
                    context += `- Companies: ${relationships.companies.join(', ')}\n`;
                }
                if (relationships.schools.length > 0) {
                    context += `- Education: ${relationships.schools.join(', ')}\n`;
                }
                if (relationships.topSkills.length > 0) {
                    context += `- Top Technical Skills: ${relationships.topSkills.join(', ')}\n`;
                }
            } catch (error) {
                console.warn(`[RAGService] Failed to fetch relationships for ${result.name}:`, error);
            }

            context += `- Relevance Score: ${Math.round(result.similarity * 100)}%\n`;
            context += '\n';
        }

        return context;
    }

    /**
     * Get candidate relationships from knowledge graph
     */
    private async getCandidateRelationships(candidateId: string): Promise<{
        companies: string[];
        schools: string[];
        topSkills: string[];
    }> {
        if (!supabase) {
            return { companies: [], schools: [], topSkills: [] };
        }

        const [companiesData, schoolsData, skillsData] = await Promise.all([
            supabase
                .from('candidate_companies')
                .select('title, companies(name), start_date, end_date, is_current')
                .eq('candidate_id', candidateId)
                .order('is_current', { ascending: false })
                .limit(3),
            supabase
                .from('candidate_schools')
                .select('degree, schools(name), graduation_year')
                .eq('candidate_id', candidateId)
                .limit(2),
            supabase
                .from('candidate_skills')
                .select('proficiency_level, skills(name, category)')
                .eq('candidate_id', candidateId)
                .order('proficiency_level', { ascending: false })
                .limit(5)
        ]);

        const companies = companiesData.data?.map(row =>
            `${row.title} at ${(row.companies as any).name}${row.is_current ? ' (Current)' : ''}`
        ) || [];

        const schools = schoolsData.data?.map(row =>
            `${row.degree} from ${(row.schools as any).name} (${row.graduation_year})`
        ) || [];

        const topSkills = skillsData.data?.map(row =>
            `${(row.skills as any).name} (${row.proficiency_level})`
        ) || [];

        return { companies, schools, topSkills };
    }

    /**
     * Generate AI response using retrieved context
     */
    private async generateResponse(
        query: string,
        searchResults: any[],
        context: string
    ): Promise<{ text: string; mode: 'ai' | 'template' }> {
        const template = this.generateTemplateResponse(query, searchResults);

        if (!aiService.isAvailable()) {
            return {
                mode: 'template',
                text:
                    `AI is currently unavailable (missing API key). Here’s a useful template response based on the retrieved candidates:\n\n` +
                    template
            };
        }

        const prompt = `You are an expert recruitment assistant with access to a candidate database.
A user has asked the following question:

"${query}"

Based on the candidate profiles retrieved from the database, provide a helpful, professional response.

${context}

Instructions:
1. Be specific and reference actual candidates by name
2. If the user asks for an email or message, write it in a professional, personalized tone
3. If the user asks for interview questions, tailor them to the candidates' backgrounds
4. If the user asks for a summary or comparison, be analytical and highlight key differentiators
5. Keep your response concise but informative (2-3 paragraphs max unless generating long-form content like emails)

Your response:`;

        const result = await aiService.generateText(prompt);
        if (!result.success || !result.data) {
            // Quota-limited or transient AI failure: degrade gracefully.
            return {
                mode: 'template',
                text:
                    `AI is temporarily rate-limited/unavailable. Here’s a template response you can use right now:\n\n` +
                    template
            };
        }
        return { mode: 'ai', text: result.data };
    }

    private generateTemplateResponse(query: string, searchResults: any[]): string {
        const candidates = (searchResults || []).slice(0, 5);
        const top = candidates[0];

        const q = query.toLowerCase();
        const wantsEmail = q.includes('email') || q.includes('outreach') || q.includes('message');
        const wantsQuestions = q.includes('interview question') || q.includes('interview questions');
        const wantsCompare = q.includes('compare') || q.includes('rank');

        const roleMatch = query.match(/for (?:a|an)\s+(.+?)\s+role\b/i);
        const role = roleMatch?.[1]?.trim();
        const companyMatch = query.match(/\bat\s+([A-Za-z0-9&().,\- ]{2,})[.?!]?$/i);
        const company = companyMatch?.[1]?.trim();

        const candidateBullets = candidates
            .map((c: any, idx: number) => {
                const skills = Array.isArray(c.skills) ? c.skills.slice(0, 6).join(', ') : '';
                const loc = c.location ? ` • ${c.location}` : '';
                return `#${idx + 1} ${c.name} — ${c.title}${loc} (${Math.round((c.similarity ?? 0) * 100)}%)${skills ? `\n- Skills: ${skills}` : ''}`;
            })
            .join('\n\n');

        if (wantsEmail) {
            const name = top?.name ? String(top.name).split(' ')[0] : 'there';
            const jobTitle = role || 'the role you mentioned';
            const companyName = company || 'our company';
            const skills = Array.isArray(top?.skills) ? top.skills.slice(0, 4).join(', ') : '';

            return (
                `Subject: ${jobTitle} opportunity\n\n` +
                `Hi ${name},\n\n` +
                `I came across your profile and thought you could be a great fit for the ${jobTitle} opportunity at ${companyName}.` +
                (skills ? ` Your experience with ${skills} stood out.` : '') +
                `\n\n` +
                `If you’re open to it, I’d love to share a bit more and hear what you’re looking for. Would you be available for a quick chat this week?\n\n` +
                `Best regards,\nRecruiting Team\n\n` +
                `---\n` +
                `Candidates matched:\n${candidateBullets}`
            );
        }

        if (wantsQuestions) {
            const skillPool = candidates
                .flatMap((c: any) => (Array.isArray(c.skills) ? c.skills : []))
                .map((s: any) => String(s))
                .filter(Boolean);
            const uniqueSkills = Array.from(new Set(skillPool)).slice(0, 8);
            const focus = uniqueSkills.length ? ` (focus: ${uniqueSkills.join(', ')})` : '';

            const questions = [
                'Walk me through a recent project you’re proud of and your specific contributions.',
                'How do you approach debugging a production issue under time pressure?',
                'Describe a trade-off you made between speed and quality. What did you choose and why?',
                uniqueSkills[0] ? `Tell me about your experience with ${uniqueSkills[0]}—where have you used it at scale?` : 'Tell me about a core technology you’ve used at scale and how you validated performance.',
                uniqueSkills[1] ? `How do you evaluate when to use ${uniqueSkills[1]} versus an alternative?` : 'How do you evaluate when to use one tool/library versus another?',
                'How do you collaborate with product/design stakeholders to clarify ambiguous requirements?',
                'What would you improve in your current development process if you had full ownership?'
            ];

            return (
                `Interview questions${focus}:\n\n` +
                questions.map((qText, i) => `${i + 1}. ${qText}`).join('\n') +
                `\n\n---\nCandidates matched:\n${candidateBullets}`
            );
        }

        if (wantsCompare) {
            return (
                `Candidate ranking (by semantic similarity):\n\n` +
                candidateBullets +
                `\n\nSuggested next step: shortlist the top 2–3 and run screening to confirm key requirements.`
            );
        }

        // Default: brief
        return (
            `Top matched candidates:\n\n` +
            candidateBullets +
            `\n\nNext step: open a candidate to review scorecard + screening history, then add to pipeline.`
        );
    }

    /**
     * Generate personalized outreach email
     */
    async generateOutreachEmail(params: {
        candidateQuery: string;
        jobTitle: string;
        companyName: string;
        tone?: 'professional' | 'casual' | 'enthusiastic';
    }): Promise<RAGResult> {
        const { candidateQuery, jobTitle, companyName, tone = 'professional' } = params;

        const query = `Write a personalized outreach email to candidates matching "${candidateQuery}" for a ${jobTitle} role at ${companyName}. Use a ${tone} tone and reference their specific experience from their profile.`;

        return this.query({ query, maxCandidates: 1 });
    }

    /**
     * Generate interview questions tailored to candidates
     */
    async generateInterviewQuestions(params: {
        candidateQuery: string;
        jobTitle: string;
        focusAreas?: string[];
    }): Promise<RAGResult> {
        const { candidateQuery, jobTitle, focusAreas = [] } = params;

        const focusText = focusAreas.length > 0
            ? ` Focus on: ${focusAreas.join(', ')}.`
            : '';

        const query = `Generate 5-7 tailored interview questions for candidates matching "${candidateQuery}" applying for a ${jobTitle} role.${focusText} Base questions on their actual experience and skills.`;

        return this.query({ query, maxCandidates: 3 });
    }

    /**
     * Compare and rank candidates
     */
    async compareCandidates(params: {
        candidateQuery: string;
        jobRequirements: string[];
    }): Promise<RAGResult> {
        const { candidateQuery, jobRequirements } = params;

        const query = `Compare and rank candidates matching "${candidateQuery}" based on these job requirements: ${jobRequirements.join(', ')}. Provide a structured comparison highlighting strengths and gaps for each candidate.`;

        return this.query({ query, maxCandidates: 5 });
    }

    /**
     * Generate candidate summary/briefing
     */
    async generateCandidateBrief(params: {
        candidateQuery: string;
        purpose: string;
    }): Promise<RAGResult> {
        const { candidateQuery, purpose } = params;

        const query = `Create a brief summary of candidates matching "${candidateQuery}" for this purpose: ${purpose}. Include key highlights, unique strengths, and any concerns.`;

        return this.query({ query, maxCandidates: 5 });
    }

    /**
     * Find candidates by company using graph relationships
     */
    async queryCandidatesByCompany(params: {
        companyName: string;
        additionalCriteria?: string;
    }): Promise<RAGResult> {
        const { companyName, additionalCriteria = '' } = params;

        console.log(`[RAGService] Graph query: Find candidates from ${companyName}`);

        const candidates = await graphQueryService.findCandidatesByCompany(companyName);

        if (candidates.length === 0) {
            return {
                query: `Find candidates from ${companyName}`,
                response: `No candidates found who have worked at ${companyName}.`,
                sourceCandidates: [],
                timestamp: new Date()
            };
        }

        const context = `Found ${candidates.length} candidates who worked at ${companyName}:\n\n` +
            candidates.slice(0, 10).map((c, i) =>
                `${i + 1}. ${c.candidate_name} - ${c.relationship_context}`
            ).join('\n');

        const query = additionalCriteria
            ? `Analyze candidates from ${companyName} focusing on: ${additionalCriteria}`
            : `Summarize the candidates who have worked at ${companyName}`;

        const generated = await this.generateResponse(query, [], context);

        return {
            query,
            response: generated.text,
            generationMode: generated.mode,
            sourceCandidates: candidates.slice(0, 10).map(c => ({
                id: c.candidate_id,
                name: c.candidate_name,
                title: c.candidate_title,
                similarity: 1.0
            })),
            timestamp: new Date()
        };
    }

    /**
     * Find candidates by school using graph relationships
     */
    async queryCandidatesBySchool(params: {
        schoolName: string;
        additionalCriteria?: string;
    }): Promise<RAGResult> {
        const { schoolName, additionalCriteria = '' } = params;

        console.log(`[RAGService] Graph query: Find candidates from ${schoolName}`);

        const candidates = await graphQueryService.findCandidatesBySchool(schoolName);

        if (candidates.length === 0) {
            return {
                query: `Find candidates from ${schoolName}`,
                response: `No candidates found who studied at ${schoolName}.`,
                sourceCandidates: [],
                timestamp: new Date()
            };
        }

        const context = `Found ${candidates.length} candidates who studied at ${schoolName}:\n\n` +
            candidates.slice(0, 10).map((c, i) =>
                `${i + 1}. ${c.candidate_name} - ${c.relationship_context}`
            ).join('\n');

        const query = additionalCriteria
            ? `Analyze alumni from ${schoolName} focusing on: ${additionalCriteria}`
            : `Summarize the candidates who studied at ${schoolName}`;

        const generated = await this.generateResponse(query, [], context);

        return {
            query,
            response: generated.text,
            generationMode: generated.mode,
            sourceCandidates: candidates.slice(0, 10).map(c => ({
                id: c.candidate_id,
                name: c.candidate_name,
                title: c.candidate_title,
                similarity: 1.0
            })),
            timestamp: new Date()
        };
    }

    /**
     * Find candidates with multi-criteria graph query
     */
    async queryByGraphCriteria(params: {
        companies?: string[];
        schools?: string[];
        skills?: string[];
        description?: string;
    }): Promise<RAGResult> {
        const { companies, schools, skills, description } = params;

        console.log('[RAGService] Multi-criteria graph query:', { companies, schools, skills });

        const candidates = await graphQueryService.findCandidatesByMultipleCriteria({
            companies,
            schools,
            skills
        });

        if (candidates.length === 0) {
            return {
                query: 'Multi-criteria graph search',
                response: 'No candidates found matching all specified criteria.',
                sourceCandidates: [],
                timestamp: new Date()
            };
        }

        const criteriaText = [
            companies?.length ? `Companies: ${companies.join(', ')}` : '',
            schools?.length ? `Schools: ${schools.join(', ')}` : '',
            skills?.length ? `Skills: ${skills.join(', ')}` : ''
        ].filter(Boolean).join(' | ');

        const context = `Found ${candidates.length} candidates matching: ${criteriaText}\n\n` +
            candidates.slice(0, 10).map((c, i) =>
                `${i + 1}. ${c.candidate_name} - ${c.candidate_title}`
            ).join('\n');

        const query = description || `Analyze candidates matching: ${criteriaText}`;
        const generated = await this.generateResponse(query, [], context);

        return {
            query,
            response: generated.text,
            generationMode: generated.mode,
            sourceCandidates: candidates.slice(0, 10).map(c => ({
                id: c.candidate_id,
                name: c.candidate_name,
                title: c.candidate_title,
                similarity: 1.0
            })),
            timestamp: new Date()
        };
    }

    /**
     * Find career paths and transitions
     */
    async analyzeCareerPaths(params: {
        fromCompany?: string;
        toCompany?: string;
    }): Promise<RAGResult> {
        const { fromCompany, toCompany } = params;

        console.log(`[RAGService] Analyzing career paths from ${fromCompany} to ${toCompany}`);

        const paths = await graphQueryService.findCareerPaths(fromCompany, toCompany);

        if (paths.length === 0) {
            return {
                query: 'Career path analysis',
                response: 'Not enough data to analyze career paths for these companies.',
                sourceCandidates: [],
                timestamp: new Date()
            };
        }

        const context = `Career transition patterns:\n\n` +
            paths.map((path, i) =>
                `${i + 1}. ${path.from_company} → ${path.to_company}: ${path.candidate_count} candidates`
            ).join('\n');

        const query = `Analyze common career paths${fromCompany ? ` from ${fromCompany}` : ''}${toCompany ? ` to ${toCompany}` : ''}`;
        const generated = await this.generateResponse(query, [], context);

        return {
            query,
            response: generated.text,
            generationMode: generated.mode,
            sourceCandidates: [],
            timestamp: new Date()
        };
    }

    /**
     * Find skill clusters and related skills
     */
    async analyzeSkillClusters(skillName: string): Promise<RAGResult> {
        console.log(`[RAGService] Analyzing skill clusters for ${skillName}`);

        const clusters = await graphQueryService.findSkillClusters(skillName);

        if (clusters.length === 0) {
            return {
                query: `Skill cluster analysis for ${skillName}`,
                response: `No skill cluster data available for ${skillName}.`,
                sourceCandidates: [],
                timestamp: new Date()
            };
        }

        const context = clusters.map(cluster =>
            `Candidates with ${cluster.primary_skill} (${cluster.candidate_count} total) commonly also have:\n` +
            cluster.related_skills.map(skill => `- ${skill}`).join('\n')
        ).join('\n\n');

        const query = `Analyze skill relationships and common combinations with ${skillName}`;
        const generated = await this.generateResponse(query, [], context);

        return {
            query,
            response: generated.text,
            generationMode: generated.mode,
            sourceCandidates: [],
            timestamp: new Date()
        };
    }

    /**
     * Check if RAG is available (requires both Supabase and AI)
     */
    isAvailable(): boolean {
        // RAG can still provide useful output without LLMs (template fallback).
        return supabase !== null;
    }
}

export const ragService = new RAGService();
