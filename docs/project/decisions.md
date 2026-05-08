# Technical Decisions — CriptEnv

A record of significant architectural and technical decisions.

---

## Format

Each decision follows this structure:

```md
## DEC-XXX — [Title]

**Date:** YYYY-MM-DD
**Status:** Accepted / Under Review / Reverted
**Context:**
[Problem being addressed]

**Decision:**
[What was decided]

**Rationale:**
[Why this makes sense]

**Consequences:**
[Positive and negative impacts]
```

---

## DEC-001 — AES-256-GCM Encryption

**Date:** 2024 (Phase 1)
**Status:** ✅ Accepted
**Context:**
Need to encrypt secrets client-side with Zero-Knowledge guarantee. Server must never see plain-text secrets.

**Decision:**
Use AES-256-GCM for symmetric encryption with:
- PBKDF2HMAC-SHA256 (100,000 iterations) for master key derivation
- HKDF-SHA256 for per-environment key derivation
- Unique IV/nonce per encryption operation

**Rationale:**
- AES-256-GCM is industry standard (NIST approved)
- 100k PBKDF2 iterations provides strong protection against brute-force
- HKDF per-environment ensures compromise of one env doesn't affect others
- GCM mode provides authenticated encryption (confidentiality + integrity)

**Consequences:**
- ✅ Strong security guarantee
- ✅ Zero-knowledge architecture maintained
- ✅ Key derivation is slow (~300ms) but acceptable for infrequent operations
- ❌ Mobile browsers may experience slower key derivation

---

## DEC-002 — SQLite for Local Vault

**Date:** 2024 (Phase 1)
**Status:** ✅ Accepted
**Context:**
CLI needs offline access to secrets. Need a local storage format that supports encryption and works cross-platform.

**Decision:**
Use SQLite database at `~/.criptenv/vault.db` with `aiosqlite` for async operations.

**Rationale:**
- SQLite is zero-configuration, cross-platform, reliable
- Single file makes backup/restore simple
- `aiosqlite` provides async interface matching CLI's async needs
- Encryption applied at application level (not at DB level)

**Consequences:**
- ✅ Works offline
- ✅ Simple backup (copy single file)
- ✅ No server dependency for CLI usage
- ❌ Local machine is the trust boundary
- ❌ Master password is the only protection if device is compromised

---

## DEC-003 — Strategy Pattern for Complex Flows

**Date:** 2024 (Phase 1 API)
**Status:** ✅ Accepted
**Context:**
Complex business flows (vault access, invite state transitions, audit filtering) require different behaviors based on context. Hard-coding if/else chains would be messy and hard to test.

**Decision:**
Implement Strategy pattern in `apps/api/app/strategies/`:
- `access.py` — Vault access control strategies
- `invite_transitions.py` — Invite state machine
- `vault_push.py` — Vault push behavior
- `audit_filters.py` — Audit log filtering

**Rationale:**
- Each strategy is testable in isolation
- New strategies can be added without modifying existing code
- Open/Closed Principle satisfied
- Follows existing patterns in codebase

**Consequences:**
- ✅ Extensible for new providers/integrations
- ✅ Testable individual strategies
- ✅ Clear separation of concerns
- ❌ More files to navigate
- ❌ Need to document which strategy applies when

---

## DEC-004 — Service Layer for Business Logic

**Date:** 2024 (Phase 1 API)
**Status:** ✅ Accepted
**Context:**
Routers should not contain business logic. Direct database access from route handlers makes testing difficult and mixes concerns.

**Decision:**
All database mutations go through service classes in `apps/api/app/services/`:
- `auth_service.py` — Authentication logic
- `project_service.py` — Project operations
- `vault_service.py` — Secret vault operations
- `audit_service.py` — Audit logging

**Rationale:**
- Routers handle HTTP, services handle business logic
- Services can be tested without HTTP layer
- Easier to implement transactions across multiple operations
- Clear dependency injection path for database sessions

