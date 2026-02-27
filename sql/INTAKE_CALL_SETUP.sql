-- ========================================================
-- INTAKE CALL & SCORECARD TABLES (HARDENED)
-- ========================================================
-- Stores intake call sessions (HM + recruiter discussions)
-- and AI-generated scorecards that feed the sourcing agent.
-- Safe to run multiple times.
--
-- Improvements:
-- - stricter defaults + JSON shape checks
-- - updated_at trigger management
-- - at most one approved scorecard per job
-- - authenticated-only RLS policies (replaces permissive USING(true))
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Intake call sessions
CREATE TABLE IF NOT EXISTS public.intake_call_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         TEXT REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_title      TEXT,
  participants   JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript     JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_transcript TEXT,
  status         TEXT NOT NULL DEFAULT 'live'
                 CHECK (status IN ('live', 'processing', 'draft_ready', 'approved')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT intake_call_sessions_participants_is_array CHECK (jsonb_typeof(participants) = 'array'),
  CONSTRAINT intake_call_sessions_transcript_is_array CHECK (jsonb_typeof(transcript) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_intake_sessions_job ON public.intake_call_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_status ON public.intake_call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_job_status ON public.intake_call_sessions(job_id, status);

-- 2) Intake scorecards (AI-generated, human-approved criteria)
CREATE TABLE IF NOT EXISTS public.intake_scorecards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID REFERENCES public.intake_call_sessions(id) ON DELETE CASCADE,
  job_id         TEXT REFERENCES public.jobs(id) ON DELETE CASCADE,
  summary        TEXT,
  must_have      JSONB NOT NULL DEFAULT '[]'::jsonb,
  nice_to_have   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ideal_profile  TEXT,
  red_flags      JSONB NOT NULL DEFAULT '[]'::jsonb,
  role_context   JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'approved', 'revised')),
  approved_by    TEXT,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT intake_scorecards_must_have_is_array CHECK (jsonb_typeof(must_have) = 'array'),
  CONSTRAINT intake_scorecards_nice_to_have_is_array CHECK (jsonb_typeof(nice_to_have) = 'array'),
  CONSTRAINT intake_scorecards_red_flags_is_array CHECK (jsonb_typeof(red_flags) = 'array'),
  CONSTRAINT intake_scorecards_role_context_is_object CHECK (jsonb_typeof(role_context) = 'object'),
  CONSTRAINT intake_scorecards_approved_requires_timestamp
    CHECK (status <> 'approved' OR approved_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_intake_scorecards_job ON public.intake_scorecards(job_id);
CREATE INDEX IF NOT EXISTS idx_intake_scorecards_status ON public.intake_scorecards(status);
CREATE INDEX IF NOT EXISTS idx_intake_scorecards_session ON public.intake_scorecards(session_id);
CREATE INDEX IF NOT EXISTS idx_intake_scorecards_job_status ON public.intake_scorecards(job_id, status);
CREATE INDEX IF NOT EXISTS idx_intake_scorecards_approved_at ON public.intake_scorecards(approved_at DESC) WHERE status = 'approved';

-- 2.1) Backfill/sanitize rows for existing deployments before stricter uniqueness/indexing
ALTER TABLE public.intake_call_sessions
  ALTER COLUMN participants SET DEFAULT '[]'::jsonb,
  ALTER COLUMN transcript SET DEFAULT '[]'::jsonb;

ALTER TABLE public.intake_scorecards
  ALTER COLUMN must_have SET DEFAULT '[]'::jsonb,
  ALTER COLUMN nice_to_have SET DEFAULT '[]'::jsonb,
  ALTER COLUMN red_flags SET DEFAULT '[]'::jsonb,
  ALTER COLUMN role_context SET DEFAULT '{}'::jsonb;

UPDATE public.intake_call_sessions
SET participants = '[]'::jsonb
WHERE participants IS NULL;

UPDATE public.intake_call_sessions
SET transcript = '[]'::jsonb
WHERE transcript IS NULL;

UPDATE public.intake_scorecards
SET must_have = '[]'::jsonb
WHERE must_have IS NULL;

UPDATE public.intake_scorecards
SET nice_to_have = '[]'::jsonb
WHERE nice_to_have IS NULL;

UPDATE public.intake_scorecards
SET red_flags = '[]'::jsonb
WHERE red_flags IS NULL;

UPDATE public.intake_scorecards
SET role_context = '{}'::jsonb
WHERE role_context IS NULL;

UPDATE public.intake_scorecards
SET approved_at = COALESCE(approved_at, updated_at, created_at, now())
WHERE status = 'approved' AND approved_at IS NULL;

