# CLI Modernization Review & Plan

> **Date**: 2026-05-11
> **Scope**: Complete CLI audit, OAuth login integration, and missing feature backlog
> **Status**: In Progress — Phases A–F implemented, tests pending

---

## 1. Executive Summary

The CriptEnv CLI is significantly behind the web application. While the web has full OAuth (GitHub, Discord, Google), team management, audit logs, and project settings, the CLI still forces users through an email/password terminal prompt and lacks ~60% of available API features. Several CLI commands are **stubs** that print fake success messages without ever calling the API.

This plan proposes:
1. **A modern browser-based OAuth login flow** for the CLI
2. **Closing the feature gap** between web and CLI
3. **Fixing all stub commands** that mislead users
4. **Adding "current project" context** for better UX

---

## 2. Current State Analysis

### 2.1 Authentication — The Biggest Pain Point

| Aspect | Web | CLI |
|--------|-----|-----|
| Login methods | Email/pass + GitHub + Discord + Google | Email/pass ONLY |
| Session storage | HTTP-only cookie | Encrypted in `~/.criptenv/vault.db` |
| 2FA | Supported | Not supported |
| Session listing | `/account` page | Not available |
| Sign out all | Web button | Not available |

**Problem**: Users who signed up via OAuth on the web have NO WAY to use the CLI. They never set a password, so `criptenv login` fails.

### 2.2 CLI Commands — What's Real vs. Fake

| Command | Appears to Work? | Actually Calls API? | Status |
|---------|-----------------|---------------------|--------|
| `login` / `logout` | ✅ | ✅ | Real |
| `set`, `get`, `list`, `delete` | ✅ | ✅ (local vault) | Real |
| `push`, `pull` | ✅ | ✅ | Real |
| `projects create`, `projects list` | ✅ | ✅ | Real |
| `env list`, `env create` | ✅ | ✅ | Real |
| `ci login`, `ci secrets`, `ci deploy` | ✅ | ✅ | Real |
| `ci tokens list/create/revoke` | ✅ | ✅ | Real |
| `integrations list`, `sync` | ✅ | ✅ | Real |
| `doctor` | ✅ | ✅ (diagnostics) | Real |
| `import`, `export` | ✅ | ✅ (local file ops) | Real |
| `secrets expire` | ⚠️ Prints success | ❌ Never calls API | **STUB** |
| `secrets alert` | ⚠️ Prints success | ❌ Never calls API | **STUB** |
| `rotation list` | ⚠️ Prints placeholder | ❌ Ignores API method | **STUB** |
| `integrations connect` | ⚠️ Prints fake success | ❌ Never calls API | **STUB** |
| `integrations disconnect` | ⚠️ Prints fake success | ❌ Never calls API | **STUB** |
| `members` (any) | ❌ Not implemented | ❌ No client methods | Missing |
| `invites` (any) | ❌ Not implemented | ❌ No client methods | Missing |
| `audit` (any) | ❌ Not implemented | ❌ No client methods | Missing |
| `project update/delete/rekey` | ❌ Not implemented | ❌ No client methods | Missing |
| `api-keys` (any) | ❌ Not implemented | ❌ No client methods | Missing |

### 2.3 API Coverage Gap

The CLI client (`CriptEnvClient`) implements ~20 methods. The API has **60+ endpoints** across 15 routers. Missing client methods for:
- All OAuth endpoints
- All member/invite endpoints
- Audit logs
- Project update / delete / rekey
- Environment get / update / delete
- Rotation history
- API keys CRUD
- Integration create / delete / validate
- Session management

---

## 3. Proposed Architecture: OAuth for CLI

### 3.1 Recommended Approach: Browser Redirect with Localhost Callback

This gives the exact UX the user described: CLI opens browser → user sees the beautiful web UI → authenticates with any OAuth provider → gets redirected back to the terminal.

