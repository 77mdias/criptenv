-- Migration 007: Add two_factor_backup_codes column to users table
-- Stores hashed backup codes for 2FA recovery
-- Idempotent by design

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]'::jsonb;
