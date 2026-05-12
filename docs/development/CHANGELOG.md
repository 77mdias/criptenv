# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Redis-Backed CLI Auth State (2026-05-12)

- **Shared CLI auth state**: Browser CLI login now stores pending `state`, auth code, and device code records in Redis when `REDIS_URL` is configured.
- **Multi-worker fix**: Production Gunicorn workers can now process `/api/auth/cli/initiate`, `/authorize`, `/token`, and device flow requests without losing state across worker boundaries.
- **Local fallback**: Development and tests keep the in-memory TTL store when Redis is not configured.
- **CLI production default**: The CLI now defaults to `https://criptenv-api.77mdevseven.tech`, while `CRIPTENV_API_URL=http://localhost:8000` remains the local development override.
- **CLI network timeout**: Increased API client timeout for Cloudflare Tunnel/public API calls and turned blank `httpx` timeout failures into actionable CLI errors.
- **Shell completion compatibility**: Fixed completion script generation for current Click versions by using the shell-specific completion class.
- **Decision record**: Added DEC-025 for Redis-backed CLI auth state.

#### Problem to Vault Vault Ceremony (2026-05-11)

- **Landing fold redesign**: Replaced the inline “Problem to Vault” diagram with a dedicated `ProblemToVaultSection` component focused on the encrypted vault as the main visual.
- **Vault ceremony motion**: Added GSAP-driven entrance choreography for scattered secret fragments, the AES-GCM local seal path, vault closing, and technical proof badges.
- **Technical proof points**: Surfaced `server sees: ciphertext`, `plaintext: never`, and `audit hash: chained` directly in the fold.
- **Reduced-motion fallback**: The section renders fully visible and static for users who prefer reduced motion.
- **Decision record**: Added DEC-024 for the Problem to Vault vault ceremony direction.

#### Landing Security Scrollytelling (2026-05-11)

- **Security narrative**: Replaced the static landing Security block with a pinned desktop scrollytelling sequence for AES-GCM, zero-knowledge, client-side-only crypto, and open-source auditability.
- **Motion system**: Added GSAP ScrollTrigger pinning, snapping, and progress state for the desktop section.
- **3D layer**: Added a lightweight dynamically loaded React Three Fiber vault scene for desktop users without reduced-motion preference.
- **Mobile fallback**: Added a stacked mobile narrative with the same topics and images, without scroll locking or WebGL canvas loading.
- **Decision record**: Added DEC-023 for the landing security scrollytelling direction.

#### Custom Production Domains (2026-05-10)

- **Frontend domain**: Production frontend references now use `https://criptenv.77mdevseven.tech`.
- **Backend domain**: Production API references now use `https://criptenv-api.77mdevseven.tech`.
- **Backend CORS/OAuth**: API env templates, rollback configs, and OAuth tests now use the custom frontend origin for `CORS_ORIGINS` and `FRONTEND_URL`.
- **Cloudflare Tunnel docs**: Deployment docs now describe the current tunnel-based API routing instead of DuckDNS/Nginx Proxy Manager.
- **Decision record**: Added DEC-022 for custom production domains through Cloudflare Tunnel.

#### VPS DuckDNS Drift Recovery (2026-05-10)

- **Explicit DuckDNS updates**: The VPS DuckDNS updater now detects the public IPv4 with `api4.ipify.org` and sends it explicitly to DuckDNS instead of relying on inferred request source IP.
- **Static IP override**: Added optional `DUCKDNS_FORCE_IP` for VPS providers with fixed public IPv4 addresses.
- **Operational runbook**: Documented DNS drift diagnosis and recovery commands for cases where local API/Nginx health is green but `criptenv.duckdns.org` times out publicly.
- **Decision record**: Added DEC-021 for explicit DuckDNS IPv4 updates.

#### Landing Pricing Redesign (2026-05-08)

- **Pricing cards**: Reworked the landing pricing carousel around honest project states: `Contribute`, `Open Source`, and `Maybe Later`.
- **Contribution CTA**: The contribution pricing card now links directly to `/contribute`.
- **Carousel stability**: Fixed stale autoplay/navigation state so timed rotation, arrows, and dots stay aligned with the visible card.

#### Mercado Pago Pix Contribution Flow (2026-05-08)

