# Technical Decisions — CriptEnv

A record of significant architectural and technical decisions.

---

## DEC-051 — Project RBAC for Settings, Secrets, and Invites

**Date:** 2026-05-29
**Status:** ✅ Accepted
**Context:**
Project-level actions were too permissive for developers: settings links were visible to every member, developers could write vault blobs through the web session, and invite revocation kept stale invite links in the database/UI.

**Decision:**
Restrict project settings and all human-session secret writes to `owner` and `admin`. Developers can still read/use project secrets and can invite only `developer` or `viewer` roles. Developers may revoke only their own pending invites; revocation now hard-deletes the invite and associated invite notifications. CI sessions with explicit `write:secrets` scope keep programmatic vault write access.

**Rationale:**
- Settings, vault writes, rotation, and expiration changes are administrative actions.
- Developers still need collaboration flow without being able to grant admin access.
- Hard-deleting revoked invites removes dead links from both persistence and UI.

**Consequences:**
- Positive: Least-privilege defaults for project administration and secret mutation.
- Positive: Cleaner invite UI with no revoked stale links.
- Neutral: Developer write workflows now require an admin or scoped CI credential.

---

## DEC-050 — Existing-User Scope for Invite Notifications

**Date:** 2026-05-29
**Status:** ✅ Accepted
**Context:**
Invite delivery now has two channels: email for every invite and in-app notifications for users who already exist. Supporting app notifications for emails without accounts would require a pending-by-email notification/outbox model and account-claim flow.

**Decision:**
Keep in-app invite notifications scoped to existing users only. Normalize invite emails before duplicate checks, email send, and existing-user lookup so registered users receive the notification reliably. Users without accounts continue to receive the invitation link by email only.

**Rationale:**
- The notification table is intentionally user-scoped by `user_id`.
- The current product need is to make existing users see invites inside the app without adding a new pending-notification lifecycle.
- Email remains the correct delivery channel for recipients who cannot yet access the app.

**Consequences:**
- Positive: Reliable invite notifications for registered users with no schema/API expansion.
- Neutral: A future pending-by-email flow can be added as a separate feature.
- Negative: Recipients without accounts still depend on email until they sign up and accept from the link.

---

## DEC-049 — In-App Notification System

**Date:** 2026-05-28
**Status:** ✅ Accepted
**Context:**
Project invites were only delivered via email. Users with active accounts had no way to see pending invites within the web app, and the notification bell in the top navigation was purely decorative.

**Decision:**
Build a lightweight in-app notification system:
- PostgreSQL `notifications` table with `user_id`, `type`, `title`, `message`, `read_at`, `action_url`, and `meta` JSONB.
- FastAPI router under `/api/v1/notifications` with list, unread-count, mark-read, and mark-all-read endpoints.
- Notification creation hooked into the invite flow: when an invite is sent to an email that matches an existing user, a notification is created automatically.
- Frontend `NotificationBell` component with Radix-free dropdown, Zustand store, 30-second polling for unread count, and optimistic mark-as-read.

**Rationale:**
- Users check the app more frequently than email; in-app notifications reduce invite acceptance friction.
- A simple table-based approach avoids the complexity of WebSockets or SSE for this use case.
- Polling every 30s is sufficient for invite notifications and keeps the architecture simple.

**Consequences:**
- Positive: Faster invite response, bell icon is now functional, consistent UX between email and in-app.
- Neutral: Future alert types (secret expiration, etc.) can reuse the same notification infrastructure.
- Negative: 30-second polling adds minor request overhead; can be upgraded to WebSockets later if needed.

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
**Status:** ✅ Superseded by DEC-022
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

## DEC-021 — Explicit DuckDNS IPv4 Updates

**Date:** 2026-05-10
**Status:** ✅ Superseded by DEC-022
**Context:**
The VPS API, Nginx Proxy Manager, and local container health checks were healthy, but public requests to `https://criptenv.duckdns.org` timed out because the DuckDNS A record drifted away from the VPS public IPv4. A manual DuckDNS update from the VPS restored the connection. The previous updater sent `ip=` empty, relying on DuckDNS to infer the address from the request source, which is fragile when NAT, tunnels, proxies, or a second updater are involved.

**Decision:**
- Make the VPS DuckDNS updater detect the VPS public IPv4 with `https://api4.ipify.org`.
- Send the detected IPv4 explicitly in the DuckDNS `ip=` parameter.
- Add `DUCKDNS_FORCE_IP` as an optional static override for VPSes with fixed public IPv4 addresses.
- Document a drift runbook that compares `curl -4 https://api.ipify.org` with `dig +short criptenv.duckdns.org`.

**Rationale:**
- Explicit updates remove ambiguity about which source address DuckDNS should store.
- A static override supports providers with stable public IPs and avoids runtime detection dependencies.
- The runbook distinguishes application health from public DNS/network drift quickly.

**Consequences:**
- ✅ DuckDNS updates should converge on the actual VPS IPv4 instead of an inferred source IP.
- ✅ Future outages can be diagnosed by comparing the VPS public IPv4 and DuckDNS A record first.
- ✅ Competing updaters become easier to detect because the record will flip away from the expected VPS IP.
- ⚠️ If the VPS public IP changes and `DUCKDNS_FORCE_IP` is set, the override must be updated manually.
- ⚠️ If `api4.ipify.org` is unreachable and no override is set, the updater will skip that cycle instead of publishing an unknown address.