**Consequences:**
- ✅ Testable business logic
- ✅ Reusable across routers
- ✅ Transaction management in one place
- ❌ Extra layer of indirection
- ❌ Need to keep services and routers in sync

---

## DEC-005 — Session-Based Auth (Not JWT in Browser)

**Date:** 2024 (Phase 2)
**Status:** ⚠️ Under Review
**Context:**
Web dashboard needs authentication. Options: JWT stored in localStorage, HTTP-only cookies, BetterAuth.

**Decision:**
Custom session-based auth with tokens stored in HTTP-only cookies. NOT using BetterAuth as originally planned.

**Rationale:**
- HTTP-only cookies prevent XSS token theft
- Server-side session validation allows revocation
- Custom implementation gives full control
- Matches CLI's session management pattern

**Consequences:**
- ✅ More secure than localStorage JWT
- ✅ Server can revoke sessions
- ✅ Works across tabs/windows
- ❌ Requires CSRF protection
- ❌ Session management is more complex

**Related Issue**: CR-02 (Token in localStorage) from Phase 2 review indicates current implementation may have issues.

---

## DEC-006 — Vinext (Next.js 16) for Frontend

**Date:** 2024 (Phase 2)
**Status:** ✅ Accepted
**Context:**
Need a React framework compatible with Cloudflare Pages + Workers runtime.

**Decision:**
Use Vinext (Vite-based Next.js reimplementation) targeting Cloudflare edge deployment.

**Rationale:**
- Cloudflare Pages + Workers has specific runtime requirements
- Vinext provides Next.js compatibility with Vite speed
- Edge deployment for global low-latency
- Wrangler config already in place (`apps/web/wrangler.jsonc`)

**Consequences:**
- ✅ Fast builds with Vite
- ✅ Cloudflare edge deployment ready
- ✅ Next.js compatibility
- ❌ Vinext is newer than Next.js (less community support)
- ❌ Some Next.js patterns may not work identically

---

## DEC-007 — Zustand + React Query State Management

**Date:** 2024 (Phase 2)
**Status:** ✅ Accepted
**Context:**
Frontend needs clear state boundaries between client state and server state.

**Decision:**
- **Zustand**: `useUIStore`, `useProjectStore`, `useCryptoStore` for client state
- **React Query**: All server state (projects, secrets, audit logs)

**Rationale:**
- Zustand is simpler than Redux, less boilerplate
- React Query handles caching, refetching, loading states automatically
- Clear separation: UI state vs data state
- Crypto store specifically NOT persisted (keys never go to localStorage)

**Consequences:**
- ✅ Minimal boilerplate
- ✅ Automatic server state sync
- ✅ Encryption keys in memory only
- ❌ Two state libraries to learn
- ❌ Need to avoid mixing responsibilities

---

## DEC-008 — APScheduler for Background Jobs

## DEC-009 — OAuth URLs Must Never Fallback to Localhost

**Date:** 2026-05-04
**Status:** ✅ Accepted
**Context:**
The production OAuth entry flow redirected users to `http://localhost:8000` when the frontend button did not receive a public API URL. This created a production-only auth failure even when provider-side redirect URLs were configured correctly.

**Decision:**
Centralize the frontend API base URL resolution and remove any hardcoded `localhost` fallback from OAuth redirects. When no public API URL is configured, the web app now falls back to a relative path instead of assuming a local backend origin.

**Rationale:**
- Prevents production redirects to developer-only origins
- Keeps OAuth initiation aligned with the rest of the web API client
- Makes missing environment configuration fail safely instead of silently targeting localhost

**Consequences:**
- ✅ Production OAuth links no longer hardcode localhost
- ✅ API URL resolution is now shared instead of duplicated
- ❌ Deployments without a public API URL must still provide same-origin API routing or a proper env value

## DEC-010 — Cloudflare Worker Proxies Production API Traffic

**Date:** 2026-05-04
**Status:** ✅ Accepted
**Context:**
Cloudflare runtime secrets are available to the worker, but `NEXT_PUBLIC_*` values are not guaranteed to be embedded into the browser bundle when configured only as secrets. This caused production requests to hit the worker's own `/api/*` paths and return 404.

