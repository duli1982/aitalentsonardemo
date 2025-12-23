-- ============================================
-- Talent Sonar: Enterprise-Safe Fairness (Aggregate Only)
-- ============================================
-- Principles:
-- - Demographics come ONLY from HRIS/ATS/self-report (no inference).
-- - Recruiters do NOT see per-candidate demographics.
-- - Recruiters can access only aggregate fairness reports by job + stage + time window.
-- - Privacy gates: minimum sample size + minimum coverage % (k-anonymity-ish).
--
-- Run this in Supabase SQL Editor.
-- ============================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1) Private demographics table (no policies by default)
-- ---------------------------------------------------------
create table if not exists public.candidate_demographics (
  candidate_id uuid primary key references public.candidates(id) on delete cascade,
  gender text check (gender in ('Male','Female','Non-binary','Prefer not to say') or gender is null),
  education_type text check (education_type in ('Elite','Traditional','Bootcamp','Self-taught','Prefer not to say') or education_type is null),
  university text,
  source text check (source in ('HRIS','ATS','self_report') or source is null),
  collected_at timestamptz,
  consent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidate_demographics enable row level security;

-- Intentionally no SELECT policies for anon/authenticated.
-- Access is via SECURITY DEFINER aggregation functions below.

create index if not exists idx_candidate_demographics_gender on public.candidate_demographics (gender);
create index if not exists idx_candidate_demographics_education_type on public.candidate_demographics (education_type);

-- ---------------------------------------------------------
-- 2) Aggregate-only fairness report (job + stage + window)
-- ---------------------------------------------------------
-- Requires: public.pipeline_events (from PIPELINE_SYSTEM_OF_TRUTH_SETUP.sql)
-- Cohort definition:
-- - latest stage per candidate for the job
-- - latest stage transition within the time window
-- - stage = requested stage
--
-- Privacy gates:
-- - If sample < min_sample: return INSUFFICIENT_SAMPLE (no distributions)
-- - If coverage < min_coverage_pct: return INSUFFICIENT_COVERAGE (no distributions)
--
create or replace function public.get_fairness_report_by_stage(
  job_id text,
  stage text,
  window_days int default 30,
  min_sample int default 10,
  min_coverage_pct numeric default 0.30
)
returns table (
  status text,
  sample_size int,
  gender_known_count int,
  education_known_count int,
  gender_coverage_pct numeric,
  education_coverage_pct numeric,
  gender_distribution jsonb,
  education_distribution jsonb,
  alerts jsonb,
  diversity_score int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sample int := 0;
  v_gender_known int := 0;
  v_edu_known int := 0;
  v_gender_cov numeric := 0;
  v_edu_cov numeric := 0;
  v_status text := 'OK';
  v_gender jsonb := '{}'::jsonb;
  v_edu jsonb := '{}'::jsonb;
  v_alerts jsonb := '[]'::jsonb;
  v_score int := null;
begin
  -- Compute cohort: latest stage per candidate for the job within window.
  with latest as (
    select distinct on (pe.candidate_id)
      pe.candidate_id,
      pe.to_stage,
      pe.created_at
    from public.pipeline_events pe
    where pe.job_id = get_fairness_report_by_stage.job_id
      and pe.to_stage is not null
      and pe.created_at >= now() - make_interval(days => greatest(window_days, 0))
    order by pe.candidate_id, pe.created_at desc
  ),
  cohort as (
    select l.candidate_id
    from latest l
    where lower(l.to_stage) = lower(get_fairness_report_by_stage.stage)
  ),
  cohort_candidates as (
    select c.id
    from cohort x
    join public.candidates c on c.id::text = x.candidate_id
    where c.deleted_at is null
  ),
  demo as (
    select
      cc.id as candidate_id,
      cd.gender,
      cd.education_type
    from cohort_candidates cc
    left join public.candidate_demographics cd on cd.candidate_id = cc.id
  )
  select
    count(*)::int,
    count(*) filter (where gender is not null)::int,
    count(*) filter (where education_type is not null)::int
  into v_sample, v_gender_known, v_edu_known
  from demo;

  if v_sample = 0 then
    status := 'INSUFFICIENT_SAMPLE';
    sample_size := 0;
    gender_known_count := 0;
    education_known_count := 0;
    gender_coverage_pct := 0;
    education_coverage_pct := 0;
    gender_distribution := '{}'::jsonb;
    education_distribution := '{}'::jsonb;
    alerts := '[]'::jsonb;
    diversity_score := null;
    return next;
    return;
  end if;

  v_gender_cov := round((v_gender_known::numeric / v_sample::numeric), 4);
  v_edu_cov := round((v_edu_known::numeric / v_sample::numeric), 4);

  -- Privacy gate: minimum sample size.
  if v_sample < greatest(min_sample, 0) then
    v_status := 'INSUFFICIENT_SAMPLE';
  end if;

  -- Privacy gate: minimum coverage.
  if v_status = 'OK' and (v_gender_cov < min_coverage_pct or v_edu_cov < min_coverage_pct) then
    v_status := 'INSUFFICIENT_COVERAGE';
  end if;

  if v_status = 'OK' then
    -- Distributions (percent of total sample). Unknowns excluded from buckets.
    with latest as (
      select distinct on (pe.candidate_id)
        pe.candidate_id,
        pe.to_stage,
        pe.created_at
      from public.pipeline_events pe
      where pe.job_id = get_fairness_report_by_stage.job_id
        and pe.to_stage is not null
        and pe.created_at >= now() - make_interval(days => greatest(window_days, 0))
      order by pe.candidate_id, pe.created_at desc
    ),
    cohort as (
      select l.candidate_id
      from latest l
      where lower(l.to_stage) = lower(get_fairness_report_by_stage.stage)
    ),
    cohort_candidates as (
      select c.id
      from cohort x
      join public.candidates c on c.id::text = x.candidate_id
      where c.deleted_at is null
    ),
    demo as (
      select
        cc.id as candidate_id,
        cd.gender,
        cd.education_type
      from cohort_candidates cc
      left join public.candidate_demographics cd on cd.candidate_id = cc.id
    ),
    gender_counts as (
      select gender as key, count(*)::int as cnt
      from demo
      where gender is not null
      group by gender
    ),
    edu_counts as (
      select education_type as key, count(*)::int as cnt
      from demo
      where education_type is not null
      group by education_type
    )
    select
      coalesce((select jsonb_object_agg(key, jsonb_build_object(
        'count', cnt,
        'pct', round((cnt::numeric / v_sample::numeric) * 100, 1)
      )) from gender_counts), '{}'::jsonb),
      coalesce((select jsonb_object_agg(key, jsonb_build_object(
        'count', cnt,
        'pct', round((cnt::numeric / v_sample::numeric) * 100, 1)
      )) from edu_counts), '{}'::jsonb)
    into v_gender, v_edu;

    -- Alerts (same basic guardrails as the MVP fairness engine, but aggregate-only).
    v_alerts := '[]'::jsonb;

    -- Gender imbalance: any single gender > 70%.
    v_alerts := v_alerts || coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'GENDER_IMBALANCE',
        'severity', case when (value->>'pct')::numeric > 85 then 'CRITICAL' else 'WARNING' end,
        'message', format('%s%% of cohort is %s.', (value->>'pct'), key),
        'suggestion', 'Consider widening sourcing channels and re-checking funnel progression.'
      ))
      from jsonb_each(v_gender) e(key, value)
      where (value->>'pct')::numeric > 70
    ), '[]'::jsonb);

    -- Education concentration: Elite > 60%.
    if (v_edu ? 'Elite') and ((v_edu->'Elite'->>'pct')::numeric > 60) then
      v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
        'type', 'EDUCATION_CONCENTRATION',
        'severity', 'WARNING',
        'message', format('%s%% of cohort is from Elite institutions.', (v_edu->'Elite'->>'pct')),
        'suggestion', 'Review qualified candidates from Traditional and Non-traditional pathways.'
      ));
    end if;

    -- Diversity score: simple penalty model (only when OK).
    v_score := 100;
    v_score := v_score - (select coalesce(sum(case when (a->>'severity') = 'CRITICAL' then 20 else 10 end), 0)
                          from jsonb_array_elements(v_alerts) a);
    if v_score < 0 then v_score := 0; end if;
  end if;

  status := v_status;
  sample_size := v_sample;
  gender_known_count := v_gender_known;
  education_known_count := v_edu_known;
  gender_coverage_pct := v_gender_cov;
  education_coverage_pct := v_edu_cov;
  gender_distribution := v_gender;
  education_distribution := v_edu;
  alerts := v_alerts;
  diversity_score := v_score;
  return next;
end;
$$;

grant execute on function public.get_fairness_report_by_stage(text, text, int, int, numeric) to authenticated;
grant execute on function public.get_fairness_report_by_stage(text, text, int, int, numeric) to anon;

