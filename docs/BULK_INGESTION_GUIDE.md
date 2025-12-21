# Bulk Candidate Generation Guide

Complete guide for generating 10K-100K+ candidate profiles using the bulk ingestion system.

---

## 📋 Quick Start

### 1. **Database Setup** (One-time)

Run this SQL in your Supabase SQL Editor:

```bash
# Copy the SQL file contents and run in Supabase
See `sql/BULK_INGESTION_SETUP.sql`
```

This creates the `bulk_ingestion_progress` table for tracking job progress.

### 2. **Navigate to /ingest Page**

```
http://localhost:3000/ingest
```

You'll see two panels:
- **Bulk Candidate Generation** (NEW!)
- **Knowledge Graph Ingestion** (existing batch/migration)

### 3. **Configure Generation**

In the "Bulk Candidate Generation" panel, configure:

| Setting | Description | Recommended |
|---------|-------------|-------------|
| **Target Count** | Total profiles to generate | 10,000 (test), 100,000 (production) |
| **Batch Size** | Profiles per batch | 500 (balanced), 1000 (faster, more memory) |
| **Parallelism** | Concurrent API calls | 10 (safe), 20 (faster, more API quota) |
| **Checkpoint Interval** | Save progress every N | 1000 (frequent saves) |

### 4. **Start Generation**

Click **"Start Bulk Generation"** and watch:
- Real-time progress bar
- Current batch tracking
- Estimated time remaining
- Success/failure counts

### 5. **Pause/Resume Anytime**

- **Pause**: Saves current progress, can resume later
- **Stop**: Stops completely (progress still saved)
- **Resume**: Continue from last checkpoint

---

## 🎯 Use Cases

### **Scenario 1: Quick Test (1K profiles, ~5 minutes)**
```typescript
Target Count: 1000
Batch Size: 500
Parallelism: 10
Checkpoint Interval: 500
```
**Purpose**: Test the system, verify everything works

---

### **Scenario 2: Development Dataset (10K profiles, ~30 minutes)**
```typescript
Target Count: 10000
Batch Size: 500
Parallelism: 10
Checkpoint Interval: 1000
```
**Purpose**: Good for local development, RAG testing, agent testing

---

### **Scenario 3: Production Dataset (100K profiles, ~5 hours)**
```typescript
Target Count: 100000
Batch Size: 1000
Parallelism: 20
Checkpoint Interval: 5000
```
**Purpose**: Full-scale testing, demo to stakeholders, realistic load

---

### **Scenario 4: Million Scale (1M profiles, ~2 days)**
```typescript
Target Count: 1000000
Batch Size: 1000
Parallelism: 20
Checkpoint Interval: 10000
```
**Purpose**: Phase 1 completion, stress testing, enterprise demo
**Tip**: Run overnight, pause during work hours if needed

---

## 🏗️ What Gets Generated

### **50+ Job Roles Across Categories**

**Engineering (15 roles)**
- Frontend Engineer, Backend Engineer, Full Stack Engineer
- DevOps Engineer, Mobile Engineer, Data Engineer
- ML Engineer, Security Engineer, QA Engineer
- Site Reliability Engineer, Cloud Architect
- Embedded Systems Engineer, Platform Engineer
- Solutions Architect, AI Research Scientist

**Data & Analytics (8 roles)**
- Data Scientist, Data Analyst, BI Analyst
- Analytics Engineer, Quantitative Analyst
- MLOps Engineer, Data Visualization Engineer, Research Analyst

**Product (6 roles)**
- Product Manager, Technical PM, Product Designer
- UX Researcher, Growth PM, Product Operations Manager

**Design (4 roles)**
- UI Designer, UX Designer, Graphic Designer, Motion Designer

**Marketing (6 roles)**
- Digital Marketing Manager, Content Marketing Manager
- Growth Marketing Manager, Marketing Analyst
- Social Media Manager, SEO Specialist

**Sales (5 roles)**
- Account Executive, SDR, Customer Success Manager
- Sales Engineer, Enterprise Account Manager

**HR & Recruiting (4 roles)**
- Technical Recruiter, HR Business Partner
- Talent Acquisition Manager, People Operations Manager

**Finance (4 roles)**
- Financial Analyst, Accountant, FP&A Analyst, Controller

**Operations (3 roles)**
- Operations Manager, Supply Chain Analyst, Program Manager