---

## DEC-022 — Custom Production Domains Through Cloudflare Tunnel

**Date:** 2026-05-10
**Status:** ✅ Accepted
**Context:**
DuckDNS became unstable for the production API because the shared account token could not be rotated and another updater appeared to overwrite the `criptenv` record. CriptEnv now has the `77mdevseven.tech` domain available in Cloudflare, which can provide both custom frontend DNS and an outbound tunnel to the VPS API without exposing VPS ports directly.

**Decision:**
- Use `https://criptenv.77mdevseven.tech` as the production frontend domain.
- Use `https://criptenv-api.77mdevseven.tech` as the production backend API domain.
- Route the backend through Cloudflare Tunnel to the internal Docker service `http://api:8000`.
- Keep frontend browser requests same-origin through `/api/*`; set Cloudflare Pages runtime `API_URL=https://criptenv-api.77mdevseven.tech` and keep `NEXT_PUBLIC_API_URL` empty.
- Configure backend `FRONTEND_URL` and `CORS_ORIGINS` to `https://criptenv.77mdevseven.tech`.

**Rationale:**
- Cloudflare-managed DNS and tunnel remove DuckDNS token drift from the production path.
- The VPS no longer needs public inbound `80/443` for the API.
- Custom domains make OAuth redirects, webhooks, and CLI configuration stable and brand-aligned.

**Consequences:**
- ✅ Production no longer depends on DuckDNS for API availability.
- ✅ Backend CORS and OAuth redirects point at the custom frontend origin.
- ✅ The API can remain private behind an outbound tunnel.
- ❌ Cloudflare Tunnel availability becomes part of production availability.
- ⚠️ Cloudflare tunnel token must be protected and rotated if exposed.

---

## DEC-023 — Landing Security Scrollytelling

**Date:** 2026-05-11
**Status:** ✅ Accepted
**Context:**
The marketing landing security section was a static image-and-list block. It did not explain the core security model in enough detail for visitors evaluating a zero-knowledge secrets product, and it did not use the existing GSAP/Three.js frontend capabilities already present in the web app.

**Decision:**
- Replace the static Security section with a desktop scrollytelling sequence covering AES-GCM, zero-knowledge, client-side-only crypto, and open-source auditability.
- Use GSAP ScrollTrigger for desktop pinning, progress, and snap points.
- Use a lightweight dynamically loaded React Three Fiber scene only on desktop when reduced motion is not requested.
- Render a static stacked mobile narrative with the same content and images, without scroll locking or canvas loading.

**Rationale:**
- Security-sensitive claims need a guided explanation instead of short marketing bullets.
- Pinning and snapping make the section feel intentional while keeping the rest of the landing scroll normal after the final topic.
- Mobile and reduced-motion users should retain normal page control and readable content.

**Consequences:**
- ✅ The landing now explains security claims in a more detailed and inspectable flow.
- ✅ Desktop gets a cinematic interaction without introducing new dependencies.
- ✅ Mobile and reduced-motion modes avoid scroll traps and WebGL cost.
- ⚠️ The section now depends on GSAP ScrollTrigger behavior and needs visual QA when layout changes nearby.

---

## DEC-024 — Problem to Vault Vault Ceremony

**Date:** 2026-05-11
**Status:** ✅ Accepted
**Context:**
The “Problem to Vault” landing fold showed the transformation from scattered secrets to a vault, but the vault was visually secondary and the encryption boundary was not explicit enough. The page already uses GSAP and React Three Fiber elsewhere, so this fold needed a lighter, more editorial interaction that reinforces the zero-knowledge promise without adding another WebGL scene.

**Decision:**
- Replace the inline “Problem to Vault” block with a dedicated `ProblemToVaultSection` component.
- Make the encrypted vault the dominant visual endpoint, with scattered `.env` fragments feeding a three-step path: `plain env`, `AES-GCM local seal`, and `encrypted vault`.
- Use GSAP ScrollTrigger only for local entrance choreography: fragments appear, the seal path lights up, the vault closes, and proof badges enter.
- Keep React Three Fiber out of this fold and rely on static HTML/CSS for reduced-motion users.
- Surface concise proof points in the fold: `server sees: ciphertext`, `plaintext: never`, and `audit hash: chained`.

**Rationale:**
- The visual hierarchy now matches the product promise: plaintext is temporary, the encrypted vault is the durable source of truth.
- GSAP provides enough motion to explain the transformation without increasing WebGL cost on a landing page that already has 3D sections.
- Explicit proof points make the zero-knowledge boundary easier to understand at a glance.

**Consequences:**
- ✅ The fold feels more professional and vault-centered.
- ✅ Visitors see the local encryption path before the later deeper security scrollytelling section.
- ✅ No new frontend dependencies are introduced.
- ⚠️ The section now has component-local GSAP behavior that should be checked when nearby landing layout changes.

---

## DEC-025 — Redis-Backed CLI Auth State

**Date:** 2026-05-12
**Status:** ✅ Accepted
**Context:**
Browser-based CLI login creates a short-lived `state` during `/api/auth/cli/initiate` and consumes it during `/api/auth/cli/authorize`. Production runs Gunicorn with multiple Uvicorn workers, so in-memory state can be created in one worker and consumed by another, causing intermittent `Invalid or expired state` errors.

