/**
 * Graph Query Service
 * Provides graph traversal and relationship queries for the Knowledge Graph
 *
 * Features:
 * - Company-based queries (alumni networks, career paths)
 * - School-based queries (university networks)
 * - Skill-based queries (skill clusters, expertise mapping)
 * - Network traversal (2nd degree connections, referral paths)
 * - Career path analysis
 */

import { supabase } from './supabaseClient';
import type { Result } from '../types/result';
import { err, ok } from '../types/result';
import { notConfigured, upstream } from './errorHandling';

export interface CompanyNode {
    id: number;
    name: string;
    industry: string;
    size: string;
    location: string;
    employee_count: number;
}

export interface SchoolNode {
    id: number;
    name: string;
    type: string;
    location: string;
    ranking: number;
}

export interface SkillNode {
    id: number;
    name: string;
    category: string;
    demand_score: number;
}

export interface CandidateRelationship {
    candidate_id: string;
    candidate_name: string;
    candidate_title: string;
    candidate_email: string;
    relationship_type: string;
    relationship_context: string;
}

export interface CareerPath {
    from_company: string;
    to_company: string;
    candidate_count: number;
    common_titles: string[];
}

export interface SkillCluster {
    primary_skill: string;
    related_skills: string[];
    candidate_count: number;
}

class GraphQueryService {
    /**
     * Find candidates who worked at a specific company
     */
    async findCandidatesByCompany(companyName: string): Promise<Result<CandidateRelationship[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        const { data, error } = await supabase
            .from('candidate_companies')
            .select(`
                candidate_id,
                title,
                start_date,
                end_date,
                is_current,
                companies!inner (
                    id,
                    name
                ),
                candidate_documents!inner (
                    metadata
                )
            `)
            .eq('companies.name', companyName);

        if (error || !data) {
            return err(upstream('GraphQueryService', 'Error finding candidates by company.', error), { data: [] });
        }

        return ok(data.map(row => ({
            candidate_id: row.candidate_id,
            candidate_name: (row.candidate_documents as any).metadata.name,
            candidate_title: row.title,
            candidate_email: (row.candidate_documents as any).metadata.email,
            relationship_type: 'worked_at',
            relationship_context: `${row.title} at ${companyName} (${row.start_date} - ${row.is_current ? 'Present' : row.end_date})`
        })));
    }

    /**
     * Find candidates who studied at a specific school
     */
    async findCandidatesBySchool(schoolName: string): Promise<Result<CandidateRelationship[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        const { data, error } = await supabase
            .from('candidate_schools')
            .select(`
                candidate_id,
                degree,
                field_of_study,
                graduation_year,
                schools!inner (
                    id,
                    name
                ),
                candidate_documents!inner (
                    metadata
                )
            `)
            .eq('schools.name', schoolName);

        if (error || !data) {
            return err(upstream('GraphQueryService', 'Error finding candidates by school.', error), { data: [] });
        }

        return ok(data.map(row => ({
            candidate_id: row.candidate_id,
            candidate_name: (row.candidate_documents as any).metadata.name,
            candidate_title: (row.candidate_documents as any).metadata.title,
            candidate_email: (row.candidate_documents as any).metadata.email,
            relationship_type: 'studied_at',
            relationship_context: `${row.degree} in ${row.field_of_study} from ${schoolName} (${row.graduation_year})`
        })));
    }

    /**
     * Find candidates with a specific skill
     */
    async findCandidatesBySkill(skillName: string, minProficiency?: string): Promise<Result<CandidateRelationship[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        let query = supabase
            .from('candidate_skills')
            .select(`
                candidate_id,
                proficiency_level,
                years_of_experience,
                skills!inner (
                    id,
                    name
                ),
                candidate_documents!inner (
                    metadata
                )
            `)
            .eq('skills.name', skillName);

        if (minProficiency) {
            // DB constraint only allows: beginner | intermediate | expert
            const normalizedMin =
                minProficiency === 'advanced' ? 'expert' : minProficiency;

            const proficiencyOrder = ['beginner', 'intermediate', 'expert'];
            const minIndex = proficiencyOrder.indexOf(normalizedMin);
            if (minIndex >= 0) {
                query = query.in('proficiency_level', proficiencyOrder.slice(minIndex));
            }
        }

        const { data, error } = await query;

        if (error || !data) {
            return err(upstream('GraphQueryService', 'Error finding candidates by skill.', error), { data: [] });
        }

        return ok(data.map(row => ({
            candidate_id: row.candidate_id,
            candidate_name: (row.candidate_documents as any).metadata.name,
            candidate_title: (row.candidate_documents as any).metadata.title,
            candidate_email: (row.candidate_documents as any).metadata.email,
            relationship_type: 'has_skill',
            relationship_context: `${skillName} - ${row.proficiency_level} (${row.years_of_experience} years)`
        })));
    }

