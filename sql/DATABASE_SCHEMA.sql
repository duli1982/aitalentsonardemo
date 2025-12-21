-- ============================================
-- TALENT SONAR AI - Production Database Schema
-- ============================================
-- Database: PostgreSQL 14+
-- Purpose: Complete production-ready schema
-- Created: 2025
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSONB operations
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================
-- 1. CORE TABLES
-- ============================================

-- Jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    job_type VARCHAR(50) DEFAULT 'Full-time',
    description TEXT NOT NULL,
    required_skills JSONB NOT NULL DEFAULT '[]'::JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'on hold')),
    posted_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Company context for better matching
    company_context JSONB DEFAULT '{}'::JSONB,
    -- Example: {"industry": "SaaS", "companySize": "500-1000", "reportingStructure": "Direct to CTO"}

    -- Metadata
    created_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP, -- Soft delete

    -- Indexing for fast searches
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(title, '') || ' ' ||
            coalesce(department, '') || ' ' ||
            coalesce(description, '')
        )
    ) STORED
);

-- Indexes for jobs
CREATE INDEX idx_jobs_status ON jobs(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_department ON jobs(department) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX idx_jobs_search ON jobs USING GIN(search_vector);
CREATE INDEX idx_jobs_required_skills ON jobs USING GIN(required_skills);

-- ============================================
-- Candidates table (unified schema for all types)
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('internal', 'past', 'uploaded')),

    -- Common fields
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    skills JSONB NOT NULL DEFAULT '[]'::JSONB,

    -- File management
    cv_file_url VARCHAR(500),
    cv_file_name VARCHAR(255),
    cv_parsed_at TIMESTAMP,

    -- Type-specific metadata stored as JSONB
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    /*
    For 'internal':
    {
        "currentRole": "Software Engineer",
        "department": "Technology",
        "experienceYears": 3,
        "performanceRating": 4,
        "careerAspirations": "...",
        "developmentGoals": "...",
        "learningAgility": 4
    }

    For 'past':
    {
        "previousRoleAppliedFor": "Senior Developer",
        "lastContactDate": "2024-06-15",
        "notes": "Strong technical skills..."
    }

    For 'uploaded':
    {
        "summary": "Experienced developer...",
        "experienceYears": 5
    }
    */

    -- Profile status
    profile_status VARCHAR(20) DEFAULT 'partial' CHECK (profile_status IN ('complete', 'partial', 'placeholder')),
    employment_status VARCHAR(20) DEFAULT 'available' CHECK (employment_status IN ('available', 'interviewing', 'hired')),

    -- Social profiles
    linkedin_url VARCHAR(500),
    github_url VARCHAR(500),

    -- Hidden gem flag (set by AI or recruiter)
    is_hidden_gem BOOLEAN DEFAULT false,

    -- Metadata
    created_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP, -- Soft delete

    -- Search optimization
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(name, '') || ' ' ||
            coalesce(email, '')
        )
    ) STORED
);

