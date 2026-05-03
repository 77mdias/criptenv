# In Progress Features — CriptEnv

## Overview

Features currently under development.

---

## Phase 3: CI/CD Integrations

### M3.7: OAuth Authentication (GitHub, Google, Discord)

**Status:** ✅ Implemented and tested

#### What Exists

| Component | Status | Files |
|-----------|--------|-------|
| `OAuthAccount` model | ✅ | `apps/api/app/models/oauth_account.py` |
| `OAuthService` (3 providers) | ✅ | `apps/api/app/services/oauth_service.py` |
| `OAuthRouter` endpoints | ✅ | `apps/api/app/routers/oauth.py` |
| OAuth migration | ✅ | `migrations/versions/20260503_0002_create_oauth_accounts.py` |
| `OAuthButton` component | ✅ | `apps/web/src/components/ui/oauth-button.tsx` |
| `OAuthButtonGroup` | ✅ | `apps/web/src/components/ui/oauth-button.tsx` |
| OAuth callback page | ✅ | `apps/web/src/app/(auth)/oauth/callback/page.tsx` |
| Login/Signup OAuth integration | ✅ | `apps/web/src/app/(auth)/login/page.tsx`, `signup/page.tsx` |
| OAuth tests (8) | ✅ | `apps/api/tests/test_oauth.py` |

#### OAuth Providers

| Provider | Status | Implementation |
|----------|--------|----------------|
| GitHub | ✅ Tested | User info with avatar |
| Google | ✅ | OAuth 2.0 with userinfo endpoint |
| Discord | ✅ | OAuth 2.0 with avatar URL construction |

#### Flow

1. User clicks OAuth button → backend `/api/auth/oauth/{provider}`
2. Backend sets `oauth_state` cookie → redirects to provider
3. Provider redirects to `/api/auth/oauth/{provider}/callback?code=...&state=...`
4. Backend validates state, creates session, sets `session_token` cookie
5. Backend redirects to frontend `/oauth/callback`
6. Frontend verifies session via `authApi.session()` → redirects to `/dashboard`

#### Security Features

- CSRF protection via state parameter
- HTTP-only cookies (secure=False for dev, secure=True for prod)
- OAuth users have no password (kdf_salt generated, email_verified=True)

#### Next Steps

1. ✅ OAuth implemented and working
2. Add Google/Discord OAuth testing
3. Add "link account" UI for linking multiple OAuth providers to single account

---

### M3.5: Secret Alerts & Rotation

**Target:** Complete secret expiration and rotation system

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
| `ExpirationBadge` component | ⚠️ Partial | `apps/web/src/components/shared/` |
| Secret row integration | ⚠️ Partial | In progress |

#### What's Missing

| Component | Priority | Status |
|-----------|----------|--------|
| Web: Full expiration UI | P1 | ❌ Not started |
| Web: Alert configuration page | P1 | ❌ Not started |
| Webhook: Email notifications | P2 | ❌ Not started |
| Webhook: Slack integration | P2 | ❌ Not started |
| Rotation: Auto-rotation policy | P1 | ❌ Not started |

#### Current Work

**ExpirationBadge Component Integration:**

The `ExpirationBadge` component exists but needs integration into the secrets table/row in the web dashboard. This requires:
1. API endpoint to fetch expiration data per secret
2. Pass expiration data to SecretRow component
3. Display badge with appropriate color (green/yellow/red/expired)
4. Click handler for rotation modal

**Files to work on:**
- `apps/web/src/components/shared/expiration-badge.tsx` (if exists)
- `apps/web/src/app/(dashboard)/projects/[id]/secrets/page.tsx`
- API endpoint for `/api/v1/.../secrets/expiring`

#### Possible Issues

1. **Background job reliability**: APScheduler runs in single process, no distributed scheduling
2. **Webhook retry logic**: Need to verify exponential backoff is working correctly
3. **Secret row integration**: Component structure may need adjustment

#### Next Steps

1. ✅ Complete ExpirationBadge integration in secrets table
2. ✅ Create expiration configuration UI
3. ✅ Add rotation modal to web dashboard
4. ✅ Implement auto-rotation policy (future)

---

### M3.1: GitHub Action

**Status:** ✅ Implemented (action.yml and index.ts complete)

#### What Exists

| Component | Status | Files |
|-----------|--------|-------|
| `action.yml` | ✅ | `packages/github-action/action.yml` |
| Action source (TypeScript) | ✅ | `packages/github-action/src/index.ts` |
| Test infrastructure | ✅ | `packages/github-action/__tests__/` |

#### What's Missing

| Component | Priority | Status |
|-----------|----------|--------|
| Published to GitHub Marketplace | P0 | ❌ Not done |
| README documentation | P1 | ❌ Not done |
| E2E tests with real repo | P1 | ⚠️ Partial |

#### Next Steps

1. Complete README for the action
2. Run E2E tests with test repository
3. Publish to GitHub Marketplace
4. Add badges and version tags

---

### Pending: Cloud Integrations

**Status:** ❌ Not started

#### Vercel Integration

| Component | Priority |
|-----------|----------|
| `IntegrationProvider` interface | P0 |
| `Integration` model | P0 |
| `IntegrationService` | P0 |
| `VercelProvider` strategy | P0 |
| CLI `integrations` commands | P1 |
| Web integrations dashboard | P1 |

#### Railway Integration

| Component | Priority |
|-----------|----------|
| `RailwayProvider` strategy | P1 |

#### Render Integration

| Component | Priority |
|-----------|----------|
| `RenderProvider` strategy | P1 |

#### Strategy Pattern Structure

```
apps/api/app/strategies/integrations/
├── base.py          # IntegrationProvider interface
├── vercel.py        # VercelProvider
├── railway.py       # RailwayProvider  
├── render.py        # RenderProvider
└── __init__.py
```

---

### Pending: Public API

**Status:** ❌ Not started

#### Requirements

| Component | Priority |
|-----------|----------|
| API versioning (`/api/v1/` prefix) | P0 |
| `APIKey` model | P0 |
| `APIKey` router | P0 |
| API key auth middleware | P0 |
| Rate limiting middleware | P0 |
| OpenAPI/Swagger documentation | P0 |
| Rate limiting tests | P1 |

#### Security Issues

Before public API launch, resolve from Phase 2 Review:
- **CR-01**: Session token in response body
- **CR-02**: Token in localStorage

---

## Phase 2: Incomplete Items

### Web: Integrations Page

**Status:** ⚠️ Placeholder

The integrations page (`/integrations`) exists as a placeholder but has no real functionality.

**Files:** `apps/web/src/app/(dashboard)/integrations/page.tsx`

**Needed:**
- Integration cards for GitHub, Vercel, Railway, Render
- Connect/disconnect flow
- Status display (connected/disconnected)

### Security: Token Handling

**Status:** ⚠️ Review needed

- Session token exposure in response body (CR-01)
- Token stored in localStorage (CR-02)

These issues from Phase 2 Review should be resolved before Phase 3 public API work.

---

## Priority Order for In-Progress Work

1. **High Priority**
   - Resolve security issues (CR-01, CR-02)
   - Complete expiration badge integration
   - Implement Vercel integration (P0 for Phase 3)

2. **Medium Priority**
   - Complete GitHub Action publishing
   - Web alert configuration UI
   - CLI `ci-login` / `ci-deploy` commands

3. **Lower Priority**
   - Railway/Render integrations
   - Email/Slack webhook notifications
   - Rate limiting implementation (beyond tests)

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01  
**Status**: Active Development