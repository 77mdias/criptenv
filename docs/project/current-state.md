# Current State — CriptEnv

## Estado atual em uma frase

**CriptEnv Phase 1 e 2 completos. Phase 3 (CI/CD) ~92%: GitHub Action ✅, Public API ✅, CI Tokens ✅, Cloud Integrations (Vercel + Render) ✅, Integration Config Encryption ✅, Secret Rotation/Alerts ✅, OAuth ✅, Security Hardening (CR-01/CR-02) ✅, Project Vault Passwords ✅, CLI Remote Terminal ✅. Backend migrado e validado em VPS Docker com Redis rate limiting, Cloudflare Tunnel (`criptenv-api.77mdevseven.tech`), frontend custom domain (`criptenv.77mdevseven.tech`) e Supabase externo. Resta Railway provider, Web Alert UI e VPS ops baseline.**

---

## Development Status

| Phase | Status | Completion |
|-------|--------|------------|
| **Phase 1 (CLI MVP)** | ✅ COMPLETE | 100% |
| **Phase 2 (Web UI)** | ✅ COMPLETE | 100% |
| **Phase 3 (CI/CD)** | 🔄 IN PROGRESS | ~92% |
| **Phase 4 (Enterprise)** | 📋 PLANNED | 0% |

---

## Implemented Features

### CLI (apps/cli)

| Command | Description | Status |
|---------|-------------|--------|
| `init` | Prepare local CLI metadata | ✅ |
| `login` | Authenticate with backend | ✅ |
| `logout` | Clear session | ✅ |
| `set` | Add/update remote project secret (encrypted client-side) | ✅ |
| `get` | Get decrypted remote secret in memory | ✅ |
| `list` | List remote secret names (no values) | ✅ |
| `delete` | Remove remote secret | ✅ |
| `push` | Import `.env` file into remote vault | ✅ |
| `pull` | Export remote vault to file | ✅ |
| `env` | Environment management | ✅ |
| `projects` | Project management | ✅ |
| `projects create` | Create cloud project with project vault password | ✅ |
| `doctor` | Diagnostic checks | ✅ |
| `import` | Import from `.env` file | ✅ |
| `export` | Export to `.env` file | ✅ |
| `rotate` | Rotate secret value | ✅ |
| `secrets expire` | Set secret expiration | ✅ |
| `secrets alert` | Configure alert timing | ✅ |
| `rotation list` | List secrets pending rotation | ✅ |
| `ci login` | Login with CI token | ✅ |
| `ci logout` | Clear CI session | ✅ |
| `ci secrets` | List secrets in CI context | ✅ |
| `ci deploy` | Import file into remote vault with CI session | ✅ |
| `ci tokens list` | List CI tokens | ✅ |
| `ci tokens create` | Create CI token | ✅ |
| `ci tokens revoke` | Revoke CI token | ✅ |
| `integrations list` | List cloud integrations | ✅ |
| `integrations connect` | Connect provider | ✅ |
| `integrations disconnect` | Disconnect provider | ✅ |
| `integrations sync` | Sync secrets with provider | ✅ |

**CLI Tests**: 178 unit tests passing

### API Backend (apps/api)

| Router | Endpoints | Status |
|--------|-----------|--------|
| `auth` | signup, signin, signout, session, sessions, oauth, forgot/reset password, change password, 2FA/TOTP | ✅ |
| `auth/oauth` | github, google, discord | ✅ |
| `projects` | CRUD + list/get with API key + vault rekey | ✅ |
| `environments` | CRUD + list/get with API key | ✅ |
| `vault` | push with vault proof + expected_version, pull/version (session + API key) | ✅ |
| `members` | CRUD on team members | ✅ |
| `invites` | create, list, accept, revoke | ✅ |
| `tokens` | CI/CD tokens CRUD | ✅ |
| `audit` | Paginated audit logs + CSV export | ✅ |
| `rotation` | Secret rotation operations | ✅ |
| `integrations` | Vercel + Render providers, sync, validate | ✅ |
| `integration config encryption` | AES-256-GCM encrypted provider configs at rest | ✅ |
| `api-keys` | API key CRUD | ✅ |
| `ci` | CI login, CI secrets | ✅ |
| `profile` | Update profile, delete account | ✅ |
| `rate limiting` | Middleware active (1000/200/100/5 per min) | ✅ |
| `vps deploy` | Docker Compose API + Redis + Cloudflare Tunnel + custom domains | ✅ Live smoke validated |
| `worker health proxy` | `/api/health` and `/api/health/ready` aliases for Cloudflare Worker proxy | ✅ |