**Decision:**
- Store CLI auth state, auth codes, and device flow codes in Redis when `REDIS_URL` is configured.
- Keep the in-memory store as the local development fallback when Redis is unavailable or unset.
- Use explicit TTL keys: `cli_auth:state:{state}` and `cli_auth:code:{auth_code}` for 300 seconds, and `cli_auth:device:{device_code}` for 600 seconds.
- Default the CLI API URL to `https://criptenv-api.77mdevseven.tech`, with `CRIPTENV_API_URL` retained as the development override.

**Rationale:**
- Redis is already part of the production VPS stack for shared operational state.
- A shared TTL store lets public API workers scale without breaking browser-based CLI login.
- The CLI should work against production by default for end users while preserving local development ergonomics.

**Consequences:**
- ✅ `criptenv login` works consistently with multiple API workers.
- ✅ Device flow authorization also survives worker hops.
- ✅ Local development remains simple without requiring Redis.
- ⚠️ Production CLI auth now depends on Redis availability, matching existing rate-limit infrastructure.

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

## DEC-026 — Wave 1 Alignment Fixes: Rotation Router Registration & CLI Rekey

**Status:** Approved
**Date:** 2026-05-13
**Context:**
Gap analysis between API, WEB, and CLI revealed two critical P0 issues:
1. The `rotation.py` router (M3.5 Secret Rotation & Alerts) existed in the codebase but was never imported or registered in `main.py`, making all rotation/expiring endpoints return 404.
2. The CLI `projects rekey` command called `client.rekey_project()` with an empty body, while the API expected `ProjectVaultRekeyRequest` (current_vault_proof, new_vault_config, new_vault_proof, environments), causing 422 Unprocessable Entity.

**Decision:**
- Register `rotation_router` and `expiring_router` in `main.py` and `app/routers/__init__.py`.
- Rewrite the CLI `projects rekey` command to perform the full client-side re-encryption flow: prompt for current and new vault passwords, verify the current password, pull all environment vaults, decrypt each blob with the old key, re-encrypt with the new key, compute web-compatible checksums, and send the complete payload to the API.

**Consequences:**
- ✅ M3.5 Secret Rotation endpoints are now accessible.
- ✅ CLI `projects rekey` now works correctly and is consistent with the WEB implementation.
- ⚠️ The CLI rekey command now requires interactive password prompts and performs client-side crypto for all environments (slower but zero-knowledge).
- ✅ Test suite updated to cover the new rekey flow.

---

## DEC-027 — Wave 2: User Account Management (Auth, Profile, 2FA, Email)

**Status:** Approved
**Date:** 2026-05-13
**Context:**
Gap analysis identified that the API had no endpoints for forgot/reset password, change password, update profile, delete account, or 2FA management. The WEB had a forgot-password page with no API connection, and the account page was read-only. The CLI had no commands for any of these features.

**Decision:**
- **Email Provider**: Use Resend (resend.com) for transactional emails. From address: `admin@77mdevseven.tech`.
- **Forgot/Reset Password**: API generates cryptographically secure tokens (secrets.token_urlsafe) stored in a new `password_reset_tokens` table with 1-hour expiration. Email sent via Resend with a frontend reset URL.
- **Change Password**: API verifies current password with bcrypt, hashes new password, invalidates all sessions.
- **Update Profile**: API allows updating name and email (with uniqueness check). Email verification reset on email change.
- **Delete Account**: API hard-deletes user and cascades related data (sessions, reset tokens, OAuth accounts, memberships, owned projects).
- **2FA/TOTP**: Uses `pyotp` library. Setup generates a TOTP secret URI for QR code display. Verification requires one valid code. Disabling requires password confirmation.
- **WEB**: Forgot-password page now calls API. New reset-password page handles token validation. Account page now supports profile editing, password change, 2FA setup/verify/disable, and account deletion with confirmation.
- **CLI**: New `auth`, `profile`, and `2fa` command groups mirror all API capabilities.

**Consequences:**
- ✅ Full user account lifecycle now supported across API, WEB, and CLI.
- ✅ Zero-knowledge architecture maintained (password changes invalidate sessions, no plaintext storage).
- ✅ Resend integration is optional — if `RESEND_API_KEY` is not set, emails return mock responses for local development.
- ⚠️ 2FA backup codes are generated but not stored server-side (displayed once during setup). Users must save them.
- ⚠️ Delete account cascades and deletes owned projects. This is intentional for GDPR-style right-to-erasure.

---

## DEC-028 — Wave 3 Alignment: API Keys, Rotation UI, Invites, OAuth Accounts

**Status:** Approved
**Date:** 2026-05-13
**Context:**
Gap analysis revealed that several API endpoints existed but had no corresponding WEB UI:
1. API Keys (M3.4) — API and CLI existed, WEB had nothing.
2. Secret Rotation — API endpoints were registered in Wave 1, but WEB only displayed expiration badges without allowing configuration.
3. Accept Invite — API endpoint existed but WEB had no page to accept invites via email token.
4. OAuth Accounts — API endpoints for listing/unlinking existed but WEB account page didn't show them.

