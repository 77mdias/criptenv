# Current State — CriptEnv

## Estado atual em uma frase

**CriptEnv Phase 1 e 2 completos com CLI funcional (93+ testes) e Web Dashboard operacional. Phase 3 (CI/CD) está em andamento com GitHub Action implementado, rotação de secrets em desenvolvimento, e integrações cloud (Vercel/Railway) pendentes.**

---

## Development Status

| Phase | Status | Completion |
|-------|--------|------------|
| **Phase 1 (CLI MVP)** | ✅ COMPLETE | 100% |
| **Phase 2 (Web UI)** | ✅ COMPLETE | 100% |
| **Phase 3 (CI/CD)** | 🔄 IN PROGRESS | ~60% |
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
| `doctor` | Diagnostic checks | ✅ |
| `import` | Import from `.env` file | ✅ |
| `export` | Export to `.env` file | ✅ |
| `rotate` | Rotate secret value | ✅ (Phase 3) |
| `secrets expire` | Set secret expiration | ✅ (Phase 3) |
| `secrets alert` | Configure alert timing | ✅ (Phase 3) |
| `rotation list` | List secrets pending rotation | ✅ (Phase 3) |

**CLI Tests**: 93+ unit tests passing

### API Backend (apps/api)

| Router | Endpoints | Status |
|--------|-----------|--------|
| `auth` | signup, signin, signout, session, sessions | ✅ |
| `projects` | CRUD on projects | ✅ |
| `environments` | CRUD per project | ✅ |
| `vault` | push, pull, version | ✅ |
| `members` | CRUD on team members | ✅ |
| `invites` | create, list, accept, revoke | ✅ |
| `tokens` | CI/CD tokens | ✅ |
| `audit` | Paginated audit logs | ✅ |
| `rotation` | Secret rotation operations | ✅ (Phase 3) |
| `integrations` | Cloud integrations | ⚠️ Partial |

**API Tests**: 40+ tests for auth, CI tokens, rate limiting, etc.

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
| Secrets Browser | `/projects/[id]/secrets` | ✅ |
| Audit Log | `/projects/[id]/audit` | ✅ |
| Team Settings | `/projects/[id]/members` | ✅ |
| Project Settings | `/projects/[id]/settings` | ✅ |
| Account | `/account` | ✅ |
| Integrations | `/integrations` | ⚠️ Placeholder |

---

## Features In Progress (Phase 3)

### M3.5: Secret Alerts & Rotation

**API (apps/api)**:
- ✅ `SecretExpiration` model
- ✅ `RotationService` with audit logging
- ✅ `RotationRouter` endpoints
- ✅ `WebhookService` with exponential backoff
- ✅ `ExpirationChecker` background job
- ✅ `WebhookChannel` notification implementation

**CLI (apps/cli)**:
- ✅ `criptenv rotate` command
- ✅ `criptenv secrets expire` command
- ✅ `criptenv secrets alert` command
- ✅ `criptenv rotation list` command

**Web UI (apps/web)**:
- ⚠️ `ExpirationBadge` component (implemented)
- ⚠️ Secret row integration (in progress)

### M3.1: GitHub Action

- ✅ `packages/github-action/action.yml`
- ✅ `packages/github-action/src/index.ts`
- ✅ Test infrastructure

---

## Incomplete / Not Started

### Phase 3 (Pending)

| Feature | Priority | Status |
|---------|----------|--------|
| Vercel integration | P0 | ❌ Not started |
| Railway integration | P1 | ❌ Not started |
| Render integration | P1 | ❌ Not started |
| Public API versioning | P0 | ❌ Not started |
| API key model | P0 | ❌ Not started |
| Rate limiting | P0 | ⚠️ Tests exist |
| CLI `ci-login` | P0 | ❌ Not started |
| CLI `ci-deploy` | P0 | ❌ Not started |
| CLI `ci-secrets` | P0 | ❌ Not started |
| Web integrations dashboard | P1 | ⚠️ Placeholder |

### Security Issues (From Phase 2 Review)

| Issue | Priority | Impact |
|-------|----------|--------|
| CR-01: Session token in response body | P0 | API exposes tokens |
| CR-02: Token in localStorage | P0 | XSS vulnerability risk |
| MR-03: Rate limiting absent | P1 | Security prerequisite |
| HR-01: Escalation via invites | P1 | CI token security |

---

## Technical Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Rate limiting not implemented | 🔴 High | Required before public API |
| Security review incomplete | 🔴 High | Phase 2 security issues unresolved |
| Cloud integrations not started | 🟡 Medium | Phase 3 depends on these |
| Webhook delivery reliability | 🟡 Medium | Need retry mechanism validation |

---

## Next Recommended Steps

1. **Security First**: Resolve Phase 2 security issues (CR-01, CR-02)
2. **API Infrastructure**: Implement rate limiting and API key model
3. **CI Auth**: Complete CI token middleware and endpoints
4. **Cloud Integrations**: Implement Vercel provider (Priority P0)

---

## Files to Focus On

### For Current Phase 3 Work

| File | Purpose |
|------|---------|
| `apps/api/app/routers/rotation.py` | Rotation endpoints |
| `apps/api/app/services/rotation_service.py` | Rotation business logic |
| `apps/api/app/models/secret_expiration.py` | Expiration model |
| `apps/cli/src/criptenv/commands/secrets.py` | CLI rotation commands |
| `packages/github-action/src/index.ts` | GitHub Action |
| `apps/api/app/middleware/ci_auth.py` | CI token auth (needed) |

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01  
**Status**: Active Development — Phase 3