# Security Remediation Plan — P1 Findings

> Source: security audit of 2026 (`AGENTS.md` Phase 2 review follow-up) plus a fresh
> read of the codebase. P0 items are already fixed on `hotfix/security-vuln-fix`:
> `security(api): require project admin for API key management` and
> `security(auth): bind CLI browser login to loopback callback and PKCE`.

This document is the solution plan for the six P1 findings, in the order they are
being implemented. Each item lists the root cause, the fix, and the test that
locks it in.

---

## P1-3 — IDOR on `integrations/{id}/sync` and `integrations/{id}/validate`

**Root cause.** `IntegrationService.get_integration()` resolves an integration by
primary key only (`integration_service.py:95-100`). The `sync` and `validate`
handlers check access to the **path** `project_id` but then pass a caller-supplied
`integration_id` straight through, so an `admin` of project A can drive another
tenant's integration: `sync_integration` decrypts the victim's stored provider
config and pushes attacker-chosen secrets to the victim's Vercel/Railway/Render
target. Sibling handlers (`delete`, `get`) already compare
`integration.project_id != project_id`.

**Fix.**
1. `get_integration(integration_id, project_id)` — project scope becomes a
   **required** keyword argument so no caller can forget it.
2. `sync_integration(..., project_id=...)` and `validate_integration(...,
   project_id=...)` forward the scope to the lookup.
3. Routers pass `project_uuid`, which has already been verified by
   `check_user_access(..., "admin")`.
4. A missing/foreign integration returns 404 (no existence disclosure).

**Tests.** Service-level: a foreign `project_id` yields "Integration not found"
and never calls the provider. Router-level: sync/validate for a foreign
integration return 404.

---

## P1-4 — Password-reset token returned in the response body

**Root cause.** `routers/auth.py:252-258` (and the resend-verification twin at
`:296-303`) return `dev_token=<reset token>` whenever `email_service.enabled` is
false, and `enabled` is just `bool(settings.RESEND_API_KEY)`. There is no
`DEBUG`/`APP_ENV` gate, so a production deployment that forgets `RESEND_API_KEY`
hands an unauthenticated attacker a working reset token for **any** known email
(full account takeover).

**Fix.** Introduce a single explicit predicate `_dev_token_allowed()` = debug
mode **and** a development environment, and gate both `dev_token` payloads on it.
The `dev_warning` text stays so local development keeps working. Production
behaviour is now "always send the email, never echo the token".

**Tests.** `dev_token` present only when `DEBUG=True and APP_ENV="development"`;
absent when `DEBUG=False` even if the email service is disabled; absent with
`APP_ENV="production"`.

---

## P1-5 — Mercado Pago webhook signature validation fails open

**Root cause.** `webhook_security.validate_mercadopago_signature()` returns
`True` when `MERCADO_PAGO_WEBHOOK_SECRET` is empty (`:76-83`), while
`PAYMENTS_ENABLED` defaults to `True`. A deployment that enables payments without
the webhook secret accepts unsigned notifications.

**Fix.** Fail **closed**: an unconfigured secret returns `False` and logs an
error. The router message is unchanged (401).

> Replay note: a timestamp freshness window was considered and deliberately **not**
> enforced. Mercado Pago retries notifications for hours, so a short `ts` window
> would break legitimate reconciliation, and replay is already harmless because
> `process_webhook_notification` re-fetches the authoritative payment status and
> only applies valid status transitions (idempotent). This is recorded in the
> service docstring.

**Tests.** No secret → `False` (fail closed), including for a well-formed
request; missing/malformed header → `False`; valid HMAC → `True`; wrong HMAC →
`False`.

---

## P1-6 — Auth endpoints use the wrong rate limit and an untrusted identity

**Root cause.** Two defects in `middleware/rate_limit.py`:
1. `AUTH_RATE_LIMIT = "5/minute"` is **dead code**. Limits are selected purely by
   `identify_auth_type()`, which reads the `Authorization` header; web logins are
   "anonymous" and therefore get `PUBLIC_RATE_LIMIT = 100/minute`. The OpenAPI
   description advertises 5/min, and there is no per-account lockout, so this is
   the only brute-force control on `signin`.
2. The limiter keys on `request.client.host`. Behind Cloudflare Tunnel + the
   Worker proxy every request can share one address (a global bucket: one
   attacker DoSes login for everyone), or the `X-Forwarded-For` header can be
   client-controlled (trivial bypass). The app never validated the proxy chain.

**Fix.**
1. Add a path-based rule table: requests to the enumerated auth endpoints get
   `AUTH_RATE_LIMIT`, keyed in their own namespace (`auth:<ip>`).
2. Add `get_client_ip(request)`: trust `X-Forwarded-For` **only** when the
   immediate peer is a configured trusted proxy, and walk the chain right-to-left
   to the first untrusted hop (so a client-injected left-hand value is ignored).
   New setting `TRUSTED_PROXIES` (default loopback).
3. Document that `FORWARDED_ALLOW_IPS` must be pinned to the tunnel in the
   deployment compose.