- **Public contribution page**: Added `/contribute` with a Pix amount form, optional payer name/email fields, QR code display, copy-paste Pix code, and status states for pending, paid, expired, and error outcomes.
- **Payment integration**: Wired the page to `POST /api/v1/contributions/pix`, `GET /api/v1/contributions/{id}/status`, and light `POST /api/v1/contributions/{id}/sync` polling.
- **Public API creation**: Anonymous visitors can create contribution payments while the backend still validates amount and normalizes blank optional payer metadata.
- **Validation coverage**: Added React Hook Form/Zod conversion coverage for numeric amount input and page tests for create, paid, expired, and error states.
- **Decision record**: Added DEC-020 documenting public Pix contributions with webhook-first status and light frontend sync.

#### Blocking CI, Security, E2E, and Build Gates (2026-05-08)

- **GitHub Actions**: Added CI, E2E, Security, Docker Build, and Dependabot configuration.
- **Frontend stability**: Fixed stale GET cache after mutations, cleaned web lint debt, made Vinext compatibility scan reach 100%, and hardened Cypress project creation against stale project lists.
- **Backend coverage**: Added route-manifest regression coverage for duplicate `/api/v1/api/v1` routes and opt-in PostgreSQL integration tests for signup/project/default-environment flows.
- **Scheduler safety**: Background expiration checks now open a fresh DB session per scheduled execution.
- **CLI coverage**: Added integration command coverage and a `ci deploy` no-session regression test; Railway connect now reports the backend provider gap clearly.
- **GitHub Action package**: Refactored action code for testability, added Jest/ESLint coverage, and versioned the generated `dist/` bundle.

#### Frontend Test Suite With Local E2E Database (2026-05-07)

- **Jest + React Testing Library**: Added runnable unit and interaction test infrastructure for `apps/web`.
- **Cypress E2E**: Added browser tests for signup, protected-route redirects, project creation, vault unlock, and secret lifecycle flows.
- **Isolated test database**: Added Docker Compose PostgreSQL test service, safe env templates, and guarded API reset/run scripts for local E2E.
- **Automation**: Added web test npm scripts and Make targets for unit and E2E execution.

#### Integration Config Encryption (TASK-068) (2026-05-06)

- **At-rest encryption**: Added AES-256-GCM envelope encryption for `integrations.config`, with HKDF-SHA256 key derivation from dedicated `INTEGRATION_CONFIG_SECRET`.
- **Service compatibility**: `IntegrationService` now stores encrypted provider config, decrypts before calling Vercel/Render providers, and re-encrypts legacy plaintext config on access.
- **Migration**: Added Alembic revision `20260506_0003_encrypt_integration_configs` to backfill existing plaintext integration configs without changing the JSONB schema.
- **Env templates**: Added `INTEGRATION_CONFIG_SECRET` to API and VPS production examples.
- **Tests**: Added coverage for roundtrip encryption, wrong-key failure, plaintext non-leakage, legacy detection, provider-service decrypt flow, and missing-secret errors.

#### VPS Backend Migration Planning (2026-05-06)

- **VPS deploy stack**: Added Docker artifacts for FastAPI on a VPS with Gunicorn/Uvicorn, Redis, Nginx Proxy Manager, and DuckDNS.
- **Redis rate limits**: Added Redis-backed rate-limit storage for multi-worker API deployments while keeping in-memory storage as the local default.
- **Scheduler isolation**: Documented and configured a dedicated one-worker scheduler service so APScheduler does not duplicate jobs across public API workers.
- **Deployment docs**: Updated production guidance from Render Free Tier to VPS Docker + DuckDNS + Let's Encrypt, with Render retained as rollback/legacy hosting.
- **Production validation**: Smoke tested `https://criptenv-api.77mdevseven.tech/health`, `https://criptenv-api.77mdevseven.tech/api/health`, and `https://criptenv.77mdevseven.tech/api/health`.
- **Worker health aliases**: Added `/api/health` and `/api/health/ready` backend aliases so the Cloudflare Worker `/api/*` proxy can expose health checks without path rewriting.

#### Floating Bar Docs Link (2026-05-05)

- **Landing floating bar**: Added a `Docs` item that links directly to `/docs` while preserving smooth scrolling for landing-page section anchors.
- **Docs welcome page**: Rendered the floating bar on `/docs` so the documentation entry page exposes the same quick navigation affordance.
- **Cross-route section links**: Section items clicked from `/docs` now navigate to landing hashes such as `/#how-it-works`, and `Docs` is the final floating-bar item separated by a visual divider.

