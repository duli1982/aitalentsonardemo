-- ============================================
-- Pipeline Scheduling + Interview Persistence
-- Run this in your Supabase SQL Editor
-- ============================================
-- Purpose:
-- - Persist scheduling proposals + confirmed interviews (restart-safe)
-- - Persist interview sessions (transcripts + debriefs) for auditability
--
-- Notes:
-- - Uses TEXT ids because this app uses string ids.
-- - Postgres does NOT support "CREATE POLICY IF NOT EXISTS".
--   This script uses DROP POLICY IF EXISTS ... then CREATE POLICY ...
--
-- Optional (recommended): enable extensions if not already enabled
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ============================================

-- 1) Scheduled interviews (includes proposals + reschedules)
CREATE TABLE IF NOT EXISTS scheduled_interviews (
  interview_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  candidate_name TEXT,
  job_id TEXT NOT NULL,
  job_title TEXT,
  interview_type TEXT NOT NULL CHECK (interview_type IN ('phone', 'video', 'onsite')),
  meeting_provider TEXT NOT NULL CHECK (meeting_provider IN ('google_meet', 'ms_teams')),
  meeting_link TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'proposed', 'confirmed', 'declined', 'rescheduled', 'cancelled')) DEFAULT 'queued',
  requested_at TIMESTAMPTZ,
  proposed_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduled_time TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  reschedule_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_interviews_candidate ON scheduled_interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_interviews_job ON scheduled_interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_interviews_updated_at ON scheduled_interviews(updated_at DESC);

COMMENT ON TABLE scheduled_interviews IS 'Scheduling proposals + confirmed interviews (restart-safe).';

-- 2) Interview sessions (transcripts + debriefs)
CREATE TABLE IF NOT EXISTS interview_sessions (
  session_id TEXT PRIMARY KEY,
  interview_id TEXT,
  candidate_id TEXT NOT NULL,
  candidate_name TEXT,
  job_id TEXT NOT NULL,
  job_title TEXT,
  meeting_provider TEXT NOT NULL CHECK (meeting_provider IN ('google_meet', 'ms_teams')),
  meeting_link TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  debrief JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_job ON interview_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_started_at ON interview_sessions(started_at DESC);

COMMENT ON TABLE interview_sessions IS 'Interview sessions with transcript + debrief artifacts.';

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE scheduled_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Authenticated users (adjust for production)
DROP POLICY IF EXISTS "scheduled_interviews_authenticated_all" ON scheduled_interviews;
CREATE POLICY "scheduled_interviews_authenticated_all"
ON scheduled_interviews
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "interview_sessions_authenticated_all" ON interview_sessions;
CREATE POLICY "interview_sessions_authenticated_all"
ON interview_sessions
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "scheduled_interviews_anon_all" ON scheduled_interviews;
-- Optional for local/demo only:
-- CREATE POLICY "scheduled_interviews_anon_all"
-- ON scheduled_interviews
-- FOR ALL
-- TO anon
-- USING (true)
-- WITH CHECK (true);

DROP POLICY IF EXISTS "interview_sessions_anon_all" ON interview_sessions;
-- Optional for local/demo only:
-- CREATE POLICY "interview_sessions_anon_all"
-- ON interview_sessions
-- FOR ALL
-- TO anon
-- USING (true)
-- WITH CHECK (true);
