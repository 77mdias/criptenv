-- Migration 005: Add ON DELETE behaviors to all user_id foreign keys
-- Fixes: Unable to delete users from Supabase dashboard due to various FK constraints
-- Idempotent by design

-- ============================================
-- 1. CASCADE: records that should vanish with the user
-- ============================================

-- sessions (handled in 004, included here for completeness if re-running)
ALTER TABLE sessions
    DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE sessions
    ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- project_members: membership is tied to the user
ALTER TABLE project_members
    DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
ALTER TABLE project_members
    ADD CONSTRAINT project_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- api_keys: keys belong to the user
ALTER TABLE api_keys
    DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================
-- 2. SET NULL: keep the record, remove the user reference
-- ============================================

-- project_members.invited_by: keep membership, lose who invited
ALTER TABLE project_members
    DROP CONSTRAINT IF EXISTS project_members_invited_by_fkey;
ALTER TABLE project_members
    ADD CONSTRAINT project_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;

-- project_invites.invited_by: keep invite, lose who invited
ALTER TABLE project_invites
    DROP CONSTRAINT IF EXISTS project_invites_invited_by_fkey;
ALTER TABLE project_invites
    ADD CONSTRAINT project_invites_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;

-- audit_logs: keep audit trail, lose actor reference
ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- api_keys.created_by: keep key, lose creator reference
ALTER TABLE api_keys
    DROP CONSTRAINT IF EXISTS api_keys_created_by_fkey;
ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ci_tokens.created_by: keep token, lose creator reference
ALTER TABLE ci_tokens
    DROP CONSTRAINT IF EXISTS ci_tokens_created_by_fkey;
ALTER TABLE ci_tokens
    ADD CONSTRAINT ci_tokens_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- secret_rotations: keep rotation history, lose actor reference
ALTER TABLE secret_rotations
    DROP CONSTRAINT IF EXISTS secret_rotations_rotated_by_fkey;
ALTER TABLE secret_rotations
    ADD CONSTRAINT secret_rotations_rotated_by_fkey
    FOREIGN KEY (rotated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 3. INTENTIONALLY UNCHANGED: projects.owner_id
-- ============================================
-- projects.owner_id remains RESTRICT to force explicit ownership
-- transfer before a user can be deleted. A project cannot exist
-- without an owner.
