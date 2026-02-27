/**
 * IntakeCallPersistenceService
 * Persists intake call sessions and scorecards to Supabase with localStorage fallback.
 */

import { supabase } from './supabaseClient';
import type { IntakeCallSession, IntakeScorecard } from '../types';

const LOCAL_SESSIONS_KEY = 'intake_call_sessions_v1';
const LOCAL_SCORECARDS_KEY = 'intake_scorecards_v1';

function asEpoch(input?: string): number {
  if (!input) return 0;
  const t = Date.parse(input);
  return Number.isFinite(t) ? t : 0;
}

class IntakeCallPersistenceService {
  isAvailable(): boolean {
    return Boolean(supabase);
  }

  private async canUseSupabase(): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) return false;
      return Boolean(data?.user?.id);
    } catch {
      return false;
    }
  }

  async upsertSession(session: IntakeCallSession): Promise<void> {
    const db = (await this.canUseSupabase()) ? supabase : null;
    if (db) {
      const payload = {
        id: session.id,
        job_id: session.jobId,
        job_title: session.jobTitle ?? null,
        participants: session.participants,
        transcript: session.transcript,
        raw_transcript: session.rawTranscript ?? null,
        status: session.status,
        started_at: session.startedAt,
        ended_at: session.endedAt ?? null,
        updated_at: new Date().toISOString()
      };

      const { error } = await db.from('intake_call_sessions').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn('[IntakeCallPersistence] Session upsert failed:', error);
      }
    }

    try {
      const all = this.loadLocalMap<IntakeCallSession>(LOCAL_SESSIONS_KEY);
      all[session.id] = session;
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(all));
    } catch {
      // ignore local fallback errors
    }
  }

  async getSessionsByJob(jobId: string): Promise<IntakeCallSession[]> {
    const db = (await this.canUseSupabase()) ? supabase : null;
    if (db) {
      const { data, error } = await db
        .from('intake_call_sessions')
        .select('*')
        .eq('job_id', jobId)
        .order('started_at', { ascending: false });

      if (!error && data) {
        return data.map((row) => this.mapSessionRow(row));
      }
    }

    const all = this.loadLocalMap<IntakeCallSession>(LOCAL_SESSIONS_KEY);
    return Object.values(all).filter((s) => s.jobId === jobId);
  }

  async getSessionById(sessionId: string): Promise<IntakeCallSession | null> {
    const db = (await this.canUseSupabase()) ? supabase : null;
    if (db) {
      const { data, error } = await db
        .from('intake_call_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (!error && data) {
        return this.mapSessionRow(data);
      }
    }

    const all = this.loadLocalMap<IntakeCallSession>(LOCAL_SESSIONS_KEY);
    return all[sessionId] ?? null;
  }

  async upsertScorecard(scorecard: IntakeScorecard): Promise<void> {
    const db = (await this.canUseSupabase()) ? supabase : null;
    if (db) {
      const nowIso = new Date().toISOString();
      const payload = {
        id: scorecard.id,
        session_id: scorecard.sessionId,
        job_id: scorecard.jobId,
        summary: scorecard.summary,
        must_have: scorecard.mustHave,
        nice_to_have: scorecard.niceToHave,
        ideal_profile: scorecard.idealProfile,
        red_flags: scorecard.redFlags,
        role_context: scorecard.roleContext,
        status: scorecard.status,
        approved_by: scorecard.approvedBy ?? null,
        approved_at: scorecard.approvedAt ?? null,
        updated_at: scorecard.updatedAt || nowIso
      };

      if (scorecard.status === 'approved') {
        // Keep DB state compatible with one-approved-per-job constraint.
        await db
          .from('intake_scorecards')
          .update({ status: 'revised', updated_at: nowIso })
          .eq('job_id', scorecard.jobId)
          .eq('status', 'approved')
          .neq('id', scorecard.id);
      }

      let { error } = await db.from('intake_scorecards').upsert(payload, { onConflict: 'id' });

      // Retry once for unique conflict races.
      if (error && String((error as any)?.code || '') === '23505' && scorecard.status === 'approved') {
        await db
          .from('intake_scorecards')
          .update({ status: 'revised', updated_at: nowIso })
          .eq('job_id', scorecard.jobId)
          .eq('status', 'approved')
          .neq('id', scorecard.id);

        const retry = await db.from('intake_scorecards').upsert(payload, { onConflict: 'id' });
        error = retry.error;
      }

      if (error) {
        console.warn('[IntakeCallPersistence] Scorecard upsert failed:', error);
      }
    }

    try {
      const nowIso = new Date().toISOString();
      const all = this.loadLocalMap<IntakeScorecard>(LOCAL_SCORECARDS_KEY);

      if (scorecard.status === 'approved') {
        // Mirror one-approved-per-job rule in local fallback store.
        Object.values(all).forEach((existing) => {
          if (
            existing.jobId === scorecard.jobId &&
            existing.id !== scorecard.id &&
            existing.status === 'approved'
          ) {
            existing.status = 'revised';
            existing.updatedAt = nowIso;
          }
        });
      }

      all[scorecard.id] = scorecard;
      localStorage.setItem(LOCAL_SCORECARDS_KEY, JSON.stringify(all));
    } catch {
      // ignore local fallback errors
    }
  }

  async getScorecardByJob(jobId: string): Promise<IntakeScorecard | null> {
    const db = (await this.canUseSupabase()) ? supabase : null;
    if (db) {
      const { data, error } = await db
        .from('intake_scorecards')
        .select('*')
        .eq('job_id', jobId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return this.mapScorecardRow(data);
      }
    }

    const all = this.loadLocalMap<IntakeScorecard>(LOCAL_SCORECARDS_KEY);
    const matches = Object.values(all)
      .filter((s) => s.jobId === jobId)
      .sort((a, b) => asEpoch(b.updatedAt || b.createdAt) - asEpoch(a.updatedAt || a.createdAt));
    return matches[0] ?? null;
  }

  async getApprovedScorecardForJob(jobId: string): Promise<IntakeScorecard | null> {
    const db = (await this.canUseSupabase()) ? supabase : null;
    if (db) {
      const { data, error } = await db
        .from('intake_scorecards')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return this.mapScorecardRow(data);
      }
    }

    const all = this.loadLocalMap<IntakeScorecard>(LOCAL_SCORECARDS_KEY);
    const matches = Object.values(all)
      .filter((s) => s.jobId === jobId && s.status === 'approved')
      .sort((a, b) => asEpoch(b.approvedAt || b.updatedAt) - asEpoch(a.approvedAt || a.updatedAt));
    return matches[0] ?? null;
  }

  private mapSessionRow(row: any): IntakeCallSession {
    return {
      id: row.id,
      jobId: row.job_id,
      jobTitle: row.job_title ?? undefined,
      participants: row.participants ?? [],
      transcript: row.transcript ?? [],
      rawTranscript: row.raw_transcript ?? undefined,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined
    };
  }

  private mapScorecardRow(row: any): IntakeScorecard {
    return {
      id: row.id,
      sessionId: row.session_id,
      jobId: row.job_id,
      summary: row.summary ?? '',
      mustHave: row.must_have ?? [],
      niceToHave: row.nice_to_have ?? [],
      idealProfile: row.ideal_profile ?? '',
      redFlags: row.red_flags ?? [],
      roleContext: row.role_context ?? {},
      status: row.status ?? 'draft',
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private loadLocalMap<T>(key: string): Record<string, T> {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

export const intakeCallPersistenceService = new IntakeCallPersistenceService();