-- Indexes for candidates
CREATE UNIQUE INDEX idx_candidates_email ON candidates(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_candidates_type ON candidates(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_candidates_status ON candidates(employment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_candidates_created_at ON candidates(created_at DESC);
CREATE INDEX idx_candidates_search ON candidates USING GIN(search_vector);
CREATE INDEX idx_candidates_skills ON candidates USING GIN(skills);
CREATE INDEX idx_candidates_hidden_gem ON candidates(is_hidden_gem) WHERE is_hidden_gem = true;

-- ============================================
-- 2. MATCHING & ANALYSIS TABLES
-- ============================================

-- Match scores (computed and cached)
CREATE TABLE match_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

    -- Basic scoring
    match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    match_rationale TEXT,

    -- AI-enhanced analysis (from Gemini)
    ai_analysis JSONB,
    /*
    {
        "multiDimensionalAnalysis": {
            "technicalSkillAlignment": {"score": 85, "rationale": "..."},
            "transferableSkillMapping": {"score": 70, "rationale": "..."},
            "careerStageAlignment": {"score": 90, "rationale": "..."},
            "learningAgilityIndicators": {"score": 75, "rationale": "..."},
            "teamFitSignals": {"score": 80, "rationale": "..."}
        },
        "strengths": ["React expert", "Fast learner"],
        "gaps": ["Limited TypeScript experience"],
        "skillGapAnalysis": [...],
        "futurePotentialProjection": {...}
    }
    */

    -- Analysis metadata
    analysis_type VARCHAR(20) DEFAULT 'basic' CHECK (analysis_type IN ('basic', 'ai_enhanced', 'deep')),
    analyzed_at TIMESTAMP,
    analyzed_by VARCHAR(50), -- 'system' or 'gemini-2.5-pro'

    -- Version tracking (for A/B testing)
    algorithm_version VARCHAR(20) DEFAULT 'v1.0',

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Ensure one score per job-candidate pair
    UNIQUE(job_id, candidate_id)
);

-- Indexes for match_scores
CREATE INDEX idx_match_scores_job ON match_scores(job_id, match_score DESC);
CREATE INDEX idx_match_scores_candidate ON match_scores(candidate_id, match_score DESC);
CREATE INDEX idx_match_scores_score ON match_scores(match_score DESC);
CREATE INDEX idx_match_scores_analyzed ON match_scores(analyzed_at DESC) WHERE analysis_type = 'ai_enhanced';
CREATE INDEX idx_match_ai_analysis ON match_scores USING GIN(ai_analysis);

-- ============================================
-- 3. FEEDBACK & LEARNING TABLES
-- ============================================

-- Recruiter feedback for ML training
CREATE TABLE recruiter_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    recruiter_id UUID NOT NULL,

    -- Feedback type
    feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'hired', 'rejected', 'interviewed')),

    -- Optional notes
    notes TEXT,

    -- Feedback context
    match_score_at_feedback INTEGER, -- What was the score when feedback given?
    stage VARCHAR(50), -- 'screening', 'interview', 'offer', 'hired'

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for recruiter_feedback
CREATE INDEX idx_feedback_job ON recruiter_feedback(job_id, created_at DESC);
CREATE INDEX idx_feedback_candidate ON recruiter_feedback(candidate_id, created_at DESC);
CREATE INDEX idx_feedback_recruiter ON recruiter_feedback(recruiter_id, created_at DESC);
CREATE INDEX idx_feedback_type ON recruiter_feedback(feedback_type);
CREATE INDEX idx_feedback_hired ON recruiter_feedback(feedback_type) WHERE feedback_type = 'hired';

-- ============================================
-- Hiring outcomes (for ML training)
CREATE TABLE hiring_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    candidate_id UUID NOT NULL REFERENCES candidates(id),

    -- Outcome details
    hired BOOLEAN NOT NULL,
    hire_date DATE,

    -- Performance tracking (for validation)
    performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
    retention_months INTEGER, -- How long did they stay?

    -- What was predicted vs actual
    predicted_score INTEGER,
    actual_fit_score INTEGER,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(job_id, candidate_id)
);

-- Indexes for hiring_outcomes
CREATE INDEX idx_outcomes_job ON hiring_outcomes(job_id);
CREATE INDEX idx_outcomes_candidate ON hiring_outcomes(candidate_id);
CREATE INDEX idx_outcomes_hired ON hiring_outcomes(hired);
CREATE INDEX idx_outcomes_performance ON hiring_outcomes(performance_rating) WHERE hired = true;

-- ============================================
-- 4. USER & AUTHENTICATION TABLES
-- ============================================

-- Users (recruiters, hiring managers, admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'recruiter', 'hiring_manager', 'viewer')),
    department VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,

    -- Preferences
    preferences JSONB DEFAULT '{}'::JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email) WHERE is_active = true;
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;

-- ============================================
-- Sessions (for authentication)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX idx_sessions_token ON sessions(token) WHERE expires_at > NOW();
CREATE INDEX idx_sessions_user ON sessions(user_id, expires_at DESC);

-- ============================================
-- 5. ANALYTICS & AUDIT TABLES
-- ============================================

-- Activity log (audit trail)
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),

    -- What happened
    action VARCHAR(100) NOT NULL, -- 'job_created', 'candidate_analyzed', 'feedback_given'
    entity_type VARCHAR(50) NOT NULL, -- 'job', 'candidate', 'match_score'
    entity_id UUID NOT NULL,

    -- Details
    details JSONB,

    -- Context
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for activity_log
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_action ON activity_log(action, created_at DESC);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