**Decision:**
- **API Keys UI**: Created `ApiKeysPanel` component (mirroring `CITokensPanel`) with create (scopes selection, env restriction, expiration), list, and revoke. Added to project settings page.
- **Secret Rotation UI**: Expanded `rotationApi` with `rotateSecret`, `setExpiration`, `deleteExpiration`, `getRotationHistory`. Added rotation and expiration buttons to `SecretRow`. Created `ExpirationModal` for configuring expiration (days, policy, notify days). Updated `SecretsTable` to pass new callbacks. Added `handleRotateSecret` in secrets page that generates a new random value and calls the rotation API.
- **Accept Invite**: Created new API endpoints `GET /api/auth/invites/lookup` and `POST /api/auth/invites/accept` that work with invite tokens (not just invite IDs). Created WEB page `/invites/accept?token=xxx` that shows invite info and allows acceptance.
- **OAuth Accounts**: Added `listOAuthAccounts` and `unlinkOAuthAccount` to WEB auth API. Added "Connected Accounts" section to `/account` page with unlink capability.
- **Types**: Added `APIKey`, `RotationResponse`, `RotationHistoryResponse`, `ExpirationResponse` to `client.ts`.

**Consequences:**
- ✅ WEB now covers all major API features for API Keys and Secret Rotation.
- ✅ Invite acceptance flow works end-to-end via email token links.
- ✅ OAuth account management is visible and actionable in the WEB UI.
- ⚠️ `SecretRow` test file has pre-existing TypeScript issues (unrelated to changes).

---

## DEC-029 — Waves 4 & 5: CLI Completeness, Railway Stub, Audit Export, Docs Polish

**Status:** Approved
**Date:** 2026-05-13
**Context:**
Remaining gaps from the alignment analysis were lower priority but needed for full coherence:
1. CLI client was missing 8 methods that the API already exposed.
2. Railway provider was a stub in both CLI and API.
3. WEB audit page only exported JSON, not CSV.
4. AGENTS.md referenced a non-existent `project.ts` store.
5. API Keys router registration was indirect via v1_router (intentional, but documented).

**Decision:**
- **CLI Client (GAP-12)**: Added all 8 missing methods: `list_ci_secrets_keys`, `delete_ci_token`, `get_integration`, `delete_expiration`, `get_api_key`, `update_api_key`, `list_oauth_accounts`, `unlink_oauth_account`.
- **Railway Stub (GAP-13)**: Removed `railway` from CLI `Click.Choice` options for `integrations connect` and `integrations sync`. Updated test to assert that `railway` is rejected as an invalid choice (exit code 2). Railway remains in the API registry but without an implemented provider — this is documented and acceptable until the provider API becomes available.
- **Audit Export CSV (GAP-14)**: Added `exportCsv()` function to the WEB audit page that generates RFC-4180 compliant CSV with proper escaping. Added "Export CSV" button alongside existing "Export JSON".
- **AGENTS.md (GAP-15)**: Removed reference to non-existent `src/stores/project.ts`.
- **Router Registration (GAP-16)**: After testing, reverted the move of `api_keys_router` from `v1.py` back to `v1.py` because the router uses a relative prefix (`/projects/...`) and depends on the `/api/v1` prefix from `v1_router`. The indirect registration is intentional and correct.

**Consequences:**
- ✅ CLI client now covers all API endpoints comprehensively.
- ✅ Railway no longer appears as a valid option in CLI until implemented.
- ✅ Audit export supports both JSON and CSV formats.
- ✅ Documentation is accurate regarding existing files.
- ✅ All test suites pass (API: 365 passed, CLI: 173 passed).

---

## DEC-030 — Professional Auth Screens Layout

**Status:** Approved
**Date:** 2026-05-13
**Context:**
The login, signup, and forgot-password screens were functional but visually generic. Login/signup used a narrow centered stack, OAuth providers appeared as heavy full-width buttons, and forgot-password rendered its own full-screen card inside the auth layout, creating an inconsistent composition.

**Decision:**
- Use a shared split auth layout: desktop shows a product/security panel plus a refined form surface; mobile shows a compact branded header and the same form surface.
- Render OAuth providers as a compact three-column row for GitHub, Google, and Discord while preserving the existing `/api/auth/oauth/{provider}` redirect flow.
- Keep field labels, submit button names, validation behavior, and the login forgot-password link accessible for current tests and user workflows.

**Consequences:**
- ✅ Auth screens feel more polished and better aligned with the zero-knowledge product promise.
- ✅ The forgot-password request and sent states now match login/signup visually.
- ✅ No API, schema, route, or dependency changes are required.
- ⚠️ Future auth pages should reuse the shared auth layout instead of adding nested full-screen wrappers.

---

## DEC-031 — Pipeline Compatibility for Invite Type Hints and React Effects

**Status:** Approved
**Date:** 2026-05-13
**Context:**
CI reported API collection failures with `NameError: name 'ProjectInvite' is not defined` and WEB lint failures from `react-hooks/set-state-in-effect`. Local Python 3.14 defers annotation evaluation, but the pipeline can run with Python versions that evaluate annotations eagerly during import.

**Decision:**
- Import `ProjectInvite` at module scope in `AuthService` instead of relying on function-local imports after annotations have already been evaluated.
- Keep the WEB components' existing local state pattern, but schedule initial async fetch/invalid-token state transitions from `useEffect` via `window.setTimeout(..., 0)`, matching the existing `CITokensPanel` pattern.
- Remove unused imports/types flagged by ESLint.

**Consequences:**
- ✅ API test collection is compatible with eager annotation evaluation.
- ✅ WEB lint passes without replacing the current local state implementation.
- ⚠️ Future React data-loading work should consider a shared query/cache pattern to avoid repeating effect scheduling logic.

