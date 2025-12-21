# Knowledge Graph Schema Design

Comprehensive entity-relationship design for the Talent Sonar Knowledge Graph.

---

## 🎯 Overview

Transform the flat candidate database into a **true Knowledge Graph** with:
- **Entities**: Candidates, Companies, Schools, Skills, Projects
- **Relationships**: worked_at, studied_at, has_skill, collaborated_with, reported_to
- **Graph Queries**: Network-based searches, relationship traversal, 2nd-degree connections

---

## 📊 Entity-Relationship Diagram

```
┌─────────────┐
│  Candidate  │
└──────┬──────┘
       │
       ├──[WORKED_AT]──────> ┌──────────┐
       │                     │ Company  │
       │                     └──────────┘
       │
       ├──[STUDIED_AT]─────> ┌──────────┐
       │                     │  School  │
       │                     └──────────┘
       │
       ├──[HAS_SKILL]──────> ┌──────────┐
       │                     │  Skill   │
       │                     └──────────┘
       │
       ├──[WORKED_ON]──────> ┌──────────┐
       │                     │ Project  │
       │                     └──────────┘
       │
       ├──[COLLABORATED_WITH]> Candidate
       │
       └──[REPORTED_TO]─────> Candidate
```

---

## 🏗️ Entities

### 1. **Companies**

Stores all companies that candidates have worked at.