-- Partition by month for performance (optional, for high volume)
-- CREATE TABLE activity_log_y2025m01 PARTITION OF activity_log
-- FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- ============================================
-- API usage tracking (for cost management)
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),

    -- API details
    api_provider VARCHAR(50) NOT NULL, -- 'gemini', 'openai', etc.
    api_model VARCHAR(100) NOT NULL, -- 'gemini-2.5-pro', 'gemini-2.5-flash'
    api_operation VARCHAR(100) NOT NULL, -- 'analyze_fit', 'parse_cv', 'analyze_job'

    -- Usage
    tokens_used INTEGER,
    estimated_cost DECIMAL(10, 6),

    -- Associated entities
    job_id UUID,
    candidate_id UUID,

    -- Response details
    response_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for api_usage
CREATE INDEX idx_api_usage_user ON api_usage(user_id, created_at DESC);
CREATE INDEX idx_api_usage_provider ON api_usage(api_provider, created_at DESC);
CREATE INDEX idx_api_usage_cost ON api_usage(created_at DESC, estimated_cost);
CREATE INDEX idx_api_usage_errors ON api_usage(success) WHERE success = false;

-- ============================================
-- 6. JOB QUEUE TABLES (for async processing)
-- ============================================

-- Background jobs queue
CREATE TABLE job_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Job details
    job_type VARCHAR(100) NOT NULL, -- 'analyze_candidates', 'parse_cv', 'send_email'
    payload JSONB NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
    priority INTEGER DEFAULT 5, -- 1 = highest, 10 = lowest

    -- Execution
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,

    -- Scheduling
    scheduled_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for job_queue
CREATE INDEX idx_queue_status ON job_queue(status, priority, scheduled_at)
    WHERE status IN ('pending', 'retry');
CREATE INDEX idx_queue_type ON job_queue(job_type, status);
CREATE INDEX idx_queue_created ON job_queue(created_at DESC);

-- ============================================
-- 7. NOTIFICATION TABLES
-- ============================================

-- Notifications for users
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification content
    type VARCHAR(50) NOT NULL, -- 'new_match', 'analysis_complete', 'candidate_applied'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Action
    action_url VARCHAR(500),
    action_label VARCHAR(100),

    -- Status
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC)
    WHERE read = false;
CREATE INDEX idx_notifications_type ON notifications(type, created_at DESC);

-- ============================================
-- 8. VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Best matches per job (top 20)
CREATE OR REPLACE VIEW v_top_matches_per_job AS
SELECT
    ms.job_id,
    j.title as job_title,
    ms.candidate_id,
    c.name as candidate_name,
    c.type as candidate_type,
    ms.match_score,
    ms.match_rationale,
    ms.analysis_type,
    ROW_NUMBER() OVER (PARTITION BY ms.job_id ORDER BY ms.match_score DESC) as rank
FROM match_scores ms
JOIN jobs j ON j.id = ms.job_id AND j.deleted_at IS NULL
JOIN candidates c ON c.id = ms.candidate_id AND c.deleted_at IS NULL
WHERE ms.match_score >= 50 -- Only good matches
ORDER BY ms.job_id, ms.match_score DESC;

-- View: Candidate summary with match statistics
CREATE OR REPLACE VIEW v_candidate_summary AS
SELECT
    c.id,
    c.name,
    c.email,
    c.type,
    c.employment_status,
    COUNT(ms.id) as total_jobs_matched,
    MAX(ms.match_score) as best_match_score,
    AVG(ms.match_score)::INTEGER as avg_match_score,
    COUNT(CASE WHEN ms.match_score >= 70 THEN 1 END) as strong_matches,
    COUNT(CASE WHEN ms.match_score >= 50 AND ms.match_score < 70 THEN 1 END) as good_matches
FROM candidates c
LEFT JOIN match_scores ms ON ms.candidate_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.email, c.type, c.employment_status;

-- View: Job statistics
CREATE OR REPLACE VIEW v_job_statistics AS
SELECT
    j.id,
    j.title,
    j.department,
    j.status,
    COUNT(ms.id) as total_candidates,
    COUNT(CASE WHEN ms.match_score >= 70 THEN 1 END) as strong_matches,
    COUNT(CASE WHEN ms.match_score >= 50 AND ms.match_score < 70 THEN 1 END) as good_matches,
    COUNT(CASE WHEN ms.analysis_type = 'ai_enhanced' THEN 1 END) as ai_analyzed_count,
    MAX(ms.match_score) as highest_match_score,
    AVG(ms.match_score)::INTEGER as avg_match_score
FROM jobs j
LEFT JOIN match_scores ms ON ms.job_id = j.id
WHERE j.deleted_at IS NULL
GROUP BY j.id, j.title, j.department, j.status;

