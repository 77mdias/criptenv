# API Documentation — CriptEnv

## Overview

FastAPI backend providing REST API for the CriptEnv platform. The OpenAPI document at `/openapi.json` is the canonical endpoint contract; this page is the human-oriented overview.

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:8000` |
| Production | `https://criptenv-api.77mdevseven.tech` |

---

## Authentication

### Session Token (Default)

Session-based endpoints accept the HTTP-only `criptenv_session` cookie. CLI and non-browser clients may use the equivalent bearer credential:

```
Authorization: Bearer <session_token>
```

Session tokens are:
- Generated on login
- Stored in HTTP-only cookies
- JWT-like format (custom implementation)
- Configurable expiration (default: 30 days for sessions; access-token setting remains configurable)

### API Key

Public read endpoints also accept an API key as `Authorization: Bearer cek_...`. Scope and environment restrictions are enforced server-side.

### CI Token

For CI/CD pipelines, use CI tokens:

```
Authorization: Bearer ci_<token>
```

CI tokens are validated differently from session tokens and have their own permission scopes.

---

## Endpoints

### Auth Router (`/api/auth`)

**File:** `apps/api/app/routers/auth.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/signup` | Register new user | None |
| POST | `/api/auth/signin` | Login user | None |
| POST | `/api/auth/signout` | Logout user | Session |
| GET | `/api/auth/session` | Get current session | Session |
| GET | `/api/auth/sessions` | List all sessions | Session |
| DELETE | `/api/auth/sessions/{id}` | Revoke session | Session |

**Signup Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Signup Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "created_at": "2026-05-01T12:00:00Z"
}
```

**Signin Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Signin Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com"
}
```

---

### Projects Router (`/api/v1/projects`)

**File:** `apps/api/app/routers/projects.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/projects` | List user's projects | Session |
| POST | `/api/v1/projects` | Create project | Session |
| GET | `/api/v1/projects/{id}` | Get project | Session |
| PUT | `/api/v1/projects/{id}` | Update project | Session |
| DELETE | `/api/v1/projects/{id}` | Delete project | Session |

**List Projects Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "My Project",
      "created_at": "2026-05-01T12:00:00Z",
      "updated_at": "2026-05-01T12:00:00Z"
    }
  ],
  "total": 1
}
```

**Create Project Request:**
```json
{
  "name": "My New Project"
}
```

---

### Environments Router (`/api/v1/projects/{id}/environments`)

**File:** `apps/api/app/routers/environments.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/projects/{id}/environments` | List environments | Session |
| POST | `/api/v1/projects/{id}/environments` | Create environment | Session |
| GET | `/api/v1/projects/{id}/environments/{eid}` | Get environment | Session |
| PUT | `/api/v1/projects/{id}/environments/{eid}` | Update environment | Session |
| DELETE | `/api/v1/projects/{id}/environments/{eid}` | Delete environment | Session |

**Create Environment Request:**
```json
{
  "name": "production"
}
```

---

### Vault Router (`/api/v1/projects/{p_id}/environments/{e_id}/vault`)

**File:** `apps/api/app/routers/vault.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/projects/{p_id}/environments/{e_id}/vault` | Get all vault blobs | Session |
| POST | `/api/v1/projects/{p_id}/environments/{e_id}/vault` | Push secrets | Session |
| GET | `/api/v1/projects/{p_id}/environments/{e_id}/vault/{key}` | Get specific secret | Session |
| PUT | `/api/v1/projects/{p_id}/environments/{e_id}/vault/{key}` | Update secret | Session |
| DELETE | `/api/v1/projects/{p_id}/environments/{e_id}/vault/{key}` | Delete secret | Session |
| GET | `/api/v1/projects/{p_id}/environments/{e_id}/vault/{key}/versions` | Version history | Session |

**Push Secrets Request:**
```json
{
  "secrets": [
    {
      "key_id": "DATABASE_URL",
      "encrypted_value": "base64_encrypted_blob",
      "version": 1
    }
  ]
}
```

**Push Secrets Response:**
```json
{
  "pushed": 1,
  "version": 5
}
```

---

### Members Router (`/api/v1/projects/{id}/members`)

**File:** `apps/api/app/routers/members.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/projects/{id}/members` | List members | Session |
| POST | `/api/v1/projects/{id}/members` | Add member | Session |
| PUT | `/api/v1/projects/{id}/members/{mid}` | Update member role | Session |
| DELETE | `/api/v1/projects/{id}/members/{mid}` | Remove member | Session |

**Roles:** `owner`, `admin`, `member`, `viewer`

**Add Member Request:**
```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

---

### Invites Router (`/api/v1/projects/{id}/invites`)

**File:** `apps/api/app/routers/invites.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/projects/{id}/invites` | List pending invites | Session |
| POST | `/api/v1/projects/{id}/invites` | Create invite | Session |
| POST | `/api/v1/projects/{id}/invites/accept` | Accept invite | None (token in body) |
| DELETE | `/api/v1/projects/{id}/invites/{iid}` | Revoke invite | Session |

**Create Invite Request:**
```json
{
  "email": "invitee@example.com",
  "role": "member"
}
```

---

### Tokens Router (`/api/v1/projects/{id}/tokens`)

**File:** `apps/api/app/routers/tokens.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/projects/{id}/tokens` | List CI tokens | Session |
| POST | `/api/v1/projects/{id}/tokens` | Create CI token | Session |
| DELETE | `/api/v1/projects/{id}/tokens/{tid}` | Revoke CI token | Session |

**Create Token Request:**
```json
{
  "name": "GitHub Actions",
  "expires_at": "2027-01-01T00:00:00Z"
}
```

