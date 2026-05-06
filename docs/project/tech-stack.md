# Tech Stack — CriptEnv

## Overview

CriptEnv uses a modern full-stack architecture with Python for backend and TypeScript/Next.js for frontend.

---

## Backend — Python

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | FastAPI | 0.110+ | REST API with async support |
| **ORM** | SQLAlchemy (async) | 2.0+ | Database abstraction |
| **Driver** | asyncpg | 0.9+ | Async PostgreSQL driver |
| **Validation** | Pydantic | 2.0+ | Request/response schemas |
| **Settings** | pydantic-settings | 2.0+ | Environment configuration |
| **Auth** | Custom JWT-like | — | Session tokens |
| **Scheduler** | APScheduler | 3.10+ | Background jobs |
| **HTTP Client** | httpx | 0.27+ | Webhook notifications |

**Dependencies** (`apps/api/requirements.txt`):
```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.9.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
httpx>=0.27.0
apscheduler>=3.10.0
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
| **Framework** | Vinext (Next.js 16) | 16.0+ | Full-stack React framework |
| **Runtime** | React | 19.0+ | UI library |
| **Styling** | TailwindCSS | v4 | Utility-first CSS |
| **Components** | Radix UI | 1.0+ | Accessible primitives |
| **Forms** | react-hook-form | 7.0+ | Form handling |
| **Validation** | Zod | 3.0+ | Schema validation |
| **State** | Zustand | 4.0+ | Client state |
| **Server State** | @tanstack/react-query | 5.0+ | Server state management |
| **Build** | Vite | 5.0+ | Bundler |
| **Deployment** | Cloudflare Pages/Workers | — | Edge deployment |

**Dependencies** (`apps/web/package.json`):
```json
{
  "next": "^16.0.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@radix-ui/react-*": "^1.0.0",
  "react-hook-form": "^7.0.0",
  "zod": "^3.0.0",
  "zustand": "^4.0.0",
  "@tanstack/react-query": "^5.0.0"
}
```

---

## Database

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database** | PostgreSQL | Primary data store |
| **ORM** | SQLAlchemy async | Database abstraction |
| **Connection Pool** | asyncpg | Non-blocking connections |
| **Migrations** | (manual) | Schema management |

**Connection Settings**:
- Pool size: 2
- Max overflow: 5
- Prepared statements: disabled (pgbouncer compatibility)

---

## Infrastructure & Deploy

| Service | Platform | Purpose |
|---------|----------|---------|
| **Database** | PostgreSQL (Free Tier) | Primary store |
| **Backend** | VPS Docker + Gunicorn/Uvicorn | FastAPI server |
| **Reverse Proxy** | Nginx Proxy Manager | DuckDNS hostname + Let's Encrypt TLS |
| **Rate Limit Store** | Redis | Shared counters across API workers |
| **Frontend** | Cloudflare Pages + Workers | Vinext deployment + `/api/*` proxy |
| **CLI Distribution** | PyPI (future) | Package distribution |

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
| **Linter** | ESLint (frontend), pytest (backend) |
| **Tests** | pytest (Python), vitest (frontend) |
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
API_URL=https://criptenv.duckdns.org

# Auth
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
```

---

## Testing

| Layer | Framework | Coverage |
|-------|-----------|----------|
| **CLI** | pytest | 93+ tests |
| **API** | pytest | 40+ tests |
| **Frontend** | vitest | (not in this scope) |

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

**Document Version**: 1.0  
**Last Updated**: 2026-05-01