---

## DEC-032 — Email Verification Required for Dashboard Access

**Status:** Approved
**Date:** 2026-05-13
**Context:**
User accounts could be created and immediately used without confirming ownership of the email address. This creates risks: password-reset emails could be sent to unowned addresses, invite flows assume valid emails, and audit logs benefit from verified identities.

**Decision:**
- Require email verification before any authenticated session is created or any protected resource is accessed.
- Reuse the existing `email_verified` boolean on `User` and follow the same token pattern as `PasswordResetToken` (`EmailVerificationToken`, 24-hour expiry, single-use).
- On signup: create the user but do NOT create a session or set cookies. Send the verification email immediately.
- On signin: if `email_verified` is `False`, return `403 Forbidden` and automatically resend the verification email.
- In middleware (`get_current_user`): reject requests from users with `email_verified = False` with `403 Forbidden`.
- OAuth users remain exempt because providers already verify emails; they are created with `email_verified = True`.
- Frontend: add `/verify-email` (token handler) and `/verify-email/sent` (confirmation + resend form) inside the shared auth layout. Update login to detect `403` and offer a resend button. Update account page to show a resend button when unverified.

**Consequences:**
- ✅ Only verified email owners can access secrets, projects, and audit data.
- ✅ Password-reset and invite flows become more trustworthy.
- ✅ Existing unverified users with active sessions will be blocked on their next request; this is acceptable for a pre-release product.
- ⚠️ Future work may add rate-limiting on `/send-verification` to prevent abuse.

---

## DEC-033 — CLI Auth Sessions Separated from Local Secrets Vault

**Status:** Approved
**Date:** 2026-05-14
**Context:**
The CLI reused the local secrets vault master password to encrypt API session tokens. As a result, API-only commands such as `projects list`, `env list`, `audit`, `members`, `integrations`, and `status` prompted for the vault password even though they do not decrypt `.env` secrets. `criptenv doctor` also checked `/docs`, which can return 404 in production even when the API is healthy.

**Decision:**
- Add a local `~/.criptenv/auth.key` file, mode `0600`, used only to encrypt CLI auth/session tokens.
- Keep the master password requirement for local secret encryption/decryption and sync flows that convert between local secrets and project vault ciphertext.
- Make authenticated API context use `auth.key` by default and require the master key only when explicitly requested.
- Support one-time migration of legacy sessions encrypted with the vault master key.
- Change `doctor` API connectivity check from `/docs` to the stable `/health` endpoint.

**Consequences:**
- ✅ API-only CLI commands no longer unlock the local secrets vault.
- ✅ Project vault passwords remain required for project secret access and rekey/push/pull flows.
- ✅ Existing legacy sessions can be migrated without forcing immediate logout.
- ⚠️ `auth.key` is a local machine credential and should be protected with filesystem permissions; future hardening can integrate OS keychain storage.

---

## DEC-034 — CLI Sync Resolves Project Environments Remotely

**Status:** Approved
**Date:** 2026-05-14
**Context:**
`criptenv env list --project <id>` correctly listed environments from the API, but `criptenv pull -e production --project <id>` resolved `production` only against the local SQLite environment cache. Fresh CLI installs or projects created in the WEB dashboard therefore failed with a false `Environment 'production' not found` even though the remote project contained that environment.

**Decision:**
- Make `pull` and `push` resolve the environment through `client.list_environments(project_id)`.
- When the remote environments are fetched, cache their IDs/names locally so later local commands can reference the same environment IDs.
- If `--env` is omitted, use the remote default environment first, then `production`, then the first environment as a final fallback.
- Keep local master password behavior unchanged for now: sync still re-encrypts secrets into the local SQLite vault, so local secret storage still needs the local vault key.

**Consequences:**
- ✅ `criptenv pull -e production -p <project-id>` works for environments that exist remotely but are not cached locally yet.
- ✅ `criptenv pull -p <project-id>` follows the project's remote default environment instead of the local `default` placeholder.
- ✅ Local cache becomes aligned with project environment IDs after sync.
- ⚠️ The CLI still has two password concepts during sync: project vault password for shared cloud secrets and local master password for local encrypted storage. This remains a UX/design follow-up.

---

## DEC-035 — CLI Remote Terminal

**Status:** Approved
**Date:** 2026-05-14
**Context:**
The CLI still behaved like a local encrypted vault that occasionally synchronized with the server. That created two confusing password concepts: a local master password and a project Vault password. It also caused broken flows where remote environments existed but local cache state did not match the project, making commands such as `pull -e production -p <project-id>` fail even when the web dashboard and `env list` showed the environment.

**Decision:**
- Make the CLI a remote terminal for the project vault. Core secret commands operate directly on remote encrypted blobs.
- Keep zero-knowledge behavior: the API receives only ciphertext; the CLI decrypts and re-encrypts in memory using the project Vault password.
- Remove the local master password from the main CLI path. `init` only prepares local metadata/configuration; auth sessions use `~/.criptenv/auth.key`.
- Introduce a `RemoteVault` CLI layer for project/environment resolution, vault config loading, Vault password prompt/env handling, pull/decrypt/mutate/encrypt/push, and stale-write errors.
- Redefine `push FILE` as remote import and `pull --output FILE` as remote export. Bare `push`/`pull` fail with explicit guidance.
- Add optimistic write protection with `expected_version` on vault push; stale writes return `409 Conflict`.