**Create Token Response:**
```json
{
  "id": "uuid",
  "name": "GitHub Actions",
  "token": "ci_xxxxxxxxxxxx",  // Only returned once!
  "prefix": "ci_xxxx",
  "expires_at": "2027-01-01T00:00:00Z"
}
```

---

### Audit Router (`/api/v1/projects/{id}/audit`)

**File:** `apps/api/app/routers/audit.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/projects/{id}/audit` | List audit logs | Session |
| GET | `/api/v1/projects/{id}/audit/export` | Export logs | Session |

**Query Parameters:**
- `page` (int, default: 1)
- `per_page` (int, default: 20, max: 100)
- `action` (string, optional): Filter by action type
- `user_id` (uuid, optional): Filter by user
- `start_date` (datetime, optional): Filter from date
- `end_date` (datetime, optional): Filter to date

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "action": "secret.create",
      "resource_type": "vault",
      "resource_id": "uuid",
      "user_id": "uuid",
      "ip_address": "192.168.1.1",
      "metadata": {"key": "DATABASE_URL"},
      "created_at": "2026-05-01T12:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "per_page": 20
}
```

---

### Rotation Router (Phase 3)

**File:** `apps/api/app/routers/rotation.py`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/projects/{p_id}/environments/{e_id}/rotate` | Rotate secret | Session |
| GET | `/api/v1/projects/{p_id}/environments/{e_id}/rotation` | Get rotation status | Session |
| GET | `/api/v1/projects/{p_id}/secrets/expiring` | List expiring secrets | Session |
| POST | `/api/v1/projects/{p_id}/environments/{e_id}/expiration` | Set expiration | Session |

### Additional Routers

The versioned API also exposes authentication/OAuth, API keys, CI login/secrets, integrations, notifications, contributions/webhooks and health aliases. Use `/docs` in development or `/openapi.json` for the complete route list. Production may disable the interactive `/docs` page while retaining `/openapi.json`.

**Rotate Secret Request:**
```json
{
  "key": "DATABASE_URL",
  "new_value": "new_encrypted_value",
  "rotation_policy": "manual"
}
```

**Rotate Secret Response:**
```json
{
  "success": true,
  "key": "DATABASE_URL",
  "version": 6,
  "rotated_at": "2026-05-01T12:00:00Z"
}
```

**Set Expiration Request:**
```json
{
  "key": "DATABASE_URL",
  "expires_at": "2026-08-01T00:00:00Z",
  "rotation_policy": "notify",
  "notify_days_before": 30
}
```

---

### Project Alert Settings Router (Phase 3)

**File:** `apps/api/app/routers/alert_settings.py`

These endpoints require a human session and the project `owner` or `admin` role.
API keys and CI tokens cannot configure or test alert settings.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/projects/{project_id}/alert-settings` | Read safe alert settings and webhook preview | Session + owner/admin |
| PATCH | `/api/v1/projects/{project_id}/alert-settings` | Merge alert settings and optionally configure/remove webhook | Session + owner/admin |
| POST | `/api/v1/projects/{project_id}/alert-settings/test-webhook` | Send a stored-configuration synthetic webhook event | Session + owner/admin |

**Settings response:**
```json
{
  "enabled": true,
  "default_notify_days_before": 7,
  "channels": { "in_app": true, "email": false, "webhook": false },
  "webhook_configured": false,
  "webhook_url_preview": null
}
```

`PATCH` accepts optional `enabled`, `default_notify_days_before` (1-365), a complete
`channels` object (`in_app`, `email`, `webhook`) and `webhook_url`. Omitted values are
preserved; `webhook_url: null` explicitly removes the saved webhook. The complete URL
is write-only, encrypted at rest with the integration-config envelope, and never
returned in a project response, audit metadata, log or browser payload. Save and
delivery time both validate the URL and reject unsafe/private targets outside
development/tests.

The channels are independent. In-app alerts go to the project owner and accepted
owner/admin members. Email additionally requires `email_verified=true`; developers and
viewers are excluded. Webhooks use the saved URL and the existing pinned, no-redirect
transport. A test event uses `payload_version: 1` and `test: true`; scheduled events
use the same canonical payload with `test: false`.

**Delivery semantics:** `alert_deliveries` is the source of truth for unique
`(expiration, event, channel, recipient)` work. Claims use a fencing token and a
shared maximum of three attempts; failed work is retried with sanitized errors, while
expired claims at the limit become terminal failures. In-app delivery is transactionally
idempotent. Email and webhook delivery are at-least-once across process crashes and
webhooks include a stable idempotency key. `last_notified_at` is compatibility metadata
and does not suppress pending work.

For a new secret expiration, omitted `notify_days_before` resolves from the project
default (7 by default). An explicit per-secret value always wins, and changing the
project default does not rewrite existing expiration records. Alert payloads contain
only project/environment identifiers and names, secret key identifier, expiration
metadata, `payload_version`, `test`, and an action link. They never contain secret
plaintext, ciphertext, IV, authentication tag, vault password, webhook URL or API
credentials.

---

## Error Responses

### 400 Bad Request

```json
{
  "detail": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden

```json
{
  "detail": "Not authorized to access this resource"
}
```

### 404 Not Found

```json
{
  "detail": "Resource not found"
}
```

### 429 Too Many Requests

```json
{
  "detail": "Rate limit exceeded"
}
```

---

## OpenAPI Documentation

When `DEBUG=true`, interactive API documentation is available:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

**Document Version**: 1.2
**Last Updated**: 2026-09-19
