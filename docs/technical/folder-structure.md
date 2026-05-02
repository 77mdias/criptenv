# Folder Structure — CriptEnv

## Complete Directory Tree

```
criptenv/
├── .gitignore
├── CLAUDE.md                     # AI agent guidance
├── CONTRIBUTING.md               # Contribution guidelines
├── LICENSE                       # MIT License
├── Makefile                      # Build/run commands
├── README.md                     # Project overview

├── .claude/                      # Claude Code configuration
├── .hermes/                      # Hermes agent configuration
├── .playwright-mcp/              # Playwright MCP config
├── .serena/                      # Serena config

├── apps/
│   ├── api/                      # FastAPI Backend (Python)
│   │   ├── .env                  # Environment variables (not in git)
│   │   ├── .env.example          # Example environment config
│   │   ├── .gitignore
│   │   ├── README.md             # API documentation
│   │   ├── main.py               # FastAPI app entry point
│   │   ├── requirements.txt      # Python dependencies
│   │   ├── test_import.py        # Import test
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── config.py        # pydantic-settings
│   │   │   ├── database.py      # SQLAlchemy async setup
│   │   │   ├── middleware/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py      # Session token validation
│   │   │   │   └── jobs/
│   │   │   │       ├── __init__.py
│   │   │   │       ├── expiration_check.py  # Background job
│   │   │   │       └── scheduler.py         # APScheduler lifecycle
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── user.py
│   │   │   │   ├── project.py
│   │   │   │   ├── environment.py
│   │   │   │   ├── vault.py
│   │   │   │   ├── member.py    # Includes CIToken
│   │   │   │   ├── audit.py
│   │   │   │   └── secret_expiration.py  # Phase 3
│   │   │   ├── routers/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── projects.py
│   │   │   │   ├── environments.py
│   │   │   │   ├── vault.py
│   │   │   │   ├── members.py
│   │   │   │   ├── invites.py
│   │   │   │   ├── tokens.py
│   │   │   │   ├── audit.py
│   │   │   │   └── rotation.py
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── project.py
│   │   │   │   └── ... (other schemas)
│   │   │   ├── services/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth_service.py
│   │   │   │   ├── project_service.py
│   │   │   │   ├── vault_service.py
│   │   │   │   ├── audit_service.py
│   │   │   │   ├── rotation_service.py   # Phase 3
│   │   │   │   └── webhook_service.py    # Phase 3
│   │   │   └── strategies/
│   │   │       ├── __init__.py
│   │   │       ├── access.py
│   │   │       ├── invite_transitions.py
│   │   │       ├── vault_push.py
│   │   │       ├── audit_filters.py
│   │   │       └── integrations/
│   │   │           ├── __init__.py
│   │   │           ├── base.py
│   │   │           ├── vercel.py   # Pending
│   │   │           ├── railway.py  # Pending
│   │   │           └── render.py   # Pending
│   │   └── tests/
│   │       ├── __init__.py
│   │       ├── test_auth_routes.py
│   │       ├── test_ci_auth.py
│   │       ├── test_ci_tokens_m3_3.py
│   │       ├── test_api_key_auth.py
│   │       ├── test_api_key_model.py
│   │       ├── test_api_key_routes.py
│   │       ├── test_api_versioning.py
│   │       ├── test_environment_soft_delete.py
│   │       ├── test_expiration_check.py
│   │       ├── test_integration_providers.py
│   │       ├── test_integration_rotation.py
│   │       ├── test_openapi_docs.py
│   │       ├── test_project_service.py
│   │       ├── test_rate_limit.py
│   │       ├── test_rotation_routes.py
│   │       ├── test_secret_expiration_model.py
│   │       ├── test_strategy_access.py
│   │       ├── test_strategy_audit_filters.py
│   │       ├── test_strategy_invites.py
│   │       ├── test_strategy_vault.py
│   │       └── test_webhook_service.py
│   │
│   ├── cli/                      # Python CLI Application
│   │   ├── pyproject.toml        # Python package config
│   │   └── src/criptenv/
│   │       ├── __init__.py
│   │       ├── cli.py            # Click entry point
│   │       ├── config.py        # Configuration
│   │       ├── context.py       # Context managers
│   │       ├── session.py       # Session management
│   │       ├── api/
│   │       │   ├── __init__.py
│   │       │   ├── auth.py      # Auth client
│   │       │   ├── client.py    # CriptEnvClient (httpx)
│   │       │   └── vault.py    # Vault client
│   │       ├── commands/
│   │       │   ├── __init__.py
│   │       │   ├── ci.py        # CI commands (pending)
│   │       │   ├── doctor.py    # Diagnostic
│   │       │   ├── environments.py
│   │       │   ├── import_export.py
│   │       │   ├── init.py
│   │       │   ├── login.py
│   │       │   ├── projects.py
│   │       │   ├── secrets.py   # set, get, list, delete + rotate
│   │       │   └── sync.py      # push, pull
│   │       ├── crypto/
│   │       │   ├── __init__.py
│   │       │   ├── core.py      # AES-256-GCM
│   │       │   ├── keys.py     # PBKDF2 + HKDF
│   │       │   └── utils.py
│   │       └── vault/
│   │           ├── __init__.py
│   │           ├── database.py  # SQLite operations
│   │           ├── models.py    # Vault data models
│   │           └── queries.py   # SQL queries
│       └── tests/
│           ├── __init__.py
│           ├── conftest.py
│           ├── test_commands.py
│           ├── test_crypto.py
│           ├── test_import_export.py
│           ├── test_rotation_commands.py
│           ├── test_secrets_flow.py
│           └── test_vault.py
│   │
│   └── web/                      # TypeScript/Next.js Frontend
│       ├── .env.example
│       ├── .gitignore
│       ├── README.md
│       ├── AGENTS.md
│       ├── CLAUDE.md
│       ├── eslint.config.mjs
│       ├── next.config.ts
│       ├── package.json
│       ├── package-lock.json
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── vite.config.ts       # Vinext (Vite-based Next.js)
│       ├── wrangler.jsonc       # Cloudflare Workers config
│       ├── public/
│       │   ├── file.svg
│       │   ├── globe.svg
│       │   ├── next.svg
│       │   ├── vercel.svg
│       │   ├── window.svg
│       │   └── images/
│       ├── assets/
│       │   └── images/
│       └── src/
│           ├── proxy.ts
│           ├── app/
│           │   ├── favicon.ico
│           │   ├── globals.css
│           │   ├── layout.tsx
│           │   ├── (auth)/
│           │   │   ├── login/page.tsx
│           │   │   ├── signup/page.tsx
│           │   │   └── forgot-password/page.tsx
│           │   ├── (dashboard)/
│           │   │   ├── dashboard/page.tsx
│           │   │   ├── projects/
│           │   │   │   ├── page.tsx
│           │   │   │   └── [id]/
│           │   │   │       ├── page.tsx
│           │   │   │       ├── secrets/page.tsx
│           │   │   │       ├── audit/page.tsx
│           │   │   │       ├── members/page.tsx
│           │   │   │       └── settings/page.tsx
│           │   │   ├── account/page.tsx
│           │   │   └── integrations/page.tsx
│           │   └── (marketing)/
│           │       └── page.tsx
│           ├── components/
│           │   ├── layout/
│           │   │   ├── shell.tsx
│           │   │   ├── sidebar-nav.tsx
│           │   │   ├── top-nav.tsx
│           │   │   ├── marketing-sidebar.tsx
│           │   │   ├── marketing-header.tsx
│           │   │   └── footer.tsx
│           │   ├── ui/
│           │   │   ├── badge.tsx
│           │   │   ├── button.tsx
│           │   │   ├── card.tsx
│           │   │   ├── input.tsx
│           │   │   └── ... (other primitives)
│           │   ├── marketing/
│           │   │   ├── hero.tsx
│           │   │   ├── features.tsx
│           │   │   ├── pricing-card-carousel.tsx
│           │   │   └── ... (other marketing)
│           │   └── shared/
│           │       ├── create-project-dialog.tsx
│           │       ├── empty-state.tsx
│           │       └── ... (other shared)
│           ├── hooks/
│           │   ├── use-auth.ts
│           │   └── use-theme.ts
│           ├── stores/
│           │   ├── auth.ts
│           │   ├── crypto.ts
│           │   ├── ui.ts
│           │   └── project.ts
│           ├── types/
│           │   └── index.ts
│           └── lib/
│               └── proxy.ts
│
├── discovery/
│   └── README.md
│
├── docs/
│   ├── index.md                  # (NEW) Documentation index
│   ├── project/
│   │   ├── overview.md            # (NEW)
│   │   ├── current-state.md        # (NEW)
│   │   ├── architecture.md         # (NEW)
│   │   ├── tech-stack.md           # (NEW)
│   │   └── decisions.md            # (NEW)
│   ├── workflow/
│   │   ├── development-workflow.md # (NEW)
│   │   ├── agent-workflow.md       # (NEW)
│   │   ├── task-management.md      # (NEW)
│   │   └── context-map.md          # (NEW)
│   ├── features/
│   │   ├── implemented.md          # (NEW)
│   │   ├── in-progress.md          # (NEW)
│   │   └── backlog.md              # (NEW)
│   ├── technical/
│   │   ├── folder-structure.md     # (NEW - this file)
│   │   ├── environment.md          # (NEW)
│   │   ├── database.md             # (NEW)
│   │   ├── api.md                  # (NEW)
│   │   ├── frontend.md             # (NEW)
│   │   ├── backend.md              # (NEW)
│   │   └── deployment.md           # (NEW)
│   ├── tasks/
│   │   ├── current-task.md         # (NEW)
│   │   ├── next-tasks.md           # (NEW)
│   │   └── task-history.md         # (NEW)
│   ├── development/
│   │   ├── CHANGELOG.md
│   │   └── phases/
│   │       ├── PHASE2-REVIEW.md
│   │       ├── PHASE2-WEB-UI.md
│   │       ├── PHASE2-WEB-UI-TODO.md
│   │       └── PHASE2-REVIEW.md
│   ├── frontend/
│   │   ├── FRONTEND-MAP.md
│   │   ├── LAYOUT-STRUCTURE.md
│   │   ├── UI-ARCHITECTURE.md
│   │   └── UI-SPEC-COMPONENTS.md
│   └── phase-1/
│       ├── M1-IMPLEMENTATION-PLAN.md
│       ├── M1-1-CLI-SCAFFOLD.md
│       ├── M1-2-ENCRYPTION.md
│       ├── M1-3-LOCAL-VAULT.md
│       ├── M1-4-AUTH.md
│       ├── M1-5-CORE-COMMANDS.md
│       └── M1-6-SYNC.md
│
├── packages/
│   └── github-action/              # GitHub Action (TypeScript)
│       ├── action.yml
│       ├── package.json
│       ├── README.md
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
│
├── plans/
│   ├── phase3-cicd-integrations.md
│   ├── hell-tdd-m3-4-m3-5.md
│   ├── hell-tdd-m3-5-6-m3-6.md
│   ├── hell-tdd-m3-5-continuation.md
│   ├── phase1-cli-implementation.md
│   └── phase1.5-cli-integration.md
│
├── prd/
│   └── README.md                   # Product Requirements Document
│
├── roadmap/
│   └── README.md
│
├── specs/
│   ├── README.md
│   └── phase3-m3-1-github-action/
│       └── specs.md
│
├── user-stories/
│   └── README.md
│
└── ux-ui/
```

