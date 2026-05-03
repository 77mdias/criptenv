-- Migration 002: Add missing columns to ci_tokens table
-- Phase 3: CI Tokens enhancement (scopes, environment_scope, description, revoked_at, created_by)
-- Idempotent by design

ALTER TABLE ci_tokens
    ADD COLUMN IF NOT EXISTS description VARCHAR(500),
    ADD COLUMN IF NOT EXISTS scopes JSON DEFAULT '["read:secrets"]',
    ADD COLUMN IF NOT EXISTS environment_scope VARCHAR(255),
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