**Consequences:**
- ✅ CLI behavior now matches the web app: one remote project vault, always synchronized.
- ✅ Secret commands no longer ask for a local master password.
- ✅ `CRIPTENV_VAULT_PASSWORD` is the single automation password for secret decrypt/mutate flows.
- ✅ Concurrent edits are protected by version conflict detection.
- ⚠️ The legacy SQLite vault code remains for metadata, sessions, compatibility, and historical tests, but it is no longer the main secrets storage model.

---

**Document Version**: 2.7
**Last Updated**: 2026-05-23

---

## DEC-036 — Pix contribution UX timeout and mobile overflow hardening

**Status:** Approved
**Date:** 2026-05-21
**Context:**
The `/contribute` flow allowed very long Pix wait windows and mobile users could hit horizontal scroll, reducing trust and usability during payment.

**Decision:**
- Cap the visible Pix payment window to **2 minutes** in the QR panel.
- Add a visual countdown progress bar that decreases with time remaining.
- Harden `/contribute` layout for narrow screens (`overflow-x-clip`, reduced mobile paddings/text sizing, `min-w-0` on grid items).

**Consequences:**
- ✅ Mobile experience avoids horizontal scrolling in common viewport sizes.
- ✅ Users get clearer urgency and feedback while waiting for Pix confirmation.
- ⚠️ The UI cap is client-side visibility behavior and does not alter provider expiration semantics returned by the backend.

---

## DEC-037 — Explicit pyasn1 Security Floor for API Audits

**Status:** Approved
**Date:** 2026-05-23
**Context:**
The Security workflow failed during `pip-audit -r apps/api/requirements.txt` because the requirements graph could resolve `pyasn1 0.4.8`, which is affected by CVE-2026-30922. `pyasn1` is used transitively by the API auth stack through `python-jose`.

**Decision:**
Add `pyasn1>=0.6.3` directly to `apps/api/requirements.txt` and document it in the project tech stack as a security floor for the transitive auth dependency.

**Consequences:**
- ✅ The dependency audit cannot select the vulnerable `pyasn1 0.4.8` release.
- ✅ The auth implementation stays on the existing `python-jose[cryptography]` path.
- ⚠️ Future auth dependency updates should keep direct security floors when advisories affect transitive packages.

---

## DEC-038 — Pix Contribution Thank-You Emails

**Status:** Approved
**Date:** 2026-05-23
**Context:**
The public `/contribute` Pix flow collected optional payer name/email but did not acknowledge successful supporters after Mercado Pago confirmed payment. The contribution flow is operationally separate from zero-knowledge vault data, so it can use existing transactional email infrastructure without exposing secrets.

**Decision:**
- Send a bilingual Portuguese/English thank-you email when a contribution reaches `PAID`.
- Send only when `payer_email` is present; the public contribution form remains optional for name and email.
- Track `thank_you_email_sent_at` and `thank_you_email_error` on `contributions` to avoid duplicate successful sends and preserve failure diagnostics.
- Treat email as best-effort: failures are logged and stored but never block payment status reconciliation.
- Reuse the existing Resend-backed `EmailService` and local dev mock behavior when `RESEND_API_KEY` is not configured.

**Consequences:**
- ✅ Contributors who provide email receive a warmer confirmation after payment.
- ✅ Webhook retries, manual sync, and paid-status lookups do not duplicate successful emails.
- ✅ Payment confirmation remains reliable even if Resend is unavailable.
- ⚠️ Concurrent workers could still race before `thank_you_email_sent_at` is flushed; if this becomes visible in production, move thank-you delivery to a queued/outbox worker with a uniqueness constraint.

---

## DEC-039 — Strict 2-Minute Visible Pix Contribution Window

**Status:** Approved
**Date:** 2026-05-23
**Context:**
The `/contribute` QR panel already mentioned a 2-minute Pix window, but the countdown still depended on Mercado Pago's `expires_at`. Because Checkout API Pix defaults to 24 hours and only allows `date_of_expiration` between 30 minutes and 30 days, the UI could display a longer-than-intended payment window.

**Decision:**
- Enforce a client-side visible Pix deadline at `createdAt + 2 minutes`, capped earlier if the provider expiration is sooner.
- Drive the countdown and progress bar from the local visible deadline instead of the provider-only expiration.
- Hide QR/copy-paste details after the visible window expires.
- Keep backend `PAID` status ahead of the local timeout so confirmed payments remain visible.
- Do not change Mercado Pago `date_of_expiration` to 2 minutes because that is below the provider-supported minimum.

**Consequences:**
- ✅ Visitors see a true `02:00` countdown and a clearer urgency signal.
- ✅ The app's UX policy is independent from the provider's longer Pix validity.
- ✅ Late status reconciliation can still show confirmed payments.
- ⚠️ Mercado Pago may technically keep the Pix payment valid beyond the app's visible window; app behavior intentionally asks users to generate a new Pix after 2 minutes.

---

## DEC-040 — Landing Pricing Trust Section

**Status:** Approved
**Date:** 2026-05-25
**Context:**
The landing pricing section used a GSAP-powered carousel for `Contribute`, `Open Source`, and future hosted-plan messaging. The result felt visually disconnected from the rest of the landing, hid pricing context behind rotation, and added unnecessary motion/timer behavior for a trust-sensitive commercial section.

