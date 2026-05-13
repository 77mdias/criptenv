-- Migration 004: Add ON DELETE CASCADE to sessions.user_id foreign key
-- Fixes: Unable to delete users from Supabase dashboard due to sessions FK constraint
-- Idempotent by design

-- Drop existing FK constraint if it exists (PostgreSQL auto-generated name or common naming)
ALTER TABLE sessions
    DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;

-- Recreate with ON DELETE CASCADE
ALTER TABLE sessions
    ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