```
┌─────────┐     criptenv login          ┌─────────────┐
│  User   │ ──────────────────────────> │     CLI     │
│         │                             │  (terminal) │
└─────────┘                             └──────┬──────┘
                                               │
                                               │ 1. Generate state + nonce
                                               │ 2. Start localhost server (random port)
                                               │ 3. Open browser
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Browser   │
                                        │  (opens to) │
                                        └──────┬──────┘
                                               │
                    GET /cli-auth?port=XXXX&state=YYYY&nonce=ZZZZ
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Web App    │
                                        │ (production)│
                                        └──────┬──────┘
                                               │
                                               │ User clicks GitHub/Discord/Google
                                               │ OAuth flow completes
                                               │ Web receives session cookie
                                               │
                                               │ POST /api/auth/cli/authorize
                                               │ (creates short-lived auth code)
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │     API     │
                                        │   Backend   │
                                        └──────┬──────┘
                                               │
                    Redirect to http://localhost:XXXX/callback?code=AUTHCODE
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Browser   │
                                        │ (redirects) │
                                        └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │     CLI     │
                                        │ localhost   │
                                        │   server    │
                                        └──────┬──────┘
                                               │
                                               │ 4. Exchange code for token
                                               │    POST /api/auth/cli/token
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │     API     │
                                        │   Backend   │
                                        └──────┬──────┘
                                               │
                                               │ 5. Return session token
                                               │    (encrypted response)
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │     CLI     │
                                        │  (terminal) │
                                        └──────┬──────┘
                                               │
                                               │ 6. Encrypt token with master key
                                               │ 7. Store in ~/.criptenv/vault.db
                                               │ 8. Print: "✓ Logged in as user@..."
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  User back  │
                                        │   in CLI    │
                                        └─────────────┘
```

### 3.2 Alternative: Device Authorization Grant (RFC 8628)

As a **fallback for headless environments** (SSH, WSL without browser, CI containers):

```
$ criptenv login --device

Open https://app.criptenv.com/cli-auth in your browser
Enter the code: ABCD-1234-EFGH

Waiting for authorization...
✓ Logged in as user@example.com
```

Requires backend endpoints:
- `POST /api/auth/device/code` — generate device code
- `POST /api/auth/device/poll` — poll for token

### 3.3 Decision: Implement BOTH

| Flow | Primary Use Case | Environment |
|------|-----------------|-------------|
| **Browser Redirect** (localhost) | Interactive desktop use | Default — `criptenv login` |
| **Device Code** | Headless/remote/SSH | Fallback — `criptenv login --device` |
| **API Key** | Automation/scripts | `criptenv login --api-key cek_xxx` |

---

## 4. Feature Implementation Roadmap

### Phase A — OAuth Login (P0 — Critical)

**Backend Changes:**
- [x] `POST /api/auth/cli/initiate` — generate auth nonce, store in Redis/cache with TTL (5 min)
- [x] `POST /api/auth/cli/authorize` — web calls this after OAuth to create short-lived auth code linked to nonce
- [x] `POST /api/auth/cli/token` — CLI exchanges auth code for session token
- [x] `POST /api/auth/device/code` — device flow: generate `user_code`, `device_code`, `verification_uri`
- [x] `POST /api/auth/device/poll` — device flow: poll for token
- [x] Update `AuthService` to support CLI session creation

**Web Changes:**
- [x] New page: `/cli-auth` — shows "Authorize CLI" with OAuth buttons
- [x] After OAuth, calls `/api/auth/cli/authorize` with nonce
- [x] Shows success/failure message with auto-redirect back to localhost

**CLI Changes:**
- [x] `criptenv login` — opens browser, starts localhost server, exchanges code
- [x] `criptenv login --device` — device code flow
- [x] `criptenv login --api-key <key>` — API key authentication
- [x] `criptenv logout` — enhanced to clear all auth types
- [x] `criptenv sessions` — list active sessions (new command)

### Phase B — Fix Stub Commands (P0 — Critical)

- [x] `secrets expire` — wire to `POST /api/v1/projects/{pid}/environments/{eid}/secrets/{key}/expiration`
- [x] `secrets alert` — wire to API or remove if not supported
- [x] `rotation list` — wire to `GET /api/v1/projects/{pid}/secrets/expiring`
- [x] `integrations connect <provider>` — wire to `POST /api/v1/projects/{id}/integrations`
- [x] `integrations disconnect <id>` — wire to `DELETE /api/v1/projects/{id}/integrations/{iid}`
- [ ] Add tests for all fixed commands

### Phase C — Team Management (P1 — High)

- [x] `members list --project <id>`
- [x] `members add <email> --role <role> --project <id>`
- [x] `members update <id> --role <role> --project <id>`
- [x] `members remove <id> --project <id>`
- [x] `invites list --project <id>`
- [x] `invites create <email> --role <role> --project <id>`
- [x] `invites revoke <id> --project <id>`
- [x] `invites accept <token>`

### Phase D — Audit & Project Settings (P1 — High)

