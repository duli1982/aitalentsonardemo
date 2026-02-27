-- ============================================
-- Recruiting Scorecards (Normalized Scoring)
-- Run this in your Supabase SQL Editor
-- ============================================
-- Purpose:
-- - Creates a normalized "Recruiting Scorecard" that consolidates multiple signals
--   (semantic match, shortlist analysis, screening, engagement) into one comparable score.
-- - Stores per-(candidate, job) scorecards with provenance + confidence for auditability.
--
-- Notes:
-- - Designed for TEXT ids (candidate_id/job_id) because this app uses string ids.
-- - Postgres does NOT support "CREATE POLICY IF NOT EXISTS".
--   This script uses DROP POLICY IF EXISTS ... then CREATE POLICY ...
-- ============================================

CREATE TABLE IF NOT EXISTS recruiting_scorecards (
  id BIGSERIAL PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  candidate_name TEXT,
  job_id TEXT NOT NULL,
  job_title TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  confidence NUMERIC,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_id, job_id, version)
);

CREATE INDEX IF NOT EXISTS idx_recruiting_scorecards_candidate ON recruiting_scorecards(candidate_id);
CREATE INDEX IF NOT EXISTS idx_recruiting_scorecards_job ON recruiting_scorecards(job_id);
CREATE INDEX IF NOT EXISTS idx_recruiting_scorecards_updated_at ON recruiting_scorecards(updated_at DESC);

COMMENT ON TABLE recruiting_scorecards IS 'Normalized scorecards per (candidate, job) with dimensions, weights, and provenance.';

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE recruiting_scorecards ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Authenticated users (adjust for production)
DROP POLICY IF EXISTS "recruiting_scorecards_authenticated_all" ON recruiting_scorecards;
CREATE POLICY "recruiting_scorecards_authenticated_all"
ON recruiting_scorecards
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "recruiting_scorecards_anon_all" ON recruiting_scorecards;
-- Optional for local/demo only:
-- CREATE POLICY "recruiting_scorecards_anon_all"
-- ON recruiting_scorecards
-- FOR ALL
-- TO anon
-- USING (true)
-- WITH CHECK (true);