**Executive (3 roles)**
- CTO, VP of Engineering, VP of Product

---

## 📊 Profile Details

Each generated profile includes:

```typescript
{
  name: "Alice Wonderland",
  title: "Senior Frontend Engineer",
  email: "alice.wonderland@example.com",
  yearsOfExperience: 6,
  skills: ["React", "TypeScript", "JavaScript", "CSS", "Redux"],
  education: "Bachelor's in Computer Science - Stanford University",
  location: "San Francisco, CA",
  company: "Google",
  industry: "SaaS",
  summary: "Senior Frontend Engineer with 6+ years of experience..."
}
```

**Data Diversity:**
- **100+ First Names** (diverse, international)
- **100+ Last Names** (diverse backgrounds)
- **50+ Companies** (Google, Meta, Amazon, startups, etc.)
- **30+ Universities** (Stanford, MIT, Harvard, state schools, etc.)
- **Multiple Locations** (SF, NYC, Austin, Seattle, Remote, etc.)
- **Varied Experience** (0-25 years based on role)
- **Industry-Specific Skills** (role-appropriate skill sets)

---

## 🔄 How It Works

### **Step-by-Step Process:**

```
1. Generate Profiles
   ├── Select random job role template (50+ options)
   ├── Generate random name (100+ first × 100+ last)
   ├── Select skills from template (role-appropriate)
   ├── Generate realistic summary
   └── Assign company, location, education

2. Batch Processing
   ├── Group profiles into batches (e.g., 500 each)
   ├── Process batches sequentially
   └── Track progress after each batch

3. Parallel Embedding
   ├── Within each batch, parallelize API calls
   ├── Generate embeddings via Gemini API (768-dimensional)
   ├── Configurable parallelism (1-20 concurrent)
   └── Retry failed embeddings

4. Database Insertion
   ├── Insert profile + embedding into Supabase
   ├── Store metadata (skills, experience, etc.)
   ├── Mark as 'uploaded' type with 'bulk_ingestion' source
   └── Track success/failure

5. Checkpoint & Resume
   ├── Save progress every N profiles
   ├── Store job state in bulk_ingestion_progress table
   ├── Resume from last checkpoint if interrupted
   └── Track errors for debugging
```

---

## 📈 Performance Expectations

### **Speed Estimates** (with parallelism = 10)

| Profiles | Time | Notes |
|----------|------|-------|
| 1,000 | ~5 min | Quick test |
| 10,000 | ~30 min | Dev dataset |
| 50,000 | ~2.5 hours | Large test |
| 100,000 | ~5 hours | Production |
| 1,000,000 | ~50 hours (~2 days) | Enterprise scale |

**Factors affecting speed:**
- **Parallelism**: Higher = faster (but more API quota usage)
- **Batch Size**: Larger = fewer checkpoints (slightly faster)
- **Network Speed**: Faster connection = faster embedding generation
- **Gemini API Rate Limits**: May throttle at very high parallelism

---

## ⚙️ Advanced Configuration

### **Tuning for Speed**

**Fast Mode (max speed, higher API usage)**
```typescript
targetCount: 100000
batchSize: 1000
parallelism: 20      // ← Increased
checkpointInterval: 10000
```

**Safe Mode (slower, more reliable)**
```typescript
targetCount: 100000
batchSize: 500
parallelism: 5       // ← Reduced
checkpointInterval: 1000
```

**Balanced Mode (recommended)**
```typescript
targetCount: 100000
batchSize: 500
parallelism: 10
checkpointInterval: 1000
```

---

## 🛠️ Troubleshooting

### **Issue: Job stalls/hangs**
**Cause**: API rate limit hit
**Solution**:
- Reduce `parallelism` to 5-10
- Pause job, wait 5 minutes, resume

### **Issue: High failure rate**
**Cause**: Supabase connection issues or API key invalid
**Solution**:
- Check Supabase credentials in `.env`
- Verify Gemini API key is valid
- Check network connection

### **Issue: Progress not saving**
**Cause**: `bulk_ingestion_progress` table not created
**Solution**: Run `sql/BULK_INGESTION_SETUP.sql` in Supabase

### **Issue: Out of API quota**
**Cause**: Too many embedding requests
**Solution**:
- Pause job to preserve quota
- Wait for quota reset
- Resume job later

