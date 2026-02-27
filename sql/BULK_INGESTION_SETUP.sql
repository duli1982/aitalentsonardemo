-- ============================================
-- Bulk Ingestion Progress Tracking Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create bulk_ingestion_progress table
CREATE TABLE IF NOT EXISTS bulk_ingestion_progress (
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
CREATE INDEX IF NOT EXISTS idx_bulk_ingestion_job_id ON bulk_ingestion_progress(job_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_bulk_ingestion_status ON bulk_ingestion_progress(status);

-- Create index on start_time for sorting
CREATE INDEX IF NOT EXISTS idx_bulk_ingestion_start_time ON bulk_ingestion_progress(start_time DESC);

-- Grant permissions (adjust if needed)
ALTER TABLE bulk_ingestion_progress ENABLE ROW LEVEL SECURITY;

-- Authenticated-only policy
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON bulk_ingestion_progress;
CREATE POLICY "Allow all operations for authenticated users"
ON bulk_ingestion_progress
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Optional for local/demo only:
-- CREATE POLICY "Allow all operations for anonymous users"
-- ON bulk_ingestion_progress
-- FOR ALL
-- TO anon
-- USING (true)
-- WITH CHECK (true);

COMMENT ON TABLE bulk_ingestion_progress IS 'Tracks progress of bulk candidate ingestion jobs';
COMMENT ON COLUMN bulk_ingestion_progress.job_id IS 'Unique identifier for the bulk ingestion job';
COMMENT ON COLUMN bulk_ingestion_progress.total IS 'Total number of profiles to generate';
COMMENT ON COLUMN bulk_ingestion_progress.completed IS 'Number of profiles successfully ingested';
COMMENT ON COLUMN bulk_ingestion_progress.failed IS 'Number of profiles that failed to ingest';
COMMENT ON COLUMN bulk_ingestion_progress.current_batch IS 'Current batch number being processed';
COMMENT ON COLUMN bulk_ingestion_progress.total_batches IS 'Total number of batches to process';
COMMENT ON COLUMN bulk_ingestion_progress.status IS 'Current status: running, paused, completed, or failed';
COMMENT ON COLUMN bulk_ingestion_progress.errors IS 'Array of error messages encountered';
