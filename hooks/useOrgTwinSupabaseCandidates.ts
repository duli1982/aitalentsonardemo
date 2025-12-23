import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Candidate } from '../types';
import { supabase } from '../services/supabaseClient';
import { degradedModeService } from '../services/DegradedModeService';
import { notConfigured, upstream } from '../services/errorHandling';

export interface OrgTwinCandidatesOptions {
  enabled?: boolean;
  limit?: number;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  return [];
}

/**
 * Fetch candidates from Supabase system-of-record for Org Twin capabilities.
 * Uses `public.candidates` because it contains canonical fields + metadata.passport.
 */
export function useOrgTwinSupabaseCandidates(options: OrgTwinCandidatesOptions = {}) {
  const { enabled = true, limit = 7000 } = options;

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = useMemo(() => `orgtwin_candidates_${limit}`, [limit]);

  const fetchCandidates = useCallback(async () => {
    if (!enabled) {
      setCandidates([]);
      return;
    }

    if (!supabase) {
      setCandidates([]);
      setError(new Error(notConfigured('useOrgTwinSupabaseCandidates', 'Supabase is not configured.').message));
      return;
    }

    // Cache valid for 10 minutes (Org Twin can tolerate slightly stale analytics).
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const ageMs = Date.now() - Number(parsed?.timestamp ?? 0);
        if (Array.isArray(parsed?.data) && ageMs < 10 * 60 * 1000) {
          setCandidates(parsed.data);
          return;
        }
      }
    } catch {
      // ignore
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: supaError } = await supabase
        .from('candidates')
        .select('id, full_name, email, location, headline, experience_years, skills, metadata, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (supaError) throw supaError;

      const parsed: Candidate[] = (data || []).map((row: any) => {
        const metadata = row?.metadata ?? {};
        const passport = metadata?.passport ?? null;

        const skills = asStringArray(row?.skills);
        const verifiedSkills = Array.isArray(passport?.verifiedSkills) ? passport.verifiedSkills : [];
        const badges = Array.isArray(passport?.badges) ? passport.badges : [];

        const candidate: Candidate = {
          id: String(row?.id),
          name: row?.full_name || metadata?.name || metadata?.full_name || 'Unknown',
          email: row?.email || metadata?.email || '',
          type: 'uploaded' as const,
          skills,
          role: row?.headline || metadata?.title || metadata?.role || 'Candidate',
          experience: Number(row?.experience_years ?? metadata?.experienceYears ?? metadata?.experience ?? 0) || 0,
          location: row?.location || metadata?.location || '',
          availability: metadata?.availability || '',
          passport: verifiedSkills.length || badges.length ? { verifiedSkills, badges } : undefined
        } as Candidate;

        (candidate as any).metadata = metadata;
        return candidate;
      });

      setCandidates(parsed);

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: parsed, timestamp: Date.now() }));
      } catch {
        // ignore
      }
    } catch (e) {
      degradedModeService.report({
        feature: 'org_twin_candidates',
        error: upstream('useOrgTwinSupabaseCandidates', 'Failed to load Org Twin candidates.', e),
        lastUpdatedAt: new Date().toISOString(),
        whatMightBeMissing: 'Org Twin capability metrics may be incomplete or unavailable.'
      });
      setError(e instanceof Error ? e : new Error('Failed to fetch candidates'));
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, cacheKey, limit]);

  useEffect(() => {
    void fetchCandidates();
  }, [fetchCandidates]);

  const refresh = useCallback(() => {
    try {
      localStorage.removeItem(cacheKey);
    } catch {
      // ignore
    }
    void fetchCandidates();
  }, [cacheKey, fetchCandidates]);

  return { candidates, isLoading, error, refresh };
}

