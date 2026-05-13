# CriptEnv API

FastAPI backend for the CriptEnv Zero-Knowledge secret management platform.

## Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | FastAPI | 0.115+ |
| ORM | SQLAlchemy (async) | 2.0+ |
| Driver | asyncpg | 0.30+ |
| Validation | Pydantic | 2.0+ |
| Auth | Custom JWT-like + OAuth 2.0 | — |
| 2FA | pyotp | 2.9+ |
| Scheduler | APScheduler | 3.10+ |
| Migrations | Alembic | 1.13+ |
| Rate Limit | Redis | 5.0+ |

## Setup

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Run development server
uvicorn main:app --reload --port 8000
```

Or use Make from the project root:

```bash
make api-dev
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db

# Auth
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# App
DEBUG=true
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_STORAGE=memory
# REDIS_URL=redis://redis:6379/0

# Scheduler
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_HOURS=24

# Email (optional)
# RESEND_API_KEY=re_...
```

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Endpoints Overview

### Authentication `/api/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/signin` | Login |
| POST | `/api/auth/signout` | Logout |
| GET | `/api/auth/session` | Current user |
| GET | `/api/auth/sessions` | Active sessions |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/2fa/setup` | Setup TOTP 2FA |
| POST | `/api/auth/2fa/verify` | Verify TOTP |
| POST | `/api/auth/2fa/disable` | Disable 2FA |

### OAuth `/api/auth/oauth`

| Provider | Endpoint | Description |
|----------|----------|-------------|
| GitHub | `/api/auth/oauth/github` | OAuth login |
| Google | `/api/auth/oauth/google` | OAuth login |
| Discord | `/api/auth/oauth/discord` | OAuth login |

### Projects `/api/v1/projects`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects` | Create project |
| GET | `/api/v1/projects` | List projects |
| GET | `/api/v1/projects/{id}` | Project details |
| PATCH | `/api/v1/projects/{id}` | Update project |
| DELETE | `/api/v1/projects/{id}` | Delete project |
| POST | `/api/v1/projects/{id}/rekey` | Rotate vault password |

### Environments `/api/v1/projects/{project_id}/environments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `.../environments` | Create environment |
| GET | `.../environments` | List environments |
| GET | `.../environments/{id}` | Environment details |
| PATCH | `.../environments/{id}` | Update environment |
| DELETE | `.../environments/{id}` | Delete environment |

### Vault `/api/v1/projects/{project_id}/environments/{env_id}/vault`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `.../vault/push` | Push encrypted secrets |
| GET | `.../vault/pull` | Pull encrypted secrets |
| GET | `.../vault/version` | Get vault version |

### Members `/api/v1/projects/{project_id}/members`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `.../members` | Add member |
| GET | `.../members` | List members |
| PATCH | `.../members/{id}` | Update role |
| DELETE | `.../members/{id}` | Remove member |

### Invites `/api/v1/projects/{project_id}/invites`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `.../invites` | Create invite |
| GET | `.../invites` | List invites |
| POST | `.../invites/{id}/accept` | Accept invite |
| POST | `.../invites/{id}/revoke` | Revoke invite |

### Tokens `/api/v1/projects/{project_id}/tokens`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `.../tokens` | Create CI token |
| GET | `.../tokens` | List tokens |
| DELETE | `.../tokens/{id}` | Delete token |

### Audit `/api/v1/projects/{project_id}/audit`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `.../audit` | List audit logs (paginated) |
| GET | `.../audit/export` | Export audit logs as CSV |

### API Keys `/api/v1/api-keys`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/api-keys` | Create API key |
| GET | `/api/v1/api-keys` | List API keys |
| DELETE | `/api/v1/api-keys/{id}` | Revoke API key |

### Integrations `/api/v1/integrations`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/integrations` | List connected integrations |
| POST | `/api/v1/integrations` | Connect provider |
| DELETE | `/api/v1/integrations/{id}` | Disconnect provider |
| POST | `/api/v1/integrations/{id}/sync` | Sync secrets |

## Authentication

The API supports dual authentication:

1. **Session Cookie** — HTTP-only `criptenv_session` cookie (web dashboard)
2. **API Key** — `Authorization: Bearer cek_...` header (public API)

## Testing

```bash
# Run all tests
make api-test

# Or manually
cd apps/api
python -m pytest tests -q
```

**365 tests passing, 2 skipped.**

## Production Deploy

Current production target is the VPS Docker stack in `../../deploy/vps`, with Cloudflare Tunnel, Redis-backed rate limiting, and Supabase PostgreSQL. `render.yaml`, `railway.toml`, and `Procfile` are retained as legacy rollback references.

```bash
cd deploy/vps
cp .env.example .env
# Edit .env
docker compose up -d --build
```

## License

MIT — see [LICENSE](../../LICENSE) for details.
