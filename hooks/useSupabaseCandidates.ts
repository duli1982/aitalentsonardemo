import { useState, useEffect, useCallback } from 'react';
import type { Job, Candidate } from '../types';
import { semanticSearchService } from '../services/SemanticSearchService';
import { supabase } from '../services/supabaseClient';

export interface SupabaseCandidateResult {
    id: string;
    name: string;
    email: string;
    type: 'uploaded'; // All Supabase candidates are 'uploaded' type
    skills: string[];
    matchScore: number; // 0-100 based on semantic similarity
    metadata?: any;
    // Graph relationships
    companies?: string[];
    schools?: string[];
    experienceYears?: number;
    location?: string;
    matchReason?: string; // Why they match
}

interface UseSupabaseCandidatesOptions {
    enabled?: boolean;
    limit?: number;
    threshold?: number; // Minimum similarity threshold (0-1)
    // Filters
    experienceLevel?: 'junior' | 'mid' | 'senior' | null;
    location?: string | null;
    requiredSkills?: string[] | null;
}

export const useSupabaseCandidates = (
    job: Job | null,
    options: UseSupabaseCandidatesOptions = {}
) => {
    const {
        enabled = true,
        limit = 50,
        threshold = 0.3,
        experienceLevel = null,
        location = null,
        requiredSkills = null
    } = options;

    const [candidates, setCandidates] = useState<SupabaseCandidateResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [currentLimit, setCurrentLimit] = useState(limit);

    const clearJobCache = useCallback(() => {
        if (!job) return;
        const prefix = `candidates_${job.id}_`;
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) keysToRemove.push(key);
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {
            console.warn('[useSupabaseCandidates] Cache clear failed:', e);
        }
    }, [job]);

    const fetchCandidates = useCallback(async (overrideLimit?: number) => {
        if (!job || !enabled) {
            setCandidates([]);
            return;
        }

        const effectiveLimit = overrideLimit ?? currentLimit;

        // Build cache key
        const cacheKey = `candidates_${job.id}_${threshold}_${effectiveLimit}_${experienceLevel}_${location}_${requiredSkills?.join(',')}`;

        // Check cache first
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;
                // Cache valid for 5 minutes
                if (age < 5 * 60 * 1000) {
                    console.log(`[useSupabaseCandidates] Using cached results for job ${job.id}`);
                    setCandidates(data);
                    setHasMore(data.length === effectiveLimit);
                    return;
                }
            }
        } catch (e) {
            console.warn('[useSupabaseCandidates] Cache read failed:', e);
        }

        setIsLoading(true);
        setError(null);

        try {
            // Build search query from job details
            const searchQuery = buildJobSearchQuery(job);

            console.log(`[useSupabaseCandidates] Searching for: "${searchQuery}" (limit: ${effectiveLimit})`);

            // Use semantic search to find matching candidates
            const results = await semanticSearchService.search(searchQuery, {
                threshold,
                limit: effectiveLimit
            });

            console.log(`[useSupabaseCandidates] Found ${results.length} candidates`);

            // Enrich candidates with graph relationships
            const enrichedCandidates = await enrichWithGraphData(results, job);

            // Apply filters
            let filteredCandidates = enrichedCandidates;

            if (experienceLevel) {
                filteredCandidates = filteredCandidates.filter(c => {
                    const years = c.experienceYears || 0;
                    if (experienceLevel === 'junior') return years < 3;
                    if (experienceLevel === 'mid') return years >= 3 && years < 7;
                    if (experienceLevel === 'senior') return years >= 7;
                    return true;
                });
            }

            if (location) {
                filteredCandidates = filteredCandidates.filter(c =>
                    c.location?.toLowerCase().includes(location.toLowerCase())
                );
            }

            if (requiredSkills && requiredSkills.length > 0) {
                filteredCandidates = filteredCandidates.filter(c =>
                    requiredSkills.some(skill =>
                        c.skills.some(cSkill => cSkill.toLowerCase().includes(skill.toLowerCase()))
                    )
                );
            }

            setCandidates(filteredCandidates);
            setHasMore(results.length === effectiveLimit); // If we got full limit, there might be more
            if (overrideLimit !== undefined) {
                setCurrentLimit(overrideLimit);
            }

            // Cache the results
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: filteredCandidates,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('[useSupabaseCandidates] Cache write failed:', e);
            }
        } catch (err) {
            console.error('[useSupabaseCandidates] Error fetching candidates:', err);
            setError(err instanceof Error ? err : new Error('Failed to fetch candidates'));
            setCandidates([]);
        } finally {
            setIsLoading(false);
        }
    }, [job, enabled, threshold, currentLimit, experienceLevel, location, requiredSkills]);

    // Fetch candidates when job changes
    useEffect(() => {
        fetchCandidates();
    }, [fetchCandidates]);

    const loadMore = useCallback(() => {
        setCurrentLimit(prev => prev + limit);
    }, [limit]);

    const refresh = useCallback(() => {
        clearJobCache();
        fetchCandidates(limit);
    }, [limit, fetchCandidates, clearJobCache]);

    return {
        candidates,
        isLoading,
        error,
        hasMore,
        loadMore,
        refresh,
        total: candidates.length
    };
};

