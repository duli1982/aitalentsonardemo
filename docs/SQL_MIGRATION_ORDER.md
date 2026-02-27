# SQL Migration Order

This project has SQL setup files with implicit dependencies. Use the order below to avoid FK/type failures.

## Fresh environment (recommended order)
1. `sql/DATABASE_SCHEMA.sql`
2. `sql/CANDIDATES_SYSTEM_OF_RECORD_SETUP.sql`
3. `sql/APPLY_APP_ID_COMPATIBILITY.sql`
4. `sql/KNOWLEDGE_GRAPH_SETUP.sql`
5. `sql/GRAPH_MIGRATION_SETUP.sql`
6. `sql/BULK_INGESTION_SETUP.sql`
7. `sql/PIPELINE_SYSTEM_OF_TRUTH_SETUP.sql`
8. `sql/PIPELINE_IDEMPOTENCY_SETUP.sql`
9. `sql/PIPELINE_SCHEDULING_INTERVIEWS_SETUP.sql`
10. `sql/RECRUITING_SCORECARD_SETUP.sql`
11. `sql/INTAKE_CALL_SETUP.sql`
12. `sql/FAIRNESS_DEMOGRAPHICS_SETUP.sql`

## Why this order
- `APPLY_APP_ID_COMPATIBILITY.sql` must run before scripts that rely on `TEXT` IDs for `jobs.id`/`candidates.id` (for example intake and pipeline scripts).
- `CANDIDATES_SYSTEM_OF_RECORD_SETUP.sql` defines `candidate_documents_view` and `match_candidates(...)`, which are expected by runtime services.
- `KNOWLEDGE_GRAPH_SETUP.sql` creates graph entity/relationship tables used by graph query/migration services.
- `GRAPH_MIGRATION_SETUP.sql` and `BULK_INGESTION_SETUP.sql` are progress-tracking tables and can run after core graph/candidate schema.
- `INTAKE_CALL_SETUP.sql` already contains a guard/notice for `jobs.id` type and assumes compatibility migration is already applied.

## Existing environment rollout
1. Run `sql/APPLY_APP_ID_COMPATIBILITY.sql` first.
2. Run all remaining setup files in the order above.
3. Re-run the same scripts safely when needed (`IF NOT EXISTS`/idempotent blocks are already used in these files).

## Quick verification queries
```sql
-- Verify text-compatible IDs
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('jobs', 'candidates')
  and column_name = 'id';

-- Verify key runtime objects exist
select to_regclass('public.candidate_documents_view') as candidate_documents_view;
select proname
from pg_proc
where proname = 'match_candidates';
```
