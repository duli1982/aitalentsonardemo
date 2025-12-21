import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import type { DepartmentInsight } from '../types';

export interface SupabaseCandidateInsightsOptions {
    enabled?: boolean;
    pageSize?: number;
    cacheTtlMs?: number;
}

interface CachedPayload {
    timestamp: number;
    insights: DepartmentInsight[];
    totalCandidates: number;
}

const CACHE_KEY = 'supabase_candidate_insights_v1';

const buildInsightsFromCounts = (counts: Map<string, Map<string, number>>): DepartmentInsight[] => {
    return Array.from(counts.entries())
        .map(([department, skillCounts]) => {
            const topSkills = Array.from(skillCounts.entries())
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([skill, count]) => ({ skill, count }));
            return { department, topSkills };
        })
        .filter((d) => d.topSkills.length > 0)
        .sort((a, b) => a.department.localeCompare(b.department));
};

/**
 * Aggregates skills-by-department from ALL Supabase candidates, without loading full candidate profiles.
 * Uses `candidate_documents.metadata` only and paginates through all rows.
 */
export const useSupabaseCandidateInsights = (options: SupabaseCandidateInsightsOptions = {}) => {
    const { enabled = true, pageSize = 1000, cacheTtlMs = 5 * 60 * 1000 } = options;

    const [insights, setInsights] = useState<DepartmentInsight[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [totalCandidates, setTotalCandidates] = useState(0);

    const fetchInsights = useCallback(async () => {
        if (!enabled || !supabase) {
            setInsights([]);
            setTotalCandidates(0);
            return;
        }

        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const payload = JSON.parse(cached) as CachedPayload;
                if (payload?.timestamp && Date.now() - payload.timestamp < cacheTtlMs) {
                    setInsights(payload.insights || []);
                    setTotalCandidates(payload.totalCandidates || 0);
                    return;
                }
            }
        } catch {
            // ignore cache failures
        }

        setIsLoading(true);
        setError(null);

        try {
            const { count, error: countError } = await supabase
                .from('candidate_documents')
                .select('id', { count: 'exact', head: true });

            if (countError) throw countError;
            const total = count || 0;
            setTotalCandidates(total);

            const counts = new Map<string, Map<string, number>>();
            let offset = 0;

            while (offset < total) {
                const { data, error: pageError } = await supabase
                    .from('candidate_documents')
                    .select('id, metadata')
                    .range(offset, Math.min(offset + pageSize, total) - 1);

                if (pageError) throw pageError;
                if (!data || data.length === 0) break;

                for (const row of data as any[]) {
                    const metadata = row?.metadata || {};
                    const department =
                        metadata.department ||
                        metadata.industry ||
                        'Unknown';

                    const skills: unknown = metadata.skills;
                    if (!Array.isArray(skills) || skills.length === 0) continue;

                    if (!counts.has(department)) counts.set(department, new Map());
                    const skillCounts = counts.get(department)!;

                    for (const rawSkill of skills) {
                        const skill = String(rawSkill || '').trim();
                        if (!skill) continue;
                        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
                    }
                }

                offset += pageSize;
            }

            const computed = buildInsightsFromCounts(counts);
            setInsights(computed);

            try {
                localStorage.setItem(
                    CACHE_KEY,
                    JSON.stringify({
                        timestamp: Date.now(),
                        insights: computed,
                        totalCandidates: total
                    } satisfies CachedPayload)
                );
            } catch {
                // ignore cache failures
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to build Supabase candidate insights'));
            setInsights([]);
            setTotalCandidates(0);
        } finally {
            setIsLoading(false);
        }
    }, [cacheTtlMs, enabled, pageSize]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (cancelled) return;
            await fetchInsights();
        })();
        return () => {
            cancelled = true;
        };
    }, [fetchInsights]);

    const refresh = useCallback(() => {
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch {
            // ignore
        }
        fetchInsights();
    }, [fetchInsights]);

    return { insights, isLoading, error, totalCandidates, refresh };
};

