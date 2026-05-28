-- Migration 009: Create 2FA login challenge and trusted device tables

CREATE TABLE IF NOT EXISTS two_factor_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_user_id
    ON two_factor_challenges(user_id);

CREATE INDEX IF NOT EXISTS idx_two_factor_challenges_user_id_created_at
    ON two_factor_challenges(user_id, created_at);

CREATE TABLE IF NOT EXISTS two_factor_trusted_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_trusted_devices_user_id
    ON two_factor_trusted_devices(user_id);

CREATE INDEX IF NOT EXISTS idx_two_factor_trusted_devices_user_id_created_at
    ON two_factor_trusted_devices(user_id, created_at);
