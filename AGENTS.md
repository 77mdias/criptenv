# AGENTS.md — CriptEnv

> This file is intended for AI coding agents. It describes the project architecture, conventions, and workflows you need to know before modifying any code.

---

## Project Overview

**CriptEnv** is an open-source Zero-Knowledge secret management platform — an alternative to Doppler and Infisical. It allows developers and teams to securely manage environment variables, API keys, and sensitive credentials.

### Core Value Proposition
- **Zero-Knowledge Encryption**: Secrets are encrypted 100% client-side with AES-256-GCM. The server never sees plaintext secrets.
- **CLI-First**: Natural terminal workflow (`criptenv set`, `get`, `push`, `pull`, etc.)
- **Web Dashboard**: Visual interface for non-technical team members
- **Team Sync**: Secure sharing without plaintext exposure
- **Audit Logs**: Complete trail of all operations

### License
MIT License

---

## Monorepo Structure

The repository is organized as a monorepo with three applications and one package. There is no formal monorepo tooling (no pnpm-workspace, turbo, or nx). Orchestration is managed via a root `Makefile`.

```
├── apps/
│   ├── api/          # FastAPI backend (Python)
│   ├── cli/          # Python CLI application
│   └── web/          # TypeScript/Next.js frontend (Vinext)
├── packages/
│   └── github-action/  # TypeScript GitHub Action
├── docs/             # Documentation
├── plans/            # Implementation plans
├── specs/            # Technical specifications
├── Makefile          # Build orchestration
└── AGENTS.md         # This file
```

---

## Technology Stack

### Backend (`apps/api`) — Python 3.11+
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | FastAPI 0.115+ | REST API with async support |
| ORM | SQLAlchemy 2.0+ (async) | Database abstraction |
| Driver | asyncpg 0.30+ | Async PostgreSQL driver |
| Validation | Pydantic 2.0+ | Request/response schemas |
| Settings | pydantic-settings | Environment configuration |
| Auth | python-jose + passlib | JWT-like tokens, password hashing |
| Scheduler | APScheduler 3.10+ | Background jobs |
| HTTP Client | httpx 0.27+ | Webhooks and API calls |
| Server | uvicorn | ASGI server |

### CLI (`apps/cli`) — Python 3.10+
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Click 8.1+ | CLI commands |
| Encryption | cryptography 42+ | AES-256-GCM, PBKDF2HMAC, HKDF |
| HTTP Client | httpx 0.27+ | Async API client |
| Local DB | aiosqlite 0.20+ | SQLite vault |
| Build | hatchling | Python build backend |

### Frontend (`apps/web`) — TypeScript
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Vinext 0.0.45 (Next.js 16.2.4 reimplementation) | Full-stack React |
| Runtime | React 19.2.5 | UI library |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Components | Radix UI 1.0+ | Accessible primitives |
| Forms | react-hook-form 7.74+ | Form handling |
| Validation | Zod 4.3+ | Schema validation |
| Client State | Zustand 5.0+ | UI/crypto/project stores |
| Server State | @tanstack/react-query 5.100+ | API data caching |
| Build | Vite 8.0+ | Bundler |
| Animation | Framer Motion, GSAP, Three.js | Marketing and UI effects |
| Deployment | Cloudflare Pages + Workers | Edge deployment |

### GitHub Action (`packages/github-action`)
| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 20 | GitHub Action runtime |
| Language | TypeScript | Action implementation |
| Bundling | ncc | Self-contained distribution |

### Database
- **PostgreSQL 14+** as the primary data store
- **Manual migrations** (no Alembic configured)
- Connection pool: size 2, max overflow 5, prepared statements disabled

---

## Build, Run and Test Commands

All common commands are exposed through the root `Makefile`.

```bash
# Show all available commands
make help

# Install dependencies for all apps
make install        # Runs web-install + api-install + cli-install

# Development servers
make web-dev        # Start Vinext dev server (port 3000)
make api-dev        # Start FastAPI dev server with uvicorn --reload (port 8000)

# Testing
make test           # Run api-test + cli-test
make api-test       # Run API pytest suite
make cli-test       # Run CLI pytest suite

# Linting / Checks
make lint           # Run frontend ESLint
make check          # Run web-check-vinext + web-build + api-test + cli-test
make web-check-vinext   # Vinext compatibility scan
make web-build      # Build frontend with Vinext

# Deployment
make web-deploy     # Deploy frontend to Cloudflare Workers (requires Wrangler auth)
```

### App-specific commands

