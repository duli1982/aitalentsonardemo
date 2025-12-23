import { useState, useEffect, useCallback } from 'react';
import type { Candidate } from '../types';
import { supabase } from '../services/supabaseClient';
import { degradedModeService } from '../services/DegradedModeService';
import { upstream } from '../services/errorHandling';

export interface AllCandidatesOptions {
    enabled?: boolean;
    limit?: number;
}

/**
 * Hook to fetch ALL candidates from Supabase (not job-specific)
 * Used for the Talent Pool page to show the full candidate database
 */
export const useAllSupabaseCandidates = (options: AllCandidatesOptions = {}) => {
    const { enabled = true, limit = 100 } = options;

    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [currentLimit, setCurrentLimit] = useState(limit);

    const fetchCandidates = useCallback(async () => {
        if (!enabled || !supabase) {
            setCandidates([]);
            return;
        }

        // Check cache first
        const cacheKey = `all_candidates_${currentLimit}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;
                // Cache valid for 5 minutes
                if (age < 5 * 60 * 1000) {
                    console.log(`[useAllSupabaseCandidates] Using cached results`);
                    setCandidates(data);
                    setHasMore(data.length === currentLimit);
                    return;
                }
            }
        } catch (e) {
            console.warn('[useAllSupabaseCandidates] Cache read failed:', e);
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log(`[useAllSupabaseCandidates] Fetching ${currentLimit} candidates from Supabase...`);

            // Preferred: canonical read model view (candidates -> active document)
            // Fallback: candidate_documents legacy schema.
            let candidatesData: any[] | null = null;
            let candidatesError: any = null;

            const viewAttempt = await supabase
                .from('candidate_documents_view')
                .select('candidate_id, name, email, title, location, experience_years, skills, document_id, content, document_metadata, candidate_updated_at')
                .order('candidate_updated_at', { ascending: false })
                .limit(currentLimit);

            if (viewAttempt.error) {
                const legacyAttempt = await supabase
                    .from('candidate_documents')
                    .select('id, metadata, content')
                    .order('id', { ascending: false })
                    .limit(currentLimit);
                candidatesData = legacyAttempt.data as any[] | null;
                candidatesError = legacyAttempt.error;
            } else {
                candidatesData = viewAttempt.data as any[] | null;
                candidatesError = null;
            }

            if (candidatesError) throw candidatesError;

            if (!candidatesData || candidatesData.length === 0) {
                console.log('[useAllSupabaseCandidates] No candidates found');
                setCandidates([]);
                setHasMore(false);
                return;
            }

            console.log(`[useAllSupabaseCandidates] Found ${candidatesData.length} candidates`);

            const parsedCandidates = candidatesData.map((row: any) => {
                const isViewRow = row.candidate_id !== undefined;
                const rawMetadata = isViewRow ? row.document_metadata : row.metadata;
                const metadata = rawMetadata || {};
                const content = typeof row.content === 'string' ? row.content : '';
                const nameFromContent = content.includes(' - ') ? content.split(' - ')[0].trim() : '';

                const id = String(isViewRow ? row.candidate_id : (metadata.id || row.id));
                const name = row.name || metadata.name || metadata.full_name || nameFromContent || 'Unknown';
                const email = row.email || metadata.email || '';

                const rawSkills = row.skills ?? metadata.skills;
                const skills =
                    Array.isArray(rawSkills) ? rawSkills.map((s) => String(s)) :
                        Array.isArray(rawSkills?.data) ? rawSkills.data.map((s: any) => String(s)) :
                            [];

                return {
                    id,
                    metadata,
                    name,
                    email,
                    skills
                };
            });

            const candidateIds = parsedCandidates.map((c) => c.id);

            // Fetch companies
            const { data: companyData } = await supabase
                .from('candidate_companies')
                .select(`
                    candidate_id,
                    companies (name)
                `)
                .in('candidate_id', candidateIds);

            // Fetch schools
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

            // Transform to Candidate format
            const enrichedCandidates: Candidate[] = parsedCandidates.map((c) => {
                const companies = companyMap.get(c.id) || [];
                const schools = schoolMap.get(c.id) || [];
                const metadata = c.metadata || {};

                return {
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    type: 'uploaded' as const,
                    skills: c.skills,
                    role: metadata.role || metadata.title || 'Candidate',
                    location: metadata.location || '',
                    experienceYears: metadata.experienceYears || metadata.experience || 0,
                    companies,
                    schools,
                    metadata,
                    matchScores: {},
                    feedback: {}
                } as Candidate;
            });

            setCandidates(enrichedCandidates);
            setHasMore(candidatesData.length === currentLimit);

            // Cache the results
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: enrichedCandidates,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('[useAllSupabaseCandidates] Cache write failed:', e);
            }
        } catch (err) {
            console.error('[useAllSupabaseCandidates] Error fetching candidates:', err);
            degradedModeService.report({
                feature: 'all_supabase_candidates',
                error: upstream('useAllSupabaseCandidates', 'Failed to load candidates list.', err),
                lastUpdatedAt: new Date().toISOString(),
                whatMightBeMissing: 'Candidate list may be incomplete or unavailable.'
            });
            setError(err instanceof Error ? err : new Error('Failed to fetch candidates'));
            setCandidates([]);
        } finally {
            setIsLoading(false);
        }
    }, [enabled, currentLimit]);

    useEffect(() => {
        fetchCandidates();
    }, [fetchCandidates]);

    const loadMore = useCallback(() => {
        setCurrentLimit(prev => prev + limit);
    }, [limit]);

    const refresh = useCallback(() => {
        setCurrentLimit(limit);
        fetchCandidates();
    }, [limit, fetchCandidates]);

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
