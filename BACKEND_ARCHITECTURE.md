# 🏗️ Talent Sonar AI - Backend Architecture

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [API Endpoints](#api-endpoints)
4. [Background Jobs](#background-jobs)
5. [Database Integration](#database-integration)
6. [Deployment Strategy](#deployment-strategy)
7. [Migration Plan](#migration-plan)

---

## 🏛️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│         React 19 + TypeScript + Vite                    │
│              (Current Implementation)                    │
└────────────────────┬────────────────────────────────────┘
                     │ REST API / GraphQL
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   API GATEWAY                            │
│              (Rate Limiting, Auth, CORS)                │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │             │
        ▼            ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│   Jobs   │  │Candidates│  │ Matching │
│  Service │  │ Service  │  │ Service  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │              │
     └─────────────┼──────────────┘
                   │
                   ▼
          ┌────────────────┐
          │   PostgreSQL   │
          │    Database    │
          └────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │           │
        ▼          ▼           ▼
┌──────────┐  ┌────────┐  ┌──────────┐
│  Redis   │  │ Queue  │  │  S3/CDN  │
│  Cache   │  │(Bull)  │  │  (CVs)   │
└──────────┘  └────────┘  └──────────┘
```

---

## 💻 Technology Stack

### Recommended Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Runtime** | Node.js 20 LTS | Same as frontend, shared code possible |
| **Framework** | Express.js or Fastify | Fast, lightweight, good ecosystem |
| **Language** | TypeScript | Type safety, shared types with frontend |
| **Database** | PostgreSQL 14+ | JSONB support, robust, scalable |
| **ORM** | Prisma or TypeORM | Type-safe queries, migrations |
| **Cache** | Redis | Fast, reliable, pub/sub support |
| **Queue** | Bull or BullMQ | Redis-based, retries, priorities |
| **File Storage** | AWS S3 or Azure Blob | Scalable, cheap, CDN integration |
| **Authentication** | JWT + Passport.js | Stateless, scalable |
| **API Docs** | Swagger/OpenAPI | Auto-generated, interactive |
| **Logging** | Winston + Datadog | Structured logging, monitoring |
| **Testing** | Jest + Supertest | Unit + integration tests |

---

## 🔌 API Endpoints

### REST API Design

#### Base URL: `/api/v1`

### 1. **Jobs API**

```typescript
// Get all jobs (with pagination and filters)
GET /api/v1/jobs
Query params:
  - page: number (default: 1)
  - limit: number (default: 20)
  - status: 'open' | 'closed' | 'on hold' | 'all'
  - department: string
  - search: string

Response:
{
  "data": [
    {
      "id": "uuid",
      "title": "Senior React Developer",
      "department": "Technology",
      "location": "Budapest",
      "status": "open",
      "requiredSkills": ["React", "TypeScript"],
      "matchStatistics": {
        "totalCandidates": 55,
        "strongMatches": 8,
        "goodMatches": 12
      },
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 23,
    "totalPages": 2
  }
}
```

```typescript
// Get single job with details
GET /api/v1/jobs/:id

Response:
{
  "data": {
    "id": "uuid",
    "title": "Senior React Developer",
    "description": "We are looking for...",
    "requiredSkills": ["React", "TypeScript", "Node.js"],
    "companyContext": {
      "industry": "SaaS",
      "companySize": "500-1000"
    },
    "matchStatistics": {
      "totalCandidates": 55,
      "strongMatches": 8,
      "goodMatches": 12,
      "aiAnalyzedCount": 10
    }
  }
}
```

```typescript
// Create new job
POST /api/v1/jobs
Body:
{
  "title": "Senior Full-Stack Developer",
  "department": "Technology",
  "location": "Budapest",
  "description": "...",
  "requiredSkills": ["React", "Node.js"],
  "companyContext": { ... }
}

Response:
{
  "data": {
    "id": "uuid",
    "title": "Senior Full-Stack Developer",
    // ... full job object
  },
  "message": "Job created successfully. Analyzing 55 candidates..."
}

// Background: Triggers match score calculation for all candidates
```

```typescript
// Update job
PATCH /api/v1/jobs/:id
Body: { "status": "closed" }

Response:
{
  "data": { ... },
  "message": "Job updated successfully"
}
```

```typescript
// Delete job (soft delete)
DELETE /api/v1/jobs/:id

Response:
{
  "message": "Job deleted successfully"
}
```

```typescript
// Analyze job with AI
POST /api/v1/jobs/:id/analyze

Response:
{
  "data": {
    "keyResponsibilities": ["..."],
    "idealCandidateProfile": "...",
    "trueSeniorityLevel": "Senior",
    "skillRequirements": [...]
  }
}
```

---

### 2. **Candidates API**

```typescript
// Get all candidates (with pagination and filters)
GET /api/v1/candidates
Query params:
  - page: number
  - limit: number
  - type: 'internal' | 'past' | 'uploaded' | 'all'
  - employmentStatus: 'available' | 'interviewing' | 'hired'
  - search: string
  - skills: string[] (comma-separated)

Response:
{
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "type": "uploaded",
      "skills": ["React", "TypeScript"],
      "employmentStatus": "available",
      "matchStatistics": {
        "totalJobsMatched": 23,
        "bestMatchScore": 87,
        "strongMatches": 5
      }
    }
  ],
  "pagination": { ... }
}
```

```typescript
// Get single candidate
GET /api/v1/candidates/:id

Response:
{
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "type": "uploaded",
    "skills": ["React", "TypeScript", "Node.js"],
    "cvFileUrl": "https://cdn.../john-doe-cv.pdf",
    "metadata": {
      "summary": "Experienced developer...",
      "experienceYears": 5
    },
    "matchStatistics": { ... }
  }
}
```

```typescript
// Upload CV and create candidate
POST /api/v1/candidates/upload
Content-Type: multipart/form-data
Body:
  - file: PDF/DOCX file
  - metadata: JSON (optional)

Response:
{
  "data": {
    "id": "uuid",
    "name": "John Doe", // Parsed by AI
    "email": "john@example.com", // Parsed by AI
    "skills": ["React", "TypeScript"], // Parsed by AI
    "cvFileUrl": "https://cdn.../...",
    "matchScoresQueued": true
  },
  "message": "CV uploaded and parsed successfully. Analyzing against 23 jobs..."
}

// Background: Triggers AI CV parsing + match score calculation
```

```typescript
// Update candidate
PATCH /api/v1/candidates/:id
Body: {
  "employmentStatus": "hired",
  "skills": ["React", "TypeScript", "GraphQL"]
}

Response:
{
  "data": { ... },
  "message": "Candidate updated successfully"
}
```

```typescript
// Enrich candidate profile with AI
POST /api/v1/candidates/:id/enrich

Response:
{
  "data": {
    "suggestedRoleTitle": "Full-Stack Developer",
    "experienceSummary": "...",
    "inferredSkills": ["HTML", "CSS", "JavaScript"]
  }
}
```

---

### 3. **Matching API**

```typescript
// Get top matches for a job
GET /api/v1/jobs/:jobId/matches
Query params:
  - limit: number (default: 15)
  - minScore: number (default: 50)
  - type: 'all' | 'internal' | 'past' | 'uploaded'

Response:
{
  "data": [
    {
      "candidate": {
        "id": "uuid",
        "name": "John Doe",
        "type": "uploaded",
        "skills": ["React", "TypeScript"]
      },
      "matchScore": 87,
      "matchRationale": "Strong match - has React and TypeScript...",
      "aiAnalyzed": true,
      "isHiddenGem": false,
      "feedback": null
    }
  ]
}
```

```typescript
// Get match details for a specific job-candidate pair
GET /api/v1/jobs/:jobId/candidates/:candidateId/match

Response:
{
  "data": {
    "matchScore": 87,
    "matchRationale": "...",
    "aiAnalysis": {
      "multiDimensionalAnalysis": { ... },
      "strengths": ["React expert", "Fast learner"],
      "gaps": ["Limited TypeScript"],
      "skillGapAnalysis": [...],
      "futurePotentialProjection": { ... }
    },
    "analyzedAt": "2025-01-15T10:30:00Z"
  }
}
```

```typescript
// Run AI fit analysis for a candidate
POST /api/v1/jobs/:jobId/candidates/:candidateId/analyze

Response:
{
  "data": {
    "matchScore": 87,
    "aiAnalysis": { ... }
  },
  "message": "Analysis completed successfully"
}
```

```typescript
// Batch analyze top N candidates
POST /api/v1/jobs/:jobId/analyze-top
Body: {
  "limit": 10,
  "minScore": 50
}

Response:
{
  "data": {
    "jobId": "uuid",
    "candidatesQueued": 10,
    "estimatedCompletionTime": "30-50 seconds"
  },
  "message": "Batch analysis started. You'll receive a notification when complete."
}

// Background: Queues 10 analysis jobs, processes sequentially
// Frontend can poll /api/v1/jobs/:jobId/analysis-status
```

```typescript
// Get analysis status
GET /api/v1/jobs/:jobId/analysis-status

Response:
{
  "data": {
    "inProgress": true,
    "total": 10,
    "completed": 7,
    "failed": 0,
    "progress": 70
  }
}
```

---

### 4. **Feedback API**

```typescript
// Submit feedback
POST /api/v1/feedback
Body: {
  "jobId": "uuid",
  "candidateId": "uuid",
  "feedbackType": "positive" | "negative" | "hired",
  "notes": "Optional notes"
}

Response:
{
  "message": "Feedback recorded successfully"
}
```

```typescript
// Get feedback for a job
GET /api/v1/jobs/:jobId/feedback

Response:
{
  "data": [
    {
      "candidateId": "uuid",
      "candidateName": "John Doe",
      "feedbackType": "positive",
      "notes": "...",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### 5. **Analytics API**

```typescript
// Get dashboard statistics
GET /api/v1/analytics/dashboard

Response:
{
  "data": {
    "totalJobs": 23,
    "openJobs": 18,
    "totalCandidates": 55,
    "strongMatches": 45,
    "aiAnalysisCount": 120,
    "averageMatchScore": 68,
    "recentActivity": [ ... ]
  }
}
```

```typescript
// Get insights (department-wise skill demand)
GET /api/v1/analytics/insights

Response:
{
  "data": [
    {
      "department": "Technology",
      "topSkills": [
        { "skill": "React", "count": 12 },
        { "skill": "TypeScript", "count": 10 }
      ]
    }
  ]
}
```

---

### 6. **User/Auth API**

```typescript
// Register
POST /api/v1/auth/register
Body: {
  "email": "recruiter@company.com",
  "password": "...",
  "fullName": "Jane Smith",
  "role": "recruiter"
}

Response:
{
  "data": {
    "user": { ... },
    "token": "jwt_token"
  }
}
```

```typescript
// Login
POST /api/v1/auth/login
Body: {
  "email": "recruiter@company.com",
  "password": "..."
}

Response:
{
  "data": {
    "user": { ... },
    "token": "jwt_token"
  }
}
```

```typescript
// Get current user
GET /api/v1/auth/me
Headers: Authorization: Bearer <token>

Response:
{
  "data": {
    "id": "uuid",
    "email": "...",
    "fullName": "...",
    "role": "recruiter"
  }
}
```

---

## ⚙️ Background Jobs

### Job Queue Architecture

```typescript
// Job types
enum JobType {
  CALCULATE_INITIAL_MATCHES = 'calculate_initial_matches',
  CALCULATE_CANDIDATE_MATCHES = 'calculate_candidate_matches',
  AI_FIT_ANALYSIS = 'ai_fit_analysis',
  AI_BATCH_ANALYSIS = 'ai_batch_analysis',
  PARSE_CV = 'parse_cv',
  SEND_NOTIFICATION = 'send_notification',
  SEND_EMAIL = 'send_email'
}

// Job priorities
enum Priority {
  CRITICAL = 1,  // User-initiated, blocking
  HIGH = 3,      // User-initiated, async
  NORMAL = 5,    // System-initiated
  LOW = 7        // Maintenance, cleanup
}
```

### Example Background Jobs

```typescript
// Worker: calculate_initial_matches
// Triggered when: New job is created
// Purpose: Calculate basic match scores for all candidates

interface CalculateInitialMatchesJob {
  jobId: string;
}

async function processCalculateInitialMatches(job: CalculateInitialMatchesJob) {
  const jobDetails = await db.jobs.findById(job.jobId);
  const candidates = await db.candidates.findAll({ deleted: false });

  for (const candidate of candidates) {
    const score = calculateMatchScore(jobDetails, candidate);

    await db.matchScores.upsert({
      jobId: job.jobId,
      candidateId: candidate.id,
      matchScore: score.score,
      matchRationale: score.rationale,
      analysisType: 'basic'
    });
  }

  // Notify user
  await createNotification({
    userId: jobDetails.createdBy,
    type: 'analysis_complete',
    message: `Analyzed ${candidates.length} candidates for "${jobDetails.title}"`
  });
}
```

```typescript
// Worker: ai_batch_analysis
// Triggered when: User clicks "Analyze Top 10"
// Purpose: Run deep AI analysis on top candidates

interface AIBatchAnalysisJob {
  jobId: string;
  candidateIds: string[];
  userId: string;
}

async function processAIBatchAnalysis(job: AIBatchAnalysisJob) {
  const jobDetails = await db.jobs.findById(job.jobId);
  let completed = 0;
  let failed = 0;

  for (const candidateId of job.candidateIds) {
    try {
      const candidate = await db.candidates.findById(candidateId);

      // Call Gemini API
      const analysis = await geminiService.analyzeFit(jobDetails, candidate);

      // Save to database
      await db.matchScores.update({
        where: { jobId: job.jobId, candidateId },
        data: {
          matchScore: analysis.matchScore,
          matchRationale: analysis.matchRationale,
          aiAnalysis: analysis,
          analysisType: 'ai_enhanced',
          analyzedAt: new Date()
        }
      });

      completed++;

      // Update progress
      await updateProgress(job.jobId, {
        current: completed + failed,
        total: job.candidateIds.length
      });

      // Rate limiting
      await sleep(500);

    } catch (error) {
      console.error(`Failed to analyze candidate ${candidateId}:`, error);
      failed++;
    }
  }

  // Send completion notification
  await createNotification({
    userId: job.userId,
    type: 'batch_analysis_complete',
    message: `Analyzed ${completed} candidates. ${failed} failed.`
  });
}
```

---

## 🗄️ Database Integration

### Using Prisma ORM

```typescript
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Job {
  id                String    @id @default(uuid())
  title             String
  department        String
  location          String
  description       String    @db.Text
  requiredSkills    Json      @default("[]")
  status            String    @default("open")
  companyContext    Json      @default("{}")
  createdBy         String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  matchScores       MatchScore[]
  feedback          RecruiterFeedback[]

  @@index([status, deletedAt])
  @@index([department])
  @@map("jobs")
}

model Candidate {
  id                String    @id @default(uuid())
  type              String
  name              String
  email             String
  skills            Json      @default("[]")
  cvFileUrl         String?
  metadata          Json      @default("{}")
  profileStatus     String    @default("partial")
  employmentStatus  String    @default("available")
  isHiddenGem       Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  matchScores       MatchScore[]
  feedback          RecruiterFeedback[]

  @@unique([email, deletedAt])
  @@index([type])
  @@index([employmentStatus])
  @@map("candidates")
}

model MatchScore {
  id              String    @id @default(uuid())
  jobId           String
  candidateId     String
  matchScore      Int
  matchRationale  String?   @db.Text
  aiAnalysis      Json?
  analysisType    String    @default("basic")
  analyzedAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  job             Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)
  candidate       Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)

  @@unique([jobId, candidateId])
  @@index([jobId, matchScore])
  @@index([candidateId, matchScore])
  @@map("match_scores")
}
```

---

## 🚀 Deployment Strategy

### Recommended Infrastructure

```
┌─────────────────────────────────────────┐
│           Production Setup              │
└─────────────────────────────────────────┘

Frontend (React):
  ├─ Vercel / Netlify / AWS Amplify
  ├─ CDN: CloudFlare
  └─ Auto-deploy from main branch

Backend (Node.js):
  ├─ AWS ECS / Google Cloud Run / Heroku
  ├─ Auto-scaling: 2-10 instances
  ├─ Load Balancer
  └─ Health checks

Database:
  ├─ AWS RDS PostgreSQL / Supabase
  ├─ Automated backups (daily)
  ├─ Read replicas (for scaling)
  └─ Connection pooling (PgBouncer)

Cache & Queue:
  ├─ AWS ElastiCache (Redis)
  ├─ Separate Redis for cache vs queue
  └─ Persistence enabled

File Storage:
  ├─ AWS S3
  ├─ CDN: CloudFront
  └─ Lifecycle policies (archive old CVs)

Monitoring:
  ├─ Datadog / New Relic
  ├─ Error tracking: Sentry
  ├─ Uptime: Pingdom
  └─ Logs: CloudWatch / Datadog
```

### Environment Variables

```bash
# .env.production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/talent_sonar
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://host:6379
REDIS_CACHE_TTL=3600

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# AI Services
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL_FLASH=gemini-2.5-flash
GEMINI_MODEL_PRO=gemini-2.5-pro

# File Storage
AWS_S3_BUCKET=talent-sonar-cvs
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Email
SENDGRID_API_KEY=...
FROM_EMAIL=noreply@talentsonar.ai

# Monitoring
SENTRY_DSN=...
DATADOG_API_KEY=...

# App
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://app.talentsonar.ai
```

---

## 🔄 Migration Plan

### Phase 1: Setup (Week 1)

**Tasks:**
1. Set up PostgreSQL database
2. Run schema migrations
3. Set up Redis
4. Deploy backend to staging

**Deliverables:**
- ✅ Database running
- ✅ API responding to health checks
- ✅ Documentation updated

---

### Phase 2: Data Migration (Week 2)

**Tasks:**
1. Export data from localStorage
2. Transform to database format
3. Import to PostgreSQL
4. Verify data integrity

**Migration Script:**

```typescript
// scripts/migrate-data.ts

async function migrateFromLocalStorage() {
  // 1. Get data from frontend localStorage backup
  const data = await fs.readFile('localStorage-backup.json', 'utf-8');
  const { jobs, internalCandidates, pastCandidates, uploadedCandidates } = JSON.parse(data);

  // 2. Migrate jobs
  for (const job of jobs) {
    await db.job.create({
      data: {
        id: job.id,
        title: job.title,
        department: job.department,
        location: job.location,
        description: job.description,
        requiredSkills: job.requiredSkills,
        status: job.status,
        companyContext: job.companyContext || {},
        createdAt: new Date(job.postedDate)
      }
    });
  }

  // 3. Migrate candidates
  const allCandidates = [
    ...internalCandidates,
    ...pastCandidates,
    ...uploadedCandidates
  ];

  for (const candidate of allCandidates) {
    await db.candidate.create({
      data: {
        id: candidate.id,
        type: candidate.type,
        name: candidate.name,
        email: candidate.email,
        skills: candidate.skills,
        metadata: getMetadataForType(candidate),
        isHiddenGem: candidate.isHiddenGem || false
      }
    });
  }

  // 4. Migrate match scores
  for (const candidate of allCandidates) {
    if (candidate.matchScores) {
      for (const [jobId, score] of Object.entries(candidate.matchScores)) {
        await db.matchScore.create({
          data: {
            jobId,
            candidateId: candidate.id,
            matchScore: score as number,
            matchRationale: candidate.matchRationales?.[jobId] || null,
            analysisType: 'basic'
          }
        });
      }
    }
  }

  console.log('Migration completed successfully!');
}
```

---

### Phase 3: API Integration (Week 3-4)

**Tasks:**
1. Update frontend to use API instead of localStorage
2. Replace mock data with API calls
3. Add error handling and retry logic
4. Test all features

**Frontend Changes:**

```typescript
// Before (localStorage):
const jobs = localStorage.getItem('talentSonar-jobs');

// After (API):
const jobs = await fetch('/api/v1/jobs').then(r => r.json());
```

---

### Phase 4: Background Jobs (Week 5)

**Tasks:**
1. Set up job queue (Bull)
2. Implement workers
3. Test auto-scoring
4. Test batch analysis

---

### Phase 5: Testing & Launch (Week 6)

**Tasks:**
1. Load testing
2. Security audit
3. User acceptance testing
4. Production deployment

---

## 📈 Scaling Considerations

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| Response time | >500ms | Add API instances |
| Database CPU | >70% | Add read replicas |
| Queue length | >100 jobs | Add workers |
| API errors | >1% | Investigate & fix |

### Cost Estimates

| Component | Monthly Cost (100 users) |
|-----------|--------------------------|
| Hosting (Heroku/AWS) | $50-200 |
| Database (RDS) | $50-100 |
| Redis | $20-50 |
| S3 Storage | $10-30 |
| Gemini API | $50-200 (usage-based) |
| Monitoring | $30-100 |
| **Total** | **$210-680/month** |

---

## ✅ Implementation Checklist

### Backend Development
- [ ] Set up Node.js + Express project
- [ ] Configure TypeScript
- [ ] Set up Prisma ORM
- [ ] Create all API endpoints
- [ ] Add authentication (JWT)
- [ ] Add validation (Zod/Joi)
- [ ] Add error handling
- [ ] Add logging (Winston)
- [ ] Add API documentation (Swagger)
- [ ] Add rate limiting
- [ ] Add CORS configuration

### Database
- [ ] Set up PostgreSQL
- [ ] Run schema migrations
- [ ] Set up connection pooling
- [ ] Configure backups
- [ ] Add indexes
- [ ] Test query performance

### Background Jobs
- [ ] Set up Redis
- [ ] Set up Bull queue
- [ ] Implement workers
- [ ] Add retry logic
- [ ] Add monitoring

### Deployment
- [ ] Set up CI/CD pipeline
- [ ] Configure environments (staging, production)
- [ ] Set up monitoring (Datadog/Sentry)
- [ ] Configure auto-scaling
- [ ] Set up backups
- [ ] Create runbooks

### Testing
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] Load tests
- [ ] Security audit
- [ ] User acceptance testing

---

## 🎯 Success Criteria

After implementation, the system should:

✅ Handle 100+ concurrent users
✅ Respond to API calls in <200ms (95th percentile)
✅ Process CV uploads in <10 seconds
✅ Complete batch analysis in <60 seconds
✅ 99.9% uptime
✅ Zero data loss
✅ Secure (pass security audit)
✅ Scalable (handles 10x growth)

---

**Ready to build the backend? Let's revolutionize recruitment! 🚀**
