# FastAPI Endpoint Definitions — CriptEnv

## API Reference v1

Base URL: `https://api.criptenv.com/api/v1`

---

## Authentication

All endpoints require authentication via BetterAuth session token.

**Header**: `Authorization: Bearer <session_token>`

### Auth Endpoints (BetterAuth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/signin` | Login |
| POST | `/api/auth/signout` | Logout |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/verify-2fa` | Verify 2FA code |
| GET | `/api/auth/oauth/:provider` | Initiate OAuth flow |
| GET | `/api/auth/oauth/:provider/callback` | OAuth callback |

### Signup Request

```json
POST /api/auth/signup
{
  "email": "developer@example.com",
  "password": "SecureP@ssw0rd!",
  "name": "John Developer"
}
```

**Response (201 Created)**:
```json
{
  "user": {
    "id": "usr_abc123",
    "email": "developer@example.com",
    "name": "John Developer",
    "kdf_salt": "random_salt_32bytes"
  },
  "session": {
    "token": "bst_xxx...",
    "expires_at": "2024-01-16T00:00:00Z"
  }
}
```

---

## Projects

### Create Project

```
POST /api/v1/projects
```

**Request**:
```json
{
  "name": "my-api",
  "description": "My backend API project"
}
```

**Response (201 Created)**:
```json
{
  "id": "prj_xyz789",
  "name": "my-api",
  "slug": "my-api",
  "description": "My backend API project",
  "owner_id": "usr_abc123",
  "encryption_key_id": "key_default",
  "environments": [
    {
      "id": "env_default",
      "name": "development",
      "display_name": "Development",
      "is_default": true
    }
  ],
  "created_at": "2024-01-15T10:30:00Z"
}
```

### List Projects

```
GET /api/v1/projects
```

**Response (200 OK)**:
```json
{
  "projects": [
    {
      "id": "prj_xyz789",
      "name": "my-api",
      "slug": "my-api",
      "description": "My backend API project",
      "role": "owner",
      "secrets_count": 15,
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

### Get Project

```
GET /api/v1/projects/:project_id
```

### Update Project

```
PATCH /api/v1/projects/:project_id
```

```json
{
  "name": "my-api-v2",
  "description": "Updated description"
}
```

### Delete Project

```
DELETE /api/v1/projects/:project_id
```

**Response (204 No Content)**

---

## Environments

### Create Environment

```
POST /api/v1/projects/:project_id/environments
```

```json
{
  "name": "staging",
  "display_name": "Staging Environment"
}
```

### List Environments

```
GET /api/v1/projects/:project_id/environments
```

**Response**:
```json
{
  "environments": [
    {
      "id": "env_dev",
      "name": "development",
      "display_name": "Development",
      "is_default": true,
      "secrets_count": 12,
      "secrets_version": 5
    },
    {
      "id": "env_staging",
      "name": "staging",
      "display_name": "Staging",
      "is_default": false,
      "secrets_count": 15,
      "secrets_version": 8
    },
    {
      "id": "env_prod",
      "name": "production",
      "display_name": "Production",
      "is_default": false,
      "secrets_count": 18,
      "secrets_version": 42
    }
  ]
}
```

### Delete Environment

```
DELETE /api/v1/projects/:project_id/environments/:environment_id
```

---

## Vault (Secrets)

### Push Secrets (Upload Encrypted Blob)

```
POST /api/v1/projects/:project_id/environments/:environment_name/vault
```

```json
{
  "encrypted_blob": "base64_encrypted_data...",
  "iv": "base64_iv_12_bytes",
  "auth_tag": "base64_auth_tag_16_bytes",
  "version": 42,
  "checksum": "sha256:abc123..."
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "new_version": 43,
  "updated_at": "2024-01-15T10:35:00Z"
}
```

### Pull Secrets (Download Encrypted Blob)

```
GET /api/v1/projects/:project_id/environments/:environment_name/vault
```

**Response (200 OK)**:
```json
{
  "encrypted_blob": "base64_encrypted_data...",
  "iv": "base64_iv_12_bytes",
  "auth_tag": "base64_auth_tag_16_bytes",
  "version": 43,
  "checksum": "sha256:def456...",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

### Get Vault Metadata (Without Blob)

```
HEAD /api/v1/projects/:project_id/environments/:environment_name/vault
```

**Response Headers**:
```
X-Vault-Version: 43
X-Vault-Updated-At: 2024-01-15T10:35:00Z
X-Vault-Checksum: sha256:def456...
```

### Check Sync Status

```
GET /api/v1/projects/:project_id/environments/:environment_name/vault/status
```

**Response**:
```json
{
  "version": 43,
  "server_version": 43,
  "in_sync": true,
  "last_push": "2024-01-15T10:35:00Z",
  "last_pull": "2024-01-15T10:30:00Z"
}
```

---

## Sync & Conflicts

### Resolve Conflict

```
POST /api/v1/projects/:project_id/environments/:environment_name/vault/resolve
```

```json
{
  "conflict_version": 42,
  "resolution": "remote",
  "encrypted_blob": "base64...",
  "iv": "base64...",
  "auth_tag": "base64...",
  "version": 43
}
```

**Resolution options**: `local` | `remote` | `merge`

---

## Team Management

### Invite Member

```
POST /api/v1/projects/:project_id/invites
```

```json
{
  "email": "teammate@example.com",
  "role": "developer"
}
```

**Response (201 Created)**:
```json
{
  "invite_id": "inv_xxx",
  "email": "teammate@example.com",
  "role": "developer",
  "expires_at": "2024-01-22T10:30:00Z"
}
```

### List Members

```
GET /api/v1/projects/:project_id/members
```

**Response**:
```json
{
  "members": [
    {
      "id": "mem_001",
      "user_id": "usr_abc123",
      "email": "owner@example.com",
      "name": "Project Owner",
      "role": "owner",
      "joined_at": "2024-01-10T08:00:00Z"
    },
    {
      "id": "mem_002",
      "user_id": "usr_def456",
      "email": "dev@example.com",
      "name": "Developer",
      "role": "developer",
      "joined_at": "2024-01-12T14:30:00Z"
    }
  ]
}
```

### Update Member Role

```
PATCH /api/v1/projects/:project_id/members/:member_id
```

```json
{
  "role": "admin"
}
```

### Remove Member

```
DELETE /api/v1/projects/:project_id/members/:member_id
```

### List Pending Invites

```
GET /api/v1/projects/:project_id/invites
```

### Revoke Invite

```
DELETE /api/v1/projects/:project_id/invites/:invite_id
```

---

## Audit Logs

### Get Audit Logs

```
GET /api/v1/projects/:project_id/audit
```

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `per_page` | int | Items per page (default: 50, max: 100) |
| `action` | string | Filter by action |
| `user_id` | string | Filter by user |
| `from` | ISO date | Start date |
| `to` | ISO date | End date |

**Response**:
```json
{
  "logs": [
    {
      "id": "log_001",
      "action": "secret.pushed",
      "resource_type": "vault",
      "resource_id": "prj_xyz789",
      "user_id": "usr_abc123",
      "user_email": "developer@example.com",
      "ip_address": "192.168.1.1",
      "user_agent": "criptenv-cli/1.0.0",
      "metadata": {
        "environment": "production",
        "version": 42
      },
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "log_002",
      "action": "member.joined",
      "resource_type": "member",
      "resource_id": "mem_002",
      "user_id": "usr_def456",
      "user_email": "teammate@example.com",
      "metadata": {
        "role": "developer",
        "invited_by": "usr_abc123"
      },
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 2,
    "pages": 1
  }
}
```

### Log Actions Reference

| Action | Resource | Description |
|--------|----------|-------------|
| `project.created` | project | Project created |
| `project.updated` | project | Project updated |
| `project.deleted` | project | Project deleted |
| `env.created` | env | Environment created |
| `env.deleted` | env | Environment deleted |
| `vault.pushed` | vault | Secrets pushed |
| `vault.pulled` | vault | Secrets pulled |
| `vault.conflict_resolved` | vault | Conflict resolved |
| `member.invited` | member | Member invited |
| `member.joined` | member | Invitation accepted |
| `member.removed` | member | Member removed |
| `member.role_updated` | member | Role changed |
| `token.created` | ci_token | CI token created |
| `token.revoked` | ci_token | CI token revoked |

---

## CI/CD Tokens

### Create Token

```
POST /api/v1/projects/:project_id/tokens
```

```json
{
  "name": "GitHub Actions - Deploy Pipeline",
  "expires_at": "2025-01-15T00:00:00Z"
}
```

**Response (201 Created)**:
```json
{
  "id": "tok_xxx",
  "name": "GitHub Actions - Deploy Pipeline",
  "token": "ctv_abc123...secret",
  "token_hash": "sha256:hash...",
  "expires_at": "2025-01-15T00:00:00Z",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Note**: Full token shown only ONCE at creation.

### List Tokens

```
GET /api/v1/projects/:project_id/tokens
```

**Response**:
```json
{
  "tokens": [
    {
      "id": "tok_xxx",
      "name": "GitHub Actions - Deploy Pipeline",
      "token_hash": "sha256:abc...",
      "last_used_at": "2024-01-15T12:00:00Z",
      "expires_at": "2025-01-15T00:00:00Z",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Revoke Token

```
DELETE /api/v1/projects/:project_id/tokens/:token_id
```

### CI Login

```
POST /api/v1/ci/login
```

```json
{
  "token": "ctv_abc123...secret"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "session": {
    "token": "bst_ci_xxx...",
    "project_id": "prj_xyz789",
    "permissions": ["vault:read", "vault:pull"]
  },
  "expires_at": "2024-01-15T14:00:00Z"
}
```

---

## User Account

### Get Profile

```
GET /api/v1/user/profile
```

### Update Profile

```
PATCH /api/v1/user/profile
```

```json
{
  "name": "New Name",
  "password": "NewSecurePassword!"
}
```

### Get My Projects

```
GET /api/v1/user/projects
```

### Delete Account

```
DELETE /api/v1/user/account
```

**Response (204 No Content)**

---

## Health & Status

### Health Check

```
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Readiness Check

```
GET /health/ready
```

**Response**:
```json
{
  "status": "ready",
  "services": {
    "database": "ok",
    "realtime": "ok",
    "storage": "ok"
  }
}
```

---

## Rate Limiting

All endpoints are rate limited.

| Tier | Limit | Window |
|------|-------|--------|
| Default | 100 requests | 1 minute |
| Auth endpoints | 10 requests | 1 minute |
| Vault push | 30 requests | 1 minute |
| CI tokens | 1000 requests | 1 hour |

**Response when limited (429 Too Many Requests)**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before retrying.",
    "retry_after": 60
  }
}
```

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705315800
Retry-After: 60
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "request_id": "req_abc123"
  }
}
```

### Error Codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid auth |
| 401 | `INVALID_CREDENTIALS` | Wrong email/password |
| 401 | `SESSION_EXPIRED` | Session token expired |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Version conflict (sync) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

**Document Version**: 1.0  
**Next**: Database Schema
