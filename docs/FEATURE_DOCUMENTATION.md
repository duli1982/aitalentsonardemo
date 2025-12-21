# Talent Sonar - Feature Documentation

Complete guide for the AI-powered features and autonomous agent system.

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Vector Database & Knowledge Graph](#vector-database--knowledge-graph)
3. [Data Ingestion System](#data-ingestion-system)
4. [Bulk Ingestion (100K+ Profiles)](#bulk-ingestion-100k-profiles)
5. [Knowledge Graph Migration (Existing Candidates)](#knowledge-graph-migration-existing-candidates)
6. [AI Smart Search](#ai-smart-search)
7. [RAG Query (Retrieval-Augmented Generation)](#rag-query-retrieval-augmented-generation)
8. [Knowledge Graph Queries (NEW)](#knowledge-graph-queries-new)
9. [Autonomous Agents](#autonomous-agents)
10. [Setup & Configuration](#setup--configuration)
11. [Usage Guide](#usage-guide)
12. [Architecture](#architecture)
13. [Troubleshooting](#troubleshooting)

---

## Overview

This application now includes advanced AI features powered by:
- **Supabase Vector Database** - Semantic search with pgvector
- **Google Gemini AI** - Text embeddings, RAG, and analysis
- **RAG Pipeline** - Retrieval-Augmented Generation for context-aware AI responses
- **Autonomous Agents** - Background workers that operate 24/7
- **Real-time Notifications** - Pulse Feed integration

### What's New

| Feature | Description | Status |
|---------|-------------|--------|
| **Vector Search** | AI-powered semantic candidate search | ✅ Live |
| **Knowledge Graph** | Relationship-based recruiting (companies, schools, skills) | ✅ Live |
| **Graph Migration** | Add Knowledge Graph relationships to existing candidates | ✅ Live |
| **Smart Search** | Natural language query interface | ✅ Live |
| **RAG Query** | AI-generated content with candidate context | ✅ Live |
| **Data Migration** | Move mock data to vector DB | ✅ Live |
| **Batch Ingestion** | Generate & ingest 5 synthetic profiles | ✅ Live |
| **Bulk Ingestion** | Generate 10K-1M+ profiles with progress tracking | ✅ Live |
| **Sourcing Agent** | Auto-find candidates matching jobs | ✅ Live |
| **Screening Agent** | Conduct automated phone screens | ✅ Live |
| **Scheduling Agent** | Auto-book interview times | ✅ Live |

---

## Vector Database & Knowledge Graph

### What is it?

A **Vector Database** stores candidate profiles as mathematical vectors (arrays of numbers) that represent the semantic meaning of their experience, skills, and background. The **Knowledge Graph** adds relationship data (companies, schools, skills) enabling network-based recruiting.

Together, they enable:

- **Semantic Search**: "Find senior React developers" → Matches "Principal Frontend Engineer" and "Lead UI Developer"
- **Similarity Matching**: Find candidates similar to your best performers
- **AI-Powered Ranking**: Results ranked by relevance, not just keyword matches
- **Relationship Queries**: "Find Google alumni who studied at Stanford with ML skills"
- **Network Traversal**: Discover 2nd-degree connections and referral paths
- **Career Path Analysis**: Identify common company transitions and skill clusters

### Architecture

```
Supabase PostgreSQL + pgvector Extension
├── Candidate Data Layer
│   ├── Table: candidate_documents
│   │   ├── id: bigserial (unique ID)
│   │   ├── content: text (full candidate description)
│   │   ├── metadata: jsonb (structured data: name, skills, etc.)
│   │   └── embedding: vector(768) (AI-generated semantic vector)
│   │
│   └── Function: match_candidates()
│       └── Searches vectors using cosine similarity
│
└── Knowledge Graph Layer (NEW)
    ├── Entity Tables
    │   ├── companies (25 seeded: Google, Meta, Amazon, etc.)
    │   ├── schools (25 seeded: Stanford, MIT, Harvard, etc.)
    │   ├── skills (50+ seeded: JavaScript, Python, React, etc.)
    │   └── projects (for portfolio/open-source work)
    │
    └── Relationship Tables
        ├── candidate_companies (worked_at relationships)
        ├── candidate_schools (studied_at relationships)
        ├── candidate_skills (has_skill relationships)
        ├── candidate_projects (contributed_to relationships)
        ├── candidate_collaborations (worked_with relationships)
        └── candidate_reporting (reports_to relationships)
```

### Knowledge Graph Schema

#### Entity: Companies
```typescript
{
  id: 1,
  name: "Google",
  industry: "Technology",
  size: "enterprise",
  location: "Mountain View, CA",
  website: "https://google.com",
  founded_year: 1998,
  employee_count: 150000
}
```

#### Entity: Schools
```typescript
{
  id: 1,
  name: "Stanford University",
  type: "university",
  location: "Stanford, CA",
  ranking: 3,
  website: "https://stanford.edu"
}
```

#### Entity: Skills
```typescript
{
  id: 1,
  name: "React",
  category: "framework",
  demand_score: 0.95,
  description: "JavaScript library for building user interfaces"
}
```

#### Relationship: Candidate → Company
```typescript
{
  candidate_id: "c123",
  company_id: 1,
  title: "Senior Frontend Engineer",
  start_date: "2020-01-01",
  end_date: "2023-01-01",
  is_current: false
}
```

#### Relationship: Candidate → School
```typescript
{
  candidate_id: "c123",
  school_id: 1,
  degree: "Bachelor of Science",
  field_of_study: "Computer Science",
  graduation_year: 2018
}
```

#### Relationship: Candidate → Skill
```typescript
{
  candidate_id: "c123",
  skill_id: 1,
  proficiency_level: "expert",
  years_of_experience: 5.5
}
```

### Graph Query Examples

#### 1. Find Google Alumni with ML Skills
```typescript
// Using GraphQueryService
const candidates = await graphQueryService.findCandidatesByMultipleCriteria({
  companies: ['Google'],
  skills: ['Machine Learning', 'Python']
});
```

#### 2. Find Stanford Computer Science Graduates
```typescript
const alumni = await graphQueryService.findCandidatesBySchool('Stanford University');
```

#### 3. Discover Career Paths (Google → Meta)
```typescript
const paths = await graphQueryService.findCareerPaths('Google', 'Meta');
// Returns: Common transition patterns and candidate counts
```

#### 4. Find Skill Clusters (What skills go with React?)
```typescript
const clusters = await graphQueryService.findSkillClusters('React');
// Returns: ["JavaScript", "TypeScript", "Next.js", "Node.js", ...]
```

#### 5. Find 2nd Degree Connections
```typescript
const network = await graphQueryService.find2ndDegreeConnections('candidate-123');
// Returns: People in your network's network
```

### Hybrid Search (Vector + Graph)

The most powerful queries combine semantic search with graph relationships:

```typescript
// "Senior React developers from FAANG companies who studied CS at top schools"
const results = await semanticSearchService.hybridSearch({
  query: "Senior React developer with leadership experience",
  companies: ['Google', 'Meta', 'Amazon', 'Apple', 'Netflix'],
  schools: ['Stanford University', 'MIT', 'Carnegie Mellon University'],
  skills: ['React', 'TypeScript', 'Leadership'],
  options: { threshold: 0.7, limit: 10 }
});
```

**How it works:**
1. Graph layer filters candidates by companies, schools, and skills
2. Vector search ranks filtered candidates by semantic similarity
3. Results combine relationship data with AI-powered relevance scoring

### Data Model

#### Vector Database Candidate
```typescript
{
  id: 1,
  content: "Alice Wonderland - Software Engineer II. Expert in React, JavaScript...",
  metadata: {
    id: "i1",
    type: "internal",
    name: "Alice Wonderland",
    email: "alice.w@example.com",
    skills: ["React", "JavaScript", "Java"],
    experienceYears: 3,
    currentRole: "Software Engineer II",
    department: "Technology"
  },
  embedding: [0.015, -0.231, 0.444, ...] // 768 numbers
}
```

#### Enhanced with Graph Relationships
```typescript
{
  // ... vector data above, PLUS:
  companies: [
    { name: "Google", title: "Senior Frontend Engineer", years: 3, current: true }
  ],
  schools: [
    { name: "Stanford University", degree: "BS Computer Science", year: 2018 }
  ],
  skills: [
    { name: "React", proficiency: "expert", years: 5.5 },
    { name: "TypeScript", proficiency: "advanced", years: 4.0 }
  ]
}
```

### Use Cases Unlocked by Knowledge Graph

#### 🎯 Network-Based Recruiting
- Find candidates through mutual connections
- Discover warm introductions and referral paths
- Identify company alumni networks for targeted sourcing

#### 📊 Career Path Insights
- Analyze common company transitions (e.g., startup → FAANG)
- Identify skill progression patterns
- Understand typical career trajectories

#### 🔍 Advanced Search Precision
- "Stanford CS grads who worked at Google AND have 5+ years React"
- "People in my network with ML expertise at Series A startups"
- "Candidates who transitioned from consulting to product management"

#### 🧠 Skill Intelligence
- Discover which skills frequently appear together
- Identify emerging skill combinations
- Understand skill demand patterns across companies

#### 🌐 Network Analysis
- Map organizational relationships (who worked together)
- Find clusters of talent (e.g., ex-Googlers in NYC)
- Identify skill communities and expertise hubs

---

## Data Ingestion System

### Location: `/ingest` Page

Navigate to **http://localhost:3000/ingest** or click the navigation menu.

### Purpose

The ingestion system populates your vector database with candidate profiles. It has two main functions:

#### 1. **Mock Data Migration**

Migrates your existing 80+ candidates from `data/candidates.ts` into the vector database.

**Why?**
- Your app currently uses mock data stored in TypeScript files
- To enable AI search, candidates need to be in the vector database with embeddings
- This is a one-time migration that preserves all your existing data

**How it works:**

```
Step 1: Read all candidates from data/candidates.ts
Step 2: For each candidate:
  ├── Generate comprehensive text description
  ├── Send to Google Gemini API for embedding
  ├── Receive 768-dimensional vector
  └── Insert into Supabase candidate_documents table
Step 3: Track progress and report results
```

**Usage:**

1. Go to `/ingest` page
2. Look for **"Mock Data Migration Status"** section
3. Click **"Migrate Mock Candidates to Vector DB"** button
4. Wait 2-3 minutes while ~80 candidates are processed
5. See real-time progress: "Processing: Alice Wonderland (23/80)"
6. When complete, status shows "Complete" with 100% progress bar

**What gets migrated:**

- ✅ All internal employees (current role, department, performance)
- ✅ All past candidates (previous applications, notes)
- ✅ All uploaded CVs (summaries, file references)
- ✅ Skills, experience, aspirations, development goals
- ✅ Email addresses, LinkedIn profiles

**After migration:**
- Original mock data still works in the app UI
- Vector database now has searchable copies
- Smart Search can find these candidates
- Autonomous agents can access them

---

#### 2. **Batch Candidate Ingestion**

Generates random synthetic candidate profiles for testing and demos.

**Why?**
- Scale testing: See how search performs with 100s of candidates
- Demo purposes: Show realistic data to stakeholders
- Data diversity: Mix of technical and non-technical roles

**How it works:**

```
Step 1: Generate 5 random candidates
  ├── Random names (James Smith, Maria Chen, etc.)
  ├── Random roles (Frontend Dev, Backend Eng, Product Manager, etc.)
  ├── Random skills based on role
  └── AI-generated summary

Step 2: For each candidate:
  ├── Create embedding via Gemini API
  └── Insert into vector database

Step 3: Report success/failure for each
```

**Usage:**

1. Go to `/ingest` page
2. Click **"Start Batch Ingestion (Demo: 5 Profiles)"** button
3. Watch the log window for real-time updates:
   ```
   10:23:45 - Generated 5 UNIQUE candidate profiles.
   10:23:46 - Embedding: James Smith...
   10:23:47 - Embedding: Maria Chen...
   ...
   10:23:52 - Successfully ingested 5/5 profiles.
   ```

**Generated Roles:**
- **Technical**: Frontend Dev, Backend Eng, Data Scientist, DevOps, UX Designer
- **Business**: Product Manager, HR Business Partner, Senior Recruiter, Office Manager, Executive Assistant

**Sample Output:**
```javascript
{
  name: "James Smith",
  role: "Frontend Dev",
  summary: "Frontend Dev with 5+ years experience. Expert in React and TypeScript.
           Building responsive UIs. Known for debugging."
}
```

---

### Migration vs. Batch Ingestion

| Feature | Mock Data Migration | Batch Ingestion |
|---------|-------------------|-----------------|
| **Purpose** | One-time migration of your real data | Generate test/demo data |
| **Source** | `data/candidates.ts` (80+ profiles) | Randomly generated |
| **Frequency** | Once (until you add more mock data) | Unlimited (run as many times as needed) |
| **Data Quality** | Real, detailed candidate info | Synthetic, simplified profiles |
| **Count** | ~80 candidates | 5 per run |
| **Use Case** | Enable AI search on your data | Testing, demos, scale testing |

---

### Checking Migration Status

The `/ingest` page shows:

```
Mock Data Migration Status
┌─────────────────────────────────┐
│ 0 of 80 migrated        [0%]   │ ← Before migration
│ [                        ]      │
│ [Migrate Mock Candidates] btn   │
└─────────────────────────────────┘

After Migration:
┌─────────────────────────────────┐
│ 80 of 80 migrated      [100%]  │ ← Complete
│ [████████████████████████]      │
│ ✓ Complete                      │
└─────────────────────────────────┘
```

---

### Understanding the Logs

The log window shows detailed progress:

```bash
# Migration Logs
10:30:12 - Starting migration of mock candidates to vector database...
10:30:13 - Processing: Alice Wonderland (1/80)
10:30:14 - Processing: Bob The Builder (2/80)
...
10:32:45 - ✓ Migration complete! Successfully migrated 80/80 candidates
10:32:45 - ⚠ 0 candidates failed to migrate.

# Batch Ingestion Logs
10:35:00 - Generated 5 UNIQUE candidate profiles.
10:35:01 - Embedding: James Smith...
10:35:02 - Embedding: Maria Chen...
10:35:09 - Successfully ingested 5/5 profiles.
```

**Log Symbols:**
- `✓` Success
- `⚠` Warning
- `✗` Error

---

### Common Scenarios

#### Scenario 1: Fresh Setup
```
1. Set up Supabase (add credentials to .env)
2. Run SQL setup from SUPABASE_VECTOR_GUIDE.md
3. Go to /ingest
4. Click "Migrate Mock Candidates" (one-time)
5. Run batch ingestion a few times to add more data
6. Now you have ~100-150 candidates for testing
```

#### Scenario 2: Already Migrated, Want More Data
```
1. Go to /ingest
2. Run batch ingestion multiple times
3. Each run adds 5 more candidates
4. Stop when you have enough for testing
```

#### Scenario 3: Reset Everything
```
1. Go to Supabase dashboard
2. Run: DELETE FROM candidate_documents;
3. Go to /ingest
4. Run migration again
5. Add fresh batch data
```

---

## Bulk Ingestion (100K+ Profiles)

### Location: `/ingest` Page → **"Bulk Candidate Generation"** Panel (top section)

### What is it?

The **Bulk Ingestion System** allows you to generate and ingest **10,000 to 1,000,000+ candidate profiles** in a single run with:
- **Progress tracking** and real-time ETA
- **Pause/Resume** capability (saves checkpoints)
- **50+ job role templates** across all industries
- **Realistic diversity** in names, companies, locations, skills
- **Production-ready** error handling and retry logic

This is the system that will help you achieve **Phase 1 of Vision 2030: Ingest 1M+ profiles**.

### Why use it?

| Use Case | Target Count | Time | Purpose |
|----------|--------------|------|---------|
| **Quick Test** | 1,000 | ~5 min | Verify setup works |
| **Development** | 10,000 | ~30 min | Local dev & testing |
| **Production Demo** | 100,000 | ~5 hours | Stakeholder demos |
| **Phase 1 Complete** | 1,000,000 | ~2 days | Enterprise-scale dataset |

### Setup (One-time)

1. **Run SQL Setup** in Supabase SQL Editor:
   ```sql
   -- See sql/BULK_INGESTION_SETUP.sql
   -- Creates bulk_ingestion_progress table for job tracking
   ```

2. Navigate to `/ingest` page
3. You'll see **"Bulk Candidate Generation"** panel at the top

### Configuration

The bulk ingestion panel has 4 configurable settings:

**1. Target Count** (Total profiles to generate)
- Recommended: Start with **10,000** for testing
- Production: **100,000** for realistic dataset
- Phase 1: **1,000,000** to complete Vision 2030

**2. Batch Size** (Profiles per batch)
- Recommended: **500** (balanced performance)
- Fast mode: **1,000** (higher memory usage)
- Safe mode: **250** (slower but more reliable)

**3. Parallelism** (Concurrent API calls)
- Recommended: **10** (safe API usage)
- Fast mode: **20** (faster but more quota usage)
- Safe mode: **5** (slower but very stable)

**4. Checkpoint Interval** (Save progress every N profiles)
- Recommended: **1,000** (frequent saves)
- Fast mode: **5,000** (fewer saves, slightly faster)
- Maximum safety: **500** (save very frequently)

### Usage

**1. Configure Settings**
```typescript
Target Count: 10000
Batch Size: 500
Parallelism: 10
Checkpoint Interval: 1000
```

**2. Click "Start Bulk Generation"**

The system will:
- Generate profiles using 50+ job templates
- Create embeddings via Gemini API (in parallel)
- Insert into Supabase vector database
- Save progress every 1,000 profiles
- Show real-time progress and ETA

**3. Monitor Progress**

Real-time dashboard shows:
- **Progress Bar**: Visual % complete (e.g., 75%)
- **Profiles**: 7,523 / 10,000 completed
- **Batch**: Current batch (e.g., 15/20)
- **ETA**: Time remaining (e.g., "8m")
- **Failed**: Number of failures (should be < 1%)
- **Errors**: First 5 errors displayed inline

**4. Pause/Resume Anytime**

- **Pause**: Click "Pause" → Progress saved → Can resume later
- **Stop**: Click "Stop" → Job ends but progress saved
- **Resume**: Click "▶ Job History" → Click "Resume" on paused job

### 50+ Job Role Templates

Profiles are generated from **realistic job templates** across categories:

**Engineering (15 roles)**
- Frontend Engineer, Backend Engineer, Full Stack
- DevOps, Mobile, Data Engineer, ML Engineer
- Security Engineer, QA, SRE, Cloud Architect
- Embedded Systems, Platform, Solutions Architect, AI Researcher

**Data & Analytics (8 roles)**
- Data Scientist, Data Analyst, BI Analyst
- Analytics Engineer, Quant Analyst, MLOps
- Data Viz Engineer, Research Analyst

**Product & Design (10 roles)**
- Product Manager, Technical PM, Growth PM
- Product Designer, UX Researcher, UI/UX Designer
- Graphic Designer, Motion Designer

**Marketing & Sales (11 roles)**
- Digital Marketing, Content Marketing, Growth Marketing
- Marketing Analyst, Social Media, SEO Specialist
- Account Executive, SDR, Customer Success, Sales Engineer

**Business Functions (10 roles)**
- Technical Recruiter, HR Business Partner, Talent Acquisition
- Financial Analyst, Accountant, FP&A, Controller
- Operations Manager, Supply Chain, Program Manager

**Executive (3 roles)**
- CTO, VP Engineering, VP Product

### What Gets Generated

Each profile includes:

```typescript
{
  name: "Maria Chen",                    // Random from 100+ first × 100+ last names
  title: "Senior Data Scientist",        // From 50+ role templates
  email: "maria.chen@example.com",
  yearsOfExperience: 7,                  // Role-appropriate (0-25 years)
  skills: [                              // Role-appropriate skill sets
    "Python", "PyTorch", "SQL",
    "Pandas", "Machine Learning"
  ],
  education: "Master's in Data Science - Stanford University",
  location: "San Francisco, CA",         // Diverse locations
  company: "Meta",                       // From 50+ companies
  industry: "Tech",                      // Industry-specific
  summary: "Senior Data Scientist with 7+ years of experience..." // AI-style
}
```

**Data Diversity:**
- **Names**: 100+ first names × 100+ last names
- **Companies**: Google, Meta, Amazon, Netflix, startups, etc.
- **Universities**: Stanford, MIT, Harvard, state schools, etc.
- **Locations**: SF, NYC, Seattle, Austin, Remote, etc.
- **Industries**: SaaS, Fintech, Healthcare, E-commerce, etc.

### Performance

**Speed Estimates** (with parallelism = 10):

| Profiles | Time | Disk Space | Use Case |
|----------|------|------------|----------|
| 1,000 | ~5 minutes | ~50 MB | Quick test |
| 10,000 | ~30 minutes | ~500 MB | Dev dataset |
| 100,000 | ~5 hours | ~5 GB | Production |
| 1,000,000 | ~50 hours (2 days) | ~50 GB | Phase 1 goal |

**Factors affecting speed:**
- Higher parallelism = faster (but more API quota usage)
- Larger batches = slightly faster
- Network speed affects embedding generation
- Gemini API rate limits may throttle at very high parallelism

### Job History

The system tracks all bulk ingestion jobs:

- **View History**: Click "▶ Job History" to see all jobs
- **Resume Paused**: Click "Resume" on any paused job
- **Delete Old Jobs**: Click trash icon to remove
- **Job Details**: See completion %, start time, status

Jobs are persisted in the `bulk_ingestion_progress` table.

### Advanced Tips

**🚀 Fast Mode** (max speed)
```typescript
targetCount: 100000
batchSize: 1000
parallelism: 20
checkpointInterval: 5000
```

**🛡️ Safe Mode** (most reliable)
```typescript
targetCount: 100000
batchSize: 500
parallelism: 5
checkpointInterval: 1000
```

**⚖️ Balanced Mode** (recommended)
```typescript
targetCount: 100000
batchSize: 500
parallelism: 10
checkpointInterval: 1000
```

### Troubleshooting

**Issue: Job stalls or hangs**
- **Cause**: API rate limit hit
- **Solution**: Reduce parallelism to 5-10, wait 5 min, resume

**Issue: High failure rate (>5%)**
- **Cause**: Supabase connection or API key issues
- **Solution**: Check `.env` credentials, verify network

**Issue: Progress not saving**
- **Cause**: `bulk_ingestion_progress` table not created
- **Solution**: Run `sql/BULK_INGESTION_SETUP.sql`

**Issue: Out of API quota**
- **Cause**: Too many Gemini API requests
- **Solution**: Pause job, wait for quota reset, resume later

### Achieving 1M Profiles (Phase 1)

To complete **Vision 2030 Phase 1**:

**Option 1: Single Run** (2 days)
```typescript
Target Count: 1000000
Batch Size: 1000
Parallelism: 20
Checkpoint Interval: 10000

Start Friday evening → Complete Monday morning
```

**Option 2: Multiple Sessions** (flexible)
```typescript
Run 100K profiles × 10 sessions
Each session: ~5 hours
Total: 1M profiles over 2 weeks
```

**Option 3: Start Small, Scale Up**
```bash
Week 1: Generate 1K (test) → ~5 min
Week 2: Generate 10K → ~30 min
Week 3: Generate 100K → ~5 hours
Week 4: Generate 1M → ~2 days
```

### Verification

After bulk generation, verify data quality:

```sql
-- 1. Check total count
SELECT COUNT(*) FROM candidate_documents;

-- 2. Check role diversity
SELECT DISTINCT metadata->>'title', COUNT(*)
FROM candidate_documents
WHERE metadata->>'source' = 'bulk_ingestion'
GROUP BY metadata->>'title'
ORDER BY COUNT(*) DESC;

-- 3. Check location spread
SELECT metadata->>'location', COUNT(*)
FROM candidate_documents
GROUP BY metadata->>'location'
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 4. Verify embeddings
SELECT COUNT(*) FROM candidate_documents
WHERE embedding IS NOT NULL;
```

### What's Next?

Once you've generated 100K-1M profiles:

1. **Test Smart Search** at scale → See instant results from 100K+ profiles
2. **Test RAG** → Generate content using huge candidate pool
3. **Enable Autonomous Agents** → Let them find matches from massive dataset
4. **Performance testing** → Verify sub-second query times
5. **Phase 2**: Move to LLM fine-tuning on hiring rubrics

**Full details**: See [BULK_INGESTION_GUIDE.md](BULK_INGESTION_GUIDE.md)

---

## Knowledge Graph Migration (Existing Candidates)

### Location: `/ingest` Page → **"Knowledge Graph Migration"** Panel (middle section)

### What is it?

If you already have candidates in your `candidate_documents` table (from previous ingestion, bulk generation, or migration), they may not have **Knowledge Graph relationships** yet. The Knowledge Graph Migration system adds Companies, Schools, and Skills relationships by parsing existing candidate metadata.

### Why do you need it?

**Before Migration:**
- ✅ Candidates exist in vector database
- ✅ Semantic search works
- ❌ No company relationships
- ❌ No school/education relationships
- ❌ No skill proficiency data
- ❌ Can't do graph queries (alumni networks, skill clusters, etc.)

**After Migration:**
- ✅ All of the above
- ✅ **Company relationships** → "Find all Google alumni"
- ✅ **School relationships** → "Find all Stanford graduates"
- ✅ **Skill relationships** → "Find React experts with 5+ years"
- ✅ **Hybrid search** → "Senior developers from FAANG who studied at MIT"
- ✅ **Network queries** → 2nd-degree connections, referral paths
- ✅ **Career analysis** → Common transitions, skill clusters

### Prerequisites

1. **Run `sql/KNOWLEDGE_GRAPH_SETUP.sql`** in Supabase SQL Editor
   - Creates entity tables (companies, schools, skills)
   - Creates relationship tables
   - Adds helper functions (get_or_create_company, etc.)
   - Seeds 25 companies, 25 schools, 50+ skills

2. **Run `sql/GRAPH_MIGRATION_SETUP.sql`** in Supabase SQL Editor
   - Creates `graph_migration_progress` table for tracking

### Setup (One-time)

1. Navigate to `/ingest` page
2. Find **"Knowledge Graph Migration"** panel
3. You'll see a warning banner if you have unmigrated candidates

### Configuration

**Batch Size** (Candidates per batch)
- Recommended: **100** (balanced performance)
- Fast mode: **200** (faster processing)
- Safe mode: **50** (more reliable)

**Checkpoint Interval** (Save progress every N)
- Recommended: **500** (frequent saves)
- Fast mode: **1,000** (fewer saves)
- Safe mode: **250** (very frequent saves)

### Usage

**1. Review Status**

The panel shows:
- Total candidates in database
- Whether migration is needed
- Warning if `sql/KNOWLEDGE_GRAPH_SETUP.sql` not run

**2. Click "Start Migration"**

The system will:
- Fetch candidates in batches
- Parse metadata (company, education, skills)
- Create or find entity nodes (Companies, Schools, Skills)
- Establish relationships (worked_at, studied_at, has_skill)
- Track progress with checkpoints
- Show real-time progress and ETA

**3. Monitor Progress**

Real-time dashboard shows:
- **Progress Bar**: Visual % complete
- **Candidates**: e.g., 7,523 / 15,074 migrated
- **Batch**: Current batch number
- **ETA**: Time remaining (e.g., "12m")
- **Failed**: Number of failures (should be < 1%)
- **Errors**: Error messages if any occur

**4. Pause/Resume Anytime**

- **Pause**: Click "Pause" → Progress saved → Resume later
- **Stop**: Click "Stop" → Job ends but progress saved
- **Resume**: Click "▶ Migration History" → Click "Resume"

### What Gets Migrated

For each candidate, the system extracts:

**1. Company Relationships**
```typescript
Source: metadata.currentCompany or metadata.company
Creates:
- Company entity (if doesn't exist)
- worked_at relationship with:
  - Title (from metadata.title)
  - Start/end dates (calculated from experience)
  - is_current flag
```

**2. School Relationships**
```typescript
Source: metadata.education
Example: "Master's in Computer Science - Stanford University"
Creates:
- School entity (if doesn't exist)
- studied_at relationship with:
  - Degree (e.g., "Master's in Computer Science")
  - Field of study (parsed from degree)
  - Graduation year (calculated from experience)
```

**3. Skill Relationships**
```typescript
Source: metadata.skills array
Example: ["React", "TypeScript", "Python", "Leadership"]
Creates (for each skill):
- Skill entity (if doesn't exist)
- has_skill relationship with:
  - Proficiency level (beginner/intermediate/advanced/expert)
  - Years of experience (estimated from total experience)
  - Category (programming/framework/tool/soft-skill/domain)
```

### Performance

**Speed Estimates** (with batch size = 100):

| Candidates | Time | Use Case |
|------------|------|----------|
| 1,000 | ~2-3 minutes | Small dataset |
| 10,000 | ~15-20 minutes | Medium dataset |
| 50,000 | ~60-90 minutes | Large dataset |
| 100,000 | ~2-3 hours | Enterprise dataset |

**Factors affecting speed:**
- Batch size (higher = faster but more memory)
- Number of skills per candidate
- Database performance (Supabase region, plan tier)
- Network latency

### Migration History

The system tracks all migration jobs:

- **View History**: Click "▶ Migration History"
- **Resume Paused**: Click "Resume" on any paused job
- **Delete Old Jobs**: Click trash icon to remove
- **Job Details**: See completion %, start time, errors

Jobs are persisted in the `graph_migration_progress` table.

### Verification

After migration, verify relationships were created:

```sql
-- 1. Check total relationships created
SELECT
  (SELECT COUNT(*) FROM candidate_companies) as companies,
  (SELECT COUNT(*) FROM candidate_schools) as schools,
  (SELECT COUNT(*) FROM candidate_skills) as skills;

-- 2. Sample candidate with relationships
SELECT
  c.metadata->>'name' as candidate,
  ARRAY_AGG(DISTINCT comp.name) as companies,
  ARRAY_AGG(DISTINCT sch.name) as schools,
  ARRAY_AGG(DISTINCT sk.name) as skills
FROM candidate_documents c
LEFT JOIN candidate_companies cc ON c.id = cc.candidate_id
LEFT JOIN companies comp ON cc.company_id = comp.id
LEFT JOIN candidate_schools cs ON c.id = cs.candidate_id
LEFT JOIN schools sch ON cs.school_id = sch.id
LEFT JOIN candidate_skills csk ON c.id = csk.candidate_id
LEFT JOIN skills sk ON csk.skill_id = sk.id
GROUP BY c.id
LIMIT 5;

-- 3. Top companies by candidate count
SELECT comp.name, COUNT(*) as candidate_count
FROM candidate_companies cc
JOIN companies comp ON cc.company_id = comp.id
GROUP BY comp.name
ORDER BY candidate_count DESC
LIMIT 10;

-- 4. Top skills by frequency
SELECT sk.name, sk.category, COUNT(*) as candidate_count
FROM candidate_skills cs
JOIN skills sk ON cs.skill_id = sk.id
GROUP BY sk.name, sk.category
ORDER BY candidate_count DESC
LIMIT 15;
```

### Troubleshooting

**Issue: Migration fails immediately**
- **Cause**: `sql/KNOWLEDGE_GRAPH_SETUP.sql` not run
- **Solution**: Run the SQL script in Supabase SQL Editor first

**Issue: "RPC function not found" errors**
- **Cause**: Helper functions (get_or_create_company) don't exist
- **Solution**: Verify `sql/KNOWLEDGE_GRAPH_SETUP.sql` was fully executed

**Issue: High failure rate (>5%)**
- **Cause**: Malformed metadata or missing fields
- **Solution**: Check errors panel, update candidate metadata format

**Issue: Progress not saving**
- **Cause**: `graph_migration_progress` table not created
- **Solution**: Run `sql/GRAPH_MIGRATION_SETUP.sql`

**Issue: Duplicate relationships**
- **Cause**: Migration run multiple times
- **Solution**: Check migration history, delete old jobs first

### What Happens to Original Data?

**Important:** Migration is **non-destructive**

- ✅ Original `candidate_documents` table is **NOT modified**
- ✅ Only **new** relationship records are created
- ✅ Safe to run multiple times (checks for existing relationships)
- ✅ Can be reversed by deleting relationship records

### What's Next?

Once migration is complete:

1. **Test Graph Queries** → Try "Find Google alumni who studied at Stanford"
2. **Test Hybrid Search** → Combine semantic search with graph filtering
3. **Explore Networks** → Find 2nd-degree connections, referral paths
4. **Analyze Careers** → Identify common company transitions
5. **Skill Clustering** → Discover which skills appear together

**Full details on graph queries**: See [Knowledge Graph Queries](#knowledge-graph-queries-new) section below

---

## AI Smart Search

### Location: Header → **"Smart Search"** Button (blue sparkles ✨)

### What is it?

Natural language search powered by AI vector embeddings. Instead of exact keyword matching, it understands the *meaning* of your query.

### How it works

```
Your Query: "senior React developer with leadership experience"
     ↓
Step 1: Gemini AI converts to vector [0.2, 0.4, 0.1, ...]
     ↓
Step 2: Supabase searches candidate vectors
     ↓
Step 3: Returns top 10 most similar candidates
     ↓
Result: Alice (89% match), Bob (85% match), Charlie (78% match)
```

### Usage

1. **Click "Smart Search"** button in header (next to Demo DB)
2. **Enter natural language query**:
   - ✅ "Python developer with ML experience"
   - ✅ "Project manager with Agile certification"
   - ✅ "Designer with Figma skills"
   - ❌ Don't use SQL: `SELECT * WHERE skill = 'React'`

3. **Click "Search"** or press Enter
4. **View ranked results** with similarity scores
5. **Click a candidate** to select them

### Example Queries

**Technical Roles:**
```
- "Senior frontend engineer familiar with React ecosystem"
- "Backend developer experienced in microservices and AWS"
- "Data scientist with NLP and PyTorch background"
- "DevOps engineer skilled in Kubernetes"
```

**Business Roles:**
```
- "Product manager with B2B SaaS experience"
- "Recruiter specialized in technical hiring"
- "UX designer with user research experience"
- "Marketing specialist with SEO skills"
```

**Skill-Based:**
```
- "Expertise in Python, Pandas, and data visualization"
- "Strong leadership and cross-functional collaboration"
- "Bilingual candidate fluent in German and English"
```

### Understanding Results

Each result shows:

```
┌─────────────────────────────────────────┐
│ Alice Wonderland    [Internal]  89% ✨ │
│ alice.w@example.com                     │
│                                         │
│ Skills: React, JavaScript, Java, CSS    │
│ 💼 3 years experience                   │
└─────────────────────────────────────────┘
```

**Match Score Meaning:**
- **85-100%**: Excellent match, high relevance
- **70-84%**: Good match, worth reviewing
- **60-69%**: Borderline, may have some skills
- **<60%**: Low match (filtered out by default)

### Filters

Default search settings:
- **Threshold**: 60% minimum similarity
- **Limit**: Top 10 results
- **All types**: Internal, Past, Uploaded candidates

To modify, edit in code:
```typescript
semanticSearchService.search(query, {
  threshold: 0.7,  // 70% minimum
  limit: 20,        // Top 20 results
  type: 'internal'  // Only internal candidates
});
```

---

## RAG Query (Retrieval-Augmented Generation)

### Location: Header → **"RAG Query"** Button (purple/pink gradient 🧠)

### What is it?

RAG combines **semantic search** with **AI generation** to create context-aware responses. Instead of just finding candidates, RAG uses them as context to generate personalized content:

- **Outreach Emails**: Personalized messages referencing specific candidate experience
- **Interview Questions**: Tailored questions based on candidate backgrounds
- **Candidate Comparisons**: Analytical summaries comparing multiple profiles
- **Briefing Documents**: Summaries highlighting key strengths and concerns

### How it works

```
Your Query: "Write outreach email to senior React developers in California"
     ↓
Step 1: Search vector database for matching candidates
     ↓
Step 2: Build context from top 5 candidates:
        - Alice: Senior Frontend Eng, 5 years React, SF
        - Bob: Principal Engineer, React+TypeScript, LA
        - Charlie: Lead UI Dev, 7 years frontend, San Diego
     ↓
Step 3: Send context + query to Gemini AI
     ↓
Step 4: AI generates response using actual candidate data
     ↓
Result: Personalized email mentioning Alice's React expertise,
        Bob's TypeScript skills, etc.
```

### Usage

1. **Click "RAG Query"** button in header (purple/pink gradient)
2. **Choose a template** or write custom query:
   - **Outreach Email**: Generate personalized recruitment messages
   - **Interview Questions**: Create tailored question sets
   - **Compare Candidates**: Analyze and rank profiles
   - **Candidate Brief**: Summarize key highlights
3. **Click "Generate"** or press Cmd/Ctrl + Enter
4. **View results**:
   - Source candidates used for context (with match scores)
   - AI-generated response
5. **Copy response** to clipboard

### Quick Templates

#### 1. **Outreach Email**
**Example Query:**
```
Write a personalized outreach email to senior React developers in
California for a Senior Frontend Engineer role at TechCorp
```

**What it does:**
- Searches for React developers in California
- Takes top candidate profile
- Generates email mentioning their specific React projects, experience level
- Uses professional, engaging tone

**Sample Output:**
```
Hi Alice,

I came across your profile and was impressed by your 5 years of React
experience and your work on component architecture at your current company.
We have a Senior Frontend Engineer role at TechCorp that aligns perfectly
with your expertise in React, TypeScript, and modern frontend tooling.

Would you be open to a brief call this week to discuss this opportunity?

Best regards,
[Recruiter Name]
```

#### 2. **Interview Questions**
**Example Query:**
```
Generate interview questions for ML engineers with Python and
TensorFlow experience
```

**What it does:**
- Finds ML engineers with Python/TensorFlow
- Analyzes their project backgrounds
- Creates questions targeting their specific experience level

**Sample Output:**
```
Based on the candidates' profiles, here are tailored questions:

1. Technical Depth:
   - "You've worked with TensorFlow for 3 years. Walk me through your
      approach to optimizing model training time for large datasets."

2. Problem-Solving:
   - "Given your experience with NLP models, how would you approach
      building a multilingual sentiment classifier?"

3. Systems Design:
   - "Your background shows production ML deployments. Describe your
      ideal MLOps pipeline for a recommendation system."

4. Collaboration:
   - "You've worked with cross-functional teams. How do you explain
      model performance metrics to non-technical stakeholders?"

5. Learning & Growth:
   - "What's one recent ML paper or technique you've implemented, and
      what challenges did you face?"
```

#### 3. **Compare Candidates**
**Example Query:**
```
Compare candidates with DevOps experience and rank them based on
Kubernetes, AWS, and CI/CD skills
```

**What it does:**
- Retrieves top 5 DevOps candidates
- Analyzes each against job requirements
- Provides structured comparison

**Sample Output:**
```
Candidate Comparison for DevOps Role:

**Rank 1: Alice Thompson (92% match)**
✅ Strengths:
  - 4 years Kubernetes in production
  - AWS Solutions Architect certified
  - Built CI/CD pipelines for 15+ microservices
  - Strong Terraform + Infrastructure as Code
⚠ Gaps:
  - Limited Azure experience

**Rank 2: Bob Martinez (87% match)**
✅ Strengths:
  - 5 years AWS (EC2, ECS, Lambda)
  - Jenkins + GitLab CI expertise
  - Led DevOps transformation at previous company
⚠ Gaps:
  - Only 1 year Kubernetes experience
  - Prefers Jenkins over modern CI tools

**Rank 3: Charlie Zhang (81% match)**
✅ Strengths:
  - Strong scripting (Python, Bash, Go)
  - Docker + containerization expert
  - Good monitoring/observability skills
⚠ Gaps:
  - AWS knowledge limited to basics
  - No Kubernetes in production

Recommendation: Alice is the strongest match overall with deep K8s
and AWS expertise. Bob brings valuable leadership experience. Charlie
would be a solid junior/mid-level hire.
```

#### 4. **Candidate Brief**
**Example Query:**
```
Summarize the top 3 candidates for a Product Manager role, highlighting
their unique strengths
```

**What it does:**
- Finds Product Manager candidates
- Extracts key differentiators
- Creates executive summary

**Sample Output:**
```
Product Manager Candidate Summary:

**Alice Kumar** - Enterprise B2B Specialist
- 6 years PM experience in SaaS
- Led $5M product line at previous company
- Strong in stakeholder management and roadmap planning
- Unique: Deep understanding of enterprise sales cycles
- Best for: Complex B2B products with long sales cycles

**Bob Chen** - Growth & Analytics Focus
- 4 years PM, data-driven approach
- Grew user base 300% through A/B testing
- Strong SQL, analytics tools (Amplitude, Mixpanel)
- Unique: Can write SQL queries and analyze metrics independently
- Best for: Consumer products prioritizing growth metrics

**Charlie Santos** - Technical Product Leader
- 8 years experience (started as engineer)
- Can review code and architect solutions
- Led API platform used by 1000+ developers
- Unique: Technical credibility with engineering teams
- Best for: Developer tools or technical infrastructure products

All three are strong candidates with complementary skill sets.
Choose based on product type and team needs.
```

### Advanced Usage

You can also write completely custom queries:

**Custom Query Examples:**
```
"Draft a rejection email for candidates who applied to the
 Data Engineer role but lack SQL experience"

"Create a 30-60-90 day onboarding plan for a senior backend engineer"

"Generate a skills assessment test for React developers focusing on
 hooks, state management, and performance optimization"

"Write a LinkedIn InMail message to passive candidates with
 5+ years Python experience"

"Summarize why these top 3 candidates would complement our existing
 engineering team culture"
```

### Understanding RAG Results

Each response includes:

**1. Source Candidates Section:**
```
Based on 3 candidates:
#1 Alice Wonderland • Senior Frontend Eng  89% ✨
#2 Bob Builder • Principal Engineer       85% ✨
#3 Charlie Brown • Lead Developer         78% ✨
```
Shows which candidates were used as context and their relevance scores.

**2. AI-Generated Response:**
The main content generated by the AI based on the source candidates.

**3. Copy Button:**
Click to copy the response to your clipboard for use in emails, docs, etc.

### Tips for Best Results

**✅ Do:**
- Be specific about role, skills, and context
- Reference the purpose (outreach, interview, comparison)
- Mention tone preferences (professional, casual, enthusiastic)
- Include job requirements for comparisons

**❌ Avoid:**
- Vague queries like "tell me about candidates"
- Asking for private information not in profiles
- Expecting real-time updates (uses vector DB data)

### Technical Notes

**Query Parameters:**
```typescript
{
  query: string,              // Your natural language query
  searchThreshold: 0.7,       // Min similarity (0-1)
  maxCandidates: 5            // Max candidates as context
}
```

**Limits:**
- Uses top 5 most relevant candidates by default
- 70% minimum similarity threshold
- AI response limited to ~500 words for readability

**Requirements:**
- ✅ Supabase configured with vector database
- ✅ Gemini API key in `.env`
- ✅ Candidates migrated/ingested to vector DB

---

## Knowledge Graph Queries (NEW)

### What is it?

Knowledge Graph Queries enable **relationship-based recruiting** by querying structured entity relationships (companies, schools, skills) in combination with semantic search. This unlocks powerful network-based sourcing strategies.

### Key Capabilities

#### 1. **Company-Based Queries**
Find candidates by employment history:
```typescript
// Find all Google alumni
const googleAlumni = await graphQueryService.findCandidatesByCompany('Google');

// Find alumni from multiple FAANG companies
const faangCandidates = await graphQueryService.findCandidatesByMultipleCriteria({
  companies: ['Google', 'Meta', 'Amazon', 'Apple', 'Netflix']
});
```

#### 2. **School-Based Queries**
Find candidates by educational background:
```typescript
// Find Stanford University alumni
const stanfordAlumni = await graphQueryService.findCandidatesBySchool('Stanford University');

// Find top CS program graduates
const topCSGrads = await graphQueryService.findCandidatesByMultipleCriteria({
  schools: ['Stanford University', 'MIT', 'Carnegie Mellon University']
});
```

#### 3. **Skill-Based Queries**
Find candidates by specific technical skills:
```typescript
// Find React experts
const reactExperts = await graphQueryService.findCandidatesBySkill('React', 'expert');

// Find candidates with multiple skills
const fullStackDevs = await graphQueryService.findCandidatesByMultipleCriteria({
  skills: ['React', 'Node.js', 'PostgreSQL']
});
```

#### 4. **Multi-Criteria Queries (AND logic)**
Combine companies, schools, and skills:
```typescript
// "Find Google alumni who studied CS at Stanford with ML skills"
const candidates = await graphQueryService.findCandidatesByMultipleCriteria({
  companies: ['Google'],
  schools: ['Stanford University'],
  skills: ['Machine Learning', 'Python', 'TensorFlow']
});
```

#### 5. **Career Path Analysis**
Discover common company transitions:
```typescript
// Find candidates who moved from Google to Meta
const paths = await graphQueryService.findCareerPaths('Google', 'Meta');

// Returns:
[
  {
    from_company: 'Google',
    to_company: 'Meta',
    candidate_count: 47,
    common_titles: ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer']
  }
]
```

#### 6. **Skill Clusters**
Discover which skills frequently appear together:
```typescript
// "What skills do React developers typically have?"
const clusters = await graphQueryService.findSkillClusters('React');

// Returns:
[
  {
    primary_skill: 'React',
    related_skills: ['JavaScript', 'TypeScript', 'Next.js', 'Node.js', 'CSS'],
    candidate_count: 342
  }
]
```

#### 7. **Network Traversal (2nd Degree Connections)**
Find people in your network's network:
```typescript
// Find 2nd degree connections to a candidate
const network = await graphQueryService.find2ndDegreeConnections('candidate-123');

// Returns candidates who worked at the same companies as candidate-123
```

### Hybrid Search (Vector + Graph)

The most powerful feature: **combine semantic search with graph filtering**

```typescript
// "Find senior React developers from FAANG who studied at top schools"
const results = await semanticSearchService.hybridSearch({
  query: "Senior React developer with 5+ years experience and leadership skills",
  companies: ['Google', 'Meta', 'Amazon', 'Apple', 'Netflix'],
  schools: ['Stanford University', 'MIT', 'Harvard University'],
  skills: ['React', 'TypeScript', 'Leadership'],
  options: { threshold: 0.75, limit: 20 }
});
```

**How it works:**
1. **Graph Filter**: Reduces 100K candidates → 500 who worked at FAANG + top schools + React
2. **Vector Search**: Ranks those 500 by semantic similarity to "senior developer with leadership"
3. **Result**: Top 20 candidates who match BOTH relationship criteria AND semantic meaning

### Enhanced RAG with Knowledge Graph

RAG queries now automatically include relationship context:

```typescript
// Query using RAG with graph-aware context
const result = await ragService.queryCandidatesByCompany({
  companyName: 'Google',
  additionalCriteria: 'Focus on machine learning engineers'
});

// AI response includes:
// - Candidate names and current titles
// - Employment history at Google (dates, roles)
// - Educational background
// - Skill proficiency levels
```

**Available Graph-Enhanced RAG Methods:**

1. **Query by Company**
   ```typescript
   ragService.queryCandidatesByCompany({ companyName: 'Google' })
   ```

2. **Query by School**
   ```typescript
   ragService.queryCandidatesBySchool({ schoolName: 'Stanford University' })
   ```

3. **Multi-Criteria Query**
   ```typescript
   ragService.queryByGraphCriteria({
     companies: ['Google', 'Meta'],
     schools: ['Stanford University'],
     skills: ['React', 'TypeScript']
   })
   ```

4. **Career Path Analysis**
   ```typescript
   ragService.analyzeCareerPaths({ fromCompany: 'Google', toCompany: 'Meta' })
   ```

5. **Skill Cluster Analysis**
   ```typescript
   ragService.analyzeSkillClusters('React')
   ```

### Enhanced Smart Search with Graph Traversal

Smart Search now supports graph-powered filters:

```typescript
// Search Google alumni network for React developers
const results = await semanticSearchService.searchCompanyNetwork(
  'Google',
  'React developer with frontend architecture experience'
);

// Search Stanford alumni network for ML engineers
const alumni = await semanticSearchService.searchSchoolNetwork(
  'Stanford University',
  'Machine learning engineer with research background'
);

// Search by career path (Google → Meta transitions)
const pathCandidates = await semanticSearchService.searchByCareerPath(
  'Google',
  'Meta',
  'Engineering manager with scaling experience'
);
```

### Use Cases

#### 🎯 Network Recruiting
**Scenario**: You need to hire ML engineers and want warm introductions.

**Approach**:
1. Find candidates who worked at Google (company network)
2. Filter by Stanford University (alumni network)
3. Require ML skills (skill graph)
4. Use 2nd-degree connections for referral paths

```typescript
const candidates = await semanticSearchService.hybridSearch({
  query: "Machine learning engineer with Python and TensorFlow",
  companies: ['Google'],
  schools: ['Stanford University'],
  skills: ['Machine Learning', 'Python', 'TensorFlow']
});

// For each candidate, find 2nd degree connections
for (const candidate of candidates) {
  const connections = await graphQueryService.find2ndDegreeConnections(candidate.id);
  // Now you have potential referrers
}
```

#### 📊 Competitive Intelligence
**Scenario**: Understand talent flows between companies.

**Approach**:
```typescript
// Where do Google engineers go after leaving?
const googleExits = await graphQueryService.findCareerPaths('Google');

// Who's moving from startups to Meta?
const startupToMeta = await graphQueryService.findCareerPaths('Stripe', 'Meta');
```

#### 🧠 Skill Demand Analysis
**Scenario**: Understand which skills are in demand together.

**Approach**:
```typescript
// What skills do React developers need?
const reactSkills = await graphQueryService.findSkillClusters('React');

// What about ML engineers?
const mlSkills = await graphQueryService.findSkillClusters('Machine Learning');
```

### Data Seeding

The Knowledge Graph comes pre-seeded with:

**Companies (25):**
- FAANG: Google, Meta, Amazon, Apple, Netflix
- Tech Giants: Microsoft, Tesla, Uber, Airbnb, Stripe
- Startups: Notion, Figma, Linear, Vercel
- Enterprise: Oracle, SAP, Salesforce

**Schools (25):**
- Top Universities: Stanford, MIT, Harvard, CMU, UC Berkeley
- Bootcamps: General Assembly, App Academy, Hack Reactor
- Online: Coursera, Udacity

**Skills (50+):**
- Languages: JavaScript, Python, Java, TypeScript, Go, Rust
- Frameworks: React, Angular, Vue, Django, Spring
- Tools: Docker, Kubernetes, AWS, Git, PostgreSQL

### Requirements

- ✅ Supabase configured with `sql/KNOWLEDGE_GRAPH_SETUP.sql` executed
- ✅ Candidates generated via Bulk Ingestion (auto-creates relationships)
- ✅ Gemini API key for RAG queries (optional)

---

## Autonomous Agents

### Location: **AI & Governance → Autonomous** in navigation

### What are they?

Background workers that run continuously without human intervention. They monitor, analyze, and take actions 24/7.

**Philosophy Shift:**
- **Old**: User clicks "Search Candidates" → Gets results
- **New**: Agent runs every 5 minutes → Notifies "Found 3 new matches"

---

### 1. Sourcing Agent

**Purpose**: Automatically finds candidates matching your open jobs

**How it works:**

```
Every 5 minutes:
1. Gets all open jobs
2. For each job:
   ├── Builds search query from requirements
   ├── Searches vector database
   ├── Filters candidates already in pipeline
   └── Saves new matches
3. Sends notification for each match found
```

**Configuration:**
- **Interval**: 5 minutes
- **Threshold**: 75% similarity (high quality matches only)
- **Results per job**: Top 3 candidates

**Sample Workflow:**
```
10:00 AM - You post "Senior React Developer" job
10:05 AM - Agent scans, finds Alice (89% match)
10:05 AM - 🔔 Notification: "Sourcing Agent found Alice (89% match) for Senior React Developer"
10:10 AM - Agent scans again, finds Bob (82% match)
10:10 AM - 🔔 Notification: "Sourcing Agent found Bob (82% match) for Senior React Developer"
...continues every 5 minutes
```

**Discovered Matches Dashboard:**
Shows all candidates found by the agent:
```
┌────────────────────────────────────────────┐
│ ✅ Alice Wonderland        89% match      │
│ For: Senior React Developer                │
│ Skills: React, TypeScript, Leadership      │
│ Discovered: Today at 10:05 AM              │
└────────────────────────────────────────────┘
```

---

### 2. Screening Agent

**Purpose**: Conducts automated initial phone/chat screens

**How it works:**

```
Every 4 hours:
1. Gets candidates in screening queue
2. For each candidate:
   ├── Generates 5-6 screening questions
   ├── Sends questionnaire (email/SMS/chat)
   ├── Waits for responses
   ├── AI scores each answer (0-100)
   ├── Calculates overall score
   ├── Generates recommendation
   └── Notifies hiring team
3. Stores results for review
```

**Screening Questions:**
```
Based on job requirements:
1. "Tell me about your experience with React."
2. "Describe your background in TypeScript."
3. "Why are you interested in this role?"
4. "What are your salary expectations?"
5. "When would you be available to start?"
```

**Scoring System:**
- Each answer scored 0-100 by AI
- Overall score = average of all answers
- **Pass threshold**: 65%

**Recommendations:**
- **STRONG_PASS** (85-100%): Fast-track to hiring manager
- **PASS** (65-84%): Move to technical interview
- **BORDERLINE** (50-64%): Manual review needed
- **FAIL** (<50%): Reject politely

**Sample Results:**
```
┌─────────────────────────────────────────┐
│ Candidate: Alice Wonderland             │
│ Job: Senior React Developer             │
│ Overall Score: 87/100                   │
│ Status: ✅ STRONG_PASS                  │
│                                         │
│ Q1: React experience → 92/100          │
│ Q2: TypeScript skills → 88/100         │
│ Q3: Role interest → 85/100             │
│ Q4: Salary expectations → 80/100       │
│ Q5: Availability → 90/100              │
│                                         │
│ Summary: Strong candidate with solid    │
│ technical background. Demonstrates      │
│ clear communication and relevant exp.   │
│ Recommended for technical interview.    │
└─────────────────────────────────────────┘
```

---

### 3. Scheduling Agent

**Purpose**: Automatically negotiates and books interview times

**How it works:**

```
Every 2 hours:
1. Gets candidates needing interviews
2. For each candidate:
   ├── Sends email with available time slots
   ├── Parses candidate response
   ├── Books selected time in calendar
   ├── Sends confirmation with Zoom link
   ├── Adds to company calendar
   └── Notifies hiring manager
3. Tracks all scheduled interviews
```

**Sample Email Flow:**
```
Email 1 (Agent → Candidate):
─────────────────────────────
Hi Alice,

We'd love to schedule your interview for the
Senior React Developer position.

Please select a time that works for you:
• Tuesday, Dec 12 at 10:00 AM PST
• Thursday, Dec 14 at 2:00 PM PST
• Friday, Dec 15 at 11:00 AM PST

Click here to confirm: [Calendar Link]

Best regards,
Talent Sonar Scheduling Bot

Email 2 (Candidate → Agent):
─────────────────────────────
Thursday, Dec 14 at 2:00 PM works great!

Email 3 (Agent → Candidate & Manager):
─────────────────────────────
✅ Confirmed! Your interview is scheduled for:

📅 Thursday, December 14, 2024
🕐 2:00 PM - 3:00 PM PST
🎥 Zoom: https://zoom.us/j/123456

Calendar invite attached.

Looking forward to speaking with you!
```

**Scheduled Interviews Dashboard:**
```
┌────────────────────────────────────────────┐
│ Upcoming Interviews (Next 7 Days)          │
├────────────────────────────────────────────┤
│ Thu, Dec 14 at 2:00 PM                    │
│ Alice Wonderland - Senior React Developer  │
│ Status: ✅ Confirmed                       │
├────────────────────────────────────────────┤
│ Fri, Dec 15 at 10:00 AM                   │
│ Bob Builder - Backend Engineer            │
│ Status: 🕐 Pending confirmation           │
└────────────────────────────────────────────┘
```

---

### Agent Control Panel

Located at `/autonomous-agents`

**Features:**
1. **Enable/Disable** each agent individually
2. **View status**:
   - Last run time
   - Next scheduled run
   - Queue sizes
   - Total results
3. **Manual triggers**: Run agent on-demand
4. **Recent activity**: See what agents have done

**Controls:**
```
┌─────────────────────────────────────────┐
│ 🤖 Autonomous Sourcing Agent     [ON]  │
│ Running in background                   │
│                                         │
│ Last Scan: 2:35 PM                     │
│ Next Scan: 5 minutes                   │
│ Total Matches: 12                      │
│                                         │
│ [▶ Pause Agent]  [⚡ Run Manual Scan]  │
└─────────────────────────────────────────┘
```

---

### Pulse Feed Integration

All agent actions appear in the Pulse Feed (bell icon in header):

```
🤖 Sourcing Agent found Alice (89% match) for "Senior React Developer"
   2 minutes ago

📞 Screening Agent completed screen for Bob. Score: 87/100. STRONG_PASS.
   15 minutes ago

🗓️ Scheduling Agent booked interview with Charlie for Dec 14 at 2:00 PM
   1 hour ago

✅ Alice Wonderland passed initial screening (89%). Recommendation: Fast-track
   3 hours ago
```

**Filter by agent:**
- Click agent type to see only its notifications
- Unread count shows new activity
- Mark all as read when reviewed

---

## Setup & Configuration

### Prerequisites

1. **Node.js** v16+ installed
2. **Supabase account** (free tier works)
3. **Google Cloud account** for Gemini AI
4. **Git** for version control

### Environment Setup

1. **Create Supabase Project**
   ```bash
   1. Go to https://supabase.com
   2. Click "New Project"
   3. Name it "talent-sonar"
   4. Wait ~2 minutes for provisioning
   5. Copy Project URL and anon key
   ```

2. **Enable Vector Extension**
   ```sql
   -- In Supabase SQL Editor, run:
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Create Vector Table**
   ```sql
   CREATE TABLE candidate_documents (
     id bigserial PRIMARY KEY,
     content text,
     metadata jsonb,
     embedding vector(768)
   );
   ```

4. **Create Search Function**
   ```sql
   -- See SUPABASE_VECTOR_GUIDE.md for full SQL
   CREATE OR REPLACE FUNCTION match_candidates (
     query_embedding vector(768),
     match_threshold float,
     match_count int
   )
   RETURNS TABLE (
     id bigint,
     content text,
     metadata jsonb,
     similarity float
   )
   ...
   ```

5. **Setup Knowledge Graph (NEW)**
   ```sql
   -- In Supabase SQL Editor, run sql/KNOWLEDGE_GRAPH_SETUP.sql
   -- This creates:
   -- - Entity tables: companies, schools, skills, projects
   -- - Relationship tables: candidate_companies, candidate_schools, candidate_skills
   -- - Helper functions: get_or_create_company(), get_or_create_school(), get_or_create_skill()
   -- - Seed data: 25 companies, 25 schools, 50+ skills

   -- Quick start: Copy and paste the full sql/KNOWLEDGE_GRAPH_SETUP.sql file
   -- File location: /sql/KNOWLEDGE_GRAPH_SETUP.sql
   ```

6. **Setup Bulk Ingestion Progress Tracking**
   ```sql
   -- In Supabase SQL Editor, run sql/BULK_INGESTION_SETUP.sql
   -- This creates the bulk_ingestion_progress table for tracking
   -- 10K-1M+ profile generation jobs

   -- File location: /sql/BULK_INGESTION_SETUP.sql
   ```

7. **Setup Knowledge Graph Migration Tracking (IMPORTANT for Existing Data)**
   ```sql
   -- In Supabase SQL Editor, run sql/GRAPH_MIGRATION_SETUP.sql
   -- This creates the graph_migration_progress table for tracking
   -- migration of existing candidates to the Knowledge Graph

   -- File location: /sql/GRAPH_MIGRATION_SETUP.sql

   -- Why you need this:
   -- If you already have candidates in candidate_documents, they won't have
   -- Knowledge Graph relationships (companies, schools, skills) yet.
   -- This migration adds those relationships by parsing existing metadata.
   ```

8. **Configure Environment Variables**

   Update `.env`:
   ```bash
   # Google Gemini API
   VITE_GEMINI_API_KEY=your_gemini_api_key_here

   # Supabase
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here

   # Google Drive (optional)
   VITE_GOOGLE_CLIENT_ID=your_client_id_here
   VITE_GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
   ```

9. **Install Dependencies**
   ```bash
   npm install
   ```

10. **Start Development Server**
    ```bash
    npm run dev
    ```

11. **Migrate Existing Candidates (If you have existing data)**

    If you already have candidates in your database:

    - Go to http://localhost:3000/ingest
    - Find the "Knowledge Graph Migration" panel
    - Configure batch size and checkpoint interval (defaults are fine)
    - Click "Start Migration" to add graph relationships to existing candidates
    - Monitor progress in real-time
    - You can pause/resume at any time - progress is automatically saved

    **What this does:**
    - Parses existing candidate metadata (company, education, skills)
    - Creates Companies, Schools, and Skills nodes
    - Establishes relationships (worked_at, studied_at, has_skill)
    - Enables graph queries without modifying original data

    **Time estimate:** ~15-30 minutes for 15,000 candidates
    - **NEW**: Generate 10K+ profiles using "Bulk Candidate Generation"
    - Profiles will automatically include Knowledge Graph relationships

---

## Usage Guide

### Quick Start (5 minutes)

1. **Start the app**
   ```bash
   npm run dev
   ```

2. **Migrate your data**
   - Go to http://localhost:3000/ingest
   - Click "Migrate Mock Candidates to Vector DB"
   - Wait 2-3 minutes

3. **Try Smart Search**
   - Click "Smart Search" button in header
   - Enter: "Senior React developer"
   - View results

4. **Enable Autonomous Agents**
   - Go to http://localhost:3000/autonomous-agents
   - Toggle "Sourcing Agent" to ON
   - Wait 5 minutes, check Pulse Feed

### Daily Workflow

**Morning:**
1. Check Pulse Feed (bell icon) for overnight discoveries
2. Review agents dashboard for new matches
3. Approve/reject screening results

**During Day:**
- Use Smart Search when manually sourcing
- Let agents run in background
- Get notifications for new matches

**End of Day:**
- Review scheduled interviews
- Check agent performance metrics
- Adjust thresholds if needed

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────┐
│              React Frontend (Vite)              │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Smart      │  │ /ingest    │  │ Agents   │ │
│  │ Search     │  │ Page       │  │ Control  │ │
│  └────────────┘  └────────────┘  └──────────┘ │
└────────────┬────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────┐
│             Service Layer (TypeScript)          │
│  ┌──────────────────┐  ┌──────────────────────┐│
│  │ Semantic Search  │  │ Background Jobs      ││
│  │ Service          │  │ Service              ││
│  └──────────────────┘  └──────────────────────┘│
│  ┌──────────────────┐  ┌──────────────────────┐│
│  │ Autonomous       │  │ Autonomous           ││
│  │ Sourcing Agent   │  │ Screening Agent      ││
│  └──────────────────┘  └──────────────────────┘│
└────────────┬────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────┐
│            External Services                    │
│  ┌──────────────┐  ┌──────────────────────────┐│
│  │ Google       │  │ Supabase PostgreSQL      ││
│  │ Gemini AI    │  │ + pgvector               ││
│  │ (Embeddings) │  │ (Vector Storage)         ││
│  └──────────────┘  └──────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Data Flow

**Smart Search:**
```
User Query
  → SemanticSearchService.search()
    → AIService.embedText() (Google Gemini)
      → Get vector [0.1, 0.5, ...]
    → supabase.rpc('match_candidates')
      → PostgreSQL vector search
      → Return top matches
  → Display ranked results
```

**Autonomous Agent:**
```
Background Timer (every 5 min)
  → backgroundJobService.runJob()
    → autonomousSourcingAgent.scan()
      → Get open jobs
      → For each job:
        → Build semantic query
        → Search vector DB
        → Filter existing candidates
        → Save new matches
        → pulseService.notify()
  → Sleep until next interval
```

---

## Troubleshooting

### Issue: Migration failing

**Symptoms:**
```
✗ Migration failed: supabaseUrl is required
```

**Solution:**
1. Check `.env` file has Supabase credentials
2. Restart dev server: `Ctrl+C` then `npm run dev`
3. Verify Supabase project is active

---

### Issue: No search results

**Symptoms:**
Smart Search returns 0 results for any query

**Solution:**
1. Check if data is migrated:
   - Go to `/ingest`
   - See if migration shows "Complete"
2. Verify Supabase has data:
   ```sql
   SELECT COUNT(*) FROM candidate_documents;
   -- Should return > 0
   ```
3. Lower threshold:
   ```typescript
   threshold: 0.5  // Try lower threshold
   ```

---

### Issue: Agents not running

**Symptoms:**
No notifications in Pulse Feed

**Solution:**
1. Go to `/autonomous-agents`
2. Check agent status shows "Enabled"
3. Click "Run Manual Scan" to test
4. Check console for errors: Press F12 → Console tab

---

### Issue: Gemini API errors

**Symptoms:**
```
Failed to generate embedding: API key not valid
```

**Solution:**
1. Get new API key from https://makersuite.google.com/app/apikey
2. Update `.env`:
   ```bash
   VITE_GEMINI_API_KEY=your_new_key
   ```
3. Restart server

---

### Issue: Slow ingestion

**Symptoms:**
Migration takes >5 minutes

**Explanation:**
- Normal! Each candidate needs:
  - Gemini API call (500ms)
  - Supabase insert (200ms)
- 80 candidates × 700ms = ~56 seconds minimum
- With API rate limits: 2-3 minutes is expected

**If taking >10 minutes:**
- Check internet connection
- Verify Gemini API quota (free tier: 60 req/min)
- Check Supabase status: https://status.supabase.com

---

## Support & Resources

**Documentation:**
- [VISION_2030.md](./VISION_2030.md) - Long-term roadmap
- [SUPABASE_VECTOR_GUIDE.md](./SUPABASE_VECTOR_GUIDE.md) - Vector DB setup
- [CLAUDE.md](./CLAUDE.md) - Development guidelines

**External Docs:**
- [Supabase Vector Guide](https://supabase.com/docs/guides/ai/vector-columns)
- [Google Gemini API](https://ai.google.dev/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)

**Need Help?**
1. Check console for errors (F12 → Console)
2. Review logs in `/ingest` page
3. Verify environment variables
4. Check Supabase dashboard for data

---

## Appendix: File Structure

```
talent-sonar/
├── services/
│   ├── SemanticSearchService.ts        # AI search engine
│   ├── BackgroundJobService.ts         # Job scheduler
│   ├── AutonomousSourcingAgent.ts      # Candidate finder
│   ├── AutonomousScreeningAgent.ts     # Phone screener
│   ├── AutonomousSchedulingAgent.ts    # Interview booker
│   ├── AIService.ts                    # Gemini integration
│   └── supabaseClient.ts               # Database client
│
├── components/
│   ├── modals/
│   │   └── SmartSearchModal.tsx        # Search UI
│   ├── AutonomousAgentsControl.tsx     # Agent dashboard
│   └── IngestControl.tsx               # Migration UI
│
├── pages/
│   ├── IngestPage.tsx                  # /ingest page
│   └── AutonomousAgentsPage.tsx        # /autonomous-agents
│
├── utils/
│   └── migrateToVectorDB.ts            # Migration logic
│
├── data/
│   └── candidates.ts                   # Mock data source
│
└── .env                                # Configuration
```

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Status**: ✅ Production Ready
