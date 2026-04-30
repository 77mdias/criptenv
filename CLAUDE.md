# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CriptEnv is a Zero-Knowledge secret management platform (open-source alternative to Doppler/Infisical) with:
- **Backend**: Python FastAPI + SQLAlchemy async + PostgreSQL
- **Frontend**: Next.js 16 + React 19 + TailwindCSS v4 + Radix UI
- **Auth**: JWT-like session tokens (no external provider in current implementation)

## Commands

### Backend (apps/api)

```bash
cd apps/api
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then configure .env

# Run
uvicorn main:app --reload --port 8000

# API docs: http://localhost:8000/docs (when DEBUG=true in .env)
```

### Frontend (apps/web)

```bash
cd apps/web
npm install

npm run dev      # development
npm run build    # production build
npm run start    # production server
npm run lint     # ESLint
```

### Running a Single Test (API)

```bash
cd apps/api
python -m pytest tests/ -v -k "test_name"
```

## Architecture

### Backend Structure

```
apps/api/
├── main.py              # FastAPI app, middleware, router inclusion
├── app/
│   ├── config.py       # Settings via pydantic-settings, async DB URL parsing
│   ├── database.py     # SQLAlchemy async engine, session factory, Base
│   ├── models/         # SQLAlchemy ORM models (user, project, environment, vault, member, audit)
│   ├── schemas/         # Pydantic request/response schemas
│   ├── routers/        # FastAPI route handlers (auth, projects, environments, vault, members, invites, audit, tokens)
│   ├── services/       # Business logic layer (project_service, auth_service, audit_service)
│   ├── strategies/     # Strategy pattern for backend flows (access, invite_transitions, vault_push, audit_filters)
│   └── middleware/      # Auth middleware (session token validation)
```

**Key patterns:**
- Routers use `get_db()` dependency for session management (auto-commit on success, rollback on error)
- All database mutations go through services (not directly in routers)
- Strategy pattern used for complex flows (invite state machine, vault access control, audit filtering)

### Frontend Structure

```
apps/web/src/app/
├── layout.tsx                    # Root layout with theme initialization script
├── globals.css                   # TailwindCSS v4 + CSS variables (theme system)
├── (auth)/                       # Auth route group: login, signup, forgot-password
├── (dashboard)/                 # Dashboard route group: dashboard, projects, account, integrations
├── (marketing)/                 # Marketing route group: landing page
└── components/
    ├── layout/                  # Shell, sidebar-nav, top-nav, marketing-sidebar, footer
    └── ui/                      # Radix UI primitive wrappers
```

**State management:** Zustand stores (`useUIStore`, `useProjectStore`) + React Query for server state

**Theme:** Dark mode default, CSS variables `--background`, `--text-primary`, `--accent` (orange #ff4500)

### API Design

All protected endpoints require `Authorization: Bearer <session_token>` header.

| Router | Prefix | Key Endpoints |
|--------|--------|---------------|
| auth | `/api/auth` | signup, signin, signout, session, sessions |
| projects | `/api/v1/projects` | CRUD on projects |
| environments | `/api/v1/projects/{id}/environments` | CRUD on environments |
| vault | `/api/v1/projects/{p_id}/environments/{e_id}/vault` | push, pull, version |
| members | `/api/v1/projects/{id}/members` | CRUD on members |
| invites | `/api/v1/projects/{id}/invites` | create, list, accept, revoke |
| tokens | `/api/v1/projects/{id}/tokens` | CI/CD tokens for projects |
| audit | `/api/v1/projects/{id}/audit` | paginated audit logs |

### Database

SQLAlchemy async with `asyncpg` driver. Connection pool: size=2, max_overflow=5. Prepared statements disabled (compatibility with pgbouncer).

## Key Conventions

- **Backend mutations**: Always through service layer, never directly in routers
- **Database sessions**: `get_db()` dependency handles commit/rollback automatically
- **Settings**: Via `pydantic-settings` from `.env` — `Settings` class in `config.py`
- **Async database URL**: `settings.async_database_url` strips pgbouncer params for asyncpg compatibility
- **Strategy pattern**: Strategies in `app/strategies/` handle complex conditional flows
- **Frontend route groups**: Route groups in parentheses `(auth)`, `(dashboard)` don't affect URL but organize layouts
- **Theme**: Dark mode default; localStorage key `criptenv-theme`; inline script in root layout applies class before paint
