-- ============================================
-- Knowledge Graph Schema Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- ========================================
-- PART 1: ENTITY TABLES
-- ========================================

-- 1. Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    industry TEXT,
    size TEXT CHECK (size IN ('startup', 'mid-size', 'enterprise')),
    location TEXT,
    website TEXT,
    founded_year INTEGER,
    description TEXT,
    employee_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);

COMMENT ON TABLE companies IS 'Stores all companies where candidates have worked';

-- 2. Schools Table
CREATE TABLE IF NOT EXISTS schools (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT CHECK (type IN ('university', 'college', 'bootcamp', 'online')),
    location TEXT,
    ranking INTEGER,
    website TEXT,
    founded_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(name);
CREATE INDEX IF NOT EXISTS idx_schools_type ON schools(type);

COMMENT ON TABLE schools IS 'Stores all educational institutions';

-- 3. Skills Table
CREATE TABLE IF NOT EXISTS skills (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('programming', 'framework', 'tool', 'soft-skill', 'domain', 'platform', 'database')),
    proficiency_levels TEXT[] DEFAULT ARRAY['beginner', 'intermediate', 'expert'],
    related_skills TEXT[],
    demand_score DECIMAL(3,2) DEFAULT 0.50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_demand ON skills(demand_score DESC);

COMMENT ON TABLE skills IS 'Stores all skills as first-class entities';

-- 4. Projects Table
CREATE TABLE IF NOT EXISTS projects (
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

CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_tech_stack ON projects USING GIN(tech_stack);

COMMENT ON TABLE projects IS 'Stores projects that candidates have worked on';

-- ========================================
-- PART 2: RELATIONSHIP TABLES
-- ========================================

-- 1. Candidate-Company Relationship (worked_at)
CREATE TABLE IF NOT EXISTS candidate_companies (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_candidate_companies_candidate ON candidate_companies(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_companies_company ON candidate_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_candidate_companies_current ON candidate_companies(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_candidate_companies_dates ON candidate_companies(start_date, end_date);

COMMENT ON TABLE candidate_companies IS 'Tracks employment history with tenure details';

-- 2. Candidate-School Relationship (studied_at)
CREATE TABLE IF NOT EXISTS candidate_schools (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    school_id BIGINT REFERENCES schools(id) ON DELETE CASCADE,
    degree TEXT CHECK (degree IN ('High School', 'Associate', 'Bachelor''s', 'Master''s', 'PhD', 'Bootcamp', 'Certificate')),
    field_of_study TEXT,
    graduation_year INTEGER,
    gpa DECIMAL(3,2),
    honors TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, school_id, degree)
);

CREATE INDEX IF NOT EXISTS idx_candidate_schools_candidate ON candidate_schools(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_schools_school ON candidate_schools(school_id);
CREATE INDEX IF NOT EXISTS idx_candidate_schools_degree ON candidate_schools(degree);
CREATE INDEX IF NOT EXISTS idx_candidate_schools_year ON candidate_schools(graduation_year);

COMMENT ON TABLE candidate_schools IS 'Tracks educational background';

-- 3. Candidate-Skill Relationship (has_skill)
CREATE TABLE IF NOT EXISTS candidate_skills (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    skill_id BIGINT REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level TEXT CHECK (proficiency_level IN ('beginner', 'intermediate', 'expert')),
    years_of_experience DECIMAL(4,1),
    last_used_date DATE,
    endorsed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_skills_candidate ON candidate_skills(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_skill ON candidate_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_proficiency ON candidate_skills(proficiency_level);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_years ON candidate_skills(years_of_experience DESC);

COMMENT ON TABLE candidate_skills IS 'Tracks skill proficiency with years of experience';

-- 4. Candidate-Project Relationship (worked_on)
CREATE TABLE IF NOT EXISTS candidate_projects (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT,
    contribution_percentage DECIMAL(5,2),
    responsibilities TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_projects_candidate ON candidate_projects(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_projects_project ON candidate_projects(project_id);

COMMENT ON TABLE candidate_projects IS 'Tracks project contributions';

-- 5. Candidate-Candidate Relationship (collaborated_with)
CREATE TABLE IF NOT EXISTS candidate_collaborations (
    id BIGSERIAL PRIMARY KEY,
    candidate_id_1 TEXT NOT NULL,
    candidate_id_2 TEXT NOT NULL,
    company_id BIGINT REFERENCES companies(id),
    project_id BIGINT REFERENCES projects(id),
    start_date DATE,
    end_date DATE,
    relationship_type TEXT CHECK (relationship_type IN ('peer', 'mentor-mentee', 'team-lead')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id_1, candidate_id_2, company_id),
    CHECK (candidate_id_1 < candidate_id_2)
);

CREATE INDEX IF NOT EXISTS idx_collaborations_candidate1 ON candidate_collaborations(candidate_id_1);
CREATE INDEX IF NOT EXISTS idx_collaborations_candidate2 ON candidate_collaborations(candidate_id_2);
CREATE INDEX IF NOT EXISTS idx_collaborations_company ON candidate_collaborations(company_id);

COMMENT ON TABLE candidate_collaborations IS 'Tracks professional collaborations between candidates';

-- 6. Candidate Reporting Relationship (reported_to)
CREATE TABLE IF NOT EXISTS candidate_reporting (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    manager_id TEXT NOT NULL,
    company_id BIGINT REFERENCES companies(id),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, manager_id, company_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_reporting_candidate ON candidate_reporting(candidate_id);
CREATE INDEX IF NOT EXISTS idx_reporting_manager ON candidate_reporting(manager_id);
CREATE INDEX IF NOT EXISTS idx_reporting_company ON candidate_reporting(company_id);

COMMENT ON TABLE candidate_reporting IS 'Tracks reporting relationships (org hierarchy)';

-- ========================================
-- PART 3: SEED DATA
-- ========================================

-- Seed Companies
INSERT INTO companies (name, industry, size, location, founded_year, employee_count) VALUES
    ('Google', 'Technology', 'enterprise', 'Mountain View, CA', 1998, 150000),
    ('Meta', 'Technology', 'enterprise', 'Menlo Park, CA', 2004, 80000),
    ('Amazon', 'E-commerce', 'enterprise', 'Seattle, WA', 1994, 1500000),
    ('Apple', 'Technology', 'enterprise', 'Cupertino, CA', 1976, 160000),
    ('Microsoft', 'Technology', 'enterprise', 'Redmond, WA', 1975, 220000),
    ('Netflix', 'Entertainment', 'enterprise', 'Los Gatos, CA', 1997, 12000),
    ('Tesla', 'Automotive', 'enterprise', 'Austin, TX', 2003, 130000),
    ('Uber', 'Transportation', 'enterprise', 'San Francisco, CA', 2009, 30000),
    ('Airbnb', 'Hospitality', 'enterprise', 'San Francisco, CA', 2008, 6000),
    ('Stripe', 'Fintech', 'mid-size', 'San Francisco, CA', 2010, 8000),
    ('Salesforce', 'Enterprise Software', 'enterprise', 'San Francisco, CA', 1999, 80000),
    ('Adobe', 'Software', 'enterprise', 'San Jose, CA', 1982, 30000),
    ('Oracle', 'Database', 'enterprise', 'Austin, TX', 1977, 143000),
    ('IBM', 'Technology', 'enterprise', 'Armonk, NY', 1911, 280000),
    ('Cisco', 'Networking', 'enterprise', 'San Jose, CA', 1984, 80000),
    ('Intel', 'Semiconductors', 'enterprise', 'Santa Clara, CA', 1968, 120000),
    ('NVIDIA', 'Graphics', 'enterprise', 'Santa Clara, CA', 1993, 26000),
    ('LinkedIn', 'Social Media', 'enterprise', 'Sunnyvale, CA', 2003, 20000),
    ('Dropbox', 'Cloud Storage', 'mid-size', 'San Francisco, CA', 2007, 3000),
    ('Slack', 'Communication', 'mid-size', 'San Francisco, CA', 2009, 2500),
    ('Zoom', 'Video Conferencing', 'mid-size', 'San Jose, CA', 2011, 7000),
    ('Atlassian', 'Software', 'mid-size', 'Sydney, Australia', 2002, 10000),
    ('MongoDB', 'Database', 'mid-size', 'New York, NY', 2007, 4000),
    ('Snowflake', 'Data Warehousing', 'mid-size', 'Bozeman, MT', 2012, 6000),
    ('Databricks', 'Data Analytics', 'mid-size', 'San Francisco, CA', 2013, 5000)
ON CONFLICT (name) DO NOTHING;

-- Seed Schools
INSERT INTO schools (name, type, location, ranking) VALUES
    ('Stanford University', 'university', 'Stanford, CA', 3),
    ('MIT', 'university', 'Cambridge, MA', 1),
    ('Harvard University', 'university', 'Cambridge, MA', 2),
    ('UC Berkeley', 'university', 'Berkeley, CA', 4),
    ('Carnegie Mellon', 'university', 'Pittsburgh, PA', 25),
    ('Georgia Tech', 'university', 'Atlanta, GA', 38),
    ('University of Washington', 'university', 'Seattle, WA', 55),
    ('UT Austin', 'university', 'Austin, TX', 38),
    ('UCLA', 'university', 'Los Angeles, CA', 20),
    ('USC', 'university', 'Los Angeles, CA', 25),
    ('Cornell University', 'university', 'Ithaca, NY', 17),
    ('Columbia University', 'university', 'New York, NY', 18),
    ('Princeton University', 'university', 'Princeton, NJ', 1),
    ('Yale University', 'university', 'New Haven, CT', 5),
    ('Cal Tech', 'university', 'Pasadena, CA', 9),
    ('University of Michigan', 'university', 'Ann Arbor, MI', 23),
    ('University of Illinois', 'university', 'Urbana-Champaign, IL', 47),
    ('Purdue University', 'university', 'West Lafayette, IN', 53),
    ('NYU', 'university', 'New York, NY', 30),
    ('Boston University', 'university', 'Boston, MA', 41),
    ('App Academy', 'bootcamp', 'San Francisco, CA', NULL),
    ('Hack Reactor', 'bootcamp', 'San Francisco, CA', NULL),
    ('General Assembly', 'bootcamp', 'New York, NY', NULL),
    ('Flatiron School', 'bootcamp', 'New York, NY', NULL),
    ('Lambda School', 'online', 'Remote', NULL)
ON CONFLICT (name) DO NOTHING;

-- Seed Skills
INSERT INTO skills (name, category, demand_score) VALUES
    -- Programming Languages
    ('JavaScript', 'programming', 0.95),
    ('Python', 'programming', 0.98),
    ('Java', 'programming', 0.90),
    ('TypeScript', 'programming', 0.92),
    ('Go', 'programming', 0.85),
    ('Rust', 'programming', 0.78),
    ('C++', 'programming', 0.82),
    ('Ruby', 'programming', 0.70),
    ('PHP', 'programming', 0.68),
    ('Swift', 'programming', 0.75),
    ('Kotlin', 'programming', 0.73),
    ('Scala', 'programming', 0.65),
    ('R', 'programming', 0.72),
    ('SQL', 'programming', 0.96),

    -- Frameworks
    ('React', 'framework', 0.95),
    ('Vue', 'framework', 0.82),
    ('Angular', 'framework', 0.78),
    ('Next.js', 'framework', 0.88),
    ('Node.js', 'framework', 0.93),
    ('Django', 'framework', 0.80),
    ('Flask', 'framework', 0.75),
    ('Spring Boot', 'framework', 0.85),
    ('Express', 'framework', 0.87),
    ('FastAPI', 'framework', 0.79),

    -- Tools
    ('Git', 'tool', 0.99),
    ('Docker', 'tool', 0.92),
    ('Kubernetes', 'tool', 0.88),
    ('Terraform', 'tool', 0.82),
    ('Jenkins', 'tool', 0.78),
    ('GitHub Actions', 'tool', 0.84),
    ('Webpack', 'tool', 0.75),
    ('Vite', 'tool', 0.70),

    -- Cloud Platforms
    ('AWS', 'platform', 0.95),
    ('Azure', 'platform', 0.88),
    ('GCP', 'platform', 0.83),
    ('Heroku', 'platform', 0.65),
    ('Vercel', 'platform', 0.72),

    -- Databases
    ('PostgreSQL', 'database', 0.90),
    ('MongoDB', 'database', 0.85),
    ('MySQL', 'database', 0.88),
    ('Redis', 'database', 0.82),
    ('Elasticsearch', 'database', 0.77),
    ('Cassandra', 'database', 0.68),
    ('DynamoDB', 'database', 0.75),

    -- ML/AI
    ('Machine Learning', 'domain', 0.94),
    ('Deep Learning', 'domain', 0.89),
    ('TensorFlow', 'framework', 0.85),
    ('PyTorch', 'framework', 0.87),
    ('NLP', 'domain', 0.83),
    ('Computer Vision', 'domain', 0.80),

    -- Soft Skills
    ('Leadership', 'soft-skill', 0.96),
    ('Communication', 'soft-skill', 0.98),
    ('Problem Solving', 'soft-skill', 0.97),
    ('Agile', 'soft-skill', 0.90),
    ('Scrum', 'soft-skill', 0.85),
    ('Project Management', 'soft-skill', 0.88)
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- PART 4: ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_reporting ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (modify based on your security requirements)
-- NOTE: Postgres does not support `CREATE POLICY IF NOT EXISTS`, so we wrap policy creation
-- in a DO block to make this script safe to re-run.
DO $$
DECLARE
    policy_name TEXT := 'Allow all for authenticated users';
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'companies',
        'schools',
        'skills',
        'projects',
        'candidate_companies',
        'candidate_schools',
        'candidate_skills',
        'candidate_projects',
        'candidate_collaborations',
        'candidate_reporting'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = t
              AND policyname = policy_name
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
                policy_name,
                t
            );
        END IF;
    END LOOP;
END $$;

-- Optional: Create policies for anonymous users if needed
-- CREATE POLICY "Allow read for anon users" ON companies FOR SELECT TO anon USING (true);
-- (Repeat for other tables as needed)

-- ========================================
-- PART 5: HELPER FUNCTIONS
-- ========================================

-- Function to get or create a company
CREATE OR REPLACE FUNCTION get_or_create_company(company_name TEXT, company_industry TEXT DEFAULT NULL)
RETURNS BIGINT AS $$
DECLARE
    company_id BIGINT;
BEGIN
    SELECT id INTO company_id FROM companies WHERE name = company_name;

    IF company_id IS NULL THEN
        INSERT INTO companies (name, industry) VALUES (company_name, company_industry)
        RETURNING id INTO company_id;
    END IF;

    RETURN company_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create a school
CREATE OR REPLACE FUNCTION get_or_create_school(school_name TEXT, school_type TEXT DEFAULT 'university')
RETURNS BIGINT AS $$
DECLARE
    school_id BIGINT;
BEGIN
    SELECT id INTO school_id FROM schools WHERE name = school_name;

    IF school_id IS NULL THEN
        INSERT INTO schools (name, type) VALUES (school_name, school_type)
        RETURNING id INTO school_id;
    END IF;

    RETURN school_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create a skill
CREATE OR REPLACE FUNCTION get_or_create_skill(skill_name TEXT, skill_category TEXT DEFAULT 'programming')
RETURNS BIGINT AS $$
DECLARE
    skill_id BIGINT;
BEGIN
    SELECT id INTO skill_id FROM skills WHERE name = skill_name;

    IF skill_id IS NULL THEN
        INSERT INTO skills (name, category) VALUES (skill_name, skill_category)
        RETURNING id INTO skill_id;
    END IF;

    RETURN skill_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify table creation
SELECT 'Tables created successfully!' as status;

SELECT
    'companies' as table_name, COUNT(*) as row_count FROM companies
UNION ALL
SELECT 'schools', COUNT(*) FROM schools
UNION ALL
SELECT 'skills', COUNT(*) FROM skills;

-- Check indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 'companies'
    OR tablename LIKE 'schools'
    OR tablename LIKE 'skills'
    OR tablename LIKE 'candidate_%')
ORDER BY tablename, indexname;