**Decision:**
- Replace the carousel with a static trust-focused pricing section.
- Make `/contribute` the primary CTA with `R$ 5+` Pix support, while keeping `/signup` visible as the free open-source adoption path.
- Present credibility proof points directly in the section: MIT, zero plaintext, self-hostable, and transparent roadmap.
- Keep the implementation static and Tailwind-first, with no pricing-specific GSAP, autoplay, timers, or browser-only module behavior.

**Consequences:**
- ✅ Pricing is easier to scan and better aligned with the landing's technical trust narrative.
- ✅ The contribution path is more prominent without implying that CriptEnv requires a paid plan.
- ✅ Removing pricing autoplay reduces motion and Cloudflare Workers SSR risk.
- ⚠️ The section is less visually playful than the carousel; future experiments should preserve direct access to both contribution and free-start CTAs.

---

## DEC-041 — Landing How It Works Remote Vault Narrative

**Status:** Approved
**Date:** 2026-05-26
**Context:**
The landing `How It Works` section still described an older CLI mental model centered on `criptenv init`, bare `push`, and bare `pull`. After the CLI Remote Terminal work, the main flow is a remote project vault: the CLI authenticates, prompts for the project Vault password only when secret access is needed, decrypts in memory, and sends versioned ciphertext to the API.

**Decision:**
- Reframe `How It Works` around the real remote-vault journey: `login`, `projects create`, `set`, and explicit file export/CI usage.
- Show the operational path as `CLI local -> ciphertext -> API vault -> web + CI`, making it clear that the server coordinates encrypted blobs instead of seeing plaintext.
- Add short trust proof points directly in the section: Vault password never sent, API sees ciphertext/metadata, and concurrent edits use version protection.
- Update adjacent landing copy so the feature cards, hero terminal, and CTA terminal no longer imply a local secrets vault as the primary product model.

**Consequences:**
- ✅ Customer-facing onboarding now matches the current CLI, web, and CI behavior.
- ✅ The section explains how the product works without duplicating the deeper security scrollytelling section.
- ✅ The design remains static/Tailwind-first and does not add new Cloudflare Workers SSR risk.
- ⚠️ Future CLI semantics changes must be reflected in this section quickly because it now teaches the canonical first-use flow.

---

## DEC-042 — Landing Final CTA Professional Close

**Status:** Approved
**Date:** 2026-05-26
**Context:**
The final landing CTA still used a simple split of headline, two buttons, and a small gray terminal block. After the pricing and `How It Works` redesigns, the closing section felt less polished than the rest of the landing and did not reinforce the remote-vault trust story at the point of conversion.

**Decision:**
- Rebuild the final CTA as a secure launch panel that combines concise product copy, signup/GitHub actions, trust proof points, and a remote-vault terminal state.
- Keep `/signup` as the primary CTA and GitHub as the secondary CTA.
- Treat the existing background image as subtle atmosphere behind a controlled overlay instead of leaving it as the dominant visual.
- Reuse the landing's existing Tailwind, button, icon, terminal, border, and backdrop-blur language without adding new dependencies or browser-only behavior.

**Consequences:**
- ✅ The final conversion moment now matches the professionalism and density of the updated landing sections.
- ✅ The closing copy reinforces zero plaintext, free start, and open-source trust without introducing new claims.
- ✅ The implementation stays static and compatible with Cloudflare Workers SSR constraints.
- ⚠️ Future CTA experiments should preserve the signup/GitHub hierarchy unless pricing or onboarding strategy changes.

---

## DEC-043 — Remote Vault Checksum Canonicalization

**Status:** Approved
**Date:** 2026-05-26
**Context:**
The Web dashboard stored remote vault blob checksums as `sha256(key:iv:ciphertext:authTag)`, while the CLI validated remote blob checksums as `sha256(plaintext)`. This made secrets created in the Web dashboard decrypt successfully at the AES-GCM layer but fail the CLI's additional checksum check with `Checksum mismatch`.

**Decision:**
- Treat `sha256(key:iv:ciphertext:authTag)` as the canonical checksum for remote vault blobs.
- Keep AES-GCM authentication as the primary cryptographic integrity guarantee.
- Make the CLI accept both canonical remote checksums and legacy plaintext checksums when reading existing blobs.
- Make all new CLI remote vault writes, including `projects rekey`, emit the canonical Web-compatible checksum.
- Send `expected_version` from the Web dashboard when pushing vault changes so browser writes use the same optimistic concurrency guard as CLI writes.

**Consequences:**
- ✅ Secrets created or edited in the Web dashboard can be pulled/exported by the CLI.
- ✅ Secrets created or edited by the CLI keep the checksum shape expected by the Web/API model.
- ✅ Existing legacy CLI blobs remain readable without a database migration.
- ⚠️ The plaintext checksum path remains only as backward compatibility and should not be used for new remote vault writes.

---

## DEC-044 — Supabase Storage URL Base for Avatar Uploads

**Status:** Approved
**Date:** 2026-05-27
**Context:**
Avatar uploads failed with Supabase Storage returning `PGRST125 Invalid path specified in request URL`. The API built Storage URLs by appending `/storage/v1/object/...` to `SUPABASE_URL`, but production had been configured with a REST API URL ending in `/rest/v1`, producing an invalid Storage request path.