---

## Directory Responsibilities

### `/apps/api/` — Backend

| Directory | Responsibility |
|-----------|----------------|
| `app/` | Main application code |
| `app/middleware/` | Auth middleware, background jobs |
| `app/models/` | SQLAlchemy ORM models |
| `app/routers/` | FastAPI route handlers |
| `app/schemas/` | Pydantic request/response schemas |
| `app/services/` | Business logic layer |
| `app/strategies/` | Complex flow handlers (Strategy pattern) |
| `tests/` | pytest test suite |

### `/apps/cli/` — CLI Application

| Directory | Responsibility |
|-----------|----------------|
| `src/criptenv/` | Main source code |
| `src/criptenv/commands/` | Click CLI commands |
| `src/criptenv/crypto/` | AES-256-GCM encryption |
| `src/criptenv/vault/` | Local SQLite vault |
| `src/criptenv/api/` | HTTP client for backend |
| `tests/` | pytest test suite |

### `/apps/web/` — Frontend

| Directory | Responsibility |
|-----------|----------------|
| `src/app/` | Next.js App Router pages |
| `src/app/(auth)/` | Auth pages (login, signup) |
| `src/app/(dashboard)/` | Dashboard pages |
| `src/app/(marketing)/` | Landing page |
| `src/components/` | React components |
| `src/components/layout/` | Shell, sidebar, nav |
| `src/components/ui/` | Radix UI primitives |
| `src/hooks/` | Custom React hooks |
| `src/stores/` | Zustand state stores |
| `src/types/` | TypeScript types |

### `/docs/` — Documentation (This Project)

| Directory | Responsibility |
|-----------|----------------|
| `docs/project/` | Project-level docs |
| `docs/workflow/` | Development workflow docs |
| `docs/features/` | Feature tracking |
| `docs/technical/` | Technical documentation |
| `docs/tasks/` | Task management |

### `/packages/` — Reusable Packages

| Directory | Responsibility |
|-----------|----------------|
| `github-action/` | GitHub Actions for CI/CD |

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01