# Context Map — CriptEnv

> A map to help any agent quickly find what they need in this project.

---

## Essential Files

| File | Description |
|------|-------------|
| [`README.md`](../README.md) | Project overview, quick start, tech stack |
| [`CLAUDE.md`](../CLAUDE.md) | AI agent guidance, architecture, key conventions |
| [`docs/index.md`](./index.md) | This documentation index |
| [`prd/README.md`](../prd/README.md) | Product Requirements Document |
| [`roadmap/README.md`](../roadmap/README.md) | Phase plan and timeline |

---

## Folder Structure

### Root Level

```
criptenv/
├── apps/                  # Main applications
├── packages/              # Reusable packages (GitHub Action)
├── docs/                  # This documentation
├── plans/                 # Implementation plans
├── specs/                 # Technical specifications
├── prd/                   # Product requirements
├── roadmap/               # Phase roadmap
├── user-stories/          # User journey maps
├── ux-ui/                 # Design assets
└── guidelines/            # Design guidelines
```

### apps/ Structure

```
apps/
├── api/                   # FastAPI Backend (Python)
│   ├── main.py            # App entry, middleware, router inclusion
│   ├── requirements.txt   # Python dependencies
│   ├── app/
│   │   ├── config.py      # pydantic-settings
│   │   ├── database.py    # SQLAlchemy async setup
│   │   ├── middleware/    # Auth middleware, jobs
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── routers/       # FastAPI route handlers
│   │   ├── schemas/       # Pydantic request/response
│   │   ├── services/      # Business logic
│   │   └── strategies/    # Complex flow handlers
│   └── tests/             # pytest tests
│
├── cli/                   # CLI Application (Python)
│   ├── pyproject.toml     # Python package config
│   └── src/criptenv/
│       ├── cli.py         # Click CLI entry point
│       ├── config.py      # Configuration
│       ├── context.py     # Context managers
│       ├── session.py     # Session management
│       ├── api/           # HTTP client
│       ├── commands/      # CLI commands (14 total)
│       ├── crypto/        # AES-256-GCM encryption
│       └── vault/         # Local SQLite vault
│
└── web/                   # Web Dashboard (TypeScript/Next.js)
    ├── package.json       # npm dependencies
    ├── next.config.ts     # Next.js config
    ├── vite.config.ts     # Vite config (Vinext)
    ├── wrangler.jsonc      # Cloudflare Workers config
    ├── src/
    │   ├── app/           # Next.js App Router pages
    │   ├── components/    # React components
    │   ├── hooks/         # Custom React hooks
    │   ├── stores/        # Zustand stores
    │   └── types/         # TypeScript types
    └── public/            # Static assets
```

---

## Where to Change Things

### CLI Commands

| Command | Location |
|---------|----------|
| `init` | `apps/cli/src/criptenv/commands/init.py` |
| `login` | `apps/cli/src/criptenv/commands/login.py` |
| `secrets` (set, get, list, delete) | `apps/cli/src/criptenv/commands/secrets.py` |
| `projects` | `apps/cli/src/criptenv/commands/projects.py` |
| `environments` | `apps/cli/src/criptenv/commands/environments.py` |
| `sync` (push, pull) | `apps/cli/src/criptenv/commands/sync.py` |
| `import/export` | `apps/cli/src/criptenv/commands/import_export.py` |
| `doctor` | `apps/cli/src/criptenv/commands/doctor.py` |
| `rotate` | `apps/cli/src/criptenv/commands/secrets.py` |

### API Endpoints

| Router | Location | Prefix |
|--------|----------|--------|
| Auth | `apps/api/app/routers/auth.py` | `/api/auth` |
| Projects | `apps/api/app/routers/projects.py` | `/api/v1/projects` |
| Environments | `apps/api/app/routers/environments.py` | `/api/v1/projects/{id}/environments` |
| Vault | `apps/api/app/routers/vault.py` | `/api/v1/projects/{p_id}/environments/{e_id}/vault` |
| Members | `apps/api/app/routers/members.py` | `/api/v1/projects/{id}/members` |
| Invites | `apps/api/app/routers/invites.py` | `/api/v1/projects/{id}/invites` |
| Tokens | `apps/api/app/routers/tokens.py` | `/api/v1/projects/{id}/tokens` |
| Audit | `apps/api/app/routers/audit.py` | `/api/v1/projects/{id}/audit` |
| Rotation | `apps/api/app/routers/rotation.py` | Phase 3 |

### Frontend Pages

