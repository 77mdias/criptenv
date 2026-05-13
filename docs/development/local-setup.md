# Local Development Guide

This guide covers how to set up the full CriptEnv stack locally for development and contribution.

## Prerequisites

- Python 3.11+ (backend & CLI)
- Node.js 20+ (frontend & GitHub Action)
- PostgreSQL 14+ (or Docker)
- Redis (for production-like local setup)

## Quick Setup

```bash
git clone https://github.com/77mdias/criptenv.git
cd criptenv
make install        # Installs web, api, and cli dependencies
```

## Backend API (`apps/api`)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy environment
cp .env.example .env
# Edit .env with your settings

# Run
cd ../..
make api-dev
```

### Environment Variables

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

### API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## CLI (`apps/cli`)

```bash
cd apps/cli
pip install -e ".[dev]"

# Test
python -m pytest tests -q
```

## Web Dashboard (`apps/web`)

```bash
cd apps/web
npm install

# Run dev server
npm run dev
```

Or from project root:

```bash
make web-dev
```

Open http://localhost:3000.

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## GitHub Action (`packages/github-action`)

```bash
cd packages/github-action
npm install
npm run build
```

## Docker (Production-like)

```bash
# Development stack with hot-reload
make docker-dev

# Production build
make docker-build
make docker-up
```

## Running Tests

```bash
# All tests
make test

# Specific suites
make api-test          # Backend (365 tests)
make cli-test          # CLI (173 tests)
make web-test-unit     # Frontend unit (41 tests)
make web-test-e2e      # Full E2E (4 tests)
```

## Project Structure

```
criptenv/
├── apps/
│   ├── api/                  # FastAPI Backend (Python)
│   │   ├── app/
│   │   │   ├── routers/      # API route handlers
│   │   │   ├── services/     # Business logic
│   │   │   ├── models/       # SQLAlchemy ORM models
│   │   │   ├── schemas/      # Pydantic schemas
│   │   │   ├── middleware/   # Auth, rate limit, CORS
│   │   │   └── strategies/   # Access control, integrations
│   │   ├── migrations/       # Alembic migrations
│   │   └── tests/            # pytest suite
│   ├── cli/                  # Python CLI Application
│   │   ├── src/criptenv/
│   │   │   ├── commands/     # CLI commands
│   │   │   ├── crypto/       # AES-256-GCM encryption
│   │   │   ├── vault/        # Local SQLite persistence
│   │   │   └── api/          # HTTP client
│   │   └── tests/            # pytest suite
│   └── web/                  # Web Dashboard (TypeScript/Vinext)
│       ├── src/app/          # App Router pages
│       ├── src/components/   # React components
│       ├── src/lib/api/      # API client modules
│       ├── src/stores/       # Zustand stores
│       └── tests/            # Jest + Cypress tests
├── packages/
│   └── github-action/        # TypeScript GitHub Action
├── docs/                     # Documentation
├── deploy/
│   └── vps/                  # Docker Compose production stack
├── Makefile                  # Build orchestration
└── README.md
```

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| **Frontend** | Cloudflare Pages + Workers | https://criptenv.77mdevseven.tech |
| **Backend API** | VPS Docker + Cloudflare Tunnel | https://criptenv-api.77mdevseven.tech |
| **Database** | Supabase PostgreSQL | Managed |
| **Rate Limit** | Redis (Docker) | VPS internal |

```bash
# Backend (VPS)
cd deploy/vps
cp .env.example .env
# Edit .env
docker compose up -d --build

# Frontend (Cloudflare)
cd apps/web
npm run build
npm run deploy
```

See [deployment.md](../technical/deployment.md) for full details.

## Contributing

Please read [CONTRIBUTING.md](../../CONTRIBUTING.md) before submitting pull requests.