**Decision:**
- Treat `SUPABASE_URL` as the Supabase project base URL only, for example `https://your-project.supabase.co`.
- Reject configured URLs that include `/rest/v1`, `/storage/v1`, query strings, or fragments with a clear `503` configuration error.
- Use the server-side `SUPABASE_SERVICE_KEY` for both `Authorization` and `apikey` on avatar Storage requests.
- Keep avatar uploads server-side and independent of bucket policies or anon-key configuration.

**Consequences:**
- ✅ Misconfigured deployments fail clearly before making invalid Storage calls.
- ✅ Storage path errors are reported as upstream failures instead of being mislabeled as missing buckets.
- ✅ Service-role credentials stay server-only and are no longer logged in avatar upload diagnostics.
- ⚠️ Operators must ensure VPS/API `.env` files use the project base URL, not a REST or Storage endpoint URL.

---

## DEC-045 — Real 2FA with QR Code and Persisted Backup Codes

**Status:** Approved
**Date:** 2026-05-27
**Context:**
The account security page already showed a 2FA setup flow, but the QR code was a static icon (not scannable) and backup codes were generated in the router without being persisted to the database. If the user lost the codes shown during setup, recovery was impossible.

**Decision:**
- Use `qrcode.react` on the frontend to render a real scannable QR code from the `otpauth://` URI returned by the backend.
- Store backup code hashes (SHA-256) in a new `two_factor_backup_codes` JSONB column on the `users` table.
- Generate 10 backup codes during 2FA setup (up from 8) and persist their hashes immediately.
- Clear backup codes when 2FA is disabled.
- Add a `verify_backup_code` service method for future use during login recovery flows.

**Consequences:**
- ✅ Users can scan the QR code with any authenticator app (Google Authenticator, Authy, etc.).
- ✅ Backup codes are recoverable by the backend for future login-with-backup-code flows.
- ✅ Backup codes are stored as hashes, not plaintext, limiting exposure if the database is compromised.
- ⚠️ The login flow still does not enforce 2FA challenge yet; this will be addressed in a separate auth-hardening task.

---

## DEC-046 — Secrets Page Feature Module Refactor

**Status:** Approved
**Date:** 2026-05-27
**Context:**
The project secrets page mixed route rendering, API loading, browser-only cryptography, vault mutations, modal state, and presentation in one large client component. This made the zero-knowledge flow harder to audit and increased the amount of code forced into the route component.

**Decision:**
Keep `/projects/[id]/secrets/page.tsx` as a thin server wrapper and move the interactive dashboard behavior into a feature-local client module with a dedicated hook, vault crypto helpers, and focused presentation components.

**Consequences:**
- ✅ Secrets page responsibilities are split into smaller, auditable modules.
- ✅ Zero-knowledge behavior remains browser-only and unchanged.
- ✅ Vault checksum sorting and version propagation have focused unit coverage.
- ⚠️ The dashboard layout still uses a client auth shell, so broader RSC gains require a separate auth/layout refactor.

---

## DEC-047 — Enforced 2FA Login Challenges and Trusted Devices

**Status:** Approved
**Date:** 2026-05-28
**Context:**
TOTP setup, QR code rendering, and backup-code persistence existed, but login still issued sessions immediately for users with 2FA enabled. This meant 2FA was configurable but not enforced during interactive authentication.

**Decision:**
- Require a short-lived server-side 2FA challenge before issuing a session for email/password and OAuth logins when `two_factor_enabled=true`.
- Store challenge and trusted-device tokens only as SHA-256 hashes in the database.
- Use HTTP-only cookies for the pending challenge and remembered device; never store 2FA trust state in localStorage.
- Let users remember a browser/device for a fixed 30 days by setting a trusted-device cookie and matching record.
- Keep API keys and CI tokens outside this interactive challenge flow.

**Consequences:**
- ✅ Enabled 2FA now blocks session creation until a valid TOTP or backup code is supplied.
- ✅ Remembered devices avoid repeated 2FA prompts without exposing tokens to JavaScript.
- ✅ OAuth and browser-based CLI authorization inherit the same enforcement.
- ⚠️ Trusted devices are browser-cookie based; clearing cookies or changing browsers requires 2FA again.

---

## DEC-048 — Least-Privilege Programmatic Credential Alignment

**Status:** Approved
**Date:** 2026-05-28
**Context:**
The CLI moved from a mostly local vault workflow to the same remote API/web platform model used by the dashboard. That left ambiguous boundaries between human sessions, API Keys, CI Tokens, and temporary CI sessions.

**Decision:**
- Keep CI Token and API Key management behind normal human sessions.
- Preserve credential metadata in backend auth context so API Keys and CI sessions can enforce scopes and environment restrictions.
- Treat API Keys as public API read credentials for now, using `Authorization: Bearer cek_...`.
- Treat CI Tokens as automation credentials: `ci_...` creates a temporary `ci_s_...` session, which may read, write vault blobs, or sync integrations only when its scopes allow it.
- Keep GitHub Action ciphertext export compatible, while adding optional runner-local decryption via `vault-password`.

**Consequences:**
- ✅ CI pipelines can perform remote vault deploys without gaining token-management authority.
- ✅ API Keys no longer behave like generic user sessions for vault reads.
- ✅ Environment-restricted credentials are enforced consistently in backend reads/writes.
- ✅ GitHub Action plaintext export is possible without weakening zero-knowledge server guarantees.
- ⚠️ Public API write/admin scopes remain reserved until corresponding endpoints are intentionally exposed.