**API Tests**: 365 tests passing, 2 skipped

### Web Frontend (apps/web)

| Page | Route | Status |
|------|-------|--------|
| Landing | `/` | ✅ |
| Login | `/login` | ✅ |
| Signup | `/signup` | ✅ |
| Forgot Password | `/forgot-password` | ✅ |
| Dashboard | `/dashboard` | ✅ |
| Projects List | `/projects` | ✅ |
| Project Detail | `/projects/[id]` | ✅ |
| Secrets Browser | `/projects/[id]/secrets` | ✅ Project vault unlock |
| Audit Log | `/projects/[id]/audit` | ✅ |
| Team Settings | `/projects/[id]/members` | ✅ |
| Project Settings | `/projects/[id]/settings` | ✅ Vault password rotation |
| Account | `/account` | ✅ OAuth accounts + 2FA |
| Invites Accept | `/invites/accept?token=` | ✅ |
| Integrations | `/integrations` | ⚠️ Functional for Vercel, placeholder UI |

**Web Tests**: 41 Jest/React Testing Library tests passing; 4 Cypress E2E tests passing against local Vinext + FastAPI + PostgreSQL test stack.

---

## Phase 3 Milestones Status

| Milestone | Status | Notes |
|-----------|--------|-------|
| **M3.1**: GitHub Action | ✅ Complete | action.yml + src/index.ts + dist |
| **M3.2**: Cloud integrations | 🟡 Mostly Complete | Vercel ✅, Render ✅, Railway ⚠️ pending, CLI commands ✅ |
| **M3.3**: CI tokens | ✅ Complete | Backend + CLI 100%, ci deploy real implementation |
| **M3.4**: Public API | ✅ Complete | Rate limiting ✅, API keys ✅, dual auth ✅, OpenAPI docs ✅ |
| **M3.5**: Secret alerts | 🟡 Mostly Complete | API + CLI ✅, Web UI partial |
| **M3.6**: APScheduler | ✅ Complete | Lifespan integration ✅ |
| **M3.7**: OAuth | ✅ Complete | GitHub, Google, Discord ✅ |
| **API/WEB/CLI Alignment** | ✅ Complete | 16 gaps resolved across 5 waves |

---

## Incomplete / Pending

| Feature | Priority | Status |
|---------|----------|--------|
| Railway provider | P1 | ⚠️ Not implemented |
| Integration tokens at-rest encryption | P1 | ✅ AES-256-GCM envelope in JSONB |
| Web alert configuration UI | P1 | ⚠️ Not started |
| Security review CR-01/CR-02 | P0 | ✅ Resolved (HTTP-only cookies) |
| API/WEB/CLI Alignment | P0 | ✅ Complete (16 gaps closed) |

---

## Technical Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Railway provider missing | 🟡 Medium | P1 — can be added following Render pattern |
| Web alert UI incomplete | 🟡 Medium | Finish M3.5 web gap |
| APScheduler duplication with multiple workers | 🟡 Medium | Public API workers disable scheduler; dedicated one-worker scheduler service owns jobs |
| Cloudflare Tunnel availability | 🟡 Medium | Monitor tunnel health and keep rollback API guidance current |
| VPS operational ownership | 🟡 Medium | Add basic backups, patching routine, container log rotation, uptime checks, and tunnel monitoring |
| App-level production validation | ✅ Closed | Signup/signin/OAuth/projects/vault flows validated through Workers frontend |

---

## Next Recommended Steps

1. **VPS operations baseline**: Backups, firewall review, OS patching routine, uptime/health monitoring, and Cloudflare Tunnel alerts.
2. **Railway Provider**: Implement following the RenderProvider pattern.
3. **Web Alert Configuration UI**: Complete M3.5 web gap.

---

**Document Version**: 1.7
**Last Updated**: 2026-05-13
**Status**: Active Development — Phase 3 (~92% complete, API/WEB/CLI alignment done, VPS backend and app flows validated)