**Decision:**
Use the Cloudflare worker as a same-origin bridge for `/api/*` requests. The worker forwards requests to the backend API using runtime env bindings and adds forwarded host/protocol headers so the backend can generate correct public OAuth callback URLs.

**Rationale:**
- Removes production dependence on client-side env injection for core API connectivity
- Keeps same-origin browser requests viable on Cloudflare
- Allows OAuth cookies and redirects to align with the worker domain when proxied

**Consequences:**
- ✅ Production frontend works even if the API URL exists only as a worker secret
- ✅ Same-origin API requests avoid browser-side cross-origin complexity
- ❌ The worker must have `API_URL` or `NEXT_PUBLIC_API_URL` configured at runtime

**Date:** 2026-04 (Phase 3)
**Status:** ✅ Accepted
**Context:**
Need background job for checking secret expirations and triggering notifications.

**Decision:**
Use APScheduler with FastAPI lifespan integration:
- `SchedulerManager` singleton pattern
- Starts/stops with FastAPI app
- Configurable via `SCHEDULER_ENABLED` and `SCHEDULER_INTERVAL_HOURS`

**Rationale:**
- APScheduler is mature, well-documented
- Lifespan integration ensures proper startup/shutdown
- Singleton prevents duplicate schedulers
- Configurable without code changes

**Consequences:**
- ✅ Runs periodic tasks reliably
- ✅ Proper lifecycle management
- ✅ Easy configuration
- ❌ Single process only (no distributed scheduling)
- ❌ No persistence of job state (in-memory)

---

## DEC-009 — Phase 3 Integration Strategy

**Date:** 2026-04 (Phase 3)
**Status:** ✅ Accepted
**Context:**
Phase 3 requires multiple cloud provider integrations (Vercel, Railway, Render). Each has different APIs.

**Decision:**
Use Strategy pattern with `IntegrationProvider` interface:
- Base interface in `apps/api/app/strategies/integrations/base.py`
- Provider implementations: `vercel.py`, `railway.py`, `render.py`
- `IntegrationService` selects appropriate strategy

**Rationale:**
- Same pattern already used in codebase (vault_push, invite_transitions)
- Easy to add new providers
- Testable in isolation
- Common interface for CLI and API to consume

**Consequences:**
- ✅ Extensible for new providers
- ✅ Consistent API across integrations
- ✅ Testable strategies
- ❌ More files to maintain
- ❌ Provider APIs may change (need strategy updates)

---

## DEC-012 — Cookie-Only Web Sessions and Persisted CI Sessions

**Date:** 2026-05-03
**Status:** ✅ Accepted
**Context:**
Phase 2 security review identified CR-01 (session token in auth response body) and CR-02 (token in browser storage). Phase 3 CI auth also accepted any `ci_s_` token by format only.

**Decision:**
- Web signup/signin responses return only user and session metadata; the session secret is delivered only via HTTP-only cookie.
- CLI login extracts the same session token from `Set-Cookie` and stores it encrypted in the local vault.
- CI login persists hashed temporary `ci_s_` sessions in `ci_sessions`; CI secret endpoints validate persisted session, scope, expiration, project, and environment.

**Rationale:**
- Removes bearer token exposure from browser-readable JSON.
- Preserves CLI bearer-token workflow without weakening web auth.
- Prevents forged CI session tokens from accessing vault blobs.

**Consequences:**
- ✅ Resolves CR-01/CR-02 for web auth.
- ✅ CI sessions can be expired server-side.
- ✅ `ci_sessions` can be applied and tracked with Alembic via `make db-upgrade`.
- ⚠️ CLI depends on API clients preserving response cookies.

---

## DEC-013 — Project-Scoped Vault Passwords

**Date:** 2026-05-05
**Status:** ✅ Accepted
**Context:**
The Web vault unlock flow previously derived a temporary browser key from the user's account KDF salt, which meant project secrets were not bound to a project-specific password. Teams need a project vault password that can be shared intentionally, changed by admins/owners, and never recoverable by the server.

