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

You don't need a new account. Go to your existing project's **SQL Editor** and run these 3 commands.

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

### Step 2: Create the "Knowledge Graph" Table
We create a table that holds the normal text *AND* the vector implementation.
```sql
create table candidate_documents (
  id bigserial primary key,
  content text,                    -- The raw text (e.g., resume summary)
  metadata jsonb,                  -- Extra info (candidate_id, skills, tags)
  embedding vector(768)            -- The vector! (768 dimensions is standard for Google/Gemini models)
);
```

### Step 3: Create the "Match" Function
This is the magic function your UI will call to find candidates using AI.
```sql
create or replace function match_candidates (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    candidate_documents.id,
    candidate_documents.content,
    candidate_documents.metadata,
    1 - (candidate_documents.embedding <=> query_embedding) as similarity
  from candidate_documents
  where 1 - (candidate_documents.embedding <=> query_embedding) > match_threshold
  order by candidate_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

### Step 4: Verify it Works (Manual Test)
Run this to confirm your vector database is active.

1. **Insert a dummy candidate:**
   *(Note: We use `array_fill` to generate a fake 768-dimension vector solely for testing.)*
   ```sql
   INSERT INTO candidate_documents (content, metadata, embedding)
   VALUES (
     'Alice - React Expert',
     '{"role": "frontend"}',
     array_fill(0.1, array[768])::vector(768)
   );
   ```

2. **Run a search:**
   ```sql
   select * from match_candidates(
     array_fill(0.1, array[768])::vector(768), -- Query: exact match
     0.8,                                       -- Threshold
     5                                          -- Limit
   );
   ```
   *Result:* You should see Alice!

```

---

## 4. The Workflow (How it runs in code)

Now that the DB is ready, here is how the App (Next.js) talks to it.

**When Uploading a Candidate:**
1.  **App**: Takes the Resume PDF.
2.  **App**: Extracts text ("Alice is a React expert...").
3.  **AI (Gemini)**: "Convert this text to numbers." -> Returns `[0.1, 0.5, ...]`.
4.  **Supabase**: `INSERT INTO candidate_documents (content, embedding) VALUES ('Alice...', '[0.1, 0.5, ...]')`.

**When Searching (The "Sourcing Agent"):**
1.  **User**: "Find me strong frontend leads."
2.  **AI (Gemini)**: Converts that *question* into numbers `[0.2, 0.4, ...]`.
3.  **Supabase**: `rpc('match_candidates', '[0.2, 0.4, ...]')`.
4.  **Result**: Returns Alice (because her vector is mathematically close to the question's vector).

---

## summary

You effectively get **Google-quality semantic search** for free, using the tools you already have. This is the foundation of the "Knowledge Graph" mentioned in the Vision 2030 document.
