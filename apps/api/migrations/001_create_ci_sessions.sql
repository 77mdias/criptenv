-- Phase 3 Rescue: persisted CI sessions for ci_s_* temporary tokens.
-- Idempotent by design because CriptEnv does not use Alembic yet.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ci_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ci_token_id UUID NOT NULL REFERENCES ci_tokens(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scopes JSON DEFAULT '["read:secrets"]',
    environment_scope VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ci_sessions_token_hash
    ON ci_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_ci_sessions_ci_token_id
    ON ci_sessions(ci_token_id);

CREATE INDEX IF NOT EXISTS idx_ci_sessions_project_id
    ON ci_sessions(project_id);

CREATE INDEX IF NOT EXISTS idx_ci_sessions_expires_at
    ON ci_sessions(expires_at);