**Decision:**
- Require `vault_config` and `vault_proof` when creating projects.
- Store only vault metadata and a bcrypt hash of the proof in `projects.settings.vault`; never store or return the password or `proof_hash`.
- Derive project vault keys client-side with PBKDF2-SHA256 and per-environment HKDF.
- Validate vault passwords locally with an AES-GCM verifier before decrypting blobs.
- Require `vault_proof` for vault writes and rekey operations.
- Treat forgotten vault passwords as unrecoverable zero-knowledge loss; users must create/import into a new project from an external source or an already unlocked session.

**Rationale:**
- Keeps the server zero-knowledge while enforcing project-level write authorization.
- Lets teams share a project vault password without sharing account passwords.
- Allows admins/owners to rotate the vault password by re-encrypting blobs client-side.

**Consequences:**
- ✅ Project secrets are bound to a project-specific password.
- ✅ API responses no longer expose vault proof material.
- ✅ CLI/Web use the same crypto contract.
- ❌ Forgotten vault passwords cannot be recovered.
- ⚠️ Existing projects without `vault_config` require a migration/import flow before v1 vault behavior.

---

## DEC-014 — Docs Navbar Brand Alignment

**Date:** 2026-05-05
**Status:** ✅ Accepted
**Context:**
The `/docs` navbar should visually align with the AbacatePay documentation reference while preserving CriptEnv's black/white theme system and the existing documentation information architecture.

**Decision:**
- Use `apps/web/public/images/logocriptenv.png` directly for the docs brand mark, rendered monochrome with theme-aware CSS filters.
- Keep the brand and a new visible `Início` nav item linked to `/`.
- Use a two-row docs header with one separator between the brand/search/action row and the docs tab row, plus one lower boundary under the tabs.
- Preserve existing docs sections and search modal behavior, adding click-to-open search from the navbar.

**Rationale:**
- Reuses the existing brand asset without creating duplicate logo files.
- Makes the landing page route discoverable from docs.
- Keeps docs navigation visually close to the requested reference without importing AbacatePay's green accent.

**Consequences:**
- ✅ Docs navbar better matches the requested reference.
- ✅ Theme switching keeps the logo black in light mode and white in dark mode.
- ✅ Search remains keyboard-accessible and gains mouse/touch activation.
- ✅ The full logo image, including its embedded wordmark, remains visible without an extra text label beside it.

---

## DEC-015 — Floating Bar Documentation Entry

**Date:** 2026-05-05
**Status:** ✅ Accepted
**Context:**
The landing page floating-bar did not expose the documentation route, and the `/docs` welcome page did not share that quick navigation affordance.

**Decision:**
- Add a final, visually separated `Docs` item to the floating-bar that links to `/docs`.
- Keep existing landing section items as smooth-scroll anchors when their target exists.
- When a section target is missing on the current route, navigate to the landing page with the matching hash, such as `/#how-it-works`.
- Render the floating-bar only on the `/docs` welcome page, not on docs subroutes with sidebar/TOC.

**Rationale:**
- Makes documentation discoverable from the landing navigation without changing the main marketing sections.
- Keeps section navigation reliable when the floating-bar is rendered from `/docs`.
- Avoids visual overlap with the documentation sidebar and table of contents on nested docs pages.
- Lets the floating-bar remain useful when rendered from `/docs` by navigating missing section anchors back to landing hashes.

**Consequences:**
- ✅ Landing users can reach documentation from the floating-bar.
- ✅ `/docs` shows the same quick navigation surface and can jump back to landing sections.
- ✅ Docs subroutes keep their existing reading layout uncluttered.

---

## DEC-016 — VPS Docker Backend Deployment

**Date:** 2026-05-06
**Status:** ✅ Accepted
**Context:**
The API was prepared for Render Free Tier hosting, but the project now has an available 8GB VPS. Render cold starts and single-process assumptions are no longer the preferred production path, while the frontend remains on Cloudflare Pages and the database remains Supabase.

