-- ========================================================
-- COMPATIBILITY UPDATE: JOBS & CANDIDATES ID TYPE
-- ========================================================
-- Why: The frontend app uses custom string IDs (e.g., 'j1', 'job-1738165038000'). 
-- Standard UUID columns will reject these strings. This script updates core 
-- tables to use TEXT for Primary Keys to ensure seamless sync.
-- ========================================================

-- This script converts core IDs to TEXT and safely handles dependent views/FKs.
-- It is safe to run multiple times.

-- 0) Drop dependent view/function if present (recreated later when candidates use TEXT)
DROP VIEW IF EXISTS public.candidate_documents_view;
DROP FUNCTION IF EXISTS public.match_candidates(vector, float, int, boolean);

-- 1) Drop known FKs that reference candidates.id or jobs.id
ALTER TABLE IF EXISTS public.candidate_documents
  DROP CONSTRAINT IF EXISTS fk_candidate_documents_candidate;
ALTER TABLE IF EXISTS public.candidates
  DROP CONSTRAINT IF EXISTS fk_candidates_active_document;
ALTER TABLE IF EXISTS public.candidate_demographics
  DROP CONSTRAINT IF EXISTS candidate_demographics_candidate_id_fkey;

-- 2) Update primary IDs to TEXT
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jobs') THEN
    ALTER TABLE public.jobs ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidates') THEN
    ALTER TABLE public.candidates ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

-- 3) Update foreign keys to TEXT (core tables)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'match_scores') THEN
    ALTER TABLE public.match_scores ALTER COLUMN job_id TYPE TEXT USING job_id::text;
    ALTER TABLE public.match_scores ALTER COLUMN candidate_id TYPE TEXT USING candidate_id::text;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recruiter_feedback') THEN
    ALTER TABLE public.recruiter_feedback ALTER COLUMN job_id TYPE TEXT USING job_id::text;
    ALTER TABLE public.recruiter_feedback ALTER COLUMN candidate_id TYPE TEXT USING candidate_id::text;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hiring_outcomes') THEN
    ALTER TABLE public.hiring_outcomes ALTER COLUMN job_id TYPE TEXT USING job_id::text;
    ALTER TABLE public.hiring_outcomes ALTER COLUMN candidate_id TYPE TEXT USING candidate_id::text;
  END IF;
END $$;

-- 4) Optional tables (only if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'job_context_packs') THEN
    ALTER TABLE public.job_context_packs ALTER COLUMN job_id TYPE TEXT USING job_id::text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidate_documents') THEN
    ALTER TABLE public.candidate_documents ALTER COLUMN candidate_id TYPE TEXT USING candidate_id::text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidate_demographics') THEN
    ALTER TABLE public.candidate_demographics ALTER COLUMN candidate_id TYPE TEXT USING candidate_id::text;
  END IF;
END $$;

-- 5) Recreate key FKs (TEXT -> TEXT)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidate_documents') THEN
    ALTER TABLE public.candidate_documents
      ADD CONSTRAINT fk_candidate_documents_candidate
      FOREIGN KEY (candidate_id) REFERENCES public.candidates(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidate_demographics') THEN
    ALTER TABLE public.candidate_demographics
      ADD CONSTRAINT candidate_demographics_candidate_id_fkey
      FOREIGN KEY (candidate_id) REFERENCES public.candidates(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 6) Recreate candidate_documents_view + match_candidates() if those tables exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidate_documents')
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'candidates') THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.candidate_documents_view AS
      SELECT
        c.id as candidate_id,
        c.full_name as name,
        c.email,
        c.headline as title,
        c.location,
        c.experience_years,
        c.seniority,
        c.skills,
        c.updated_at as candidate_updated_at,
        c.active_document_id as document_id,
        d.content,
        d.metadata as document_metadata,
        d.source as document_source,
        d.document_version,
        d.updated_at as document_updated_at
      FROM public.candidates c
      LEFT JOIN public.candidate_documents d
        ON d.id = c.active_document_id
      WHERE c.deleted_at IS NULL;
    $view$;

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.match_candidates (
        query_embedding vector(768),
        match_threshold float,
        match_count int,
        include_historical boolean default false
      )
      RETURNS TABLE (
        id bigint,
        content text,
        metadata jsonb,
        similarity float,
        candidate_id text,
        name text,
        email text,
        title text,
        location text,
        experience_years numeric,
        seniority text,
        skills text[]
      )
      LANGUAGE sql
      STABLE
      AS $function$
        SELECT
          d.id,
          d.content,
          d.metadata,
          1 - (d.embedding <=> query_embedding) as similarity,
          c.id as candidate_id,
          c.full_name as name,
          c.email,
          c.headline as title,
          c.location,
          c.experience_years,
          c.seniority,
          c.skills
        FROM public.candidate_documents d
        JOIN public.candidates c on c.id = d.candidate_id
        WHERE c.deleted_at IS NULL
          AND (include_historical OR d.is_active)
          AND 1 - (d.embedding <=> query_embedding) > match_threshold
        ORDER BY d.embedding <=> query_embedding
        LIMIT match_count;
      $function$;
    $fn$;
  END IF;
END $$;