    /**
     * Find candidates matching multiple criteria (AND logic)
     */
    async findCandidatesByMultipleCriteria(criteria: {
        companies?: string[];
        schools?: string[];
        skills?: string[];
    }): Promise<Result<CandidateRelationship[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        // Start with all candidates
        let candidateIds: Set<string> | null = null;

        // Filter by companies
        if (criteria.companies && criteria.companies.length > 0) {
            const { data } = await supabase
                .from('candidate_companies')
                .select('candidate_id, companies!inner(name)')
                .in('companies.name', criteria.companies);

            const companyIds = new Set(data?.map(row => row.candidate_id) || []);
            candidateIds = candidateIds ? new Set([...candidateIds].filter(id => companyIds.has(id))) : companyIds;
        }

        // Filter by schools
        if (criteria.schools && criteria.schools.length > 0) {
            const { data } = await supabase
                .from('candidate_schools')
                .select('candidate_id, schools!inner(name)')
                .in('schools.name', criteria.schools);

            const schoolIds = new Set(data?.map(row => row.candidate_id) || []);
            candidateIds = candidateIds ? new Set([...candidateIds].filter(id => schoolIds.has(id))) : schoolIds;
        }

        // Filter by skills
        if (criteria.skills && criteria.skills.length > 0) {
            const { data } = await supabase
                .from('candidate_skills')
                .select('candidate_id, skills!inner(name)')
                .in('skills.name', criteria.skills);

            const skillIds = new Set(data?.map(row => row.candidate_id) || []);
            candidateIds = candidateIds ? new Set([...candidateIds].filter(id => skillIds.has(id))) : skillIds;
        }

        if (!candidateIds || candidateIds.size === 0) {
            return ok([]);
        }

        // Fetch full candidate details
        const { data, error } = await supabase
            .from('candidate_documents')
            .select('id, metadata')
            .in('id', Array.from(candidateIds));

        if (error || !data) {
            return err(upstream('GraphQueryService', 'Error loading candidate documents for criteria.', error), { data: [] });
        }

        return ok(data.map(row => ({
            candidate_id: row.id,
            candidate_name: row.metadata.name,
            candidate_title: row.metadata.title,
            candidate_email: row.metadata.email,
            relationship_type: 'multi_criteria',
            relationship_context: `Matches: ${criteria.companies?.join(', ') || ''} ${criteria.schools?.join(', ') || ''} ${criteria.skills?.join(', ') || ''}`
        })));
    }

    /**
     * Find common career paths (company transitions)
     */
    async findCareerPaths(fromCompany?: string, toCompany?: string): Promise<Result<CareerPath[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        // This is a complex query - find candidates who worked at multiple companies
        const { data, error } = await supabase.rpc('find_career_transitions', {
            from_company: fromCompany || null,
            to_company: toCompany || null
        });

        if (error) {
            return err(upstream('GraphQueryService', 'Career path query not available (RPC missing or failed).', error), { data: [] });
        }

        return ok(data || []);
    }

    /**
     * Find alumni network (people who went to same school)
     */
    async findAlumniNetwork(schoolName: string, limit: number = 50): Promise<Result<CandidateRelationship[]>> {
        return this.findCandidatesBySchool(schoolName);
    }

    /**
     * Find company alumni network
     */
    async findCompanyAlumniNetwork(companyName: string, limit: number = 50): Promise<Result<CandidateRelationship[]>> {
        return this.findCandidatesByCompany(companyName);
    }

