-- ============================================
-- Pipeline System of Truth (Events + Decisions)
-- Run this in your Supabase SQL Editor
-- ============================================
-- Notes:
-- - Designed for TEXT ids (candidate_id/job_id) because this app uses string ids.
-- - RLS is enabled.
-- - Postgres does NOT support "CREATE POLICY IF NOT EXISTS", so this script uses:
--   DROP POLICY IF EXISTS ...; then CREATE POLICY ...
--
-- Optional (recommended): enable extensions if not already enabled in your project
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- ============================================

-- 1) Rubrics (optional but recommended for auditability)
CREATE TABLE IF NOT EXISTS rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubric_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rubric_id, version)
);

-- 2) Decision artifacts (screening/interview/shortlist analyses)
CREATE TABLE IF NOT EXISTS decision_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT NOT NULL,
  candidate_name TEXT,
  job_id TEXT NOT NULL,
  job_title TEXT,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('screening', 'interview', 'shortlist_analysis')),
  decision TEXT NOT NULL CHECK (decision IN ('STRONG_PASS', 'PASS', 'BORDERLINE', 'FAIL', 'REJECTED', 'HIRED')),
  score INTEGER,
  confidence NUMERIC,
  summary TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  rubric_id UUID REFERENCES rubrics(id) ON DELETE SET NULL,
  rubric_version INTEGER,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_id, job_id, decision_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_artifacts_candidate ON decision_artifacts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_decision_artifacts_job ON decision_artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_decision_artifacts_created_at ON decision_artifacts(created_at DESC);

-- 3) Pipeline events (append-only feed powering Talent Pulse + audits)
CREATE TABLE IF NOT EXISTS pipeline_events (
  id BIGSERIAL PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  candidate_name TEXT,
  job_id TEXT NOT NULL,
  job_title TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'user', 'system')),
  actor_id TEXT,
  from_stage TEXT,
  to_stage TEXT,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_candidate ON pipeline_events(candidate_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_job ON pipeline_events(job_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_created_at ON pipeline_events(created_at DESC);

COMMENT ON TABLE pipeline_events IS 'Append-only event log for pipeline actions (agents/users/system).';
COMMENT ON TABLE decision_artifacts IS 'Structured decision outputs (screening/interview/shortlist) with audit artifacts.';

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Authenticated users (adjust for production)
DROP POLICY IF EXISTS "rubrics_authenticated_all" ON rubrics;
CREATE POLICY "rubrics_authenticated_all"
ON rubrics
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "rubric_versions_authenticated_all" ON rubric_versions;
CREATE POLICY "rubric_versions_authenticated_all"
ON rubric_versions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "decision_artifacts_authenticated_all" ON decision_artifacts;
CREATE POLICY "decision_artifacts_authenticated_all"
ON decision_artifacts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "pipeline_events_authenticated_all" ON pipeline_events;
CREATE POLICY "pipeline_events_authenticated_all"
ON pipeline_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Anon access (useful for local/demo apps using the public anon key)
-- If you don't want anon to write in production, remove the anon policies below.
DROP POLICY IF EXISTS "rubrics_anon_read" ON rubrics;
CREATE POLICY "rubrics_anon_read"
ON rubrics
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "rubric_versions_anon_read" ON rubric_versions;
CREATE POLICY "rubric_versions_anon_read"
ON rubric_versions
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "decision_artifacts_anon_all" ON decision_artifacts;
CREATE POLICY "decision_artifacts_anon_all"
ON decision_artifacts
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "pipeline_events_anon_all" ON pipeline_events;
CREATE POLICY "pipeline_events_anon_all"
ON pipeline_events
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

