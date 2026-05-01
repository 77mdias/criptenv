# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### M3.5 Secret Alerts & Rotation

##### API (apps/api)

- **SecretExpiration Model**: `SecretExpiration` model with fields for expires_at, rotation_policy, notify_days_before, last_notified_at
- **RotationService**: Service layer for rotation operations with audit logging
- **RotationRouter**: FastAPI endpoints for rotation operations (`POST /rotate`, `POST /expiration`, `GET /rotation`, `GET /rotation/history`, `GET /secrets/expiring`)
- **WebhookService**: HTTP notification service with exponential backoff retry logic
- **ExpirationChecker**: Background job that checks for expiring secrets and triggers notifications
- **WebhookChannel**: `NotificationChannel` implementation for HTTP webhooks

##### CLI (apps/cli)

- **rotate command**: `criptenv rotate KEY [--value new_value] [--env env] [--force]` — Rotates secret with auto-generated or manual value
- **secrets expire command**: `criptenv secrets expire KEY --days 90 [--policy notify|auto|manual]` — Sets expiration on a secret
- **secrets alert command**: `criptenv secrets alert KEY --days 30` — Configures alert timing
- **rotation list command**: `criptenv rotation list [--days 30] [--env env]` — Lists secrets pending rotation
- **API Client methods**: `rotate_secret()`, `set_expiration()`, `get_rotation_status()`, `list_expiring()` added to `CriptEnvClient`

##### Web UI (apps/web)

- **ExpirationBadge component**: Visual badge showing secret expiration status (green/yellow/red/expired)
- **Secret row integration**: Expiration badge integrated into `SecretRow` component

#### M3.6 APScheduler Lifespan

- **SchedulerManager**: Abstracted scheduler lifecycle management with singleton pattern
- **Lifespan integration**: APScheduler starts/stops with FastAPI application
- **Config options**: `SCHEDULER_ENABLED` and `SCHEDULER_INTERVAL_HOURS` settings

### Tests

- **33 CLI rotation tests**: Tests for rotate, expire, alert, rotation list commands
- **6 integration tests**: E2E tests for complete rotation lifecycle
- **Webhook service tests**: Tests for retry logic, payload building, channel abstraction

## [0.2.0] - 2026-04-30

### Added

#### CLI (apps/cli)

- **CLI Package**: Click-based CLI with 14 commands (`criptenv init/login/logout/set/get/list/delete/push/pull/env/projects/doctor/import/export`)
- **Encryption Module**: AES-256-GCM with PBKDF2HMAC key derivation (100k iterations) and HKDF per-environment keys
- **Local Vault**: SQLite database at `~/.criptenv/vault.db` with tables for config, sessions, environments, secrets
- **API Client**: Async httpx client for all backend endpoints (auth, projects, environments, vault)
- **Session Manager**: Encrypted session token storage with master key derivation
- **Context Helpers**: `cli_context()` and `local_vault()` context managers bridging async vault/API with sync Click commands
- **Import/Export**: `.env` file import with quote handling, export in `.env` and JSON formats
- **Doctor Command**: Diagnostic checks for config dir, vault DB, master password, session, API connectivity

#### API Changes

- **AuthResponse**: Added `token` field to response body for CLI compatibility (zero breaking change for web frontend)

#### Tests

- **93 CLI tests**: crypto (30), vault (22), commands (23), secrets flow (8), import/export + doctor (10)
- **Test isolation**: Temporary directory fixtures with proper cleanup between tests

### Documentation

- **PHASE-1 Plan**: `docs/phase-1/M1-IMPLEMENTATION-PLAN.md` — Main implementation plan
- **PHASE-1 Milestones**: `docs/phase-1/M1-1` through `M1-6` — Detailed milestone specs
- **PHASE-1.5 Plan**: `plans/phase1.5-cli-integration.md` — Integration plan for connecting stubs to real logic

### Technical Details

| Component      | Technology                                        |
| -------------- | ------------------------------------------------- |
| CLI Framework  | Click 8.1+                                        |
| Encryption     | AES-256-GCM (cryptography 42+)                    |
| Key Derivation | PBKDF2HMAC-SHA256 (100k iterations) + HKDF-SHA256 |
| Local Storage  | SQLite via aiosqlite                              |
| HTTP Client    | httpx (async)                                     |
| .env Parsing   | Manual parser with UTF-8/Latin-1 fallback         |

## [0.1.0] - 2026-04-30

### Added

#### Backend API (apps/api)

- **Authentication**: Session-based auth with `/api/auth/*` endpoints (signup, signin, signout, session, sessions)
- **Projects CRUD**: Full project management at `/api/v1/projects`
- **Environments CRUD**: Environment management per project at `/api/v1/projects/{id}/environments`
- **Vault**: Secret push/pull/version at `/api/v1/projects/{p_id}/environments/{e_id}/vault`
- **Members**: Team member management at `/api/v1/projects/{id}/members`
- **Invites**: Invite flow (create, list, accept, revoke) at `/api/v1/projects/{id}/invites`
- **Tokens**: CI/CD tokens at `/api/v1/projects/{id}/tokens`
- **Audit**: Paginated audit logs at `/api/v1/projects/{id}/audit`
- **Health endpoints**: `/health`, `/health/ready` for status checks

#### Backend Architecture

- **Strategy Pattern**: Complex flows handled via strategies (access, invite_transitions, vault_push, audit_filters)
- **Service Layer**: Business logic in services (auth_service, project_service, vault_service, audit_service)
- **Async SQLAlchemy**: PostgreSQL with asyncpg driver, connection pooling
- **JWT-like Sessions**: Token-based auth with configurable expiration

#### Frontend Web (apps/web)

- **Auth Pages**: Login, Signup, Forgot Password
- **Dashboard**: Overview page with project summary
- **Project Management**: List and detail views
- **Secrets Browser**: View secrets (masked), CRUD operations
- **Audit Timeline**: Visual audit log with chronological events
- **Team Settings**: Member list, role management, invite flow
- **Account Settings**: User profile and security
- **Integrations Page**: Third-party integration management
- **Landing Page**: Marketing page with hero, features, pricing, CTA sections

#### Frontend Components

- **UI Primitives**: badge, button, card, input, separator, skeleton, status-badge, theme-switch
- **Layout Components**: app-shell, footer, marketing-header, marketing-sidebar, sidebar-nav, top-nav
- **Shared Components**: create-project-dialog, empty-state

#### State Management

- **Zustand Stores**: useUIStore, useProjectStore for local state
- **React Query**: Server state management
- **Theme System**: Dark mode default with CSS variables, localStorage persistence

### Documentation

- **CLAUDE.md**: Root project guidance
- **API README**: Backend documentation with endpoint table
- **Frontend Docs**: UI-ARCHITECTURE, FRONTEND-MAP, UI-SPEC-COMPONENTS, LAYOUT-STRUCTURE
- **Phase Plan**: `docs/development/phases/PHASE2-WEB-UI.md`

### Technical Stack

| Component  | Technology                                        |
| ---------- | ------------------------------------------------- |
| Backend    | FastAPI + SQLAlchemy async + asyncpg              |
| Frontend   | Next.js 16 + React 19 + TailwindCSS v4 + Radix UI |
| Database   | PostgreSQL                                        |
| Auth       | JWT-like session tokens                           |
| Validation | Zod + react-hook-form                             |

[unreleased]: https://github.com/77mdias/criptenv/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/77mdias/criptenv/releases/tag/v0.1.0
