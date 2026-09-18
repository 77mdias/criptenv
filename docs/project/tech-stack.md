# Tech Stack — CriptEnv

**Última verificação:** 2026-09-18. As versões mínimas abaixo são lidas dos manifests; versões efetivamente instaladas podem ser mais novas e ficam registradas nos lockfiles/ambientes.

## Overview

CriptEnv uses a modern full-stack architecture with Python for backend and TypeScript/Next.js for frontend.

---

## Backend — Python

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | FastAPI | 0.115+ (`!=0.136.3`) | REST API with async support |
| **ORM** | SQLAlchemy (async) | 2.0+ | Database abstraction |
| **Driver** | asyncpg | 0.30+ | Async PostgreSQL driver |
| **Validation** | Pydantic | 2.0+ | Request/response schemas |
| **Settings** | pydantic-settings | 2.0+ | Environment configuration |
| **Auth** | Custom JWT-like + OAuth/TOTP | — | HTTP-only sessions, social login and 2FA |
| **Scheduler** | APScheduler | 3.10+ | Background jobs |
| **HTTP Client** | httpx | 0.27+ | Provider APIs, webhooks and storage |

**Dependencies** (`apps/api/requirements.txt`):
```
fastapi>=0.115.0,!=0.136.3
uvicorn[standard]>=0.30.0
sqlalchemy[asyncio]>=2.0.0
alembic>=1.13.0
asyncpg>=0.30.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0
pyasn1>=0.6.3
passlib[bcrypt]>=1.7.0
python-multipart>=0.0.9
httpx>=0.27.0
apscheduler>=3.10.0
authlib>=1.3.0
gunicorn>=23.0.0
redis>=5.0.0
resend>=2.0.0
pyotp>=2.9.0
```

---

## CLI — Python

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | Click | 8.1+ | CLI framework |
| **Encryption** | cryptography | 42+ | AES-256-GCM, PBKDF2HMAC, HKDF |
| **HTTP Client** | httpx | 0.27+ | Async API client |
| **Database** | aiosqlite | 0.20+ | Local SQLite vault |
| **Key Derivation** | hashlib | stdlib | PBKDF2HMAC-SHA256 |

**Dependencies** (`apps/cli/pyproject.toml`):
```
click>=8.1.0
cryptography>=42.0.0
httpx>=0.27.0
aiosqlite>=0.20.0
```

---

## Frontend — TypeScript/Next.js (Vinext)

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | Vinext | 0.0.45+ | Vite-based Next.js-compatible framework |
| **Runtime** | React | 19.2+ | UI library |
| **Styling** | TailwindCSS | v4 | Utility-first CSS |
| **Components** | Radix UI | 1.0+ | Accessible primitives |
| **Forms** | react-hook-form | 7.0+ | Form handling |
| **Validation** | Zod | 4.3+ | Schema validation |
| **State** | Zustand | 5.0+ | Client state |
| **Server State** | @tanstack/react-query | 5.0+ | Server state management |
| **Build** | Vite | 8.0+ | Bundler |
| **Deployment** | Cloudflare Pages/Workers | — | Edge deployment |

**Dependencies** (`apps/web/package.json`):
```json
{
  "next": "16.2.6",
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "@radix-ui/react-*": "^1.0.0",
  "react-hook-form": "^7.74.0",
  "zod": "^4.3.6",
  "zustand": "^5.0.12",
  "@tanstack/react-query": "^5.100.6"
}
```

---

## Database

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database** | PostgreSQL 15 in VPS Compose | Primary data store |
| **ORM** | SQLAlchemy async | Database abstraction |
| **Connection Pool** | asyncpg | Non-blocking connections |
| **Migrations** | Alembic | Schema management |

**Connection Settings**:
- Pool size: 2
- Max overflow: 5
- Prepared statements: disabled (pgbouncer compatibility)

---

## Infrastructure & Deploy

| Service | Platform | Purpose |
|---------|----------|---------|
| **Database** | PostgreSQL 15 (Docker on VPS) | Primary store |
| **Backend** | VPS Docker + Gunicorn/Uvicorn | FastAPI server |
| **API Tunnel** | Cloudflare Tunnel | `criptenv-api.77mdevseven.tech` -> `http://api:8000` |
| **Rate Limit Store** | Redis | Shared counters across API workers |
| **Frontend** | Cloudflare Pages + Workers | Vinext deployment + `/api/*` proxy |
| **CLI Distribution** | Package metadata ready; PyPI publication pending | Package distribution |

---

## GitHub Action — TypeScript

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | Node.js | 20 |
| **Action** | TypeScript | GitHub Action implementation |
| **Distribution** | GitHub Marketplace | Action distribution |

**Location**: `packages/github-action/`

---

## Development Tools

| Tool | Purpose |
|------|---------|
| **Package Manager** | npm (frontend), pip (backend) |
| **Linter** | ESLint (frontend); pytest is the test runner, not a linter |
| **Tests** | pytest (Python), Jest + Cypress (frontend) |
| **Make** | `Makefile` for common commands |

---

## Environment Configuration

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
DB_POOL_SIZE=2
DB_MAX_OVERFLOW=2

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
```

### Frontend (.env.example)

```bash
# API
NEXT_PUBLIC_API_URL=
API_URL=https://criptenv-api.77mdevseven.tech

# Auth
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
```

---

## Testing

| Layer | Framework | Coverage |
|-------|-----------|----------|
| **CLI** | pytest | Run `make cli-test` |
| **API** | pytest | 416 passing, 2 skipped at last local verification |
| **Frontend** | Jest + Cypress | Run `make web-test`; counts evolve with the suite |

---

## Key Libraries Summary

### Backend (apps/api)

- `fastapi` — Web framework
- `sqlalchemy[asyncio]` — ORM
- `asyncpg` — PostgreSQL driver
- `pydantic` / `pydantic-settings` — Validation
- `python-jose` — JWT tokens
- `passlib` — Password hashing
- `httpx` — HTTP client
- `apscheduler` — Background jobs

### CLI (apps/cli)

- `click` — CLI framework
- `cryptography` — Encryption
- `httpx` — HTTP client
- `aiosqlite` — Local database

### Frontend (apps/web)

- `next` / `vinext` — Framework
- `react` — UI library
- `tailwindcss` — Styling
- `@radix-ui/*` — UI components
- `zod` — Validation
- `zustand` — State
- `@tanstack/react-query` — Server state

---

**Document Version**: 1.3
**Last Updated**: 2026-09-18