- [x] `audit list --project <id> [--action] [--resource] [--limit]`
- [x] `audit export --project <id> --format json > audit.json`
- [x] `project info <id>` — show project details
- [x] `project update <id> --name <name> --description <desc>`
- [x] `project delete <id>` — with confirmation
- [x] `project rekey <id>` — rotate vault encryption key

### Phase E — API Keys & Advanced Features (P2 — Medium)

- [x] `api-keys list --project <id>`
- [x] `api-keys create --project <id> --name <name> --scope <scope>`
- [x] `api-keys revoke <id> --project <id>`
- [x] `env update <id> --name <name> --project <id>`
- [x] `env delete <id> --project <id>`
- [x] `env get <id> --project <id>` — show environment details
- [x] `rotation history <key> --project <id> --env <env>`
- [x] `integrations validate <id> --project <id>`

### Phase F — UX Improvements (P2 — Medium)

- [x] **Current project tracking** — store `current_project_id` in local config
- [x] `criptenv use <project>` — set current project (like `kubectl config use-context`)
- [x] All commands default to current project when `--project` is omitted
- [x] `criptenv status` — show logged-in user, current project, API URL
- [x] Better error messages with actionable suggestions
- [x] Progress bars for `push`/`pull` with many secrets
- [x] Tab completion (Click shell completion)

---

## 5. Technical Decisions

### DEC-CLI-001 — CLI OAuth via Localhost Redirect (Primary)
**Rationale**: Best UX for desktop users. Matches `gh auth login`, `vercel login`, `npm login` patterns.
**Security**: Short-lived auth codes (60s TTL), state/nonce validation, PKCE optional but recommended.
**Fallback**: Device code for headless environments.

### DEC-CLI-002 — API Key Auth for Automation
**Rationale**: API keys (`cek_`) already exist and support scoped permissions. Perfect for CI/scripts.
**Scope**: Start with `read:secrets` and `write:secrets`. Expand as needed.
**Note**: API keys are project-scoped, so `criptenv login --api-key` would also need `--project`.

### DEC-CLI-003 — Current Project Context
**Rationale**: Requiring `--project` on every command is tedious.
**Implementation**: Store `current_project_id` in `~/.criptenv/config.json`. Commands read it if `--project` is absent.
**Precedence**: Explicit `--project` > env var `CRIPTENV_PROJECT` > current project > error.

### DEC-CLI-004 — Stub Commands Must Be Fixed or Removed
**Rationale**: Commands that print fake success are worse than missing commands — they destroy trust.
**Policy**: Either wire to the API or remove/hide the command until implemented.

### DEC-CLI-005 — Master Password Remains for Local Vault Encryption
**Rationale**: Even with OAuth login, the local vault encryption uses a separate master password (zero-knowledge).
**UX**: After OAuth login, if no master password exists, prompt to create one. Allow `CRIPTENV_MASTER_PASSWORD` env var for automation.

---

## 6. Effort Estimate

| Phase | Effort | Backend | Web | CLI | Tests |
|-------|--------|---------|-----|-----|-------|
| A — OAuth Login | ~3-4 days | 2d | 1d | 1d | 1d |
| B — Fix Stubs | ~1-2 days | — | — | 1d | 0.5d |
| C — Team Mgmt | ~2-3 days | — | — | 1.5d | 0.5d |
| D — Audit & Settings | ~2-3 days | — | — | 1.5d | 0.5d |
| E — API Keys | ~1-2 days | — | — | 1d | 0.5d |
| F — UX Polish | ~2-3 days | — | — | 1.5d | 0.5d |
| **Total** | **~11-17 days** | **2d** | **1d** | **7.5d** | **3.5d** |

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Localhost redirect blocked by firewall | High | Device code flow as fallback |
| Browser can't be opened from CLI (WSL/SSH) | Medium | `--device` flag + clear error message |
| OAuth state/nonce validation bugs | Critical | Thorough tests + short TTL on codes |
| Breaking existing `email/pass` login | High | Keep existing flow as `criptenv login --email` |
| Master password confusion with OAuth | Medium | Clear messaging: "Create a master password to encrypt your local vault" |

---

## 8. Next Steps

1. **Review and approve this plan**
2. **Decide on Phase A scope**: Start with localhost redirect only, or include device flow?
3. **Approve technical decisions** (especially DEC-CLI-001 and DEC-CLI-003)
4. **Begin implementation** with Phase A (OAuth login) + Phase B (stub fixes) in parallel
