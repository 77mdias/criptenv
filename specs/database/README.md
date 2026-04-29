# Database Schema — Supabase PostgreSQL

## CriptEnv Database Design

---

## Overview

CriptEnv uses **Supabase** (PostgreSQL) with Row Level Security (RLS) for access control. The database stores **only encrypted blobs** — the server cannot read any secret values.

---

## Extensions Required

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
```

---

## Tables

### 1. users

BetterAuth-compatible user table with custom fields for CriptEnv.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    avatar_url TEXT,
    kdf_salt VARCHAR(64) NOT NULL,
    wrapped_dek BYTEA,
    two_factor_secret BYTEA,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    CONSTRAINT email_length CHECK (char_length(email) <= 255)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

**RLS Policies**:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);
```

---

### 2. sessions (BetterAuth)

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

---

### 3. projects

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    encryption_key_id VARCHAR(64) DEFAULT 'default',
    settings JSONB DEFAULT '{}',
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 255),
    CONSTRAINT slug_length CHECK (char_length(slug) >= 1 AND char_length(slug) <= 100),
    CONSTRAINT unique_owner_project_name UNIQUE (owner_id, name)
);

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_projects_archived ON projects(archived) WHERE archived = FALSE;
```

**RLS Policies**:
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Owners and members can view project
CREATE POLICY "Project members can view"
    ON projects FOR SELECT
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = projects.id
            AND user_id = auth.uid()
        )
    );

-- Owners can update
CREATE POLICY "Owner can update project"
    ON projects FOR UPDATE
    USING (owner_id = auth.uid());

-- Owners can delete
CREATE POLICY "Owner can delete project"
    ON projects FOR DELETE
    USING (owner_id = auth.uid());

-- Authenticated users can create projects
CREATE POLICY "Authenticated users can create"
    ON projects FOR INSERT
    WITH CHECK (owner_id = auth.uid());
```

---

### 4. environments

```sql
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    secrets_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_project_env_name UNIQUE (project_id, name),
    CONSTRAINT valid_env_name CHECK (
        name ~ '^[a-z][a-z0-9_-]*$' 
        AND char_length(name) >= 1 
        AND char_length(name) <= 100
    )
);

CREATE INDEX idx_environments_project_id ON environments(project_id);
CREATE INDEX idx_environments_name ON environments(project_id, name);
```

**RLS Policies**:
```sql
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;

-- Inherit from project
CREATE POLICY "Environments inherit project access"
    ON environments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = environments.project_id
            AND (
                owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_id = projects.id
                    AND user_id = auth.uid()
                )
            )
        )
    );
```

---

### 5. vault_blobs

The heart of the system — stores encrypted secrets. Server NEVER sees plaintext.

```sql
CREATE TABLE vault_blobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    key_id VARCHAR(64) NOT NULL,
    iv BYTEA NOT NULL,
    ciphertext BYTEA NOT NULL,
    auth_tag BYTEA NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    checksum VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_project_env_key UNIQUE (project_id, environment_id, key_id),
    CONSTRAINT iv_length CHECK (octet_length(iv) = 12),
    CONSTRAINT auth_tag_length CHECK (octet_length(auth_tag) = 16),
    CONSTRAINT positive_version CHECK (version >= 1)
);

CREATE INDEX idx_vault_blobs_project_env ON vault_blobs(project_id, environment_id);
CREATE INDEX idx_vault_blobs_key_id ON vault_blobs(key_id);
CREATE INDEX idx_vault_blobs_updated_at ON vault_blobs(updated_at);
```

**RLS Policies**:
```sql
ALTER TABLE vault_blobs ENABLE ROW LEVEL SECURITY;

-- Same access as environments (inherited via project)
CREATE POLICY "Vault inherits project access"
    ON vault_blobs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = vault_blobs.project_id
            AND (
                owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_id = projects.id
                    AND user_id = auth.uid()
                )
            )
        )
    );
```

---

### 6. project_members

```sql
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'developer', 'viewer')),
    invited_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    CONSTRAINT unique_project_user UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_role ON project_members(role);
```

**RLS Policies**:
```sql
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Owners and admins can manage members
CREATE POLICY "Admins can manage members"
    ON project_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = project_members.project_id
            AND (
                owner_id = auth.uid()
                OR (
                    EXISTS (
                        SELECT 1 FROM project_members pm2
                        WHERE pm2.project_id = projects.id
                        AND pm2.user_id = auth.uid()
                        AND pm2.role = 'admin'
                    )
                )
            )
        )
    );

-- Members can view other members
CREATE POLICY "Members can view other members"
    ON project_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = project_members.project_id
            AND (
                owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members pm2
                    WHERE pm2.project_id = projects.id
                    AND pm2.user_id = auth.uid()
                )
            )
        )
    );
```

