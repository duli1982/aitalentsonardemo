-- =========================================================
-- Talent Sonar: Candidates System-of-Record + Active Documents
-- =========================================================
-- Goal:
-- - candidates = canonical entity (stable UI contract)
-- - candidate_documents = versioned vector/full-text snapshots (multiple per candidate)
-- - candidate_documents_view = canonical read model (joins candidates -> active doc)
-- - match_candidates() searches active docs by default (optional include historical)
--
-- Safe rollout (recommended):
-- 1) Run this script in Supabase SQL Editor
-- 2) Deploy updated app code (reads from view and uses candidate_id)
-- 3) Re-run ingestion/migration jobs if needed
-- =========================================================

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- ---------------------------------------------------------
-- 1) candidates (system-of-record)
-- ---------------------------------------------------------
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  location text,
  headline text,
  experience_years numeric,
  seniority text,
  skills text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  metadata_version int not null default 1,
  status text not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active_document_id bigint
);

-- helpful indexes (read-heavy UI filters)
create index if not exists idx_candidates_email on public.candidates (lower(email)) where email is not null;
create index if not exists idx_candidates_location on public.candidates (location);
create index if not exists idx_candidates_experience_years on public.candidates (experience_years);
create index if not exists idx_candidates_skills_gin on public.candidates using gin (skills);
create index if not exists idx_candidates_metadata_gin on public.candidates using gin (metadata);

-- ---------------------------------------------------------
-- 2) candidate_documents (vector index + snapshot; multiple per candidate)
-- ---------------------------------------------------------
-- Existing MVP setups commonly use:
--   id bigserial primary key
--   content text
--   metadata jsonb
--   embedding vector(768)
--
-- This script adds columns to support versioning + active-doc pointers.
alter table public.candidate_documents
  add column if not exists candidate_id uuid,
  add column if not exists document_version int,
  add column if not exists source text,
  add column if not exists is_active boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_candidate_documents_candidate_id on public.candidate_documents (candidate_id);
create index if not exists idx_candidate_documents_is_active on public.candidate_documents (is_active) where is_active = true;

-- Enforce: only one active document per candidate (when candidate_id is present)
create unique index if not exists uq_candidate_documents_one_active
  on public.candidate_documents (candidate_id)
  where is_active = true and candidate_id is not null;

-- ---------------------------------------------------------
-- 3) Backfill candidate_id from metadata->>'id' where available
-- ---------------------------------------------------------
update public.candidate_documents
set candidate_id = nullif(metadata->>'id', '')::uuid
where candidate_id is null
  and (metadata ? 'id')
  and nullif(metadata->>'id', '') is not null;

-- ---------------------------------------------------------
-- 4) Backfill candidates table from candidate_documents
-- ---------------------------------------------------------
insert into public.candidates (id, full_name, email, location, headline, experience_years, seniority, skills, metadata, metadata_version, status, created_at, updated_at)
select
  d.candidate_id as id,
  coalesce(d.metadata->>'name', d.metadata->>'full_name') as full_name,
  nullif(d.metadata->>'email', '') as email,
  nullif(d.metadata->>'location', '') as location,
  coalesce(nullif(d.metadata->>'title',''), nullif(d.metadata->>'role','')) as headline,
  nullif(coalesce(d.metadata->>'experienceYears', d.metadata->>'experience'), '')::numeric as experience_years,
  nullif(d.metadata->>'seniority','') as seniority,
  coalesce(
    (select array_agg(x::text) from jsonb_array_elements_text(coalesce(d.metadata->'skills','[]'::jsonb)) x),
    '{}'::text[]
  ) as skills,
  coalesce(d.metadata, '{}'::jsonb) as metadata,
  1 as metadata_version,
  'active' as status,
  now() as created_at,
  now() as updated_at
from public.candidate_documents d
where d.candidate_id is not null
on conflict (id) do update set
  full_name = coalesce(excluded.full_name, public.candidates.full_name),
  email = coalesce(excluded.email, public.candidates.email),
  location = coalesce(excluded.location, public.candidates.location),
  headline = coalesce(excluded.headline, public.candidates.headline),
  experience_years = coalesce(excluded.experience_years, public.candidates.experience_years),
  seniority = coalesce(excluded.seniority, public.candidates.seniority),
  skills = case when array_length(excluded.skills, 1) is not null then excluded.skills else public.candidates.skills end,
  metadata = coalesce(public.candidates.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
  updated_at = now();

-- ---------------------------------------------------------
-- 5) Choose an active document per candidate (latest doc id wins)
-- ---------------------------------------------------------
with latest as (
  select candidate_id, max(id) as document_id
  from public.candidate_documents
  where candidate_id is not null
  group by candidate_id
)
update public.candidates c
set active_document_id = l.document_id,
    updated_at = now()
from latest l
where c.id = l.candidate_id
  and (c.active_document_id is null or c.active_document_id <> l.document_id);

update public.candidate_documents d
set is_active = (d.id = c.active_document_id),
    updated_at = now()
from public.candidates c
where d.candidate_id = c.id
  and d.candidate_id is not null;

-- ---------------------------------------------------------
-- 6) Foreign key (optional; safe if candidate_documents exists)
-- ---------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_candidate_documents_candidate'
  ) then
    alter table public.candidate_documents
      add constraint fk_candidate_documents_candidate
      foreign key (candidate_id) references public.candidates(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_candidates_active_document'
  ) then
    alter table public.candidates
      add constraint fk_candidates_active_document
      foreign key (active_document_id) references public.candidate_documents(id)
      on delete set null;
  end if;
exception when others then
  -- Don't fail the whole migration if constraints can't be added (RLS, missing tables, etc).
  raise notice 'Skipping FK creation: %', sqlerrm;
end $$;

-- ---------------------------------------------------------
-- 7) Canonical read model view: candidates -> active document
-- ---------------------------------------------------------
create or replace view public.candidate_documents_view as
select
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
from public.candidates c
left join public.candidate_documents d
  on d.id = c.active_document_id
where c.deleted_at is null;

-- ---------------------------------------------------------
-- 8) match_candidates(): search active docs by default
-- ---------------------------------------------------------
-- Backward compatible:
-- - keeps existing parameter names query_embedding/match_threshold/match_count
-- - adds include_historical with default false
-- - keeps columns id/content/metadata/similarity, adds candidate_id + candidate fields
create or replace function public.match_candidates (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  include_historical boolean default false
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  candidate_id uuid,
  name text,
  email text,
  title text,
  location text,
  experience_years numeric,
  seniority text,
  skills text[]
)
language sql
stable
as $$
  select
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
  from public.candidate_documents d
  join public.candidates c on c.id = d.candidate_id
  where c.deleted_at is null
    and (include_historical or d.is_active)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

