-- ============================================
-- Pipeline Idempotency (Restart-safe Steps)
-- Run this in your Supabase SQL Editor
-- ============================================
-- Purpose:
-- - Makes agents/migrations safe to re-run without duplicates or 409 conflicts.
-- - Tracks per-(candidate, job, step) execution with a small lock/state machine.
--
-- Notes:
-- - Postgres does NOT support "CREATE POLICY IF NOT EXISTS"
-- - This script uses DROP POLICY IF EXISTS ... then CREATE POLICY ...
-- ============================================

CREATE TABLE IF NOT EXISTS pipeline_processing_marks (
  candidate_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed')) DEFAULT 'started',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (candidate_id, job_id, step)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_processing_marks_status ON pipeline_processing_marks(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_processing_marks_updated_at ON pipeline_processing_marks(updated_at DESC);

COMMENT ON TABLE pipeline_processing_marks IS 'Idempotency + restart-safe step locks for candidate/job processing.';

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE pipeline_processing_marks ENABLE ROW LEVEL SECURITY;

-- Authenticated users
DROP POLICY IF EXISTS "pipeline_processing_marks_authenticated_all" ON pipeline_processing_marks;
CREATE POLICY "pipeline_processing_marks_authenticated_all"
ON pipeline_processing_marks
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pipeline_processing_marks_anon_all" ON pipeline_processing_marks;
-- Optional for local/demo only:
-- CREATE POLICY "pipeline_processing_marks_anon_all"
-- ON pipeline_processing_marks
-- FOR ALL
-- TO anon
-- USING (true)
-- WITH CHECK (true);
