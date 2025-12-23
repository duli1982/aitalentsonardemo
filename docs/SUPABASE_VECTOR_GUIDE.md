# Supabase + Vector Store: The "Brain" of Vision 2030

You asked how to set this up, specifically with a **Free Supabase Account**.

**The Good News:** You absolutely can. Supabase uses standard PostgreSQL. The "Vector Store" isn't a premium add-on; it's just an open-source extension (`pgvector`) that you can enable on the free tier.

This guide explains **What** it is, **Why** it powers the Vision 2030, and **How** to build it for $0.

---

## 1. The Concept: "Hybrid" Database

In a standard app, you store exact matches:
*   *Table:* `candidates`
*   *Column:* `skill` = "React"

In Vision 2030 (AI Native), you store **Meanings**:
*   *Table:* `candidates`
*   *Column:* `embedding` = `[0.015, -0.231, 0.444, ...]`

This vector (array of numbers) represents the *concept* of the candidate's experience.
This allows you to search for **"Someone who has led large frontend teams"**, and the database will return a candidate who lists "Principal Engineer at Google" and "React Architecture"—even if the words "led" or "large" or "teams" aren't explicitly there.

---

## 2. Is the Free Tier Enough?

**Yes.**
*   **Supabase Free Tier**: ~500MB database size.
*   **Vector Size**: One resume embedding is tiny (approx 1-2KB).
*   **Capacity**: You can store **thousands** of candidate profiles + their vector embeddings before hitting free limits.
*   **Performance**: `pgvector` is fast enough for <100k rows without complex indexing, which is perfect for your "Talent Sonar" MVP.

---

## 3. The Setup (Step-by-Step)

You don't need a new account. Go to your existing project's **SQL Editor** and run these steps.

### Step 0: Start a Project (If you haven't already)
1.  Go to [database.new](https://database.new) and sign in with GitHub.
2.  Click **"New Project"**.
3.  Name it: `talent-sonar-vision`.
4.  Database Password: **Generate and SAVE this** (SafeToAutoRun doesn't save it!).
5.  Region: Choose the one closest to you (e.g., London, Frankfurt, US East).
6.  Click **"Create new project"** and wait ~2 minutes for it to spin up.

### Step 1: Enable the Extension
This turns your standard Postgres DB into a Vector DB.
```sql
create extension if not exists vector;
```

### Step 2: Create the System-of-Record Schema (Recommended)
Talent Sonar uses a **trust-first** architecture:
- `candidates` is the canonical system-of-record (stable UI contract: name, location, skills, etc.)
- `candidate_documents` stores **versioned** vector + text snapshots (multiple CVs per candidate)
- `candidate_documents_view` joins candidates → active document (canonical read model)
- `match_candidates()` searches **active documents by default**, with an optional `include_historical`

Draft boundary (resume uploads):
- Draft uploads create `candidates.status = pending_review` and a **non-active** document snapshot (`candidate_documents.is_active = false`).
- Drafts are not eligible for `match_candidates()` until a recruiter activates them (sets `is_active=true` and `active_document_id`).

In Supabase SQL Editor, run the repo script:

```sql
-- paste the contents of:
-- sql/CANDIDATES_SYSTEM_OF_RECORD_SETUP.sql
```

This script creates/updates all required objects, including `match_candidates()`.

### Step 4: Verify it Works (Manual Test)
Run this to confirm your vector database is active.

1. **Insert a dummy candidate + active document:**
   *(Note: We use `array_fill` to generate a fake 768-dimension vector solely for testing.)*
   ```sql
   with inserted_candidate as (
     insert into public.candidates (full_name, email, location, skills, metadata)
     values ('Alice Example', 'alice@example.com', 'Remote', array['React'], '{"source":"manual_test"}'::jsonb)
     returning id
   ), inserted_doc as (
     insert into public.candidate_documents (candidate_id, content, metadata, embedding, is_active, source)
     select
       id,
       'Alice Example - React Expert',
       '{"title":"Frontend","skills":["React"],"id":"' || id || '"}'::jsonb,
       array_fill(0.1, array[768])::vector(768),
       true,
       'manual_test'
     from inserted_candidate
     returning id, candidate_id
   )
   update public.candidates c
   set active_document_id = d.id
   from inserted_doc d
   where c.id = d.candidate_id;
   ```

2. **Verify the canonical read model:**
   ```sql
   select candidate_id, name, email, title, skills
   from public.candidate_documents_view
   order by candidate_updated_at desc
   limit 5;
   ```

3. **Run a semantic search (active docs only by default):**
   ```sql
   select * from match_candidates(
     array_fill(0.1, array[768])::vector(768), -- Query: exact match
     0.8,                                       -- Threshold
     5                                          -- Limit
   );
   ```

4. **Optional: include historical documents (forensics):**
   ```sql
   select * from match_candidates(
     array_fill(0.1, array[768])::vector(768),
     0.8,
     5,
     true -- include_historical
   );
   ```
   *Result:* You should see Alice!

```

---

## 4. The Workflow (How it runs in code)

Now that the DB is ready, here is how the app talks to it.

**When Uploading a Candidate:**
1.  **App**: Takes the Resume PDF.
2.  **App**: Extracts text ("Alice is a React expert...").
3.  **AI (Gemini)**: "Convert this text to numbers." -> Returns `[0.1, 0.5, ...]`.
4.  **Supabase**:
    - Upsert canonical row in `candidates`
    - Insert a new snapshot into `candidate_documents` and set it active (audit trail preserved)

**When Searching (The "Sourcing Agent"):**
1.  **User**: "Find me strong frontend leads."
2.  **AI (Gemini)**: Converts that *question* into numbers `[0.2, 0.4, ...]`.
3.  **Supabase**: `rpc('match_candidates', { query_embedding, match_threshold, match_count })`.
4.  **Result**: Returns the best matching candidates (active document by default), with stable candidate fields.

---

## summary

You effectively get **Google-quality semantic search** for free, using the tools you already have. This is the foundation of the "Knowledge Graph" mentioned in the Vision 2030 document.

---

## Optional: Fairness (Aggregate, Pipeline Cohorts)

If you want enterprise-safe fairness reporting (aggregate-only by job + stage + time window):
- Run `sql/PIPELINE_SYSTEM_OF_TRUTH_SETUP.sql` (pipeline events)
- Run `sql/FAIRNESS_DEMOGRAPHICS_SETUP.sql` (private `candidate_demographics` + RPC report)
- Populate demographics only from **HRIS/ATS/self-report** (no inference)