| Page | Route | Location |
|------|-------|----------|
| Landing | `/` | `apps/web/src/app/(marketing)/page.tsx` |
| Login | `/login` | `apps/web/src/app/(auth)/login/page.tsx` |
| Signup | `/signup` | `apps/web/src/app/(auth)/signup/page.tsx` |
| Dashboard | `/dashboard` | `apps/web/src/app/(dashboard)/dashboard/page.tsx` |
| Projects List | `/projects` | `apps/web/src/app/(dashboard)/projects/page.tsx` |
| Project Detail | `/projects/[id]` | `apps/web/src/app/(dashboard)/projects/[id]/page.tsx` |
| Secrets | `/projects/[id]/secrets` | `apps/web/src/app/(dashboard)/projects/[id]/secrets/page.tsx` |
| Audit | `/projects/[id]/audit` | `apps/web/src/app/(dashboard)/projects/[id]/audit/page.tsx` |
| Team | `/projects/[id]/members` | `apps/web/src/app/(dashboard)/projects/[id]/members/page.tsx` |
| Account | `/account` | `apps/web/src/app/(dashboard)/account/page.tsx` |

### Frontend Components

| Component Type | Location |
|----------------|----------|
| Layout (shell, sidebar, top-nav) | `apps/web/src/components/layout/` |
| UI primitives (badge, button, card) | `apps/web/src/components/ui/` |
| Marketing (hero, pricing, features) | `apps/web/src/components/marketing/` |

### Frontend Stores (Zustand)

| Store | Location | Purpose |
|-------|----------|---------|
| `useAuthStore` | `apps/web/src/stores/auth.ts` | Auth state |
| `useUIStore` | `apps/web/src/stores/ui.ts` | UI state (sidebar, modals) |
| `useProjectStore` | `apps/web/src/stores/project.ts` | Project selection |
| `useCryptoStore` | `apps/web/src/stores/crypto.ts` | Encryption keys (NOT persisted) |

---

## Important Flows

### Auth Flow

```
User submits credentials
        ↓
POST /api/auth/signin
        ↓
AuthService.validate_credentials()
        ↓
Create session token (JWT-like)
        ↓
Set HTTP-only cookie
        ↓
Return user data (NO token in body)
```

### Secret Encryption Flow

```
User enters secret value
        ↓
Derive master key (PBKDF2HMAC, 100k iterations)
        ↓
Derive environment key (HKDF)
        ↓
Encrypt with AES-256-GCM
        ↓
Store encrypted blob in vault
```

### Vault Sync Flow

```
criptenv push -p project-id
        ↓
Fetch local encrypted secrets
        ↓
POST /api/v1/projects/{id}/vault (all blobs)
        ↓
Server stores in PostgreSQL
        ↓
Return success
```

---

## Database Entities

| Model | Location | Purpose |
|-------|----------|---------|
| User | `apps/api/app/models/user.py` | User accounts |
| Project | `apps/api/app/models/project.py` | Projects |
| Environment | `apps/api/app/models/environment.py` | dev/staging/prod |
| VaultBlob | `apps/api/app/models/vault.py` | Encrypted secrets |
| Member | `apps/api/app/models/member.py` | Project membership + CI tokens |
| Invite | `apps/api/app/models/member.py` | Pending invites |
| AuditLog | `apps/api/app/models/audit.py` | Operation history |
| SecretExpiration | `apps/api/app/models/secret_expiration.py` | Phase 3 rotation |

---

## Testing Locations

| Component | Test Location |
|-----------|--------------|
| CLI crypto | `apps/cli/tests/test_crypto.py` |
| CLI vault | `apps/cli/tests/test_vault.py` |
| CLI commands | `apps/cli/tests/test_commands.py` |
| CLI secrets flow | `apps/cli/tests/test_secrets_flow.py` |
| CLI import/export | `apps/cli/tests/test_import_export.py` |
| CLI rotation | `apps/cli/tests/test_rotation_commands.py` |
| API auth | `apps/api/tests/test_auth_routes.py` |
| API CI auth | `apps/api/tests/test_ci_auth.py` |
| API tokens | `apps/api/tests/test_api_key_auth.py` |
| API rate limit | `apps/api/tests/test_rate_limit.py` |
| API rotation | `apps/api/tests/test_rotation_routes.py` |

---

## Key Patterns

### Backend: Service Layer

All business logic goes in services, not routers:

```python
# BAD
@router.post("/projects")
async def create_project(db: Session, name: str):
    project = Project(name=name)  # Logic in router
    db.add(project)
    return project

# GOOD
@router.post("/projects")
async def create_project(db: Session, name: str):
    return await ProjectService.create(db, name)  # Logic in service
```

### Backend: Strategy Pattern

Complex flows use strategies:

```python
# apps/api/app/strategies/
access.py          # Vault access control
invite_transitions.py  # Invite state machine
vault_push.py      # Vault sync behavior
audit_filters.py   # Audit filtering
integrations/      # Cloud provider integrations
```

### Frontend: Zustand + React Query

- Client state → Zustand stores
- Server state → React Query

---

## Common Commands

```bash
# Backend
cd apps/api && uvicorn main:app --reload

# Frontend
cd apps/web && npm run dev

# CLI
cd apps/cli && python -m criptenv.cli

# Tests
cd apps/cli && python -m pytest
cd apps/api && python -m pytest

# Make commands
make help
make api-dev
make web-dev
make test
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01