---

## 📁 Files Modified/Created

### **New Files**
1. `data/jobRoleTemplates.ts` - 50+ job role templates
2. `services/BulkIngestionService.ts` - Core bulk generation service
3. `components/BulkIngestionControl.tsx` - UI control panel
4. `sql/BULK_INGESTION_SETUP.sql` - Database setup script
5. `BULK_INGESTION_GUIDE.md` - This guide

### **Modified Files**
1. `pages/IngestPage.tsx` - Added BulkIngestionControl component

---

## 🎬 Next Steps After Generation

Once you've generated 10K-100K profiles:

### **1. Test Smart Search**
```
Click "Smart Search" → Search "senior React developers in California"
Should return many relevant results
```

### **2. Test RAG Query**
```
Click "RAG Query" → "Write outreach email to ML engineers"
Should generate personalized email using actual candidate data
```

### **3. Test Autonomous Agents**
```
Navigate to AI & Governance → Autonomous
Enable Sourcing Agent
Wait 5 minutes → Check Pulse Feed for auto-discovered matches
```

### **4. Performance Testing**
```
- Test vector search with 100K profiles
- Measure query latency (should be <500ms)
- Test RAG with different queries
- Verify agent performance at scale
```

---

## 💾 Database Storage

### **Disk Space Requirements**

| Profiles | Approximate Size |
|----------|------------------|
| 1,000 | ~50 MB |
| 10,000 | ~500 MB |
| 100,000 | ~5 GB |
| 1,000,000 | ~50 GB |

**Note**: Includes profile data + 768-dimensional embeddings

### **Supabase Free Tier Limits**
- **Database**: 500 MB (good for ~10K profiles)
- **For 100K+**: Upgrade to Pro plan (~$25/month)
- **For 1M**: Consider dedicated instance

---

## 🔍 Monitoring Progress

### **In the UI**
- Progress bar shows % complete
- Batch tracker shows current/total batches
- ETA updates in real-time
- Success/failure counts
- Error log (first 5 errors displayed)

### **In Database**
```sql
-- Check all jobs
SELECT * FROM bulk_ingestion_progress
ORDER BY start_time DESC;

-- Check total profiles ingested
SELECT COUNT(*) FROM candidate_documents
WHERE metadata->>'source' = 'bulk_ingestion';
```

---

## 🎯 Achieving Phase 1 Goal (1M+ Profiles)

To complete **Phase 1: Ingest 1M+ phony profiles**:

### **Option 1: Single Run (2 days)**
```typescript
Target Count: 1000000
Batch Size: 1000
Parallelism: 20
Checkpoint Interval: 10000

Start on Friday evening → Complete by Monday morning
```

### **Option 2: Multiple Runs (flexible)**
```typescript
// Run 1: 100K profiles (5 hours)
// Run 2: 100K profiles (5 hours)
// ...
// Run 10: 100K profiles (5 hours)

Total: 1M profiles over multiple sessions
```

### **Option 3: Distributed (fastest)**
```typescript
// Multiple machines/accounts running in parallel
// Each generates 200K profiles
// Combine into one database
// Total time: ~10 hours
```

---

## ✅ Verification

After generation, verify data quality:

```sql
-- 1. Check total count
SELECT COUNT(*) FROM candidate_documents;

-- 2. Check diversity
SELECT DISTINCT metadata->>'title' FROM candidate_documents LIMIT 50;

-- 3. Check locations
SELECT metadata->>'location', COUNT(*)
FROM candidate_documents
GROUP BY metadata->>'location'
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 4. Check experience distribution
SELECT metadata->>'experienceYears', COUNT(*)
FROM candidate_documents
GROUP BY metadata->>'experienceYears'
ORDER BY metadata->>'experienceYears';

-- 5. Verify embeddings exist
SELECT COUNT(*) FROM candidate_documents
WHERE embedding IS NOT NULL;
```

---

## 🚀 Ready to Start!

1. ✅ Run `sql/BULK_INGESTION_SETUP.sql` in Supabase
2. ✅ Navigate to `/ingest` page
3. ✅ Configure settings (start with 1K for testing)
4. ✅ Click "Start Bulk Generation"
5. ✅ Monitor progress
6. ✅ Test Smart Search & RAG with your new dataset!

**Questions or issues?** Check the troubleshooting section or review error logs in the UI.
