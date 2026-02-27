-- ============================================
-- Graph Migration Progress Tracking Setup
-- Run this in your Supabase SQL Editor
-- (Only needed if you want to track migration progress)
-- ============================================

-- Create graph_migration_progress table
CREATE TABLE IF NOT EXISTS graph_migration_progress (
    id BIGSERIAL PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    total INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    current_batch INTEGER DEFAULT 0,
    total_batches INTEGER NOT NULL,
    status TEXT CHECK (status IN ('running', 'paused', 'completed', 'failed')) DEFAULT 'running',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    last_update TIMESTAMP WITH TIME ZONE NOT NULL,
    errors TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on job_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_graph_migration_job_id ON graph_migration_progress(job_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_graph_migration_status ON graph_migration_progress(status);

-- Create index on start_time for sorting
CREATE INDEX IF NOT EXISTS idx_graph_migration_start_time ON graph_migration_progress(start_time DESC);

-- Grant permissions (adjust if needed)
ALTER TABLE graph_migration_progress ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON graph_migration_progress;
CREATE POLICY "Allow all operations for authenticated users"
ON graph_migration_progress
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Optional for local/demo only:
-- CREATE POLICY "Allow all operations for anonymous users"
-- ON graph_migration_progress
-- FOR ALL
-- TO anon
-- USING (true)
-- WITH CHECK (true);

COMMENT ON TABLE graph_migration_progress IS 'Tracks progress of Knowledge Graph migration jobs for existing candidates';
COMMENT ON COLUMN graph_migration_progress.job_id IS 'Unique identifier for the migration job';
COMMENT ON COLUMN graph_migration_progress.total IS 'Total number of candidates to migrate';
COMMENT ON COLUMN graph_migration_progress.completed IS 'Number of candidates successfully migrated';
COMMENT ON COLUMN graph_migration_progress.failed IS 'Number of candidates that failed to migrate';
COMMENT ON COLUMN graph_migration_progress.current_batch IS 'Current batch number being processed';
COMMENT ON COLUMN graph_migration_progress.total_batches IS 'Total number of batches to process';
COMMENT ON COLUMN graph_migration_progress.status IS 'Current status: running, paused, completed, or failed';
COMMENT ON COLUMN graph_migration_progress.errors IS 'Array of error messages encountered';