**Backend:**
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
python -m pytest tests -q
```

**CLI:**
```bash
cd apps/cli
pip install -e ".[dev]"
python -m pytest tests -q
```

**Frontend:**
```bash
cd apps/web
npm install
npm run dev           # Vinext dev server
npm run build         # Production build
npm run lint          # ESLint
npm run check:vinext  # Compatibility scan
npm run deploy        # Cloudflare deployment
```

**GitHub Action:**
```bash
cd packages/github-action
npm install
npm run build         # ncc build src/index.ts -> dist/index.js
```

---

## Code Organization

### Backend (`apps/api`)
- `main.py` — FastAPI app entry point. Registers routers, middleware, lifespan (scheduler + DB)
- `app/routers/` — FastAPI route handlers (auth, projects, environments, vault, members, invites, tokens, audit, rotation, integrations, v1)
- `app/services/` — Business logic layer (auth, project, vault, rotation, audit, webhook, integration, api_key)
- `app/models/` — SQLAlchemy ORM models (user, project, environment, vault, member, audit, api_key, integration, secret_expiration)
- `app/schemas/` — Pydantic request/response schemas
- `app/middleware/` — CORS, auth, rate limiting, API versioning, CI auth, background jobs
- `app/strategies/` — Strategy pattern implementations (access control, audit filters, invite transitions, vault push, integrations)
- `tests/` — pytest suite (~20 modules)

### CLI (`apps/cli`)
- `src/criptenv/cli.py` — Click entry point, registers all commands
- `src/criptenv/commands/` — Command implementations: `init`, `login`, `secrets` (set/get/list/delete/rotate), `sync` (push/pull), `environments`, `projects`, `doctor`, `import_export`, `ci`
- `src/criptenv/crypto/` — AES-256-GCM encryption, PBKDF2/HKDF key derivation
- `src/criptenv/vault/` — Local SQLite persistence (models, queries, database)
- `src/criptenv/api/` — HTTP client wrappers (`CriptEnvClient` via httpx)
- `tests/` — pytest suite (6 modules)

### Frontend (`apps/web`)
- `src/app/` — Next.js App Router with route groups:
  - `(auth)/` — login, signup, forgot-password
  - `(dashboard)/` — dashboard, projects, secrets, audit, members, settings, account, integrations
  - `(marketing)/` — landing page
- `src/components/ui/` — Radix UI primitive components
- `src/components/shared/` — Domain-specific components (secrets-table, audit-timeline, etc.)
- `src/components/layout/` — Shell, sidebar, nav, footer
- `src/components/marketing/` — Hero, features, pricing carousel
- `src/lib/api/` — API client facade and modules (auth, projects, env, vault, members, audit, ci-tokens)
- `src/stores/` — Zustand stores: `auth.ts`, `crypto.ts`, `ui.ts`, `project.ts`
- `src/hooks/` — Custom React hooks (`use-auth.ts`, `use-theme.ts`)
- `worker/index.ts` — Cloudflare Worker entry point

### GitHub Action (`packages/github-action`)
- `src/index.ts` — Main action logic (CI login -> fetch secrets -> export as env vars)
- `dist/index.js` — Compiled bundle (referenced by `action.yml`)

---

## Development Conventions

### Git Workflow
- **Branch naming**: `feature/short-description`, `bugfix/issue-number`, `hotfix/security-vuln-fix`, `chore/dependency-update`, `docs/api-reference`
- **Conventional Commits**:
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `security`
  - Format: `type(scope): subject` — e.g., `feat(cli): add import command for .env files`
- **PR Process**: Fill template -> pass CI -> 2 approvals -> squash & merge

### Python Conventions (Backend + CLI)
- **Type hints everywhere**
- **Async throughout** the backend
- **Service Layer**: All DB mutations go through service classes, never directly in routers
- **Dependency Injection**: `get_db()` handles session management (auto-commit/rollback)
- **Strategy Pattern**: Complex flows use strategies in `app/strategies/`
- **Context managers** in CLI: `cli_context()` and `local_vault()` for resource management
- Clear feedback in CLI: green=success, red=error, yellow=warning
- Confirmation prompts for destructive actions

### TypeScript / Frontend Conventions
- **Route groups**: `(auth)`, `(dashboard)`, `(marketing)` organize layouts without affecting URL
- **State separation**: Zustand for client state, React Query for server state
- **Crypto store is NOT persisted** — keys never go to localStorage
- **Theme**: Dark mode default; `criptenv-theme` key in localStorage
- Path alias: `@/*` maps to `./src/*`

### Database Conventions
- **Tables**: `snake_case`, plural (`users`, `projects`, `vault_blobs`)
- **Columns**: `snake_case` (`created_at`, `user_id`)
- **Indexes**: `idx_<table>_<column>`
- **UUIDs**: `uuid-ossp` with optional resource prefix (`usr_xxx`, `prj_xxx`, `env_xxx`)
- **Timestamps**: `timestamptz` with auto-update triggers

---

## Testing Strategy

| Layer | Framework | Minimum Coverage | Location |
|-------|-----------|-----------------|----------|
| Crypto functions | pytest | 100% | `apps/cli/tests/test_crypto.py` |
| API endpoints | pytest | 90% | `apps/api/tests/` |
| CLI commands | pytest | 85% | `apps/cli/tests/` |
| UI components | vitest | 70% | `apps/web/src/components/shared/__tests__/` (minimal) |

**Important**: There are no CI/CD pipelines (`.github/workflows` does not exist). Tests must be run locally via `make test`.

### Running tests
- Backend: `cd apps/api && python -m pytest tests -q`
- CLI: `cd apps/cli && python -m pytest tests -q`
- Frontend: Only 2 test files exist; no test runner is configured in `package.json` scripts.

---

## Security Considerations

### Zero-Knowledge Architecture
Secrets are encrypted client-side before reaching the server:
```
User Password
    |
    v
PBKDF2HMAC-SHA256 (100,000 iterations) -> Master Key
    |
    v
HKDF-SHA256 -> Per-Environment Key
    |
    v
AES-256-GCM -> Encrypted Blob -> Server (never sees plaintext)
```

### Authentication Layers
| Token Type | Storage | Purpose |
|------------|---------|---------|
| Session Token | HTTP-only cookie | Web dashboard |
| API Key (`cek_` prefix) | Database hash | Public API |
| CI Token (`ci_` prefix) | Database hash | CI/CD pipelines |

### Known Security Issues (Phase 2 Review — P0)
- **CR-01**: Session token exposed in response body
- **CR-02**: Token stored in localStorage (XSS risk)
These must be resolved before public API work continues.

### Agent Rules for Security
- Never commit secrets, `.env` files, or credential files
- The `crypto` store must never be persisted to localStorage
- Do not weaken encryption parameters (iterations, key sizes)
- Verify no plaintext secrets in logs or error messages

---

## Environment Variables

### Backend (`apps/api/.env`)
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
ASYNC_DATABASE_URL=postgresql://user:pass@host:5432/db  # Without asyncpg prefix
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=true
CORS_ORIGINS=http://localhost:3000
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_HOURS=24
```

### Frontend (`apps/web/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_COOKIE_NAME=criptenv_session
```

### CLI
The CLI stores its local vault at `~/.criptenv/vault.db` (SQLite) and configuration in the same directory.

---

## Deployment

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | Cloudflare Pages + Workers | Built with Vinext, deployed via `vinext deploy` |
| Backend | Railway / Render | FastAPI server with uvicorn/gunicorn |
| Database | PostgreSQL (free tier) | Manual migrations |
| CLI | PyPI (future) | Distributed as Python wheel |
| GitHub Action | GitHub Marketplace | Bundled with `ncc` |

There is no containerization (no Dockerfiles or docker-compose.yml).

---

## Mandatory Agent Checklist

**Before writing any code, you MUST:**

1. Read `README.md` for project overview
2. Read `docs/project/current-state.md` to understand what's implemented
3. Read `docs/tasks/current-task.md` to know the current focus
4. Check related files in the codebase before modifying
5. Run existing tests before and after changes

### Core Rules
- **Never break existing tests**
- **Document decisions** in `docs/project/decisions.md` using format `## DEC-XXX — [Title]`
- **Update documentation** after changes: `docs/development/CHANGELOG.md`, relevant feature docs, task history
- **Don't duplicate files** — check existing structures first
- **Stay on task** — don't refactor unrelated code or implement out-of-scope features
- **Mark inferred information clearly** with "(inferred)" or "(inferred from code)"
- **Report what you did** at the end of every session with a summary, test results, issues found, and next steps

### Common Patterns

**Adding a new CLI command:**
1. Create command file in `apps/cli/src/criptenv/commands/`
2. Import in `apps/cli/src/criptenv/cli.py`
3. Add to `__all__` in commands `__init__.py`
4. Write tests in `apps/cli/tests/`

**Adding a new API endpoint:**
1. Add to router in `apps/api/app/routers/`
2. Add service method in `apps/api/app/services/`
3. Add schema in `apps/api/app/schemas/`
4. Write tests in `apps/api/tests/`

**Adding a new frontend page:**
1. Create in `apps/web/src/app/(dashboard)/` or appropriate route group
2. Add navigation link in sidebar/top-nav
3. Add any needed API calls in `apps/web/src/lib/api/`

---

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 (CLI MVP) | Complete | 14 commands, AES-256-GCM, local vault, 93+ tests |
| Phase 2 (Web UI) | Complete | Dashboard, auth, CRUD, audit logs, team management |
| Phase 3 (CI/CD) | In Progress | GitHub Action done, secret rotation done, cloud integrations (Vercel/Railway/Render) pending, public API pending |
| Phase 4 (Enterprise) | Planned | SSO/SAML, SCIM, self-hosted |

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-02