ALTER TABLE public.intake_call_sessions
  ALTER COLUMN participants SET NOT NULL,
  ALTER COLUMN transcript SET NOT NULL;

ALTER TABLE public.intake_scorecards
  ALTER COLUMN must_have SET NOT NULL,
  ALTER COLUMN nice_to_have SET NOT NULL,
  ALTER COLUMN red_flags SET NOT NULL,
  ALTER COLUMN role_context SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intake_call_sessions_participants_is_array'
      AND conrelid = 'public.intake_call_sessions'::regclass
  ) THEN
    ALTER TABLE public.intake_call_sessions
      ADD CONSTRAINT intake_call_sessions_participants_is_array
      CHECK (jsonb_typeof(participants) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intake_call_sessions_transcript_is_array'
      AND conrelid = 'public.intake_call_sessions'::regclass
  ) THEN
    ALTER TABLE public.intake_call_sessions
      ADD CONSTRAINT intake_call_sessions_transcript_is_array
      CHECK (jsonb_typeof(transcript) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intake_scorecards_must_have_is_array'
      AND conrelid = 'public.intake_scorecards'::regclass
  ) THEN
    ALTER TABLE public.intake_scorecards
      ADD CONSTRAINT intake_scorecards_must_have_is_array
      CHECK (jsonb_typeof(must_have) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intake_scorecards_nice_to_have_is_array'
      AND conrelid = 'public.intake_scorecards'::regclass
  ) THEN
    ALTER TABLE public.intake_scorecards
      ADD CONSTRAINT intake_scorecards_nice_to_have_is_array
      CHECK (jsonb_typeof(nice_to_have) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intake_scorecards_red_flags_is_array'
      AND conrelid = 'public.intake_scorecards'::regclass
  ) THEN
    ALTER TABLE public.intake_scorecards
      ADD CONSTRAINT intake_scorecards_red_flags_is_array
      CHECK (jsonb_typeof(red_flags) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intake_scorecards_role_context_is_object'
      AND conrelid = 'public.intake_scorecards'::regclass
  ) THEN
    ALTER TABLE public.intake_scorecards
      ADD CONSTRAINT intake_scorecards_role_context_is_object
      CHECK (jsonb_typeof(role_context) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'intake_scorecards_approved_requires_timestamp'
      AND conrelid = 'public.intake_scorecards'::regclass
  ) THEN
    ALTER TABLE public.intake_scorecards
      ADD CONSTRAINT intake_scorecards_approved_requires_timestamp
      CHECK (status <> 'approved' OR approved_at IS NOT NULL);
  END IF;
END $$;

-- Keep newest approved scorecard per job as approved; demote older ones to revised.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY job_id
      ORDER BY approved_at DESC NULLS LAST, updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.intake_scorecards
  WHERE status = 'approved' AND job_id IS NOT NULL
)
UPDATE public.intake_scorecards s
SET status = 'revised',
    updated_at = now()
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Enforce only one approved scorecard per job.
CREATE UNIQUE INDEX IF NOT EXISTS uq_intake_scorecards_one_approved_per_job
  ON public.intake_scorecards(job_id)
  WHERE status = 'approved' AND job_id IS NOT NULL;

-- 2.2) Trigger to auto-maintain updated_at
CREATE OR REPLACE FUNCTION public.intake_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_intake_call_sessions_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_intake_call_sessions_set_updated_at
      BEFORE UPDATE ON public.intake_call_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.intake_set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_intake_scorecards_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_intake_scorecards_set_updated_at
      BEFORE UPDATE ON public.intake_scorecards
      FOR EACH ROW
      EXECUTE FUNCTION public.intake_set_updated_at();
  END IF;
END $$;

-- 3) RLS policies (authenticated users only)
ALTER TABLE public.intake_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_scorecards ENABLE ROW LEVEL SECURITY;

-- Remove legacy permissive policies if present.
DROP POLICY IF EXISTS intake_sessions_all ON public.intake_call_sessions;
DROP POLICY IF EXISTS intake_scorecards_all ON public.intake_scorecards;

-- Replace policies with authenticated-only access.
DROP POLICY IF EXISTS intake_sessions_authenticated_all ON public.intake_call_sessions;
CREATE POLICY intake_sessions_authenticated_all
  ON public.intake_call_sessions
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS intake_scorecards_authenticated_all ON public.intake_scorecards;
CREATE POLICY intake_scorecards_authenticated_all
  ON public.intake_scorecards
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Optional for local demo-only environments:
-- CREATE POLICY intake_sessions_anon_all ON public.intake_call_sessions
--   FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY intake_scorecards_anon_all ON public.intake_scorecards
--   FOR ALL TO anon USING (true) WITH CHECK (true);