**Decision:**
- Host the FastAPI backend on the VPS with Docker Compose.
- Expose the API through DuckDNS + Nginx Proxy Manager + Let's Encrypt at `https://criptenv.duckdns.org`.
- Keep Cloudflare Pages as the web host and configure the Worker runtime `API_URL` to proxy `/api/*` to the VPS API.
- Use Redis for rate-limit counters so multiple Gunicorn/Uvicorn workers share limits.
- Run APScheduler in a dedicated one-worker scheduler service and keep it disabled in public API workers.
- Keep Render/Railway deployment files as legacy rollback references; do not remove RenderProvider because it is a user-facing integration provider.

**Rationale:**
- VPS hosting removes Render Free Tier cold starts and gives stable capacity without adding monthly hosting cost.
- DuckDNS provides a stable public hostname without buying a domain.
- Nginx Proxy Manager keeps TLS and proxy management simple for a small VPS deployment.
- Same-origin Cloudflare Worker proxy preserves HTTP-only cookie behavior for the dashboard.
- Redis-backed rate limiting prevents per-worker in-memory counters from diverging.

**Consequences:**
- ✅ API can run multiple workers with shared operational counters.
- ✅ Frontend can remain on Cloudflare Pages without owning a custom domain.
- ✅ Supabase stays the managed production database.
- ✅ Smoke tests are validated through DuckDNS and the Workers frontend health proxy.
- ❌ The VPS now needs OS patching, firewall management, backups for proxy config, and container monitoring.
- ⚠️ DuckDNS availability becomes part of production availability.

---

## DEC-017 — Integration Config At-Rest Encryption

**Date:** 2026-05-06
**Status:** ✅ Accepted
**Context:**
Cloud provider integrations store operational API tokens and provider IDs in `integrations.config`. Keeping that JSONB config as plaintext would expose provider tokens if the production database is inspected or leaked.

**Decision:**
- Encrypt the full provider config JSON before storing it in `integrations.config`.
- Use AES-256-GCM with a versioned JSONB envelope and HKDF-SHA256 key derivation.
- Derive the encryption key from a dedicated `INTEGRATION_CONFIG_SECRET`, not from `SECRET_KEY`.
- Keep the public API contract unchanged: create requests still accept `config`, and list/get responses still omit it.
- Accept legacy plaintext configs temporarily and re-encrypt them on migration or first service access.

**Rationale:**
- Separates auth token signing from integration-token encryption and enables independent rotation later.
- Protects all current and future provider-specific config fields without per-provider branching.
- Keeps provider strategies simple: they still receive normal decrypted `dict` config from `IntegrationService`.

**Consequences:**
- ✅ Vercel/Render tokens are encrypted at rest.
- ✅ RailwayProvider can be added without introducing new plaintext token storage.
- ✅ Existing plaintext rows have a migration path.
- ❌ Production deploys must configure and preserve `INTEGRATION_CONFIG_SECRET`; losing it makes encrypted integration configs unrecoverable.

---

## DEC-018 — Frontend Test Suite With Isolated E2E Database

**Date:** 2026-05-07
**Status:** ✅ Accepted
**Context:**
The web app had only orphaned component tests and no runnable frontend test workflow. Critical auth, project, vault, and secret flows needed automated coverage without using production or Supabase data.

**Decision:**
- Use Jest with React Testing Library for unit and user-interaction tests.
- Use Cypress for browser E2E against a real local Vinext + FastAPI + PostgreSQL test stack.
- Keep local `.env.test` files ignored and commit only `.env.test.example` templates with disposable credentials.
- Run E2E database reset tooling only against local database URLs whose database name includes `test`.

**Rationale:**
- Jest/RTL keeps component and form behavior fast and deterministic.
- Cypress catches regressions across routing, cookies, API calls, client-side crypto, and vault interactions.
- An isolated PostgreSQL database validates realistic backend behavior without risking production data.

