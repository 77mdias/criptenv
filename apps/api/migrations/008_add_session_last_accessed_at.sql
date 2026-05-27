-- Migration: Add last_accessed_at to sessions table
-- Purpose: Track session activity for inactivity-based cleanup
-- Date: 2026-05-27

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'last_accessed_at'
    ) THEN
        ALTER TABLE sessions ADD COLUMN last_accessed_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added last_accessed_at column to sessions table';
    ELSE
        RAISE NOTICE 'Column last_accessed_at already exists in sessions table';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_last_accessed_at ON sessions(last_accessed_at);