    /**
     * Find skill clusters (skills that frequently appear together)
     */
    async findSkillClusters(primarySkill: string): Promise<Result<SkillCluster[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        // Find candidates with the primary skill
        const { data: primarySkillData } = await supabase
            .from('candidate_skills')
            .select('candidate_id, skills!inner(name)')
            .eq('skills.name', primarySkill);

        if (!primarySkillData || primarySkillData.length === 0) {
            return ok([]);
        }

        const candidateIds = primarySkillData.map(row => row.candidate_id);

        // Find other skills these candidates have
        const { data: relatedSkillsData } = await supabase
            .from('candidate_skills')
            .select('candidate_id, skills!inner(name)')
            .in('candidate_id', candidateIds)
            .neq('skills.name', primarySkill);

        if (!relatedSkillsData) {
            return ok([]);
        }

        // Count skill occurrences
        const skillCounts: Record<string, number> = {};
        relatedSkillsData.forEach(row => {
            const skillName = (row.skills as any).name;
            skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;
        });

        // Sort by frequency
        const sortedSkills = Object.entries(skillCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        return ok([{
            primary_skill: primarySkill,
            related_skills: sortedSkills.map(([skill]) => skill),
            candidate_count: candidateIds.length
        }]);
    }

    /**
     * Find 2nd degree connections (people in your network's network)
     */
    async find2ndDegreeConnections(candidateId: string): Promise<Result<CandidateRelationship[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        // Find companies the candidate worked at
        const { data: companies } = await supabase
            .from('candidate_companies')
            .select('company_id, companies(name)')
            .eq('candidate_id', candidateId);

        if (!companies || companies.length === 0) {
            return ok([]);
        }

        const companyIds = companies.map(c => c.company_id);

        // Find other people who worked at those companies
        const { data: connections } = await supabase
            .from('candidate_companies')
            .select(`
                candidate_id,
                title,
                companies(name),
                candidate_documents!inner(metadata)
            `)
            .in('company_id', companyIds)
            .neq('candidate_id', candidateId)
            .limit(50);

        if (!connections) {
            return ok([]);
        }

        return ok(connections.map(row => ({
            candidate_id: row.candidate_id,
            candidate_name: (row.candidate_documents as any).metadata.name,
            candidate_title: row.title,
            candidate_email: (row.candidate_documents as any).metadata.email,
            relationship_type: '2nd_degree',
            relationship_context: `Both worked at ${(row.companies as any).name}`
        })));
    }

    /**
     * Get all companies in the graph
     */
    async getAllCompanies(): Promise<Result<CompanyNode[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('name');

        if (error || !data) {
            return err(upstream('GraphQueryService', 'Error loading companies.', error), { data: [] });
        }

        return ok(data);
    }

    /**
     * Get all schools in the graph
     */
    async getAllSchools(): Promise<Result<SchoolNode[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        const { data, error } = await supabase
            .from('schools')
            .select('*')
            .order('name');

        if (error || !data) {
            return err(upstream('GraphQueryService', 'Error loading schools.', error), { data: [] });
        }

        return ok(data);
    }

    /**
     * Get all skills in the graph
     */
    async getAllSkills(): Promise<Result<SkillNode[]>> {
        if (!supabase) return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: [] });

        const { data, error } = await supabase
            .from('skills')
            .select('*')
            .order('name');

        if (error || !data) {
            return err(upstream('GraphQueryService', 'Error loading skills.', error), { data: [] });
        }

        return ok(data);
    }

    /**
     * Get graph statistics
     */
    async getGraphStats(): Promise<Result<{
        totalCandidates: number;
        totalCompanies: number;
        totalSchools: number;
        totalSkills: number;
        totalRelationships: number;
    }>> {
        const safe = {
                totalCandidates: 0,
                totalCompanies: 0,
                totalSchools: 0,
                totalSkills: 0,
                totalRelationships: 0
            };

        if (!supabase) {
            return err(notConfigured('GraphQueryService', 'Supabase is not configured.'), { data: safe });
        }

        const [candidates, companies, schools, skills, companyRelations, schoolRelations, skillRelations] = await Promise.all([
            supabase.from('candidate_documents').select('id', { count: 'exact', head: true }),
            supabase.from('companies').select('id', { count: 'exact', head: true }),
            supabase.from('schools').select('id', { count: 'exact', head: true }),
            supabase.from('skills').select('id', { count: 'exact', head: true }),
            supabase.from('candidate_companies').select('candidate_id', { count: 'exact', head: true }),
            supabase.from('candidate_schools').select('candidate_id', { count: 'exact', head: true }),
            supabase.from('candidate_skills').select('candidate_id', { count: 'exact', head: true })
        ]);

        const anyError =
            candidates.error || companies.error || schools.error || skills.error ||
            companyRelations.error || schoolRelations.error || skillRelations.error;

        const data = {
            totalCandidates: candidates.count || 0,
            totalCompanies: companies.count || 0,
            totalSchools: schools.count || 0,
            totalSkills: skills.count || 0,
            totalRelationships: (companyRelations.count || 0) + (schoolRelations.count || 0) + (skillRelations.count || 0)
        };

        if (anyError) {
            return err(upstream('GraphQueryService', 'Error loading graph stats.', anyError), { data });
        }

        return ok(data);
    }
}

export const graphQueryService = new GraphQueryService();