#### Docs Navbar Brand Alignment (2026-05-05)

- **Docs navbar**: Updated `/docs` navigation to match the AbacatePay-style two-row header, with clean row separators, the CriptEnv logo asset rendered in black/white theme colors, a visible `Início` link to `/`, and a compact Dashboard CTA with chevron.
- **Docs search**: The navbar search field now opens the existing documentation search modal on click while preserving the `Ctrl K` shortcut.

#### Project-Scoped Vault Passwords (2026-05-05)

- **Project vault config**: Project creation now requires client-generated `vault_config` and `vault_proof`; the API stores only sanitized vault metadata plus a bcrypt proof hash in `projects.settings.vault`.
- **Vault write protection**: Vault `push` requires a valid `vault_proof` for v1 project vaults, while pull/version continue returning ciphertext only.
- **Vault rekey**: Added `POST /api/v1/projects/{id}/vault/rekey` for admin/owner password rotation with client-side re-encryption of all environment blobs.
- **Web vault flow**: Project creation asks for a vault password, secrets unlock with the project vault password, and project settings can rotate or migrate the vault password.
- **CLI vault flow**: Added `criptenv projects create`; `push`, `pull`, and `ci deploy` now convert between the local master-key vault and the project vault key using `CRIPTENV_VAULT_PASSWORD` when non-interactive.
- **Tests**: API vault security coverage added; CLI crypto tests now cover project vault config/proof/verifier derivation.

### Fixed

#### OAuth Production Redirects (2026-05-04)

- **Frontend OAuth base URL**: Removed the hardcoded `http://localhost:8000` fallback from [`apps/web/src/components/ui/oauth-button.tsx`](../apps/web/src/components/ui/oauth-button.tsx) and centralized public API URL resolution for web auth flows.
- **OAuth callback session cookie**: Fixed [`apps/api/app/routers/oauth.py`](../apps/api/app/routers/oauth.py) so the OAuth callback writes the `session_token` cookie onto the redirect response that is actually returned to the browser.
- **Regression coverage**: Added backend coverage to verify OAuth callback redirects to `FRONTEND_URL` and carries the session cookie in the response.

#### Cloudflare Worker API Bridge (2026-05-04)

- **Runtime API proxy**: [`apps/web/worker/index.ts`](../apps/web/worker/index.ts) now proxies `/api/*` requests to the configured backend URL using Cloudflare runtime bindings, preventing production 404s when the client bundle does not receive `NEXT_PUBLIC_API_URL`.
- **Forwarded OAuth callback origin**: [`apps/api/app/services/oauth_service.py`](../apps/api/app/services/oauth_service.py) and [`apps/api/app/routers/oauth.py`](../apps/api/app/routers/oauth.py) now honor forwarded host/protocol headers so OAuth callback URLs can stay on the public worker domain when requests are proxied through Cloudflare.

### Documentation & Deployment Preparation (2026-05-03)

#### Documentation Updates

- **`docs/features/implemented.md`**: Updated to reflect all completed features including OAuth (M3.7), Public API (M3.4), Cloud Integrations (Vercel ✅, Render ✅), CI Tokens (M3.3), Secret Alerts web integration, APScheduler, and Alembic migrations. Marked CR-01/CR-02 as resolved.
- **`docs/features/in-progress.md`**: Reorganized to show only genuinely pending work: RailwayProvider, Integration Config Encryption, Web Alert Configuration UI, GitHub Action publishing. Confirmed CR-01/CR-02 security issues are resolved.
- **`docs/features/backlog.md`**: Removed implemented items from backlog. Reorganized priority tiers. Updated dependency map to show Phase 3 at ~90%.
- **`docs/tasks/next-tasks.md`**: Marked TASK-066/067/051 as completed. Added implementation specifications for TASK-061 (RailwayProvider) and TASK-068 (Integration Config Encryption). Defined recommended execution order.
- **`docs/project/current-state.md`**: Updated Phase 3 completion to ~90%. Marked security issues as resolved.
- **`docs/technical/deployment-guide.md`** (new): Complete deployment guide for Web (Cloudflare), API (Render/Railway), CLI (PyPI), and GitHub Action Marketplace.