/**
 * Enrich candidates with graph relationship data
 */
async function enrichWithGraphData(
    results: any[],
    job: Job | null
): Promise<SupabaseCandidateResult[]> {
    if (!supabase) {
        // Fallback: return basic transformation without graph data
        return results.map(result => ({
            id: result.id,
            name: result.name,
            email: result.email || '',
            type: 'uploaded' as const,
            skills: result.skills || [],
            matchScore: Math.round(result.similarity * 100),
            metadata: result.metadata || {}
        }));
    }

    // Get all candidate IDs
    const candidateIds = results.map(r => r.id);

    try {
        // Fetch companies for these candidates
        const { data: companyData } = await supabase
            .from('candidate_companies')
            .select(`
                candidate_id,
                companies (name)
            `)
            .in('candidate_id', candidateIds);

        // Fetch schools for these candidates
        const { data: schoolData } = await supabase
            .from('candidate_schools')
            .select(`
                candidate_id,
                schools (name)
            `)
            .in('candidate_id', candidateIds);

        // Build lookup maps
        const companyMap = new Map<string, string[]>();
        const schoolMap = new Map<string, string[]>();

        companyData?.forEach((row: any) => {
            const id = row.candidate_id;
            const companyName = row.companies?.name;
            if (companyName) {
                if (!companyMap.has(id)) companyMap.set(id, []);
                companyMap.get(id)!.push(companyName);
            }
        });

        schoolData?.forEach((row: any) => {
            const id = row.candidate_id;
            const schoolName = row.schools?.name;
            if (schoolName) {
                if (!schoolMap.has(id)) schoolMap.set(id, []);
                schoolMap.get(id)!.push(schoolName);
            }
        });

        // Transform and enrich
        return results.map(result => {
            const companies = companyMap.get(result.id) || [];
            const schools = schoolMap.get(result.id) || [];
            const skills = result.skills || [];
            const matchScore = Math.round(result.similarity * 100);

            // Extract metadata
            const metadata = result.metadata || {};
            const experienceYears = metadata.experienceYears || metadata.experience || 0;
            const location = metadata.location || '';

            // Build match reason
            const matchReason = buildMatchReason(
                matchScore,
                skills,
                companies,
                schools,
                job
            );

            return {
                id: result.id,
                name: result.name,
                email: result.email || '',
                type: 'uploaded' as const,
                skills,
                matchScore,
                metadata,
                companies,
                schools,
                experienceYears,
                location,
                matchReason
            };
        });
    } catch (error) {
        console.error('[enrichWithGraphData] Error fetching graph data:', error);
        // Return basic transformation on error
        return results.map(result => ({
            id: result.id,
            name: result.name,
            email: result.email || '',
            type: 'uploaded' as const,
            skills: result.skills || [],
            matchScore: Math.round(result.similarity * 100),
            metadata: result.metadata || {}
        }));
    }
}

/**
 * Build a human-readable match reason
 */
function buildMatchReason(
    matchScore: number,
    skills: string[],
    companies: string[],
    schools: string[],
    job: Job | null
): string {
    const reasons: string[] = [];

    // Add skill match
    if (skills.length > 0) {
        const topSkills = skills.slice(0, 3).join(', ');
        reasons.push(`Skills: ${topSkills}`);
    }

    // Add company experience
    if (companies.length > 0) {
        reasons.push(`Worked at: ${companies.slice(0, 2).join(', ')}`);
    }

    // Add education
    if (schools.length > 0) {
        reasons.push(`Studied at: ${schools.slice(0, 1).join(', ')}`);
    }

    // Add match quality
    if (matchScore >= 80) {
        reasons.unshift('Excellent match');
    } else if (matchScore >= 60) {
        reasons.unshift('Good match');
    } else if (matchScore >= 40) {
        reasons.unshift('Moderate match');
    }

    return reasons.join(' • ');
}

/**
 * Build a search query from job details
 */
function buildJobSearchQuery(job: Job): string {
    const parts: string[] = [];

    // Add job title
    if (job.title) {
        parts.push(job.title);
    }

    // Add required skills
    if (job.requiredSkills && job.requiredSkills.length > 0) {
        parts.push(job.requiredSkills.join(' '));
    }

    // Add nice-to-have skills
    if (job.niceToHaveSkills && job.niceToHaveSkills.length > 0) {
        parts.push(job.niceToHaveSkills.join(' '));
    }

    // Add description (truncated to avoid too long queries)
    if (job.description) {
        const truncatedDesc = job.description.substring(0, 200);
        parts.push(truncatedDesc);
    }

    return parts.join(' ');
}