```sql
CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    industry TEXT,
    size TEXT,  -- 'startup', 'mid-size', 'enterprise'
    location TEXT,
    website TEXT,
    founded_year INTEGER,
    description TEXT,
    employee_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Sample Data:**
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

---

### 2. **Schools**

Stores all educational institutions.

```sql
CREATE TABLE schools (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT,  -- 'university', 'college', 'bootcamp', 'online'
    location TEXT,
    ranking INTEGER,
    website TEXT,
    founded_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Sample Data:**
```typescript
{
  id: 1,
  name: "Stanford University",
  type: "university",
  location: "Stanford, CA",
  ranking: 3,
  website: "https://stanford.edu",
  founded_year: 1885
}
```

---

### 3. **Skills**

Stores all skills as first-class entities.

```sql
CREATE TABLE skills (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    category TEXT,  -- 'programming', 'framework', 'tool', 'soft-skill', 'domain'
    proficiency_levels TEXT[],  -- ['beginner', 'intermediate', 'expert']
    related_skills TEXT[],
    demand_score DECIMAL(3,2),  -- 0.00 to 1.00
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Sample Data:**
```typescript
{
  id: 1,
  name: "React",
  category: "framework",
  proficiency_levels: ["beginner", "intermediate", "expert"],
  related_skills: ["JavaScript", "TypeScript", "Next.js", "Redux"],
  demand_score: 0.95
}
```

---

### 4. **Projects**

Stores projects that candidates have worked on.

```sql
CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tech_stack TEXT[],
    start_date DATE,
    end_date DATE,
    url TEXT,
    github_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Sample Data:**
```typescript
{
  id: 1,
  name: "E-commerce Platform Redesign",
  description: "Led frontend redesign of checkout flow",
  tech_stack: ["React", "TypeScript", "Redux", "Tailwind"],
  start_date: "2022-01-01",
  end_date: "2022-06-01",
  url: "https://example.com"
}
```

---

## 🔗 Relationships

### 1. **worked_at** (Candidate → Company)

Tracks employment history with tenure details.

```sql
CREATE TABLE candidate_companies (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,  -- References candidate_documents.metadata->>'id'
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    description TEXT,
    achievements TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, company_id, start_date)
);
```

**Sample:**
```typescript
{
  candidate_id: "c123",
  company_id: 1,  // Google
  title: "Senior Frontend Engineer",
  start_date: "2020-01-01",
  end_date: "2023-01-01",
  is_current: false,
  achievements: ["Led team of 5", "Reduced load time by 40%"]
}
```

---

### 2. **studied_at** (Candidate → School)

Tracks educational background.

```sql
CREATE TABLE candidate_schools (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    school_id BIGINT REFERENCES schools(id) ON DELETE CASCADE,
    degree TEXT,  -- 'Bachelor', 'Master', 'PhD', 'Bootcamp'
    field_of_study TEXT,
    graduation_year INTEGER,
    gpa DECIMAL(3,2),
    honors TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, school_id, degree)
);
```

**Sample:**
```typescript
{
  candidate_id: "c123",
  school_id: 1,  // Stanford
  degree: "Master's",
  field_of_study: "Computer Science",
  graduation_year: 2019,
  gpa: 3.9,
  honors: ["Summa Cum Laude"]
}
```

---

### 3. **has_skill** (Candidate → Skill)

Tracks skill proficiency with years of experience.

```sql
CREATE TABLE candidate_skills (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    skill_id BIGINT REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level TEXT,  -- 'beginner', 'intermediate', 'expert'
    years_of_experience DECIMAL(4,1),
    last_used_date DATE,
    endorsed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, skill_id)
);
```

**Sample:**
```typescript
{
  candidate_id: "c123",
  skill_id: 1,  // React
  proficiency_level: "expert",
  years_of_experience: 5.5,
  last_used_date: "2024-12-01",
  endorsed_count: 12
}
```

---

### 4. **worked_on** (Candidate → Project)

Tracks project contributions.

```sql
CREATE TABLE candidate_projects (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT,
    contribution_percentage DECIMAL(5,2),
    responsibilities TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, project_id)
);
```

---

### 5. **collaborated_with** (Candidate ↔ Candidate)

Tracks professional collaborations.

```sql
CREATE TABLE candidate_collaborations (
    id BIGSERIAL PRIMARY KEY,
    candidate_id_1 TEXT NOT NULL,
    candidate_id_2 TEXT NOT NULL,
    company_id BIGINT REFERENCES companies(id),
    project_id BIGINT REFERENCES projects(id),
    start_date DATE,
    end_date DATE,
    relationship_type TEXT,  -- 'peer', 'mentor-mentee', 'team-lead'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id_1, candidate_id_2, company_id),
    CHECK (candidate_id_1 < candidate_id_2)  -- Prevent duplicates
);
```

---

### 6. **reported_to** (Candidate → Candidate)

Tracks reporting relationships (org hierarchy).

```sql
CREATE TABLE candidate_reporting (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,      -- Employee
    manager_id TEXT NOT NULL,        -- Manager
    company_id BIGINT REFERENCES companies(id),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, manager_id, company_id, start_date)
);
```

---

## 🔍 Graph Query Examples

### 1. **Find candidates who worked at Google AND studied at Stanford**

```sql
SELECT DISTINCT c.metadata->>'name' as name, c.metadata->>'title' as title
FROM candidate_documents c
INNER JOIN candidate_companies cc ON c.metadata->>'id' = cc.candidate_id
INNER JOIN companies co ON cc.company_id = co.id
INNER JOIN candidate_schools cs ON c.metadata->>'id' = cs.candidate_id
INNER JOIN schools s ON cs.school_id = s.id
WHERE co.name = 'Google'
  AND s.name = 'Stanford University';
```

---

### 2. **Find candidates in Alice's network with ML skills**

```sql
-- Find people who worked with Alice
WITH alice_network AS (
    SELECT DISTINCT
        CASE
            WHEN candidate_id_1 = 'alice_id' THEN candidate_id_2
            ELSE candidate_id_1
        END as network_candidate_id
    FROM candidate_collaborations
    WHERE candidate_id_1 = 'alice_id' OR candidate_id_2 = 'alice_id'
)
-- Find those with ML skills
SELECT c.metadata->>'name' as name, cs.proficiency_level, cs.years_of_experience
FROM candidate_documents c
INNER JOIN alice_network an ON c.metadata->>'id' = an.network_candidate_id
INNER JOIN candidate_skills cs ON c.metadata->>'id' = cs.candidate_id
INNER JOIN skills s ON cs.skill_id = s.id
WHERE s.name = 'Machine Learning';
```

---

### 3. **Find candidates with 2+ years at FAANG companies**

```sql
SELECT c.metadata->>'name' as name, co.name as company,
       EXTRACT(YEAR FROM AGE(COALESCE(cc.end_date, CURRENT_DATE), cc.start_date)) as years
FROM candidate_documents c
INNER JOIN candidate_companies cc ON c.metadata->>'id' = cc.candidate_id
INNER JOIN companies co ON cc.company_id = co.id
WHERE co.name IN ('Google', 'Meta', 'Amazon', 'Apple', 'Netflix')
  AND EXTRACT(YEAR FROM AGE(COALESCE(cc.end_date, CURRENT_DATE), cc.start_date)) >= 2
ORDER BY years DESC;
```

---

### 4. **Find skill clusters (skills that appear together)**

```sql
SELECT s1.name as skill_1, s2.name as skill_2, COUNT(*) as co_occurrence
FROM candidate_skills cs1
INNER JOIN candidate_skills cs2 ON cs1.candidate_id = cs2.candidate_id AND cs1.skill_id < cs2.skill_id
INNER JOIN skills s1 ON cs1.skill_id = s1.id
INNER JOIN skills s2 ON cs2.skill_id = s2.id
GROUP BY s1.name, s2.name
HAVING COUNT(*) > 10
ORDER BY co_occurrence DESC
LIMIT 20;
```

---

### 5. **Career path analysis (most common transitions)**

```sql
-- Find common company transitions
SELECT c1.name as from_company, c2.name as to_company, COUNT(*) as transition_count
FROM candidate_companies cc1
INNER JOIN candidate_companies cc2
    ON cc1.candidate_id = cc2.candidate_id
    AND cc1.end_date < cc2.start_date
INNER JOIN companies c1 ON cc1.company_id = c1.id
INNER JOIN companies c2 ON cc2.company_id = c2.id
GROUP BY c1.name, c2.name
HAVING COUNT(*) >= 3
ORDER BY transition_count DESC
LIMIT 20;
```

---

## 📈 Use Cases Enabled

### **1. Network-Based Recruiting**
- "Find people in our employees' networks"
- "Who can refer candidates for this role?"
- "Which employees have worked with candidates in the pipeline?"

### **2. Career Path Insights**
- "What's the typical career progression for ML engineers?"
- "Where do Google engineers go after leaving?"
- "What skills do people learn when transitioning to senior roles?"

### **3. Skill Gap Analysis**
- "What skills are missing in our frontend team?"
- "Which skills frequently appear together?"
- "What's the demand trend for specific technologies?"

### **4. Company Intelligence**
- "Which companies are our biggest talent sources?"
- "Where do our competitors hire from?"
- "What's the average tenure at different companies?"

### **5. Education Insights**
- "Which universities produce the best ML engineers?"
- "What's the correlation between GPA and performance?"
- "Which bootcamps have successful placement rates?"

---

## 🚀 Implementation Phases

### **Phase 1: Core Entities** ✅
- Create Companies, Schools, Skills tables
- Populate with seed data from existing candidates

### **Phase 2: Basic Relationships** ✅
- Create worked_at, studied_at, has_skill relationships
- Update ingestion to create relationships

### **Phase 3: Advanced Relationships** 🔄
- Create collaborated_with, reported_to relationships
- Infer relationships from shared companies/projects

### **Phase 4: Graph Queries** 🔄
- Build GraphQueryService
- Add graph-based search to Smart Search
- Enhance RAG with relationship queries

### **Phase 5: Visualization** 🔜
- Build interactive graph visualization
- Show candidate networks
- Display career paths

---

## 🎯 Success Metrics

After implementation:
- ✅ Can query "candidates who worked at X AND studied at Y"
- ✅ Can find 2nd-degree connections
- ✅ Can analyze skill co-occurrence patterns
- ✅ Can track career progression paths
- ✅ RAG generates insights using relationship data
- ✅ Smart Search supports network-based queries