#### Deployment Artifacts

- **`apps/web/.env.production`**: Production environment variables template
- **`apps/api/Procfile`**: Uvicorn configuration for Render free tier
- **`apps/api/render.yaml`**: Render Blueprint for free tier deploy (no database)
- **`apps/api/railway.toml`**: Railway deployment configuration
- **`scripts/deploy.sh`**: Unified deploy script supporting web/api/cli targets
- **`docs/technical/deployment-guide.md`**: Complete deployment guide

#### Architecture Decision — Free Tier Stack

- **Database**: Supabase Free Tier (permanent, 500MB) instead of Render Postgres (expires in 90 days on free tier)
- **API**: Render Free Tier instead of Starter ($7/mo) — accepts cold starts for MVP/demo phase
- **Web**: Cloudflare Pages + Workers (free tier with generous limits)
- **Total infrastructure cost**: **$0/month** for development/MVP phase

#### Test Verification

- **API tests**: 275 passed ✅
- **CLI tests**: 127 passed ✅

### Added

#### M3.4: Public API (Completed)

##### Backend (apps/api)

- **RateLimitMiddleware activated**: `app.middleware.rate_limit.RateLimitMiddleware` now registered in `main.py` with per-auth-type limits (API key: 1000/min, CI token: 200/min, session: 100/min, anonymous: 100/min, auth: 5/min)
- **Dual authentication**: `get_current_user_or_api_key()` in `app/middleware/auth.py` enables both session tokens (JWT) and API keys (`cek_` prefix) on the same endpoints
- **API Key auth on read endpoints**: Vault pull/version, projects list/get, environments list/get now accept API keys via `Authorization: Bearer cek_...`
- **OpenAPI security schemes**: Custom `custom_openapi()` in `main.py` documents both `BearerAuth` and `ApiKeyAuth` with dual-auth badges on public endpoints
- **Rate limit headers**: All API responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

##### Tests

- **Dual auth integration tests**: `apps/api/tests/test_dual_auth.py` — 7 tests covering vault pull, projects list/get, environments list, unauthorized access, and rate limit header presence

#### M3.3: CI Tokens (Completed)

##### CLI (apps/cli)

- **`ci deploy` real implementation**: `apps/cli/src/criptenv/commands/ci.py` — actual push of local vault secrets to cloud via `CriptEnvClient.push_vault()`
- **CI context fix**: All CI commands (`login`, `logout`, `secrets`, `deploy`, `tokens *`) now correctly use `cli_context()` instead of broken `ctx.obj["db"]` pattern
- **`CRIPTENV_MASTER_PASSWORD` env var**: `apps/cli/src/criptenv/context.py` supports non-interactive CI/CD usage via environment variable
- **Integration sync on deploy**: `ci deploy --provider <name>` finds the connected integration and triggers cloud sync
- **API client methods**: `list_integrations()` and `sync_integration()` added to `CriptEnvClient`

#### M3.2: Cloud Integrations (Vercel + Render)

##### Backend (apps/api)

- **RenderProvider**: `app/strategies/integrations/render.py` — full implementation with push_secrets, pull_secrets, validate_connection, get_services, get_environments
- **Provider registration**: `app/strategies/integrations/__init__.py` imports RenderProvider

##### CLI (apps/cli)

- **`integrations` command group**: `apps/cli/src/criptenv/commands/integrations.py` — `list`, `connect`, `disconnect`, `sync` subcommands
- **CLI registration**: `apps/cli/src/criptenv/cli.py` registers `integrations_group`

##### Tests

- **RenderProvider tests**: `apps/api/tests/test_integration_providers.py` — 6 tests for push, pull, validate, environments, provider name, and base URL

### Changed

- **Rate limit error format test**: Updated `test_openapi_docs.py` to match the project's consistent `{"error": {"code": "..."}}` format instead of legacy FastAPI `detail`

---

### Added

#### M3.7: OAuth Authentication (GitHub, Google, Discord)

##### Backend (apps/api)

