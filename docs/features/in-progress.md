# In Progress Features — CriptEnv

## Overview

Features currently under active development or pending completion.

---

## Phase 3: CI/CD Integrations (~92% Complete)

### M3.2: Cloud Integrations — Railway Provider

**Status:** ⚠️ Pending Implementation

#### What Exists

| Component | Status | Files |
|-----------|--------|-------|
| `IntegrationProvider` interface | ✅ | `apps/api/app/strategies/integrations/base.py` |
| `VercelProvider` | ✅ | `apps/api/app/strategies/integrations/vercel.py` |
| `RenderProvider` | ✅ | `apps/api/app/strategies/integrations/render.py` |
| `Integration` model | ✅ | `apps/api/app/models/integration.py` |
| `IntegrationService` | ✅ | `apps/api/app/services/integration_service.py` |
| `IntegrationRouter` | ✅ | `apps/api/app/routers/integrations.py` |
| CLI `integrations` commands | ✅ | `apps/cli/src/criptenv/commands/integrations.py` |
| Web integrations dashboard (Vercel) | ✅ | `apps/web/src/app/(dashboard)/integrations/page.tsx` |

#### What's Missing

| Component | Priority | Status |
|-----------|----------|--------|
| `RailwayProvider` strategy | P1 | ❌ Not started |
| Web: Railway integration card | P1 | ❌ Not started |
| CLI: Railway-specific commands | P2 | ❌ Not started |

#### RailwayProvider Expected Interface

Following the `RenderProvider` pattern in `apps/api/app/strategies/integrations/render.py`:

```python
class RailwayProvider(IntegrationProvider):
    @property
    def name(self) -> str: ...
    @property
    def display_name(self) -> str: ...
    async def validate_connection(self, config: dict) -> bool: ...
    async def push_secrets(self, config: dict, secrets: dict, env: str = "production") -> bool: ...
    async def pull_secrets(self, config: dict, env: str = "production") -> dict: ...
```

#### Next Steps

1. Implement `RailwayProvider` following `RenderProvider` pattern
2. Register in `apps/api/app/strategies/integrations/__init__.py`
3. Add unit tests in `apps/api/tests/test_integration_providers.py`
4. Update web UI to show Railway card

---

### M3.5: Secret Alerts & Rotation — Web UI Polish

**Status:** 🟡 Mostly Complete (API + CLI ✅, Web partial)

#### What Exists

| Component | Status | Files |
|-----------|--------|-------|
| `SecretExpiration` model | ✅ | `apps/api/app/models/secret_expiration.py` |
| `RotationService` | ✅ | `apps/api/app/services/rotation_service.py` |
| `RotationRouter` endpoints | ✅ | `apps/api/app/routers/rotation.py` |
| `WebhookService` | ✅ | `apps/api/app/services/webhook_service.py` |
| `ExpirationChecker` background job | ✅ | `apps/api/app/jobs/expiration_check.py` |
| CLI `rotate` command | ✅ | `apps/cli/src/criptenv/commands/secrets.py` |
| CLI `secrets expire` command | ✅ | `apps/cli/src/criptenv/commands/secrets.py` |
| CLI `secrets alert` command | ✅ | `apps/cli/src/criptenv/commands/secrets.py` |
| CLI `rotation list` command | ✅ | `apps/cli/src/criptenv/commands/secrets.py` |
| `ExpirationBadge` component | ✅ | `apps/web/src/components/shared/expiration-badge.tsx` |
| Secret row badge integration | ✅ | `apps/web/src/app/(dashboard)/projects/[id]/secrets/page.tsx` |

#### What's Missing

| Component | Priority | Status |
|-----------|----------|--------|
| Web: Alert configuration page | P1 | ❌ Not started |
| Web: Rotation modal | P1 | ⚠️ Partial |
| Webhook: Email notifications | P2 | ❌ Not started |
| Webhook: Slack integration | P2 | ❌ Not started |
| Rotation: Auto-rotation policy | P1 | ❌ Not started |

#### Next Steps

1. Create alert configuration UI in project settings
2. Add rotation modal to web dashboard
3. Implement auto-rotation policy (future milestone)

---

### GitHub Action Publishing

**Status:** 🟡 Ready for Publishing

#### What Exists

| Component | Status | Files |
|-----------|--------|-------|
| `action.yml` | ✅ | `packages/github-action/action.yml` |
| Action source (TypeScript) | ✅ | `packages/github-action/src/index.ts` |
| Compiled `dist/index.js` | ✅ | `packages/github-action/dist/index.js` |
| Test infrastructure | ✅ | `packages/github-action/__tests__/` |

#### What's Missing

| Component | Priority | Status |
|-----------|----------|--------|
| Published to GitHub Marketplace | P0 | ❌ Not done |
| README documentation | P1 | ❌ Not done |
| E2E tests with real repo | P1 | ⚠️ Partial |

#### Next Steps

1. Write action README with usage examples
2. Create a release/tag on GitHub
3. Submit to GitHub Marketplace
4. Add badges and version tags

---

## Phase 2 Security Review — Resolved ✅

### CR-01: Session Token in Response Body

**Status:** ✅ Resolved (2026-05-03)

- `AuthResponse` no longer includes `token` in JSON body
- Session token delivered exclusively via HTTP-only cookie (`session_token`)
- Cookie attributes: `httponly=True`, `secure=True`, `samesite="lax"`
- CLI login extracts token from `Set-Cookie` header and stores encrypted locally

### CR-02: Token in localStorage

**Status:** ✅ Resolved (2026-05-03)

- `useAuthStore` (Zustand) no longer persists to localStorage
- Session verified via HTTP-only cookie on every page load
- `authApi.session()` called on app initialization
- Multi-tab auth works via cookie sharing

---

## Priority Order for In-Progress Work

1. **High Priority**
   - RailwayProvider implementation (M3.2 closure)
   - Integration config at-rest encryption (security)
   - Web alert configuration UI (M3.5 closure)

2. **Medium Priority**
   - GitHub Action publishing to Marketplace
   - Web rotation modal completion
   - Email webhook notifications

3. **Lower Priority**
   - Slack webhook integration
   - Auto-rotation policy
   - E2E tests for GitHub Action

---

**Document Version**: 1.2
**Last Updated**: 2026-05-06
**Status**: Active Development — Phase 3 (92%)
