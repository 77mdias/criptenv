# Current State — CriptEnv

## Estado atual em uma frase

**CriptEnv Phase 1 e 2 completos. Phase 3 (CI/CD) ~92%: GitHub Action ✅, Public API ✅, CI Tokens ✅, Cloud Integrations (Vercel + Render) ✅, Integration Config Encryption ✅, Secret Rotation/Alerts ✅, OAuth ✅, Security Hardening (CR-01/CR-02) ✅, Project Vault Passwords ✅. Backend migrado e validado em VPS Docker com Redis rate limiting, DuckDNS (`criptenv.duckdns.org`), Nginx Proxy Manager e Supabase externo. Resta Railway provider, Web Alert UI e VPS ops baseline.**

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
| `init` | Initialize local vault | ✅ |
| `login` | Authenticate with backend | ✅ |
| `logout` | Clear session | ✅ |
| `set` | Add/update secret (encrypted) | ✅ |
| `get` | Get decrypted secret | ✅ |
| `list` | List secret names (no values) | ✅ |
| `delete` | Remove secret | ✅ |
| `push` | Upload to cloud | ✅ |
| `pull` | Download from cloud | ✅ |
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
| `ci deploy` | Deploy local secrets to cloud | ✅ |
| `ci tokens list` | List CI tokens | ✅ |
| `ci tokens create` | Create CI token | ✅ |
| `ci tokens revoke` | Revoke CI token | ✅ |
| `integrations list` | List cloud integrations | ✅ |
| `integrations connect` | Connect provider | ✅ |
| `integrations disconnect` | Disconnect provider | ✅ |
| `integrations sync` | Sync secrets with provider | ✅ |

**CLI Tests**: 130 unit tests passing

### API Backend (apps/api)

| Router | Endpoints | Status |
|--------|-----------|--------|
| `auth` | signup, signin, signout, session, sessions, oauth | ✅ |
| `auth/oauth` | github, google, discord | ✅ |
| `projects` | CRUD + list/get with API key + vault rekey | ✅ |
| `environments` | CRUD + list/get with API key | ✅ |
| `vault` | push with vault proof, pull/version (session + API key) | ✅ |
| `members` | CRUD on team members | ✅ |
| `invites` | create, list, accept, revoke | ✅ |
| `tokens` | CI/CD tokens CRUD | ✅ |
| `audit` | Paginated audit logs | ✅ |
| `rotation` | Secret rotation operations | ✅ |
| `integrations` | Vercel + Render providers, sync, validate | ✅ |
| `integration config encryption` | AES-256-GCM encrypted provider configs at rest | ✅ |
| `api-keys` | API key CRUD | ✅ |
| `ci` | CI login, CI secrets | ✅ |
| `rate limiting` | Middleware active (1000/200/100/5 per min) | ✅ |
| `vps deploy` | Docker Compose API + Redis + Nginx Proxy Manager + DuckDNS | ✅ Live smoke validated |
| `worker health proxy` | `/api/health` and `/api/health/ready` aliases for Cloudflare Worker proxy | ✅ |

**API Tests**: 292 tests passing

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
| Account | `/account` | ✅ |
| Integrations | `/integrations` | ⚠️ Functional for Vercel, placeholder UI |

---

## Phase 3 Milestones Status

| Milestone | Status | Notes |
|-----------|--------|-------|
| **M3.1**: GitHub Action | ✅ Complete | action.yml + src/index.ts + dist |
| **M3.2**: Cloud integrations | 🟡 Mostly Complete | Vercel ✅, Render ✅, Railway ⚠️ pending, CLI commands ✅ |
| **M3.3**: CI tokens | ✅ Complete | Backend + CLI 100%, ci deploy real implementation |
| **M3.4**: Public API | ✅ Complete | Rate limiting ✅, API keys ✅, dual auth ✅, OpenAPI docs ✅ |
| **M3.5**: Secret alerts | 🟡 Complete | API + CLI ✅, Web UI partial |
| **M3.6**: APScheduler | ✅ Complete | Lifespan integration ✅ |
| **M3.7**: OAuth | ✅ Complete | GitHub, Google, Discord ✅ |

---

## Incomplete / Pending

| Feature | Priority | Status |
|---------|----------|--------|
| Railway provider | P1 | ⚠️ Not implemented |
| Integration tokens at-rest encryption | P1 | ✅ AES-256-GCM envelope in JSONB |
| Web alert configuration UI | P1 | ⚠️ Not started |
| Security review CR-01/CR-02 | P0 | ✅ Resolved (HTTP-only cookies) |

---

## Technical Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Railway provider missing | 🟡 Medium | P1 — can be added following Render pattern |
| Web alert UI incomplete | 🟡 Medium | Finish M3.5 web gap |
| APScheduler duplication with multiple workers | 🟡 Medium | Public API workers disable scheduler; dedicated one-worker scheduler service owns jobs |
| Nginx Proxy Manager admin exposure | 🟡 Medium | Bind port 81 to localhost by default and restrict firewall access |
| VPS operational ownership | 🟡 Medium | Add basic backups, patching routine, container log rotation, and uptime checks |
| App-level production validation | ✅ Closed | Signup/signin/OAuth/projects/vault flows validated through Workers frontend |

---

## Next Recommended Steps

1. **Apply TASK-068 in production**: Configure `INTEGRATION_CONFIG_SECRET`, rebuild API/scheduler, and run `alembic upgrade head`.
2. **VPS operations baseline**: Backups for NPM volumes, firewall review, OS patching routine, and uptime/health monitoring.
3. **Railway Provider**: Implement following the RenderProvider pattern.
4. **Web Alert Configuration UI**: Complete M3.5 web gap.

---

**Document Version**: 1.4
**Last Updated**: 2026-05-06
**Status**: Active Development — Phase 3 (92% complete, VPS backend and app flows validated)