**Tests.** Auth paths resolve to the 5/min limit; non-auth paths keep their
existing limits; spoofed `X-Forwarded-For` from an untrusted peer is ignored; a
trusted peer propagating a chain resolves to the real client; a request without a
trusted proxy uses the peer address.

---

## P1-7 — API-key rate-limit bucket collision

**Root cause.** `get_rate_limit_key()` returns `key[:8]` for a `cek_` token, which
for `cek_live_<random>` is the constant `"cek_live"` (or `"cek_test"`). Every
tenant shares one 1000/min counter, so one noisy key throttles all API consumers.

**Fix.** Key on a truncated SHA-256 of the full token, giving each key its own
bucket without storing the secret or leaking it into logs/metrics.

**Tests.** Two different live keys produce different rate-limit keys; the same key
is stable across calls; the raw token never appears in the key.

---

## P1-8 — Secret rotation silently corrupts the stored blob (and the web client leaks plaintext)

**Root cause.** Two defects:
1. `rotation_service.rotate_secret()` assigns `vault_blob.encrypted_value`, an
   attribute that does not exist on `VaultBlob` (`models/vault.py` defines
   `iv`/`ciphertext`/`auth_tag`/`checksum`). SQLAlchemy accepts the stray
   attribute silently, so the ciphertext is never persisted while `iv`,
   `auth_tag` and `version` are — leaving a blob whose AES-GCM auth tag no longer
   matches its ciphertext (undecryptable), reported as a successful rotation. The
   `checksum` column is left stale.
2. The web client (`use-project-secrets.ts:413-418`) sends **plaintext** as
   `new_value` and omits the ciphertext, so the server would persist the secret in
   cleartext — a zero-knowledge violation.

**Fix.**
1. Persist `vault_blob.ciphertext = payload.new_value`.
2. Recompute `vault_blob.checksum` server-side using the canonical remote vault
   digest `sha256(f"{key_id}:{iv}:{ciphertext}:{auth_tag}")` — the convention
   already used by `apps/cli/src/criptenv/remote_vault.py` and the web
   `encryptVault`. No plaintext is needed, so zero-knowledge is preserved.
3. The web client sends `encrypted.ciphertext` as `new_value`.
4. A guard test asserts the rotation request schema never carries a plaintext
   field and that the persisted blob stays internally consistent.

**Tests.** Rotation writes `ciphertext` and a matching canonical `checksum`;
version increments; a blob that is missing raises 404; the stored blob is
self-consistent (checksum recomputes) and the plaintext never reaches the
service.

---

## Cross-cutting

- Run the full API (`pytest tests`) and CLI (`pytest tests`) suites after each
  item; both are green (548 passed / 2 skipped and 189 passed after P1-3..P1-7).
- Update `AGENTS.md` (stale "Known Security Issues" list), `docs/features/in-progress.md`,
  and `docs/development/CHANGELOG.md` once the fixes land.
- Deployment follow-up (out of code scope): rotate the committed `cookies.txt`
  session token and the local `.env` credentials exposed during the audit, and
  fix `.gitleaks.toml` (`[extend] useDefault = true`) so the scan is not a no-op.

---

## Status

| Item | Status | Commit |
|------|--------|--------|
| P0-1 CLI callback allowlist + PKCE | Done | `security(auth): bind CLI browser login to loopback callback and PKCE` |
| P0-2 API key cross-tenant BOLA | Done | `security(api): require project admin for API key management` |
| P1-3 Integrations IDOR | Done | `security(api): scope integration sync/validate to the owning project` |
| P1-4 Reset-token exposure | Done | `security(auth): stop echoing reset tokens outside local development` |
| P1-5 Webhook fail-open | Done | `security(api): fail closed when the webhook secret is unconfigured` |
| P1-6 Auth rate limit + trusted IP | Done | `security(api): enforce auth rate limits and a trustworthy client identity` |
| P1-7 API key bucket collision | Done | (same commit as P1-6) |
| P1-8 Rotation ciphertext / plaintext leak | **Deferred** | to be done in a follow-up |

### P1-8 follow-up handoff (not yet implemented)

Two defects remain in the rotation path:

1. `app/services/rotation_service.py` assigns `vault_blob.encrypted_value`, which
   is not a column on `VaultBlob` (`iv`/`ciphertext`/`auth_tag`/`checksum`). The
   ciphertext is never persisted while `iv`, `auth_tag` and `version` are, so the
   stored blob becomes undecryptable and the API still reports success. Fix:
   assign `ciphertext` and recompute `checksum` with the canonical digest
   `sha256(f"{key_id}:{iv}:{ciphertext}:{auth_tag}")` already used by
   `apps/cli/src/criptenv/remote_vault.py` — the server can compute it without
   the plaintext, so zero-knowledge holds.
2. The web client sends **plaintext** as `new_value`
   (`apps/web/src/app/(dashboard)/projects/[id]/secrets/use-project-secrets.ts`),
   which would persist a secret in cleartext. Fix: send `encrypted.ciphertext`.

Recommended test: assert the persisted blob's `ciphertext` matches the request
and that the canonical checksum recomputes, plus a schema guard that no plaintext
field reaches the service.

