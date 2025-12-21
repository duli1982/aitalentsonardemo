# AI Talent Sonar - Complete Application Documentation

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Core Features](#4-core-features)
5. [Data Flow](#5-data-flow)
6. [Autonomous Agents System](#6-autonomous-agents-system)
   - [6.1 Background Job Service](#61-background-job-service)
   - [6.2 Pulse Service](#62-pulse-service)
   - [6.3 Autonomous Sourcing Agent](#63-autonomous-sourcing-agent)
   - [6.4 Autonomous Screening Agent](#64-autonomous-screening-agent)
   - [6.5 Autonomous Scheduling Agent](#65-autonomous-scheduling-agent)
   - [6.6 Autonomous Interview Agent](#66-autonomous-interview-agent)
   - [6.7 Autonomous Analytics Agent](#67-autonomous-analytics-agent)
7. [User Interface Pages](#7-user-interface-pages)
8. [Key Components](#8-key-components)
9. [Data Models](#9-data-models)

---

## 1. Application Overview

**AI Talent Sonar** is an intelligent recruitment platform that leverages AI and autonomous agents to streamline the entire hiring process. The application combines:

- **Semantic Search** - Vector database search for intelligent candidate matching
- **Knowledge Graph** - Relationship mapping between candidates, companies, and schools
- **AI Analysis** - Google Gemini AI for candidate evaluation and insights
- **Autonomous Agents** - Background workers that continuously source, screen, schedule, and analyze candidates
- **Pipeline Management** - Visual recruitment funnel from sourcing to hiring
- **Real-time Notifications** - Pulse Feed for instant updates from autonomous agents

### What the App Does

The app helps recruiters and hiring teams:

1. **Find Candidates Automatically** - Autonomous agents continuously scan your talent pool to match candidates with open jobs
2. **Screen at Scale** - AI conducts initial screening interviews and scores candidates
3. **Schedule Interviews** - Automated negotiation of interview times with candidates
4. **Join Interviews** - AI joins video calls, transcribes, and generates debriefs
5. **Monitor Pipeline Health** - Detects bottlenecks and anomalies in real-time
6. **Make Data-Driven Decisions** - AI-powered fit analysis, match scores, and recommendations

---

## 2. Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe JavaScript
- **React Router** - Client-side routing
- **Lucide React** - Icon library
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tool and dev server

### Backend Services
- **Supabase PostgreSQL** - Vector database + relational database
- **Google Gemini AI (Flash 2.5)** - AI analysis and generation
- **LocalStorage** - Client-side caching and persistence

### Key Libraries
- **@supabase/supabase-js** - Supabase client
- **@google/genai** - Google Gemini API client
- **EventBus** - Custom event system for inter-component communication

### Data Storage
- **Candidate Documents** - Stored in Supabase `candidate_documents` table with vector embeddings
- **Knowledge Graph** - `candidate_companies`, `candidate_schools` many-to-many relationships
- **Agent Results** - LocalStorage for agent outputs (screening results, interview sessions, analytics snapshots)

---

## 3. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          React Application                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │   Jobs     │  │ Candidates │  │  Pipeline  │  │  Insights  │   │
│  │   Page     │  │    Page    │  │    Page    │  │    Page    │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
│         │                │                │               │         │
│         └────────────────┴────────────────┴───────────────┘         │
│                              │                                      │
│                    ┌─────────▼──────────┐                          │
│                    │   Data Context     │                          │
│                    │  (Global State)    │                          │
│                    └─────────┬──────────┘                          │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         │                    │                    │                │
│    ┌────▼─────┐      ┌───────▼────────┐   ┌──────▼──────┐        │
│    │ Gemini   │      │   Supabase     │   │  EventBus   │        │
│    │ Service  │      │    Client      │   │  (Events)   │        │
│    └────┬─────┘      └───────┬────────┘   └──────┬──────┘        │
└─────────┼────────────────────┼────────────────────┼───────────────┘
          │                    │                    │
          │         ┌──────────▼──────────┐         │
          │         │ Autonomous Agents   │◄────────┘
          │         │   System (5 Agents) │
          │         └──────────┬──────────┘
          │                    │
          │         ┌──────────▼──────────┐
          │         │ Background Job      │
          │         │    Service          │
          │         └──────────┬──────────┘
          │                    │
          │         ┌──────────▼──────────┐
          └────────►│  Pulse Service      │
                    │ (Notifications)     │
                    └─────────────────────┘
```

### Core Services Layer

#### 1. **BackgroundJobService**
- Manages all autonomous agents
- Schedules recurring jobs with intervals
- Tracks execution status and results
- Provides enable/disable controls

#### 2. **PulseService**
- Real-time notification system
- Receives events from agents and app components
- Maintains alert history
- Supports severity levels (INFO, WARNING, CRITICAL, OPPORTUNITY)

#### 3. **AIService (Gemini)**
- Candidate fit analysis
- Interview question generation
- Job requirement extraction
- JSON response generation
- Engagement score calculation

#### 4. **SemanticSearchService**
- Vector similarity search in Supabase
- Embedding generation for queries
- Threshold-based filtering
- Result ranking by similarity

#### 5. **SupabaseClient**
- PostgreSQL database connection
- Vector search via pgvector extension
- Knowledge graph queries
- Bulk ingestion support

---

## 4. Core Features

### 4.1 Semantic Candidate Search
- **Vector Embeddings**: Each candidate resume is converted to embeddings and stored in Supabase
- **Smart Matching**: Natural language queries like "Senior React developer with 5 years experience" return semantically similar candidates
- **Match Scoring**: Similarity scores (0-100%) indicate quality of match

### 4.2 Knowledge Graph Integration
- **Entities**: Candidates, Companies, Schools
- **Relationships**:
  - `candidate_companies` - Tracks work history
  - `candidate_schools` - Tracks education history
- **Visual Badges**: Company and school badges displayed on candidate cards
- **Graph Enrichment**: Candidates from Supabase are enriched with company/school data

### 4.3 AI-Powered Analysis
- **Fit Analysis**: Deep evaluation of candidate-job match with pros/cons
- **Interview Guides**: Auto-generated questions based on candidate profile
- **Engagement Scoring**: Predicts candidate interest and responsiveness
- **Batch Analysis**: Analyze multiple candidates for a job at once

### 4.4 Hybrid Data Sources
- **Demo Pool**: 66 static candidates for testing/demo
- **Supabase Pool**: 10,000+ candidates with vector search
- **Toggle Switch**: Easy switching between data sources
- **Consistent UI**: Same enhanced candidate cards across both sources

### 4.5 Pipeline Management
- **8 Pipeline Stages**: Sourced → New → Long List → Screening → Scheduling → Interview → Offer → Hired/Rejected
- **Drag-and-Drop**: Move candidates between stages
- **Stage Counts**: Visual indicators of funnel health
- **Feedback System**: Thumbs up/down with comments per stage

---

## 5. Data Flow

### Candidate Matching Flow

```
1. User creates a Job
   ↓
2. Job is added to global state (DataContext)
   ↓
3. Autonomous Sourcing Agent detects open job
   ↓
4. Agent builds semantic query from job requirements
   ↓
5. SemanticSearchService searches Supabase vector database
   ↓
6. Top matches returned (similarity > 0.75)
   ↓
7. Agent filters out candidates already in pipeline
   ↓
8. Agent emits CANDIDATE_STAGED event via EventBus
   ↓
9. App adds candidate to job's pipeline (stage: "sourced")
   ↓
10. Pulse notification sent to user
```

### AI Analysis Flow

```
1. User clicks "Analyze" on a candidate
   ↓
2. Gemini API receives:
   - Job description & requirements
   - Candidate skills & experience
   ↓
3. AI generates FitAnalysis JSON:
   {
     overallScore: 85,
     technicalMatch: 90,
     culturalMatch: 80,
     recommendation: "HIRE",
     pros: [...],
     cons: [...]
   }
   ↓
4. Analysis stored in candidate.matchScores[jobId]
   ↓
5. UI updates with scores and recommendations
```

### Interview Scheduling Flow

```
1. Candidate advances to "Scheduling" stage
   ↓
2. SchedulingRequest added to agent queue
   ↓
3. Every 2 hours, agent processes queue
   ↓
4. Agent generates time slot options
   ↓
5. (In real app: sends email to candidate)
   ↓
6. (In demo: simulates candidate response)
   ↓
7. Meeting link generated (Google Meet/MS Teams)
   ↓
8. ScheduledInterview object created
   ↓
9. Confirmation sent to candidate
   ↓
10. Pulse notification: "Interview scheduled for [date]"
   ↓
11. Candidate advances to "Interview" stage
```

---

## 6. Autonomous Agents System

### Overview

The application features **5 autonomous agents** that work 24/7 in the background to automate recruitment workflows. Each agent is a separate service that:

- Runs on a scheduled interval (e.g., every 5 minutes, 2 hours, etc.)
- Operates independently without user intervention
- Emits events and notifications via PulseService
- Stores results in LocalStorage for persistence
- Can be enabled/disabled via UI controls

All agents are managed by the **BackgroundJobService** which handles scheduling, execution tracking, and status monitoring.

---

## 6.1 Background Job Service

**File**: `services/BackgroundJobService.ts`

### Purpose
Central orchestrator for all autonomous agents. Manages job registration, scheduling, execution, and monitoring.

### Key Concepts

#### Background Job
```typescript
interface BackgroundJob {
  id: string;               // Unique identifier
  name: string;             // Human-readable name
  type: 'SOURCING' | 'SCREENING' | 'SCHEDULING' | 'MONITORING';
  status: 'idle' | 'running' | 'completed' | 'failed';
  interval: number;         // Milliseconds between runs
  lastRun?: Date;           // Timestamp of last execution
  nextRun?: Date;           // Scheduled next execution
  enabled: boolean;         // Whether the job is active
  handler: () => Promise<void>; // Async function to execute
}
```

### How It Works

#### Step 1: Job Registration
```typescript
const jobId = backgroundJobService.registerJob({
  name: 'Autonomous Candidate Sourcing',
  type: 'SOURCING',
  interval: 5 * 60 * 1000, // 5 minutes
  enabled: true,
  handler: async () => {
    await scanForCandidates();
  }
});
```

#### Step 2: Scheduling
- When a job is registered with `enabled: true`, a JavaScript `setInterval` timer is created
- The timer fires every `interval` milliseconds
- The job's `handler` function is executed on each tick

#### Step 3: Execution
```typescript
async runJob(jobId: string) {
  const job = this.jobs.get(jobId);

  // Prevent concurrent runs
  if (job.status === 'running') return;

  // Update timestamps
  job.status = 'running';
  job.lastRun = new Date();
  job.nextRun = new Date(Date.now() + job.interval);

  try {
    // Execute the handler
    await job.handler();

    job.status = 'completed';

    // Store result
    this.addResult({
      jobId,
      success: true,
      message: 'Job completed successfully',
      timestamp: new Date()
    });

  } catch (error) {
    job.status = 'failed';

    // Store error
    this.addResult({
      jobId,
      success: false,
      message: `Job failed: ${error}`,
      timestamp: new Date()
    });
  }
}
```

#### Step 4: Status Monitoring
- Each job maintains `lastRun` and `nextRun` timestamps
- Recent execution results are stored (max 100 results)
- UI can query job status via `getJob(jobId)` and `getJobResults(jobId)`

#### Step 5: Enable/Disable Control
```typescript
setJobEnabled(jobId: string, enabled: boolean) {
  const job = this.jobs.get(jobId);

  job.enabled = enabled;

  if (enabled) {
    // Start the interval timer
    this.scheduleJob(jobId);
  } else {
    // Clear the timer
    const timer = this.timers.get(jobId);
    clearInterval(timer);
    job.nextRun = undefined;
  }
}
```

### API Methods

| Method | Purpose |
|--------|---------|
| `registerJob(job)` | Add a new background job |
| `runJob(jobId)` | Manually trigger job execution |
| `setJobEnabled(jobId, enabled)` | Enable or disable a job |
| `getJob(jobId)` | Get job details and status |
| `getAllJobs()` | Get all registered jobs |
| `getJobResults(jobId, limit)` | Get recent execution results |
| `shutdown()` | Stop all jobs and clear timers |

---

## 6.2 Pulse Service

**File**: `services/PulseService.ts`

### Purpose
Real-time notification system that receives events from autonomous agents and app components, then displays them as alerts in the UI.

### Key Concepts

#### Pulse Alert
```typescript
interface PulseAlert {
  id: string;
  type: 'ATTRITION_RISK' | 'MARKET_SIGNAL' | 'INTERNAL_MOBILITY' | 'AGENT_ACTION';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'OPPORTUNITY';
  title: string;
  message: string;
  timestamp: string;
  entityId?: string;      // Related candidate/job ID
  isRead: boolean;
}
```

### How It Works

#### Step 1: Event Emission (from agents)
```typescript
pulseService.addEvent({
  type: 'AGENT_ACTION',
  message: 'Sourcing Agent found Sarah Johnson (87% match) for "Senior React Developer"',
  severity: 'info',
  metadata: {
    candidateId: 'c123',
    jobId: 'j456',
    matchScore: 0.87,
    agentType: 'SOURCING'
  }
});
```

#### Step 2: Severity Mapping
The service maps agent severity strings to PulseAlert severity:
- `'success'` → `'OPPORTUNITY'`
- `'warning'` → `'WARNING'`
- `'error'` → `'CRITICAL'`
- `'info'` → `'INFO'`

#### Step 3: Alert Creation
```typescript
private createAlert(partial: Omit<PulseAlert, 'id' | 'timestamp' | 'isRead'>) {
  const alert: PulseAlert = {
    id: `alert_${Date.now()}`,
    timestamp: new Date().toISOString(),
    isRead: false,
    ...partial
  };

  // Add to alerts array (newest first)
  this.alerts.unshift(alert);

  // Notify UI subscribers
  this.notifySubscribers();

  // Emit via EventBus for other listeners
  eventBus.emit(EVENTS.PULSE_ALERT, alert);
}
```

#### Step 4: UI Subscription
```typescript
// Component subscribes to alerts
useEffect(() => {
  const unsubscribe = pulseService.subscribe((alerts) => {
    setAlerts(alerts);
  });

  return unsubscribe;
}, []);
```

#### Step 5: User Interaction
- **Mark as Read**: `pulseService.markAsRead(alertId)`
- **Mark All as Read**: `pulseService.markAllAsRead()`
- **Get Unread Count**: `pulseService.getUnreadCount()`

### Real-World Integration

Pulse Service integrates with:

1. **Autonomous Agents** - All 5 agents emit events for their actions
2. **EventBus** - Listens to system events (CANDIDATE_STAGED, CANDIDATE_HIRED, etc.)
3. **UI Components** - PulseFeed component displays alerts with filtering and search
4. **War Room Page** - Displays critical alerts and real-time monitoring

---

## 6.3 Autonomous Sourcing Agent

**File**: `services/AutonomousSourcingAgent.ts`

### Purpose
Continuously scans the vector database to find candidates matching open job requirements. Works proactively in the background to source candidates while you sleep.

### Configuration
- **Runs Every**: 5 minutes
- **Search Threshold**: 75% similarity (only high-quality matches)
- **Results Per Job**: Top 3 matches per scan
- **Type**: `SOURCING`

### How It Works - Step by Step

#### Step 1: Initialization
```typescript
autonomousSourcingAgent.initialize(jobs);
```

**What Happens:**
1. Checks if already initialized (prevents duplicate registration)
2. Registers a background job with BackgroundJobService
3. Sets up 5-minute recurring interval
4. Logs initialization status

**Code Flow:**
```typescript
initialize(jobs: any[]) {
  if (this.isInitialized) return;

  this.jobId = backgroundJobService.registerJob({
    name: 'Autonomous Candidate Sourcing',
    type: 'SOURCING',
    interval: 5 * 60 * 1000, // 5 minutes
    enabled: true,
    handler: async () => {
      await this.scanForCandidates(jobs);
    }
  });

  this.isInitialized = true;
}
```

#### Step 2: Job Filtering
Every 5 minutes, the handler runs:

```typescript
private async scanForCandidates(jobs: any[]) {
  // Filter for open jobs only
  const openJobs = jobs.filter(job =>
    job.status === 'open' || job.status === 'active'
  );

  if (openJobs.length === 0) {
    console.log('No open jobs to source for');
    return;
  }
```

**Decision Logic:**
- ✅ Include jobs with status `'open'` or `'active'`
- ❌ Skip jobs with status `'closed'` or `'on hold'`

#### Step 3: Build Search Query
For each open job, construct a semantic search query:

```typescript
private buildSearchQuery(job: any): string {
  const parts: string[] = [];

  // Add job title
  if (job.title) {
    parts.push(job.title);
  }

  // Add seniority level
  if (job.seniority) {
    parts.push(job.seniority);
  }

  // Add top 5 required skills
  if (job.requiredSkills && job.requiredSkills.length > 0) {
    parts.push(`with expertise in ${job.requiredSkills.slice(0, 5).join(', ')}`);
  }

  // Add experience requirement
  if (job.experienceRequired) {
    parts.push(`${job.experienceRequired}+ years experience`);
  }

  return parts.join(' ');
}
```

**Example Query:**
```
Job: {
  title: "Senior React Developer",
  seniority: "Senior",
  requiredSkills: ["React", "TypeScript", "Node.js"],
  experienceRequired: 5
}

Generated Query:
"Senior React Developer Senior with expertise in React, TypeScript, Node.js 5+ years experience"
```

#### Step 4: Execute Vector Search
```typescript
const candidates = await semanticSearchService.search(searchQuery, {
  threshold: 0.75,  // 75% minimum match
  limit: 3          // Top 3 matches only
});
```

**What Happens:**
1. Query is converted to embedding vector
2. Supabase performs cosine similarity search against all candidate embeddings
3. Results filtered to only include matches above 75% threshold
4. Top 3 results returned, sorted by similarity score

#### Step 5: Filter Out Duplicates
```typescript
const newCandidates = candidates.filter(candidate => {
  // Check if already in job's pipeline
  const isAlreadyInPipeline = job.candidateIds?.includes(candidate.id);

  // Check if already discovered by agent
  const alreadyDiscovered = this.matches.some(
    m => m.candidateId === candidate.id && m.jobId === job.id
  );

  return !isAlreadyInPipeline && !alreadyDiscovered;
});
```

**Filtering Rules:**
- ❌ Skip if candidate is already in the job's pipeline
- ❌ Skip if agent already discovered this match previously
- ✅ Include only net-new discoveries

#### Step 6: Store Match Record
For each new match:

```typescript
const match: SourcingMatch = {
  jobId: job.id,
  jobTitle: job.title,
  candidateId: candidate.id,
  candidateName: candidate.name,
  matchScore: candidate.similarity,  // e.g., 0.87
  skills: candidate.skills,
  discoveredAt: new Date()
};

this.matches.push(match);
```

#### Step 7: Add Candidate to Pipeline
```typescript
eventBus.emit(EVENTS.CANDIDATE_STAGED, {
  candidateId: candidate.id,
  candidateName: candidate.name,
  jobId: job.id,
  stage: 'sourced',
  source: 'sourcing-agent',
  matchScore: candidate.similarity,
  candidate: {
    id: candidate.id,
    name: candidate.name,
    role: candidate.metadata?.role || 'Candidate',
    skills: candidate.skills || [],
    experience: candidate.metadata?.experience || 0,
    location: candidate.metadata?.location || '',
    email: candidate.email,
    matchScores: { [job.id]: Math.round(candidate.similarity * 100) },
    matchRationale: 'Sourced by Autonomous Sourcing Agent'
  }
});
```

**What Happens:**
1. Event emitted via EventBus
2. App's `useEffect` listener catches the event
3. App validates the candidate isn't moving backwards in pipeline
4. Candidate added to job's pipeline at "sourced" stage
5. If candidate doesn't exist in local state, it's imported from the event payload

#### Step 8: Send Notification
```typescript
pulseService.addEvent({
  type: 'AGENT_ACTION',
  message: `🤖 Sourcing Agent found ${candidate.name} (${Math.round(candidate.similarity * 100)}% match) for "${job.title}"`,
  severity: 'info',
  metadata: {
    candidateId: candidate.id,
    candidateName: candidate.name,
    jobId: job.id,
    jobTitle: job.title,
    matchScore: candidate.similarity,
    agentType: 'SOURCING'
  }
});
```

**Result:**
- Notification appears in Pulse Feed
- User sees: "🤖 Sourcing Agent found Sarah Johnson (87% match) for Senior React Developer"

### Complete Example Flow

```
T=0min: Job "Senior React Developer" posted (status: open)
  ↓
T=5min: Agent scans (first run)
  → Builds query: "Senior React Developer with expertise in React, TypeScript"
  → Searches vector DB
  → Finds: Sarah Johnson (87%), Mike Chen (82%), Lisa Wang (78%)
  → All 3 are new discoveries
  → Adds all 3 to job's pipeline (stage: sourced)
  → Sends 3 Pulse notifications
  ↓
T=10min: Agent scans (second run)
  → Same query
  → Finds same 3 candidates
  → Filters them out (already discovered)
  → No new matches found
  → No notifications sent
  ↓
T=15min: New candidate Emma Davis uploaded to Supabase
  ↓
T=20min: Agent scans (third run)
  → Same query
  → Finds: Sarah (87%), Mike (82%), Lisa (78%), Emma (85%)
  → Filters out Sarah, Mike, Lisa
  → Emma is NEW
  → Adds Emma to pipeline
  → Sends notification: "Sourcing Agent found Emma Davis (85% match)"
```

### Control Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `initialize(jobs)` | Start the agent | `autonomousSourcingAgent.initialize(jobs)` |
| `setEnabled(enabled)` | Pause/resume | `autonomousSourcingAgent.setEnabled(false)` |
| `triggerScan(jobs)` | Run immediately | `await autonomousSourcingAgent.triggerScan(jobs)` |
| `getMatches(jobId?)` | Get discovered matches | `const matches = autonomousSourcingAgent.getMatches('job_123')` |
| `getMatchCount(jobId)` | Count matches per job | `const count = autonomousSourcingAgent.getMatchCount('job_123')` |
| `clearMatches(jobId?)` | Reset match history | `autonomousSourcingAgent.clearMatches()` |
| `getStatus()` | Get agent status | `const status = autonomousSourcingAgent.getStatus()` |

### Status Object
```typescript
{
  initialized: true,
  enabled: true,
  lastRun: Date(2024-01-15T10:30:00Z),
  nextRun: Date(2024-01-15T10:35:00Z),
  totalMatches: 42,
  recentResults: [
    {
      jobId: 'job_1',
      success: true,
      message: 'Found 3 new matches',
      timestamp: Date(2024-01-15T10:30:00Z)
    }
  ]
}
```

---

## 6.4 Autonomous Screening Agent

**File**: `services/AutonomousScreeningAgent.ts`

### Purpose
Conducts automated initial screening interviews with candidates. Asks qualifying questions, scores responses, and filters candidates based on a threshold.

### Configuration
- **Runs Every**: 4 hours
- **Pass Threshold**: 65% score
- **Type**: `SCREENING`
- **Persistence**: LocalStorage (`autonomous_screening_results_v1`)

### How It Works - Step by Step

#### Step 1: Initialization
```typescript
autonomousScreeningAgent.initialize();
```

**What Happens:**
1. Loads persisted screening results from LocalStorage
2. Registers background job with 4-hour interval
3. Sets up queue processing handler

**Code Flow:**
```typescript
initialize() {
  if (this.isInitialized) return;

  this.loadPersistedResults(); // Restore from LocalStorage

  this.jobId = backgroundJobService.registerJob({
    name: 'Autonomous Candidate Screening',
    type: 'SCREENING',
    interval: 4 * 60 * 60 * 1000, // 4 hours
    enabled: true,
    handler: async () => {
      await this.processScreeningQueue();
    }
  });

  this.isInitialized = true;
}
```

#### Step 2: Request Screening
When a candidate is ready for screening:

```typescript
autonomousScreeningAgent.requestScreening({
  candidateId: 'c123',
  candidateName: 'Sarah Johnson',
  candidateEmail: 'sarah@example.com',
  jobId: 'j456',
  jobTitle: 'Senior React Developer',
  jobRequirements: ['React', 'TypeScript', 'Node.js'],
  addedAt: new Date()
});
```

**What Happens:**
1. Screening request added to queue
2. Pulse notification sent: "📞 Screening Agent will conduct initial screen with Sarah Johnson"
3. Request will be processed in next 4-hour cycle

#### Step 3: Queue Processing (every 4 hours)
```typescript
private async processScreeningQueue() {
  if (this.screeningQueue.length === 0) return;

  for (const candidate of this.screeningQueue) {
    // Conduct screening
    const result = await this.conductScreen(candidate);

    // Store result
    this.screeningResults.push(result);
    this.persistResults(); // Save to LocalStorage

    // Determine action
    const shouldPromote =
      result.recommendation === 'STRONG_PASS' ||
      result.recommendation === 'PASS' ||
      result.recommendation === 'BORDERLINE';

    if (shouldPromote) {
      // Move to Long List
      eventBus.emit(EVENTS.CANDIDATE_STAGED, {
        candidateId: candidate.candidateId,
        jobId: candidate.jobId,
        stage: 'long_list',
        source: 'screening-agent',
        score: result.score
      });
    } else {
      // Reject
      eventBus.emit(EVENTS.CANDIDATE_STAGED, {
        candidateId: candidate.candidateId,
        jobId: candidate.jobId,
        stage: 'rejected',
        source: 'screening-agent',
        score: result.score
      });
    }

    // Send Pulse notification
    const emoji = result.passed ? '✅' : '❌';
    pulseService.addEvent({
      type: 'AGENT_ACTION',
      message: `${emoji} ${candidate.candidateName} ${result.passed ? 'passed' : 'did not pass'} initial screening (${result.score}/100)`,
      severity: result.passed ? 'success' : 'warning',
      metadata: {
        candidateId: candidate.candidateId,
        jobId: candidate.jobId,
        score: result.score,
        recommendation: result.recommendation
      }
    });
  }

  // Clear queue
  this.screeningQueue = [];
}
```

#### Step 4: Conduct Screening Interview
```typescript
private async conductScreen(candidate: ScreeningCandidate): Promise<ScreeningResult> {
  // 4a. Generate screening questions
  const questions = this.generateQuestions(candidate.jobRequirements);

  // Example questions:
  // - "Tell me about your experience with React."
  // - "Tell me about your experience with TypeScript."
  // - "Why are you interested in this role?"
  // - "What are your salary expectations?"
  // - "When would you be available to start?"

  // 4b. Simulate candidate responses
  const qaResults = await this.simulateScreening(questions, candidate);

  // 4c. Calculate average score
  const avgScore = qaResults.reduce((sum, qa) => sum + qa.score, 0) / qaResults.length;
  const passed = avgScore >= 65; // 65% threshold

  // 4d. Determine recommendation
  let recommendation: 'STRONG_PASS' | 'PASS' | 'BORDERLINE' | 'FAIL';
  if (avgScore >= 85) recommendation = 'STRONG_PASS';
  else if (avgScore >= 65) recommendation = 'PASS';
  else if (avgScore >= 50) recommendation = 'BORDERLINE';
  else recommendation = 'FAIL';

  // 4e. Generate AI summary
  const summary = await this.generateSummary(candidate, qaResults, avgScore);

  return {
    id: `screen_${Date.now()}_${randomId}`,
    candidateId: candidate.candidateId,
    candidateName: candidate.candidateName,
    jobId: candidate.jobId,
    jobTitle: candidate.jobTitle,
    score: Math.round(avgScore),
    passed,
    questions: qaResults,
    recommendation,
    summary,
    screenedAt: new Date()
  };
}
```

#### Step 5: Question Generation
```typescript
private generateQuestions(requirements: string[]): string[] {
  const questions: string[] = [];

  // Add requirement-specific questions (top 3)
  requirements.slice(0, 3).forEach(req => {
    questions.push(`Tell me about your experience with ${req}.`);
  });

  // Add general questions
  questions.push('Why are you interested in this role?');
  questions.push('What are your salary expectations?');
  questions.push('When would you be available to start?');

  return questions;
}
```

#### Step 6: Answer Simulation & Scoring
**Note:** In production, this would integrate with email/chat to get real candidate responses. For demo purposes, it simulates responses.

```typescript
private async simulateScreening(questions: string[], candidate: ScreeningCandidate) {
  const results: { question: string; answer: string; score: number }[] = [];

  for (const question of questions) {
    // Generate mock answer
    const answer = this.generateMockAnswer(question);

    // Score the answer (50-95 random for demo)
    // In production: Use AI to evaluate answer quality
    const score = 50 + Math.floor(Math.random() * 45);

    results.push({ question, answer, score });

    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay
  }

  return results;
}
```

**Production Implementation Would:**
1. Send email with screening questions
2. Parse candidate's email reply
3. Use AI (Gemini) to score answers based on:
   - Relevance to question
   - Technical accuracy
   - Communication clarity
   - Depth of experience

#### Step 7: AI Summary Generation
```typescript
private async generateSummary(
  candidate: ScreeningCandidate,
  qaResults: any[],
  avgScore: number
): Promise<string> {

  if (!aiService.isAvailable()) {
    // Fallback summary
    return `Automated screening completed with ${Math.round(avgScore)}% match.`;
  }

  // In production: Use AI to generate comprehensive summary
  // For demo: Return random summary
  const summaries = [
    'Strong candidate with solid technical background. Recommended for technical interview.',
    'Candidate shows promise but needs deeper evaluation. Schedule follow-up.',
    'Excellent fit for role requirements. Fast-track to hiring manager interview.',
    'Candidate lacks some key requirements but shows learning potential.'
  ];

  return summaries[Math.floor(Math.random() * summaries.length)];
}
```

#### Step 8: Result Storage
```typescript
private persistResults() {
  const trimmed = this.screeningResults.slice(0, 500); // Max 500 results

  localStorage.setItem(
    'autonomous_screening_results_v1',
    JSON.stringify(trimmed.map(r => ({
      ...r,
      screenedAt: r.screenedAt.toISOString()
    })))
  );
}
```

### Scoring Thresholds

| Score Range | Recommendation | Action |
|-------------|----------------|--------|
| 85-100 | STRONG_PASS | Move to Long List |
| 65-84 | PASS | Move to Long List |
| 50-64 | BORDERLINE | Move to Long List (with caution) |
| 0-49 | FAIL | Move to Rejected |

### Complete Example Flow

```
T=0: Candidate Sarah reaches "Screening" stage
  ↓
  ScreeningRequest added to queue:
  {
    candidateName: 'Sarah Johnson',
    jobTitle: 'Senior React Developer',
    jobRequirements: ['React', 'TypeScript', 'Node.js']
  }
  ↓
  Pulse notification: "📞 Screening Agent will conduct screen with Sarah"
  ↓
T=4hrs: Agent processes queue
  ↓
  Generates 6 questions:
  1. "Tell me about your experience with React."
  2. "Tell me about your experience with TypeScript."
  3. "Tell me about your experience with Node.js."
  4. "Why are you interested in this role?"
  5. "What are your salary expectations?"
  6. "When would you be available to start?"
  ↓
  Simulates Q&A:
  Q1: Score 92
  Q2: Score 88
  Q3: Score 85
  Q4: Score 78
  Q5: Score 80
  Q6: Score 90
  ↓
  Average Score: 85.5 → STRONG_PASS
  ↓
  Generates summary: "Excellent technical background. Strong React and TypeScript skills demonstrated."
  ↓
  Stores result in LocalStorage
  ↓
  Emits CANDIDATE_STAGED event → stage: 'long_list'
  ↓
  Pulse notification: "✅ Sarah Johnson passed initial screening (86/100). Recommendation: STRONG_PASS"
  ↓
  Sarah appears in "Long List" column on Pipeline page
```

### Control Methods

| Method | Purpose |
|--------|---------|
| `initialize()` | Start the agent |
| `requestScreening(request)` | Add candidate to queue |
| `setEnabled(enabled)` | Pause/resume agent |
| `triggerScreening()` | Process queue immediately |
| `getResults()` | Get all screening results |
| `getResultsForCandidate(candidateId)` | Get candidate's screening history |
| `getResultsForJob(jobId)` | Get job's screening results |
| `getPassedCandidates()` | Get all candidates who passed |
| `getStatus()` | Get agent status |

### Screening Result Object
```typescript
{
  id: 'screen_1234567890_abc123',
  candidateId: 'c123',
  candidateName: 'Sarah Johnson',
  jobId: 'j456',
  jobTitle: 'Senior React Developer',
  score: 86,
  passed: true,
  questions: [
    {
      question: 'Tell me about your experience with React.',
      answer: 'I have 5 years of experience with React...',
      score: 92
    },
    // ... more Q&A pairs
  ],
  recommendation: 'STRONG_PASS',
  summary: 'Excellent technical background. Strong React and TypeScript skills.',
  screenedAt: Date(2024-01-15T14:30:00Z)
}
```

---

## 6.5 Autonomous Scheduling Agent

**File**: `services/AutonomousSchedulingAgent.ts`

### Purpose
Automatically negotiates interview times with candidates, sends emails, parses responses, books calendar slots, and generates meeting links (Google Meet / MS Teams).

### Configuration
- **Runs Every**: 2 hours
- **Meeting Providers**: Google Meet, MS Teams
- **Type**: `SCHEDULING`
- **Persistence**: LocalStorage (`autonomous_scheduling_interviews_v1`)

### How It Works - Step by Step

#### Step 1: Initialization
```typescript
autonomousSchedulingAgent.initialize();
```

**What Happens:**
1. Loads persisted scheduled interviews from LocalStorage
2. Registers background job with 2-hour interval
3. Sets default meeting provider (Google Meet)

#### Step 2: Request Scheduling
When a candidate reaches "Scheduling" stage:

```typescript
autonomousSchedulingAgent.requestScheduling({
  candidateId: 'c123',
  candidateName: 'Sarah Johnson',
  candidateEmail: 'sarah@example.com',
  jobId: 'j456',
  jobTitle: 'Senior React Developer',
  interviewType: 'video', // or 'phone' | 'onsite'
  requestedAt: new Date()
});
```

**What Happens:**
1. Request added to scheduling queue
2. Pulse notification: "🗓️ Scheduling Agent will contact Sarah Johnson to book a video interview"

#### Step 3: Queue Processing (every 2 hours)
```typescript
private async processSchedulingQueue() {
  if (this.schedulingQueue.length === 0) return;

  for (const request of this.schedulingQueue) {
    try {
      // 3a. Send scheduling email to candidate
      await this.sendSchedulingEmail(request);

      // 3b. Generate available time slots
      const proposedSlots = this.generateTimeSlots();

      // 3c. Simulate candidate selecting a slot
      const selectedSlot = await this.simulateCandidateResponse(proposedSlots);

      // 3d. Generate meeting link
      const meetingLink = this.generateMeetingLink(this.meetingProvider);

      // 3e. Create scheduled interview
      const interview: ScheduledInterview = {
        id: `interview_${Date.now()}_${randomId}`,
        candidateId: request.candidateId,
        candidateName: request.candidateName,
        jobId: request.jobId,
        jobTitle: request.jobTitle,
        interviewType: request.interviewType,
        scheduledTime: selectedSlot,
        meetingProvider: this.meetingProvider, // 'google_meet' or 'ms_teams'
        meetingLink,
        status: 'confirmed',
        confirmationSentAt: new Date()
      };

      this.scheduledInterviews.push(interview);
      this.persistInterviews(); // Save to LocalStorage

      // 3f. Send confirmation to candidate
      await this.sendConfirmation(interview);

      // 3g. Send Pulse notification
      pulseService.addEvent({
        type: 'AGENT_ACTION',
        message: `✅ Scheduled video interview with ${request.candidateName} for ${selectedSlot.toLocaleString()} (Google Meet)`,
        severity: 'success',
        metadata: {
          candidateId: request.candidateId,
          jobId: request.jobId,
          interviewTime: selectedSlot.toISOString(),
          meetingLink
        }
      });

    } catch (error) {
      // Handle failure
      pulseService.addEvent({
        type: 'AGENT_ACTION',
        message: `⚠️ Scheduling Agent couldn't reach ${request.candidateName}. Manual follow-up needed.`,
        severity: 'warning'
      });
    }
  }

  // Clear queue
  this.schedulingQueue = [];
}
```

#### Step 4: Email Communication (Production)
**Demo Implementation:**
```typescript
private async sendSchedulingEmail(request: SchedulingRequest): Promise<void> {
  console.log(`Sending email to ${request.candidateEmail}...`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
}
```

**Production Implementation Would:**
1. Use email service (SendGrid, AWS SES, Gmail API)
2. Send email with calendar link (Calendly, Cal.com)
3. Track email opens/clicks
4. Parse email replies for time selection

**Example Email:**
```
Subject: Interview Invitation - Senior React Developer at TalentCorp

Hi Sarah,

We'd love to schedule a video interview with you for the Senior React Developer position.

Please select your preferred time slot:
□ Tuesday, Jan 16 at 10:00 AM EST
□ Thursday, Jan 18 at 12:00 PM EST
□ Friday, Jan 19 at 2:00 PM EST

Click here to confirm: [Calendar Link]

Looking forward to speaking with you!

Best,
TalentCorp Recruiting Team
```

#### Step 5: Time Slot Generation
```typescript
private generateTimeSlots(): Date[] {
  const slots: Date[] = [];
  const now = new Date();

  // Generate 3 slots over next week
  for (let i = 1; i <= 3; i++) {
    const slot = new Date(now);
    slot.setDate(now.getDate() + i * 2);  // Every 2 days
    slot.setHours(10 + i, 0, 0, 0);        // 11 AM, 12 PM, 1 PM
    slots.push(slot);
  }

  return slots;
}
```

**Example Output:**
```
[
  Date(2024-01-16 11:00:00),  // 2 days from now
  Date(2024-01-18 12:00:00),  // 4 days from now
  Date(2024-01-20 13:00:00)   // 6 days from now
]
```

**Production Implementation Would:**
- Query Google Calendar API for recruiter availability
- Check candidate's timezone
- Avoid weekends and holidays
- Respect business hours

#### Step 6: Candidate Response Simulation
```typescript
private async simulateCandidateResponse(slots: Date[]): Promise<Date> {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay

  // 80% accept first slot, 20% second slot
  return Math.random() < 0.8 ? slots[0] : slots[1];
}
```

**Production Implementation Would:**
1. Wait for candidate's email reply
2. Parse email content for selected time
3. Use NLP to extract date/time from text
4. Confirm time is still available
5. Handle conflicts and rescheduling

#### Step 7: Meeting Link Generation
```typescript
private generateMeetingLink(provider: 'google_meet' | 'ms_teams'): string {
  if (provider === 'ms_teams') {
    return `https://teams.microsoft.com/l/meetup-join/placeholder-${Date.now()}`;
  }

  return 'https://meet.google.com/new';
}
```

**Production Implementation:**
- **Google Meet**: Use Google Calendar API to create event with `conferenceData`
- **MS Teams**: Use Microsoft Graph API to create online meeting
- Returns actual meeting URL with unique room ID

#### Step 8: Confirmation Email
```typescript
private async sendConfirmation(interview: ScheduledInterview): Promise<void> {
  console.log(`Sending confirmation to ${interview.candidateName}...`);
  await new Promise(resolve => setTimeout(resolve, 300));
}
```

**Production Email Would Include:**
- Calendar invite (.ics file)
- Meeting link (Google Meet / MS Teams)
- Interview details (type, duration, interviewer names)
- CC: Hiring manager and recruiter
- Add to company calendar

**Example Confirmation:**
```
Subject: Interview Confirmed - Tuesday, Jan 16 at 11:00 AM

Hi Sarah,

Your interview for Senior React Developer is confirmed!

📅 Date: Tuesday, January 16, 2024
🕐 Time: 11:00 AM EST (1 hour)
🎥 Type: Video Interview
🔗 Join Meeting: https://meet.google.com/abc-defg-hij

Interviewers:
- John Smith (Engineering Manager)
- Lisa Chen (Senior Developer)

Please join 5 minutes early to test your audio/video.

See you then!

Best,
TalentCorp Recruiting Team

[.ics calendar attachment]
```

#### Step 9: Rescheduling Support
```typescript
autonomousSchedulingAgent.requestReschedule({
  interviewId: 'interview_123',
  requestedBy: 'candidate', // or 'hiring_manager'
  reason: 'Conflict with another commitment',
  requestedAt: new Date()
});
```

**Reschedule Flow:**
1. Request added to reschedule queue
2. Agent proposes new time slots (avoiding previous time)
3. Candidate selects new time
4. Meeting updated
5. Reschedule history recorded
6. New confirmation sent

**Reschedule History Tracking:**
```typescript
interface RescheduleHistoryEntry {
  previousTime: Date(2024-01-16 11:00:00),
  newTime: Date(2024-01-18 14:00:00),
  requestedBy: 'candidate',
  reason: 'Conflict with another commitment',
  requestedAt: Date(2024-01-15 09:30:00),
  processedAt: Date(2024-01-15 10:00:00)
}
```

### Complete Example Flow

```
T=0: Sarah reaches "Scheduling" stage
  ↓
  SchedulingRequest added to queue:
  {
    candidateName: 'Sarah Johnson',
    candidateEmail: 'sarah@example.com',
    jobTitle: 'Senior React Developer',
    interviewType: 'video'
  }
  ↓
  Pulse: "🗓️ Scheduling Agent will contact Sarah to book video interview"
  ↓
T=2hrs: Agent processes queue
  ↓
  Sends email to sarah@example.com with 3 time slot options:
  - Tuesday Jan 16, 11 AM
  - Thursday Jan 18, 12 PM
  - Friday Jan 19, 1 PM
  ↓
  (Simulates 2-day wait for response)
  ↓
  Sarah selects: Tuesday Jan 16, 11 AM
  ↓
  Agent generates Google Meet link: https://meet.google.com/abc-defg-hij
  ↓
  Creates ScheduledInterview object:
  {
    candidateName: 'Sarah Johnson',
    scheduledTime: Date(2024-01-16 11:00:00),
    meetingProvider: 'google_meet',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    status: 'confirmed'
  }
  ↓
  Stores in LocalStorage
  ↓
  Sends confirmation email with calendar invite
  ↓
  Pulse: "✅ Scheduled video interview with Sarah Johnson for Tue Jan 16, 11:00 AM (Google Meet)"
  ↓
  Sarah's stage auto-advances to "Interview"
  ↓
T=Jan 16 11:00 AM: Interview time!
  (Interview Agent can join the call)
```

### Control Methods

| Method | Purpose |
|--------|---------|
| `initialize()` | Start the agent |
| `requestScheduling(request)` | Add to scheduling queue |
| `requestReschedule(request)` | Request time change |
| `setMeetingProvider(provider)` | Switch Google Meet / MS Teams |
| `getMeetingProvider()` | Get current provider |
| `getScheduledInterviews()` | Get all interviews |
| `getUpcomingInterviews()` | Get next 7 days |
| `setEnabled(enabled)` | Pause/resume |
| `triggerProcessing()` | Process queue now |
| `getStatus()` | Get agent status |

### Scheduled Interview Object
```typescript
{
  id: 'interview_1234567890_abc123',
  candidateId: 'c123',
  candidateName: 'Sarah Johnson',
  jobId: 'j456',
  jobTitle: 'Senior React Developer',
  interviewType: 'video',
  scheduledTime: Date(2024-01-16T16:00:00Z),
  meetingProvider: 'google_meet',
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  status: 'confirmed',
  confirmationSentAt: Date(2024-01-15T10:00:00Z),
  rescheduleHistory: [
    {
      previousTime: Date(2024-01-15T15:00:00Z),
      newTime: Date(2024-01-16T16:00:00Z),
      requestedBy: 'candidate',
      reason: 'Schedule conflict',
      requestedAt: Date(2024-01-14T12:00:00Z),
      processedAt: Date(2024-01-14T14:00:00Z)
    }
  ]
}
```

---

## 6.6 Autonomous Interview Agent

**File**: `services/AutonomousInterviewAgent.ts`

### Purpose
Joins interview calls (Google Meet / MS Teams), transcribes conversations in real-time, tracks question coverage, nudges when key questions are missed, and generates comprehensive debrief documents.

### Configuration
- **Runs Every**: 1 hour (heartbeat/monitoring)
- **Type**: `MONITORING`
- **Persistence**: LocalStorage (`autonomous_interview_sessions_v1`)
- **Max Sessions**: 200

### How It Works - Step by Step

#### Step 1: Initialization
```typescript
autonomousInterviewAgent.initialize();
```

**What Happens:**
1. Loads persisted interview sessions from LocalStorage
2. Registers heartbeat job (monitors upcoming interviews)
3. Ready to start interview sessions

#### Step 2: Start Interview Session
When an interview is about to begin:

```typescript
const session = autonomousInterviewAgent.startSession({
  interview: scheduledInterview, // Optional: from Scheduling Agent
  candidate: candidate,
  job: job
});
```

**What Happens:**
```typescript
startSession(params: { interview?, candidate, job }) {
  const questions = this.buildBaselineQuestions(job, candidate);

  const session: InterviewSession = {
    id: `int_session_${Date.now()}_${randomId}`,
    interviewId: interview?.id,
    candidateId: candidate.id,
    candidateName: candidate.name,
    jobId: job.id,
    jobTitle: job.title,
    meetingProvider: interview?.meetingProvider || 'google_meet',
    meetingLink: interview?.meetingLink || 'https://meet.google.com/new',
    startedAt: new Date(),
    questions: questions,           // Questions to cover
    transcript: [],                 // Empty at start
    missingQuestions: questions     // All questions initially missing
  };

  this.sessions.unshift(session);
  this.persistSessions();

  pulseService.addEvent({
    type: 'AGENT_ACTION',
    message: `Interview Agent started session for ${candidate.name} (${job.title}).`,
    severity: 'success'
  });

  return session;
}
```

#### Step 3: Baseline Question Generation
```typescript
private buildBaselineQuestions(job: Job, candidate: Candidate): string[] {
  const questions: string[] = [];

  // Add questions for required skills (top 4)
  (job.requiredSkills || []).slice(0, 4).forEach(skill => {
    questions.push(`Tell me about your experience with ${skill}.`);
  });

  // Add behavioral questions
  questions.push('Walk me through a recent project you're proud of.');
  questions.push('What's a difficult problem you solved recently, and how did you approach it?');
  questions.push('What are you looking for in your next role?');
  questions.push('Do you have any questions for us?');

  // Add candidate-specific follow-ups if needed
  if (questions.length < 6 && candidate.skills?.length > 0) {
    questions.push(`How have you used ${candidate.skills[0]} in production?`);
  }

  return questions;
}
```

**Example Questions:**
```
Job: Senior React Developer
Candidate: Sarah Johnson (skills: React, TypeScript, Node.js)

Generated Questions:
1. "Tell me about your experience with React."
2. "Tell me about your experience with TypeScript."
3. "Tell me about your experience with Node.js."
4. "Tell me about your experience with GraphQL."
5. "Walk me through a recent project you're proud of."
6. "What's a difficult problem you solved recently?"
7. "What are you looking for in your next role?"
8. "Do you have any questions for us?"
```

#### Step 4: Real-Time Transcript Capture
As the interview progresses, transcript lines are added:

```typescript
autonomousInterviewAgent.addTranscriptLine(sessionId, {
  speaker: 'interviewer',
  text: 'Hi Sarah, thanks for joining. Can you tell me about your experience with React?'
});

autonomousInterviewAgent.addTranscriptLine(sessionId, {
  speaker: 'candidate',
  text: 'Sure! I've been working with React for about 5 years, primarily building...'
});
```

**What Happens:**
```typescript
addTranscriptLine(sessionId: string, line: { speaker, text }) {
  const session = this.getSessionById(sessionId);
  if (!session) return;

  const entry: InterviewTranscriptLine = {
    id: `tl_${Date.now()}_${randomId}`,
    timestamp: new Date(),
    speaker: line.speaker, // 'interviewer' | 'candidate' | 'system'
    text: line.text
  };

  session.transcript.push(entry);

  // Update missing questions
  session.missingQuestions = this.computeMissingQuestions(
    session.questions,
    session.transcript
  );

  this.persistSessions();
}
```

#### Step 5: Question Coverage Tracking
```typescript
private computeMissingQuestions(
  questions: string[],
  transcript: InterviewTranscriptLine[]
): string[] {

  const joined = transcript
    .map(t => t.text)
    .join(' ')
    .toLowerCase();

  return questions.filter(q => {
    const key = this.extractQuestionKey(q);
    if (!key) return false;

    // Check if key appears in transcript
    return !joined.includes(key.toLowerCase());
  });
}

private extractQuestionKey(question: string): string {
  // For "experience with X", key on X
  const match = /experience with\s+(.+?)\./i.exec(question);
  if (match?.[1]) return match[1].trim();

  // Otherwise, extract significant words
  const cleaned = question
    .replace(/[^\w\s]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(w =>
      w.length >= 4 &&
      !['what', 'when', 'that', 'this', 'your', 'have'].includes(w)
    );

  return cleaned.slice(0, 3).join(' ');
}
```

**Example:**
```
Question: "Tell me about your experience with React."
Key: "React"

Transcript includes: "...I've been working with React for 5 years..."
Result: Question is COVERED (not in missingQuestions)

Question: "Tell me about your experience with GraphQL."
Key: "GraphQL"

Transcript does NOT include "GraphQL"
Result: Question is MISSING (in missingQuestions)
```

#### Step 6: Real-Time Nudging (Production)
**Note:** In a production app with UI integration, the agent would display nudges:

```typescript
// If missingQuestions.length > 0 and interview is > 30 minutes:
UI displays:
"⚠️ Missing Key Questions:
- Experience with GraphQL
- Difficult problem solving example
Consider asking these before wrapping up."
```

#### Step 7: Generate AI Question Set (Optional)
For more advanced questioning:

```typescript
await autonomousInterviewAgent.generateQuestionSet(sessionId, candidate, job);
```

**What Happens:**
```typescript
async generateQuestionSet(sessionId: string, candidate: Candidate, job: Job) {
  const session = this.getSessionById(sessionId);
  if (!session) return;

  // Use Gemini to generate tailored questions
  const response = await aiService.generateInterviewQuestions(
    candidate.skills || [],
    job.title,
    8 // Number of questions
  );

  if (response.success && response.data) {
    session.questions = response.data;
    session.missingQuestions = this.computeMissingQuestions(
      session.questions,
      session.transcript
    );
    this.persistSessions();
  }
}
```

**AI-Generated Questions Might Include:**
```
1. "Describe your approach to state management in large React applications."
2. "How do you handle performance optimization in React?"
3. "Walk me through your TypeScript type system design process."
4. "Describe a time you had to refactor a legacy React codebase."
5. "How do you ensure code quality and maintainability?"
6. "What's your approach to testing React components?"
7. "Describe your experience with CI/CD pipelines."
8. "How do you stay current with React ecosystem changes?"
```

#### Step 8: End Session & Generate Debrief
When the interview concludes:

```typescript
await autonomousInterviewAgent.endSession(sessionId);
```

**What Happens:**
```typescript
async endSession(sessionId: string) {
  const session = this.getSessionById(sessionId);
  if (!session || session.endedAt) return;

  session.endedAt = new Date();
  session.missingQuestions = this.computeMissingQuestions(
    session.questions,
    session.transcript
  );

  // Generate AI debrief
  session.debrief = await this.generateDebrief(session);

  this.persistSessions();

  pulseService.addEvent({
    type: 'AGENT_ACTION',
    message: `Interview Agent generated debrief for ${session.candidateName}.`,
    severity: 'success'
  });
}
```

#### Step 9: AI Debrief Generation
```typescript
private async generateDebrief(session: InterviewSession): Promise<InterviewDebrief> {
  const transcriptText = session.transcript
    .map(t => `[${t.speaker}] ${t.text}`)
    .join('\n');

  const prompt = `You are an interview assistant. Create a concise debrief.
Job: ${session.jobTitle}
Candidate: ${session.candidateName}
Key questions: ${session.questions.join(' | ')}
Missing questions: ${session.missingQuestions.join(' | ') || 'None'}

Transcript:
${transcriptText || '(no transcript)'}

Return JSON:
{
  "summary": "...",
  "strengths": ["..."],
  "concerns": ["..."],
  "recommendedNextSteps": ["..."],
  "suggestedFollowUps": ["..."]
}`;

  const response = await aiService.generateJson<InterviewDebrief>(prompt);

  if (response.success && response.data) {
    return response.data;
  }

  // Fallback debrief
  return {
    summary: `Interview completed for ${session.candidateName}. Missing ${session.missingQuestions.length} questions.`,
    strengths: ['Communicates clearly', 'Relevant experience signals'],
    concerns: session.missingQuestions.length ? ['Some topics not covered'] : [],
    recommendedNextSteps: ['Schedule technical interview', 'Collect references'],
    suggestedFollowUps: session.missingQuestions.slice(0, 3)
  };
}
```

**Example Debrief:**
```json
{
  "summary": "Strong interview with Sarah Johnson. Demonstrated deep React expertise and solid problem-solving skills. Minor gap in GraphQL experience but shows willingness to learn.",
  "strengths": [
    "5 years of production React experience",
    "Strong understanding of TypeScript type systems",
    "Clear communication and structured thinking",
    "Impressive project portfolio with measurable impact"
  ],
  "concerns": [
    "Limited GraphQL experience (mentioned only briefly)",
    "Didn't cover scaling/performance optimization in depth",
    "No discussion of leadership or mentoring experience"
  ],
  "recommendedNextSteps": [
    "Schedule technical deep-dive with senior engineer",
    "Request code samples or GitHub portfolio review",
    "Conduct culture-fit interview with team lead"
  ],
  "suggestedFollowUps": [
    "Can you describe your approach to performance optimization?",
    "Have you mentored junior developers?",
    "Walk me through your most complex React architecture"
  ]
}
```

### Complete Example Flow

```
T=0: Interview scheduled for Tuesday Jan 16, 11 AM
  ↓
T=Jan 16 10:55 AM: Interviewer starts session
  ↓
  autonomousInterviewAgent.startSession({
    candidate: Sarah Johnson,
    job: Senior React Developer
  })
  ↓
  Session created with 8 baseline questions
  Pulse: "Interview Agent started session for Sarah Johnson"
  ↓
T=11:00 AM: Interview begins
  ↓
  Interviewer: "Hi Sarah, tell me about your experience with React."
  addTranscriptLine({ speaker: 'interviewer', text: '...' })
  ↓
  Sarah: "I've been working with React for 5 years..."
  addTranscriptLine({ speaker: 'candidate', text: '...' })
  ↓
  Agent tracks: Question 1 ("experience with React") → COVERED
  missingQuestions: [Q2, Q3, Q4, Q5, Q6, Q7, Q8]
  ↓
  [Interview continues for 45 minutes]
  ↓
  Transcript grows to 42 lines
  missingQuestions: [Q4 (GraphQL), Q8 (any questions for us)]
  ↓
  (In production: UI nudges interviewer)
  "⚠️ Consider asking: Experience with GraphQL"
  ↓
T=11:45 AM: Interview ends
  ↓
  autonomousInterviewAgent.endSession(sessionId)
  ↓
  Agent generates AI debrief:
  - Summary: "Strong React expertise, minor GraphQL gap"
  - Strengths: [5 items]
  - Concerns: [2 items]
  - Next Steps: [3 items]
  - Follow-ups: [2 questions]
  ↓
  Debrief stored in session
  ↓
  Pulse: "Interview Agent generated debrief for Sarah Johnson"
  ↓
  Interviewer can view full debrief in UI
```

### Control Methods

| Method | Purpose |
|--------|---------|
| `initialize()` | Start the agent |
| `startSession(params)` | Begin interview session |
| `addTranscriptLine(sessionId, line)` | Add transcript entry |
| `generateQuestionSet(sessionId, candidate, job)` | Generate AI questions |
| `endSession(sessionId)` | End session & generate debrief |
| `getSessionById(id)` | Get session details |
| `getSessions()` | Get all sessions (sorted) |
| `getSessionsForCandidate(candidateId)` | Get candidate's interview history |
| `getSessionsForJob(jobId)` | Get job's interviews |
| `setEnabled(enabled)` | Pause/resume heartbeat |
| `getStatus()` | Get agent status |

### Interview Session Object
```typescript
{
  id: 'int_session_1234567890_abc123',
  interviewId: 'interview_456',
  candidateId: 'c123',
  candidateName: 'Sarah Johnson',
  jobId: 'j456',
  jobTitle: 'Senior React Developer',
  meetingProvider: 'google_meet',
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  startedAt: Date(2024-01-16T16:00:00Z),
  endedAt: Date(2024-01-16T16:45:00Z),
  questions: [
    "Tell me about your experience with React.",
    "Tell me about your experience with TypeScript.",
    // ... 6 more
  ],
  transcript: [
    {
      id: 'tl_1',
      timestamp: Date(2024-01-16T16:01:00Z),
      speaker: 'interviewer',
      text: 'Hi Sarah, tell me about your React experience.'
    },
    {
      id: 'tl_2',
      timestamp: Date(2024-01-16T16:01:15Z),
      speaker: 'candidate',
      text: 'I've been working with React for 5 years...'
    },
    // ... 40 more lines
  ],
  missingQuestions: [
    "Tell me about your experience with GraphQL.",
    "Do you have any questions for us?"
  ],
  debrief: {
    summary: "Strong interview...",
    strengths: [...],
    concerns: [...],
    recommendedNextSteps: [...],
    suggestedFollowUps: [...]
  }
}
```

---

## 6.7 Autonomous Analytics Agent

**File**: `services/AutonomousAnalyticsAgent.ts`

### Purpose
Monitors pipeline health, talent pool metrics, and hiring velocity. Detects anomalies like bottlenecks, velocity drops, and data quality issues. Emits proactive alerts to prevent problems before they escalate.

### Configuration
- **Runs Every**: 30 minutes
- **Type**: `MONITORING`
- **Persistence**: LocalStorage (`autonomous_analytics_snapshots_v1`, `autonomous_analytics_alerts_v1`)
- **Max Snapshots**: 500
- **Max Alerts**: 500

### How It Works - Step by Step

#### Step 1: Initialization
```typescript
autonomousAnalyticsAgent.initialize(jobs, candidates);
```

**What Happens:**
1. Registers background job with 30-minute interval
2. Sets up handler to run analytics every 30 minutes
3. Ready to capture pipeline snapshots

**Code Flow:**
```typescript
initialize(jobs: any[], candidates: any[]) {
  if (this.isInitialized) return;

  this.jobId = backgroundJobService.registerJob({
    name: 'Autonomous Pipeline Analytics',
    type: 'MONITORING',
    interval: 30 * 60 * 1000, // 30 minutes
    enabled: true,
    handler: async () => {
      await this.runAnalysis(jobs, candidates);
    }
  });

  this.isInitialized = true;
}
```

#### Step 2: Analytics Run (every 30 minutes)
```typescript
private async runAnalysis(jobs: any[], candidates: any[]) {
  // 2a. Filter for open jobs
  const openJobs = jobs.filter(j =>
    j.status === 'open' || j.status === 'active'
  );

  // 2b. Count candidates by stage
  const pipeline = countByStageOverall(candidates, openJobs);

  // 2c. Fetch Supabase candidate count
  const supabaseCandidateCount = await this.fetchSupabaseCandidateCount();

  // 2d. Create snapshot
  const snapshot: PipelineSnapshot = {
    id: `snap_${Date.now()}_${randomId}`,
    createdAt: new Date().toISOString(),
    openJobs: openJobs.length,
    pipeline: {
      totalInPipeline: pipeline.total,
      stageCounts: pipeline.stageCounts,
      jobStageCounts: pipeline.jobStageCounts
    },
    talentPool: {
      supabaseCandidateCount
    }
  };

  // 2e. Store snapshot
  this.persistSnapshot(snapshot);

  // 2f. Detect anomalies by comparing with previous snapshot
  const previous = this.getSnapshots(2)[1] || null;
  this.detectAnomalies(snapshot, previous);

  // 2g. Optional: Generate AI insight
  await this.tryGenerateAiInsight(snapshot);
}
```

#### Step 3: Stage Counting Logic
```typescript
function countByStageOverall(candidates: any[], jobs: any[]) {
  const jobStageCounts: Record<string, Record<string, number>> = {};
  const stageCounts: Record<string, number> = {};

  for (const job of jobs) {
    const jobId = job.id;
    const counts = {};

    // Count candidates for this job
    for (const candidate of candidates) {
      const score = candidate?.matchScores?.[jobId];
      if (!score) continue; // Candidate not matched to this job

      const stage = candidate?.pipelineStage?.[jobId] || 'new';
      counts[stage] = (counts[stage] || 0) + 1;
    }

    jobStageCounts[jobId] = counts;

    // Aggregate to overall counts
    for (const [stage, count] of Object.entries(counts)) {
      stageCounts[stage] = (stageCounts[stage] || 0) + count;
    }
  }

  const total = Object.values(stageCounts).reduce((sum, count) => sum + count, 0);

  return { total, stageCounts, jobStageCounts };
}
```

**Example Snapshot:**
```json
{
  "id": "snap_1234567890_abc123",
  "createdAt": "2024-01-16T10:30:00Z",
  "openJobs": 5,
  "pipeline": {
    "totalInPipeline": 127,
    "stageCounts": {
      "sourced": 15,
      "new": 22,
      "long_list": 28,
      "screening": 25,
      "scheduling": 12,
      "interview": 15,
      "offer": 8,
      "hired": 2
    },
    "jobStageCounts": {
      "job_1": {
        "sourced": 3,
        "new": 5,
        "long_list": 7,
        "screening": 6,
        "interview": 4,
        "offer": 2
      },
      "job_2": {
        // ... per-job breakdown
      }
    }
  },
  "talentPool": {
    "supabaseCandidateCount": 10247
  }
}
```

#### Step 4: Supabase Candidate Count
```typescript
private async fetchSupabaseCandidateCount(): Promise<number | null> {
  try {
    const result = await supabase
      .from('candidate_documents')
      .select('id', { count: 'exact', head: true });

    if (result.error) return null;
    return result.count ?? null;

  } catch {
    return null;
  }
}
```

**Purpose:**
- Track growth/shrinkage of talent pool
- Detect ingestion failures
- Monitor data retention policies

#### Step 5: Anomaly Detection
The agent compares current snapshot with previous snapshot to detect issues:

##### Anomaly 1: Pipeline Velocity Drop
```typescript
// Detect sharp drop in late-stage candidates
const lateStages = ['interview', 'offer', 'hired'];
const currentLate = lateStages.reduce((sum, s) =>
  sum + (current.pipeline.stageCounts[s] || 0), 0
);
const prevLate = lateStages.reduce((sum, s) =>
  sum + (previous.pipeline.stageCounts[s] || 0), 0
);

if (prevLate >= 5 && currentLate <= Math.floor(prevLate * 0.4)) {
  // Drop of 60%+ in late-stage volume
  this.emitAlert({
    severity: 'warning',
    title: 'Pipeline Velocity Drop',
    message: `Late-stage pipeline volume dropped from ${prevLate} to ${currentLate}. Check interview throughput.`,
    metadata: { prevLate, currentLate }
  });
}
```

**Example Alert:**
```
⚠️ Pipeline Velocity Drop
Late-stage pipeline volume dropped from 25 to 9. Check interview throughput and offer approvals.
```

##### Anomaly 2: Screening Bottleneck
```typescript
// Screening grows while downstream stays flat
const curScreen = current.pipeline.stageCounts['screening'] || 0;
const prevScreen = previous.pipeline.stageCounts['screening'] || 0;
const curScheduling = current.pipeline.stageCounts['scheduling'] || 0;
const prevScheduling = previous.pipeline.stageCounts['scheduling'] || 0;
const curInterview = current.pipeline.stageCounts['interview'] || 0;
const prevInterview = previous.pipeline.stageCounts['interview'] || 0;

if (
  curScreen >= prevScreen + 10 &&
  (curScheduling + curInterview) <= (prevScheduling + prevInterview) + 1
) {
  this.emitAlert({
    severity: 'warning',
    title: 'Screening Bottleneck',
    message: `Screening queue increased (+${curScreen - prevScreen}) while scheduling/interview volume is flat. Consider adding interviewer capacity.`,
    metadata: { curScreen, prevScreen }
  });
}
```

**Example Alert:**
```
⚠️ Screening Bottleneck
Screening queue increased (+15) while scheduling/interview volume is flat. Consider adding interviewer capacity.
```

##### Anomaly 3: Talent Pool Size Drop
```typescript
// Supabase candidate count dropped significantly
const curPool = current.talentPool.supabaseCandidateCount;
const prevPool = previous.talentPool.supabaseCandidateCount;

if (
  typeof curPool === 'number' &&
  typeof prevPool === 'number' &&
  curPool < prevPool - 1000
) {
  this.emitAlert({
    severity: 'error',
    title: 'Talent Pool Size Drop',
    message: `Supabase candidate pool count dropped from ${prevPool} to ${curPool}. Verify ingestion jobs and data retention policies.`,
    metadata: { prevPool, curPool }
  });
}
```

**Example Alert:**
```
🚨 Talent Pool Size Drop
Supabase candidate pool count dropped from 10,247 to 8,912. Verify ingestion jobs and data retention policies.
```

#### Step 6: AI-Generated Insights (Optional)
```typescript
private async tryGenerateAiInsight(snapshot: PipelineSnapshot) {
  try {
    const prompt = [
      'You are an analytics agent for a recruiting pipeline.',
      'Given this snapshot JSON, return JSON with:',
      '{ "insight": "string", "recommendation": "string" }',
      'Be brief and actionable. If no issues, highlight strongest signal.',
      JSON.stringify(snapshot)
    ].join('\n');

    const result = await aiService.generateJson<{ insight: string; recommendation: string }>(prompt);

    if (!result?.insight || !result?.recommendation) return;

    this.emitAlert({
      severity: 'info',
      title: 'AI Insight',
      message: `${result.insight} Recommendation: ${result.recommendation}`,
      metadata: { snapshotId: snapshot.id }
    });

  } catch {
    // AI is optional; fail silently
  }
}
```

**Example AI Insight:**
```
💡 AI Insight
Strong screening velocity (25 candidates processed), but interview stage is slowing down. Recommendation: Schedule more interview slots this week to maintain momentum.
```

#### Step 7: Alert Emission
```typescript
private emitAlert(alert: Omit<AnalyticsAlert, 'id' | 'createdAt'>) {
  const full: AnalyticsAlert = {
    ...alert,
    id: `aa_${Date.now()}_${randomId}`,
    createdAt: new Date().toISOString()
  };

  // Store in LocalStorage
  this.persistAlert(full);

  // Send to Pulse Feed
  pulseService.addEvent({
    type: 'AGENT_ACTION',
    severity: full.severity,
    title: full.title,
    message: full.message,
    metadata: {
      agentType: 'ANALYTICS',
      ...full.metadata
    }
  });
}
```

### Complete Example Flow

```
T=10:00 AM: Analytics run
  ↓
  Snapshot captured:
  - Open jobs: 5
  - Total in pipeline: 127
  - Screening: 25, Interview: 15, Offer: 8
  - Supabase pool: 10,247
  ↓
  No previous snapshot (first run)
  ↓
  No anomalies detected
  ↓
T=10:30 AM: Analytics run
  ↓
  Snapshot captured:
  - Open jobs: 5
  - Total in pipeline: 128 (+1)
  - Screening: 40 (+15), Interview: 15 (same), Offer: 8 (same)
  - Supabase pool: 10,250 (+3)
  ↓
  Compare with previous snapshot
  ↓
  Anomaly detected: Screening Bottleneck
  ↓
  Alert emitted:
  "⚠️ Screening queue increased (+15) while downstream is flat"
  ↓
  Pulse notification sent
  ↓
  Alert appears in War Room dashboard
  ↓
T=11:00 AM: Analytics run
  ↓
  Snapshot captured:
  - Open jobs: 5
  - Total in pipeline: 130 (+2)
  - Screening: 42 (+2), Interview: 18 (+3), Offer: 9 (+1)
  - Supabase pool: 10,252 (+2)
  ↓
  No anomalies (screening is now flowing into interviews)
  ↓
  AI generates insight:
  "💡 Healthy pipeline flow. Screening velocity improved. Recommendation: Maintain current interviewer capacity."
```

### Control Methods

| Method | Purpose |
|--------|---------|
| `initialize(jobs, candidates)` | Start the agent |
| `setEnabled(enabled)` | Pause/resume monitoring |
| `triggerRun(jobs, candidates)` | Run analytics now |
| `getSnapshots(limit)` | Get recent snapshots |
| `getAlerts(limit)` | Get recent alerts |
| `getStatus()` | Get agent status |

### Analytics Alert Object
```typescript
{
  id: 'aa_1234567890_abc123',
  severity: 'warning',
  title: 'Pipeline Velocity Drop',
  message: 'Late-stage volume dropped from 25 to 9. Check interview throughput.',
  createdAt: '2024-01-16T10:30:00Z',
  metadata: {
    prevLate: 25,
    currentLate: 9,
    agentType: 'ANALYTICS'
  }
}
```

### Alert Severity Levels

| Severity | When Used | Example |
|----------|-----------|---------|
| `info` | General insights | "Pipeline growing steadily" |
| `warning` | Potential issues | "Screening bottleneck detected" |
| `error` | Critical problems | "Talent pool size dropped 1000+" |
| `OPPORTUNITY` | Positive signals | "Strong candidate pool for React roles" |

---

## 7. User Interface Pages

### 7.1 Jobs Page (`/`)
**File**: `pages/JobsPage.tsx`

**Purpose**: Main dashboard for managing open jobs and viewing matched candidates.

**Features**:
- Job list with search and status filters
- Selected job details panel
- Matched candidates for selected job (from Supabase or demo data)
- AI-powered batch analysis
- Candidate feedback (thumbs up/down)
- Add candidates to pipeline
- Enhanced candidate cards with company/school badges

**Key Components**:
- `JobList` - Sidebar with all jobs
- `JobDetails` - Selected job info (title, description, skills)
- `CandidatePane` - Grid of matched candidates with scores
- `CandidateCard` - Individual candidate card with actions

### 7.2 Pipeline Page (`/pipeline`)
**File**: `pages/PipelinePage.tsx`

**Purpose**: Kanban-style view of recruitment funnel for all jobs.

**Features**:
- 8 stage columns: Sourced → New → Long List → Screening → Scheduling → Interview → Offer → Hired/Rejected
- Drag-and-drop to move candidates between stages
- Per-stage candidate counts
- Filter by job
- Stage-specific actions

**Pipeline Stages**:
1. **Sourced** - Found by Sourcing Agent
2. **New** - Recently added, not yet reviewed
3. **Long List** - Passed initial screening
4. **Screening** - Screening Agent processing
5. **Scheduling** - Scheduling Agent booking interview
6. **Interview** - Scheduled or in progress
7. **Offer** - Offer extended
8. **Hired** - Accepted offer
9. **Rejected** - Not moving forward

### 7.3 Candidates Page (`/candidates`)
**File**: `pages/CandidatesPage.tsx`

**Purpose**: Browse full talent pool with hybrid data source toggle.

**Features**:
- **Hybrid Data Source Toggle**:
  - Demo Pool (66 candidates)
  - Supabase Pool (10,000+ candidates with Knowledge Graph)
- Enhanced candidate list with company/school badges
- Best match score display
- Skill highlighting
- Experience & location icons
- "Load More" pagination for Supabase
- Refresh button
- Knowledge Graph info banner

**Data Sources**:
```typescript
const [dataSource, setDataSource] = useState<'demo' | 'supabase'>('demo');

const allCandidates = dataSource === 'supabase'
  ? supabaseCandidates
  : demoCandidates;
```

### 7.4 Insights Page (`/insights`)
**File**: `pages/InsightsPage.tsx`

**Purpose**: Department-level analytics and skill demand insights.

**Features**:
- Top skills by department
- Job count per department
- Skill gap analysis
- Department heatmap

### 7.5 Autonomous Agents Page (`/autonomous-agents`)
**File**: `pages/AutonomousAgentsPage.tsx`

**Purpose**: Central dashboard for all 5 autonomous agents.

**Features**:
- **Sourcing Agent Control**:
  - Enable/disable toggle
  - Manual scan trigger
  - Last run / next run timestamps
  - Total matches found
  - Recent match list

- **Screening Agent Control**:
  - Enable/disable toggle
  - Queue size
  - Total screened count
  - Pass rate percentage
  - Recent screening results

- **Scheduling Agent Control**:
  - Enable/disable toggle
  - Meeting provider selection (Google Meet / MS Teams)
  - Queue size
  - Upcoming interviews (next 7 days)
  - Scheduled interview list

- **Interview Agent Control**:
  - Enable/disable toggle
  - Total interview sessions
  - Recent sessions with debriefs
  - Transcript viewer

- **Analytics Agent Control**:
  - Enable/disable toggle
  - Latest snapshot metrics
  - Recent alerts
  - Pipeline health charts

### 7.6 War Room Page (`/war-room`)
**File**: `pages/WarRoomPage.tsx`

**Purpose**: Real-time monitoring and alerts dashboard.

**Features**:
- Critical alerts from Analytics Agent
- Pipeline velocity trends
- Bottleneck detection
- Talent pool health
- Real-time Pulse Feed integration

### 7.7 Health Page (`/health`)
**File**: `pages/HealthPage.tsx`

**Purpose**: System health monitoring.

**Features**:
- Background job status
- Agent health checks
- Supabase connection status
- API rate limits

---

## 8. Key Components

### 8.1 CandidateCard
**File**: `components/CandidatePane.tsx` (inline component)

**Features**:
- **Company & School Badges** - From Knowledge Graph data
- **Experience & Location Icons** - Briefcase and MapPin icons
- **Match Quality Badge** - ⭐ Excellent (80+), ✓ Good (60+), ○ Moderate (40+), · Fair (<40)
- **Skill Highlighting** - Green badges for skills matching job requirements
- **Action Buttons** - View Profile, Analyze, Add to Pipeline, Feedback

**Enhancement Code:**
```typescript
const getCompanySchoolData = () => {
  const companies: string[] = [];
  const schools: string[] = [];

  if ((candidate as any).companies) {
    companies.push(...(candidate as any).companies);
  }
  if ((candidate as any).schools) {
    schools.push(...(candidate as any).schools);
  }

  return { companies, schools };
};

const getMatchQuality = () => {
  if (matchScore >= 80) return { text: 'Excellent', color: 'bg-green-500/20 text-green-300', icon: '⭐' };
  if (matchScore >= 60) return { text: 'Good', color: 'bg-blue-500/20 text-blue-300', icon: '✓' };
  if (matchScore >= 40) return { text: 'Moderate', color: 'bg-yellow-500/20 text-yellow-300', icon: '○' };
  return { text: 'Fair', color: 'bg-slate-500/20 text-slate-300', icon: '·' };
};
```

### 8.2 PulseFeed
**File**: `components/PulseFeed.tsx`

**Features**:
- Real-time notifications from all agents
- Severity-based color coding
- Unread count badge
- Mark as read
- Search and filter
- Timestamp display

### 8.3 AnalysisModal
**File**: `components/modals/AnalysisModal.tsx`

**Features**:
- Displays AI fit analysis results
- Technical/cultural/soft skills match scores
- Pros and cons lists
- Recommendation badge (STRONG_HIRE, HIRE, CONSIDER, REJECT)
- Loading state with progress indicator

### 8.4 CandidateProfileModal
**File**: `components/modals/CandidateProfileModal.tsx`

**Features**:
- Full candidate details
- Match scores for all jobs
- Skills passport (verified skills)
- Education and experience
- Engagement score
- Demographics (for fairness tracking)
- Quick actions

---

## 9. Data Models

### 9.1 Candidate
```typescript
interface Candidate {
  id: string;
  name: string;
  role: string;
  skills: string[];
  experience: number;                    // Years
  location: string;
  availability: string;
  matchScore?: number;                   // 0-100 (for single job context)
  matchScores?: Record<string, number>;  // Job ID → Score map
  matchRationale?: string;
  stage?: PipelineStage;                 // Deprecated (use pipelineStage)
  pipelineStage?: Record<string, PipelineStage>; // Job ID → Stage map
  source?: 'internal' | 'past' | 'uploaded';
  email?: string;
  phone?: string;
  education?: string[];
  projects?: string[];
  employmentStatus?: 'available' | 'interviewing' | 'hired' | 'passive';

  // Knowledge Graph data
  companies?: string[];                  // From candidate_companies table
  schools?: string[];                    // From candidate_schools table

  // Fairness tracking
  demographics?: {
    gender: 'Male' | 'Female' | 'Non-binary' | 'Prefer not to say';
    educationType: 'Elite' | 'Traditional' | 'Bootcamp' | 'Self-taught';
    university?: string;
  };

  // Skills passport
  passport?: {
    verifiedSkills: {
      skillName: string;
      proficiencyLevel: number;
      verifiedAt: string;
      source: string;
    }[];
    badges: string[];
  };
}
```

### 9.2 Job
```typescript
interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Internship';
  salaryRange: string;
  requiredSkills: string[];
  niceToHaveSkills?: string[];
  description: string;
  posted: string;
  applicants: number;
  status: 'open' | 'closed' | 'on hold';
  candidateIds?: string[];               // Candidates in pipeline
}
```

### 9.3 FitAnalysis
```typescript
interface FitAnalysis {
  overallScore: number;                  // 0-100
  technicalMatch: number;                // 0-100
  softSkillsMatch: number;               // 0-100
  culturalMatch: number;                 // 0-100
  summary: string;
  pros: string[];
  cons: string[];
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'REJECT';
}
```

### 9.4 Pipeline Stages
```typescript
type PipelineStage =
  | 'sourced'      // Found by Sourcing Agent
  | 'new'          // New to pipeline
  | 'long_list'    // Passed initial review
  | 'screening'    // In screening process
  | 'scheduling'   // Booking interview
  | 'interview'    // Interview scheduled/completed
  | 'offer'        // Offer extended
  | 'hired'        // Offer accepted
  | 'rejected';    // Not moving forward
```

---

## 10. Environment Configuration

### Required Environment Variables

**`.env.local`:**
```bash
# Google Gemini AI API Key (required for AI features)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration (required for vector search and Knowledge Graph)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Optional Features
- **Without Gemini API Key**: App works with demo data, but AI analysis features are disabled
- **Without Supabase**: App works with 66 demo candidates only (no vector search, no Knowledge Graph)

---

## 11. Development & Deployment

### Local Development
```bash
# Install dependencies
npm install

# Set environment variables in .env.local
# VITE_GEMINI_API_KEY=...
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

# Start dev server
npm run dev

# Open http://localhost:5173
```

### Build for Production
```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

### Deployment Platforms
- **Vercel** (recommended)
- **Netlify**
- **AWS S3 + CloudFront**
- **Firebase Hosting**

---

## 12. Key Integrations

### 12.1 Supabase PostgreSQL
- **Candidate Documents**: `candidate_documents` table with `metadata` JSONB column
- **Vector Embeddings**: `embedding` column (pgvector extension)
- **Knowledge Graph**:
  - `candidate_companies` (many-to-many)
  - `candidate_schools` (many-to-many)
  - `companies` (entity table)
  - `schools` (entity table)

### 12.2 Google Gemini AI
- **Model**: `gemini-2.5-flash`
- **Use Cases**:
  - Candidate fit analysis
  - Interview question generation
  - Screening summary generation
  - Interview debrief generation
  - Analytics insights
- **Rate Limits**: Free tier = 20 requests/day

### 12.3 EventBus System
**File**: `utils/EventBus.ts`

**Events:**
- `CANDIDATE_STAGED` - Candidate moved to new pipeline stage
- `CANDIDATE_HIRED` - Candidate accepted offer
- `JOB_FILLED` - Job position filled
- `PULSE_ALERT` - New Pulse notification

**Usage:**
```typescript
// Emit event
eventBus.emit(EVENTS.CANDIDATE_STAGED, {
  candidateId: 'c123',
  jobId: 'j456',
  stage: 'interview'
});

// Listen to event
const unsubscribe = eventBus.on(EVENTS.CANDIDATE_STAGED, (data) => {
  console.log(`${data.candidateName} moved to ${data.stage}`);
});

// Cleanup
unsubscribe();
```

---

## 13. Future Enhancements

### Planned Features
1. **Real Email Integration** - SendGrid/AWS SES for screening and scheduling
2. **Calendar API Integration** - Google Calendar / Outlook for real availability
3. **Video Call Integration** - Zoom/Teams API for automatic meeting creation
4. **Speech-to-Text** - Real-time transcription during interviews
5. **Advanced Analytics** - ML-powered hiring predictions
6. **Candidate Chatbot** - Answer candidate questions 24/7
7. **Reference Checking** - Automated reference outreach and verification
8. **Offer Letter Generation** - Auto-generate offer letters from templates

---

## 14. Troubleshooting

### Common Issues

#### 1. Autonomous Agents Not Running
**Symptom**: Agent shows "Never run" or "Paused"

**Solution**:
- Check agent is enabled: `autonomousSourcingAgent.setEnabled(true)`
- Verify initialization: Agents must be initialized in `AutonomousAgentsPage` or app startup
- Check browser console for errors

#### 2. Supabase Connection Fails
**Symptom**: "Failed to fetch candidates" or empty results

**Solution**:
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`
- Check Supabase project is active
- Verify Row Level Security (RLS) policies allow anonymous reads
- Test connection: `await supabase.from('candidate_documents').select('id').limit(1)`

#### 3. Gemini API Rate Limit
**Symptom**: "429 Too Many Requests" or "Quota exceeded"

**Solution**:
- Free tier limit: 20 requests/day
- Upgrade to paid tier or wait 24 hours
- Cache analysis results to reduce API calls

#### 4. LocalStorage Quota Exceeded
**Symptom**: Agent results not persisting

**Solution**:
- Clear old agent data: `localStorage.clear()`
- Reduce max stored results (default: 500)
- Use IndexedDB for larger storage needs

---

## 15. Performance Optimization

### Best Practices

1. **Vector Search Caching**
   - 5-minute TTL cache for Supabase queries
   - Reduces redundant API calls
   - Improves perceived performance

2. **Lazy Loading**
   - Load candidates in batches (100 at a time)
   - "Load More" pagination
   - Reduces initial page load

3. **React.useMemo**
   - Memoize expensive computations
   - Filter/sort operations
   - Derived state calculations

4. **Agent Interval Tuning**
   - Sourcing: 5 minutes (high frequency for fast matching)
   - Screening: 4 hours (batch processing)
   - Scheduling: 2 hours (time-sensitive)
   - Interview: 1 hour (monitoring)
   - Analytics: 30 minutes (real-time insights)

---

## 16. Security Considerations

### Data Privacy
- **Candidate PII**: Email, phone, demographics stored securely
- **GDPR Compliance**: Right to be forgotten (manual deletion required)
- **Data Retention**: Implement automatic purging of old data

### API Key Security
- **Never commit**: `.env.local` in `.gitignore`
- **Environment variables**: Use Vercel/Netlify secret management
- **Key rotation**: Regularly rotate API keys

### Supabase RLS
```sql
-- Example RLS policy for candidate_documents
CREATE POLICY "Allow anonymous read access"
ON candidate_documents FOR SELECT
TO anon
USING (true);

-- Restrict writes to authenticated users
CREATE POLICY "Restrict write access"
ON candidate_documents FOR INSERT
TO authenticated
USING (true);
```

---

## 17. Testing Strategy

### Unit Tests
```typescript
// Example: Test Sourcing Agent
describe('AutonomousSourcingAgent', () => {
  it('should filter out candidates already in pipeline', () => {
    const job = { id: 'j1', candidateIds: ['c1', 'c2'] };
    const candidates = [
      { id: 'c1', similarity: 0.9 },
      { id: 'c3', similarity: 0.85 }
    ];

    const newCandidates = agent.filterNewCandidates(candidates, job);

    expect(newCandidates).toHaveLength(1);
    expect(newCandidates[0].id).toBe('c3');
  });
});
```

### Integration Tests
```typescript
// Example: Test end-to-end flow
describe('Candidate Pipeline Flow', () => {
  it('should move candidate from sourced to hired', async () => {
    // 1. Sourcing Agent finds candidate
    await autonomousSourcingAgent.triggerScan(jobs);

    // 2. Candidate appears in pipeline
    const candidate = getCandidateById('c123');
    expect(candidate.pipelineStage['j456']).toBe('sourced');

    // 3. Move through stages
    await handleUpdateCandidateStage('c123', 'j456', 'screening');
    await handleUpdateCandidateStage('c123', 'j456', 'interview');
    await handleUpdateCandidateStage('c123', 'j456', 'offer');
    await handleUpdateCandidateStage('c123', 'j456', 'hired');

    // 4. Verify final state
    expect(candidate.pipelineStage['j456']).toBe('hired');
    expect(job.status).toBe('closed');
  });
});
```

---

## 18. Contributing Guidelines

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Follow project rules
- **Prettier**: Auto-format on save
- **Naming**: camelCase for variables, PascalCase for components

### Commit Message Format
```
feat(sourcing-agent): add skill-based filtering
fix(pipeline): prevent backward stage movement
docs(readme): update setup instructions
chore(deps): upgrade react to 18.3.0
```

### Pull Request Checklist
- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] New features have tests
- [ ] Documentation updated
- [ ] No console errors/warnings
- [ ] Performance impact considered

---

## 19. Glossary

| Term | Definition |
|------|------------|
| **Autonomous Agent** | Background service that runs independently to automate recruitment tasks |
| **Vector Search** | Semantic search using embeddings to find similar candidates |
| **Knowledge Graph** | Relationship network between candidates, companies, and schools |
| **Pipeline Stage** | Step in recruitment funnel (Sourced → Screening → Interview → Hired) |
| **Match Score** | Similarity percentage (0-100%) between candidate and job |
| **Fit Analysis** | AI-generated evaluation of candidate-job compatibility |
| **Pulse Feed** | Real-time notification system for agent actions |
| **Screening** | Initial candidate evaluation via Q&A |
| **Debrief** | Post-interview summary with strengths, concerns, next steps |
| **Snapshot** | Point-in-time capture of pipeline metrics |
| **Anomaly** | Detected issue in pipeline health (bottleneck, velocity drop) |
| **RLS** | Row Level Security (Supabase access control) |
| **TTL** | Time To Live (cache expiration time) |

---

## 20. Support & Resources

### Documentation
- **Supabase Docs**: https://supabase.com/docs
- **Google Gemini API**: https://ai.google.dev/docs
- **React Router**: https://reactrouter.com/docs
- **Lucide Icons**: https://lucide.dev/icons

### Community
- **GitHub Issues**: Report bugs and request features
- **Discord**: Join the community chat
- **Email Support**: support@talentsonar.com (example)

---

**End of Documentation**

This comprehensive guide covers the entire AI Talent Sonar application architecture, all autonomous agents with step-by-step workflows, UI components, data models, and best practices. Use this as a reference for understanding, extending, and maintaining the application.