---

### 7. project_invites

```sql
CREATE TABLE project_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email CITEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'developer', 'viewer')),
    invited_by UUID NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_project_email_pending UNIQUE (project_id, email)
);

CREATE INDEX idx_project_invites_project_id ON project_invites(project_id);
CREATE INDEX idx_project_invites_token ON project_invites(token);
CREATE INDEX idx_project_invites_email ON project_invites(email);
CREATE INDEX idx_project_invites_expires_at ON project_invites(expires_at)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;
```

---

### 8. audit_logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_project_id ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_project_action ON audit_logs(project_id, action);
```

**RLS Policies**:
```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Project members can view audit logs
CREATE POLICY "Project members can view audit"
    ON audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = audit_logs.project_id
            AND (
                owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_id = projects.id
                    AND user_id = auth.uid()
                )
            )
        )
    );

-- All authenticated users can insert (for logging)
CREATE POLICY "Authenticated can create audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
```

---

### 9. ci_tokens

```sql
CREATE TABLE ci_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_project_token_name UNIQUE (project_id, name)
);

CREATE INDEX idx_ci_tokens_project_id ON ci_tokens(project_id);
CREATE INDEX idx_ci_tokens_token_hash ON ci_tokens(token_hash);
```

---

## Functions & Triggers

### Updated At Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_environments_updated_at
    BEFORE UPDATE ON environments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_vault_blobs_updated_at
    BEFORE UPDATE ON vault_blobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Increment Secrets Version

```sql
CREATE OR REPLACE FUNCTION increment_secrets_version()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE environments
    SET secrets_version = secrets_version + 1
    WHERE id = NEW.environment_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vault_blobs_version_bump
    AFTER INSERT OR UPDATE ON vault_blobs
    FOR EACH ROW EXECUTE FUNCTION increment_secrets_version();
```

---

## Full Schema SQL

Complete migration file at `supabase/migrations/001_initial_schema.sql`:

```sql
-- CriptEnv Initial Schema
-- Version: 1.0.0

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email CITEXT UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    avatar_url TEXT,
    kdf_salt VARCHAR(64) NOT NULL,
    wrapped_dek BYTEA,
    two_factor_secret BYTEA,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);

-- Sessions Table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    encryption_key_id VARCHAR(64) DEFAULT 'default',
    settings JSONB DEFAULT '{}',
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_slug ON projects(slug);

-- Environments Table
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    secrets_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE INDEX idx_environments_project_id ON environments(project_id);

-- Vault Blobs Table
CREATE TABLE vault_blobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    key_id VARCHAR(64) NOT NULL,
    iv BYTEA NOT NULL,
    ciphertext BYTEA NOT NULL,
    auth_tag BYTEA NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    checksum VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, environment_id, key_id)
);

CREATE INDEX idx_vault_blobs_project_env ON vault_blobs(project_id, environment_id);

-- Project Members Table
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'developer', 'viewer')),
    invited_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- Project Invites Table
CREATE TABLE project_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email CITEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'developer', 'viewer')),
    invited_by UUID NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_invites_token ON project_invites(token);
CREATE INDEX idx_project_invites_email ON project_invites(email);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_project_id ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- CI Tokens Table
CREATE TABLE ci_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE INDEX idx_ci_tokens_project_id ON ci_tokens(project_id);
CREATE INDEX idx_ci_tokens_token_hash ON ci_tokens(token_hash);

-- Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_environments_updated_at BEFORE UPDATE ON environments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_vault_blobs_updated_at BEFORE UPDATE ON vault_blobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment secrets version on vault change
CREATE OR REPLACE FUNCTION increment_secrets_version()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE environments
    SET secrets_version = secrets_version + 1
    WHERE id = NEW.environment_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vault_blobs_version_bump
    AFTER INSERT OR UPDATE ON vault_blobs
    FOR EACH ROW EXECUTE FUNCTION increment_secrets_version();

COMMIT;
```

---

## Realtime Configuration

Enable Realtime for vault updates:

```sql
-- Enable realtime on vault_blobs
ALTER PUBLICATION supabase_realtime ADD TABLE vault_blobs;

-- Or manually
ALTER TABLE vault_blobs REPLICA IDENTITY FULL;
```

---

## Backup & Recovery

```sql
-- Point-in-time recovery enabled by default on Supabase Pro
-- Manual backup trigger
CREATE OR REPLACE FUNCTION create_backup()
RETURNS void AS $$
BEGIN
    PERFORM pg_backup_start('criptenv-backup', false);
END;
$$ LANGUAGE plpgsql;
```

---

**Document Version**: 1.0  
**Next**: Encryption Protocol