- **OAuthAccount model**: `app/models/oauth_account.py` — Links OAuth providers to users with fields: user_id, provider, provider_user_id, provider_email, access_token, refresh_token, expires_at, timestamps
- **OAuthService**: `app/services/oauth_service.py` — Complete OAuth implementation with three providers:
  - `GitHubOAuthProvider`: Exchanges code for token, fetches user info (id, name, email, avatar_url)
  - `GoogleOAuthProvider`: OAuth 2.0 with userinfo endpoint
  - `DiscordOAuthProvider`: OAuth 2.0 with avatar URL construction
  - All providers use 30-second timeout for httpx requests
  - `authenticate_with_oauth()` creates new users or links to existing accounts
  - `generate_kdf_salt()` method for OAuth users (no password)
  - State encoding/decoding for CSRF protection
- **OAuthRouter**: `app/routers/oauth.py` — FastAPI endpoints:
  - `GET /api/auth/oauth/{provider}` — Initiates OAuth flow, sets oauth_state cookie
  - `GET /api/auth/oauth/{provider}/callback` — Handles callback, creates session, redirects to frontend
  - `GET /api/auth/oauth/accounts` — Lists linked OAuth accounts
  - `DELETE /api/auth/oauth/{provider}` — Unlinks OAuth account
- **OAuth Migration**: `migrations/versions/20260503_0002_create_oauth_accounts.py` — Creates oauth_accounts table
- **Config additions**: `FRONTEND_URL` setting for OAuth redirect destination
- **authlib dependency**: Added to `requirements.txt` for OAuth support

##### Frontend (apps/web)

- **OAuthButton component**: `src/components/ui/oauth-button.tsx` — Button with FontAwesome brand icons (GitHub, Google, Discord), hover color effects
- **OAuthButtonGroup**: Renders all three OAuth provider buttons
- **OAuth callback page**: `src/app/(auth)/oauth/callback/page.tsx` — Handles post-OAuth redirect, verifies session via `authApi.session()`, redirects to dashboard
- **Login page updated**: `login/page.tsx` — Added OAuthButtonGroup with separator
- **Signup page updated**: `signup/page.tsx` — Added OAuthButtonGroup with separator
- **Environment variables**: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_COOKIE_NAME` added to `.env`

##### OAuth Flow

1. User clicks OAuth button → frontend redirects to backend `/api/auth/oauth/{provider}`
2. Backend sets `oauth_state` cookie and redirects to provider's authorization URL
3. User authorizes → provider redirects to `/api/auth/oauth/{provider}/callback?code=...&state=...`
4. Backend validates state, exchanges code for tokens, creates/links user, sets `session_token` cookie
5. Backend redirects to frontend `/oauth/callback`
6. Frontend calls `authApi.session()` to verify session, redirects to `/dashboard`

##### Security Features

- CSRF protection via state parameter (encoded in cookie, validated on callback)
- HTTP-only, SameSite=Lax cookies for session
- secure=True in production, secure=False for development HTTP
- OAuth users have no password (kdf_salt generated, email_verified=True by default)

### Changed

- **Auth response hardening**: Signup/signin no longer return session tokens in JSON; the web app uses HTTP-only cookies only.

#### Phase 3 Rescue

- **Persistent CI sessions**: Added `ci_sessions` model/table and hardened CI secret endpoints so `ci_s_` tokens must be persisted, unexpired, scoped for `read:secrets`, and allowed for the requested environment.
- **Expiration metadata in Web UI**: Secrets page now fetches `/api/v1/projects/{project_id}/secrets/expiring?include_expired=true` and displays real expiration badges per secret row.
- **Vercel integrations UI**: Replaced integrations placeholder with project-scoped Vercel integration list/create/validate/delete UI.
- **GitHub Action publishing readiness**: Fixed action metadata outputs, aligned default API URL with `/api/v1`, documented zero-knowledge limitation, and generated `dist/index.js`.
- **Alembic migration setup**: Added Alembic async configuration, first revision for `ci_sessions`, and Makefile commands for upgrade/current/history/downgrade/revision workflows.

### Changed

- **Auth response hardening**: Signup/signin no longer return session tokens in JSON; the web app uses HTTP-only cookies only.
- **CLI login compatibility**: CLI API client extracts `session_token` from response cookies and stores it encrypted locally.
- **Integration service reliability**: Vercel integration sync now records real UTC timestamps and redacts configured secret values from stored/returned errors.
- **Database operations**: `make db-migrate` is now an alias for `make db-upgrade`; the legacy shell script delegates to Alembic.

### Fixed

- **Settings test collection**: API settings now ignore unrelated environment variables so local OAuth placeholders do not break pytest collection.

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
