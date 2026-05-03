-- Migration 003: Create api_keys table for M3.4 Public API
-- Idempotent by design

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    prefix VARCHAR(20) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    scopes JSON DEFAULT '["read:secrets"]',
    environment_scope VARCHAR(255),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS ix_api_keys_user_project
    ON api_keys(user_id, project_id);

CREATE INDEX IF NOT EXISTS ix_api_keys_key_hash
    ON api_keys(key_hash);