-- View: Recent activity dashboard
CREATE OR REPLACE VIEW v_recent_activity AS
SELECT
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    u.full_name as user_name,
    u.email as user_email,
    al.created_at,
    CASE
        WHEN al.entity_type = 'job' THEN (SELECT title FROM jobs WHERE id = al.entity_id)
        WHEN al.entity_type = 'candidate' THEN (SELECT name FROM candidates WHERE id = al.entity_id)
        ELSE NULL
    END as entity_name
FROM activity_log al
LEFT JOIN users u ON u.id = al.user_id
ORDER BY al.created_at DESC
LIMIT 100;

-- ============================================
-- 9. FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all relevant tables
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_match_scores_updated_at BEFORE UPDATE ON match_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Auto-create match scores when job is created
CREATE OR REPLACE FUNCTION create_match_scores_for_new_job()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue a background job to calculate initial match scores
    INSERT INTO job_queue (job_type, payload, priority)
    VALUES (
        'calculate_initial_matches',
        jsonb_build_object('job_id', NEW.id),
        1 -- High priority
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_match_scores
    AFTER INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION create_match_scores_for_new_job();

-- Function: Auto-create match scores when candidate is added
CREATE OR REPLACE FUNCTION create_match_scores_for_new_candidate()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue a background job to calculate initial match scores
    INSERT INTO job_queue (job_type, payload, priority)
    VALUES (
        'calculate_candidate_matches',
        jsonb_build_object('candidate_id', NEW.id),
        2 -- Medium priority
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_candidate_match_scores
    AFTER INSERT ON candidates
    FOR EACH ROW
    EXECUTE FUNCTION create_match_scores_for_new_candidate();

-- Function: Log activity automatically
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_log (action, entity_type, entity_id, details)
        VALUES (
            TG_TABLE_NAME || '_created',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(NEW)::JSONB
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO activity_log (action, entity_type, entity_id, details)
        VALUES (
            TG_TABLE_NAME || '_updated',
            TG_TABLE_NAME,
            NEW.id,
            jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply activity logging to key tables
CREATE TRIGGER log_jobs_activity
    AFTER INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_candidates_activity
    AFTER INSERT OR UPDATE ON candidates
    FOR EACH ROW
    EXECUTE FUNCTION log_activity();

-- ============================================
-- 10. SAMPLE DATA FUNCTIONS
-- ============================================

-- Function: Get top matches for a job
CREATE OR REPLACE FUNCTION get_top_matches(
    p_job_id UUID,
    p_limit INTEGER DEFAULT 15
)
RETURNS TABLE (
    candidate_id UUID,
    candidate_name VARCHAR,
    candidate_type VARCHAR,
    match_score INTEGER,
    match_rationale TEXT,
    ai_analyzed BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.type,
        ms.match_score,
        ms.match_rationale,
        (ms.analysis_type = 'ai_enhanced') as ai_analyzed
    FROM match_scores ms
    JOIN candidates c ON c.id = ms.candidate_id
    WHERE ms.job_id = p_job_id
        AND c.deleted_at IS NULL
    ORDER BY ms.match_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. INDEXES FOR FULL-TEXT SEARCH
-- ============================================

-- Additional GIN indexes for JSON fields
CREATE INDEX idx_jobs_company_context ON jobs USING GIN(company_context);
CREATE INDEX idx_candidates_metadata ON candidates USING GIN(metadata);

-- ============================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE jobs IS 'Job requisitions posted by recruiters';
COMMENT ON TABLE candidates IS 'Unified candidate database - internal, past, and uploaded';
COMMENT ON TABLE match_scores IS 'Computed match scores between jobs and candidates - cached for performance';
COMMENT ON TABLE recruiter_feedback IS 'Feedback from recruiters for ML model training';
COMMENT ON TABLE hiring_outcomes IS 'Actual hiring outcomes for model validation';
COMMENT ON TABLE users IS 'System users - recruiters, hiring managers, admins';
COMMENT ON TABLE activity_log IS 'Audit trail of all system actions';
COMMENT ON TABLE api_usage IS 'Tracking of external API calls for cost management';
COMMENT ON TABLE job_queue IS 'Background job queue for async processing';

-- ============================================
-- END OF SCHEMA
-- ============================================

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO talent_sonar_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO talent_sonar_app;