**Consequences:**
- ✅ Frontend changes can be verified with `make web-test`.
- ✅ E2E tests cover the real cookie/session and zero-knowledge vault browser flow.
- ✅ Test env defaults are safe to commit and easy to recreate locally.
- ❌ E2E requires Docker and local API dependencies to be available.

---

## DEC-019 — Blocking Test, Security, and Build Gates

**Date:** 2026-05-08
**Status:** ✅ Accepted
**Context:**
CriptEnv had strong local API/CLI test suites and a new frontend E2E stack, but no pull-request gates for tests, lint, security scans, Docker builds, or the packaged GitHub Action bundle. Several regressions were still able to live in the workspace: stale frontend GET cache after mutations, duplicate `/api/v1/api/v1` routes, missing GitHub Action tests, and lint debt in docs pages.

**Decision:**
- Add blocking GitHub Actions for CI, Cypress E2E, security scans, and Docker image builds.
- Keep E2E on an isolated local PostgreSQL service and upload Cypress screenshots on failure.
- Add a backend database integration test that is opt-in locally and enabled in the E2E workflow.
- Treat the GitHub Action package as a release artifact: lint, test, typecheck, build, and verify `dist/` is committed.
- Use Dependabot for npm, pip, and GitHub Actions updates.

**Rationale:**
- Security-sensitive secret-management code needs automated checks before merge, not only local manual runs.
- The web dashboard depends on browser cookies, client crypto, API cache behavior, and a real backend; unit tests alone do not catch those integration risks.
- The GitHub Action marketplace entry references `dist/index.js`, so source and bundle must stay in sync.

**Consequences:**
- ✅ PRs now have repeatable gates for API, CLI, Web, GitHub Action, E2E, security, and Docker builds.
- ✅ Stale cache and duplicate route regressions are covered by automated tests.
- ✅ The scheduler now opens a fresh DB session per background execution.
- ❌ Contributors need Docker available for E2E runs.
- ⚠️ Security dependency audits may require periodic triage when upstream advisories appear.

---

## DEC-020 — Public Pix Contributions With Light Status Sync

**Date:** 2026-05-08
**Status:** ✅ Accepted
**Context:**
CriptEnv needs a low-friction contribution flow from the marketing site. Requiring dashboard login would add unnecessary friction for open-source supporters, while Mercado Pago webhooks can be delayed or unavailable in local/sandbox environments.

**Decision:**
- Make `/contribute` public and allow anonymous `POST /api/v1/contributions/pix` creation.
- Keep Mercado Pago Pix as the only payment method for this contribution flow.
- Treat Mercado Pago webhook verification as the primary source of payment truth.
- Let the frontend poll local contribution status every 5 seconds and perform light provider sync after 10 seconds, then at most every 30 seconds.
- Store only minimal payer metadata; no vault data, secrets, or zero-knowledge material participate in this flow.

**Rationale:**
- Public Pix keeps support friction low for visitors arriving from the landing pricing CTA.
- Webhooks remain authoritative, but light sync improves feedback when webhooks are delayed.
- The contribution flow is operationally separate from encrypted secret management and does not weaken the zero-knowledge boundary.

**Consequences:**
- ✅ Visitors can contribute without creating an account.
- ✅ The UI can recover from delayed webhook delivery without aggressive Mercado Pago polling.
- ✅ Payment status is visible in the browser through QR, pending, paid, expired, and error states.
- ❌ Anonymous payment creation must remain protected by amount validation and rate limiting.
- ⚠️ Provider availability can still surface as a visible Pix creation error.

---

## Pending Decisions

### DEC-011 — API Key vs CI Token Separation

**Status:** Under Review
**Context:**
Phase 3 has two types of tokens: API keys (for public API) and CI tokens (for CI/CD). Should they be separate models?

**Options:**
1. Separate models (`APIKey` and `CIToken`)
2. Unified token model with `type` field

**Recommended:** Separate models for clearer purpose and different permission scopes.

---

**Document Version**: 1.2
**Last Updated**: 2026-05-08
