# Phase 2 Code Review

## Summary

Phase 2 implements a full-stack secret management platform with FastAPI backend and Next.js frontend. The auth flow uses session tokens stored in HttpOnly cookies with a 30-day expiration. Password hashing uses bcrypt with default rounds. Project membership-based authorization is consistently applied via `check_user_access()` across all routers. Secrets are encrypted client-side before storage.

Critical issues found: session tokens exposed in API responses (auth), XSS risk via localStorage token storage, missing input validation on project slugs, and soft-delete gap on environment deletion. High-priority: potential for members to escalate privileges via invite acceptance.

## Critical Issues (P0)

### CR-01: Session token returned in API response body

**File:** `apps/api/app/routers/auth.py:73-77`
**Issue:** AuthResponse schema exposes `session_token` in the response body, including the raw token. After signup/signin, the token is returned alongside user data.
**Impact:** Token could be logged by intermediaries, cached by CDNs, or leaked via browser history. The token is a bearer credential -- exposing it in a response body is equivalent to Basic Auth password in a GET response.
**Fix:**
```python
# Remove session_token from AuthResponse, or only return it via cookie
class AuthResponse(BaseModel):
    user: UserResponse
    session: SessionResponse
    # session_token removed - cookie-based auth only
```

### CR-02: Token stored in localStorage (XSS credential theft)

**File:** `apps/web/src/stores/auth.ts:72`
**Issue:** Auth state is persisted via Zustand with `persist` middleware, serializing token and user to `localStorage` under key `criptenv-auth`. Any XSS vulnerability anywhere on the site allows exfiltration of this token.
**Impact:** XSS can read localStorage and send the token to an attacker-controlled server. This is a well-known pattern for session hijacking.
**Fix:** Use `sessionStorage` instead of `localStorage` for token storage, or rely solely on the HttpOnly cookie pattern already implemented server-side. Remove `criptenv-auth` from persisted state, or only persist non-sensitive data.

### CR-03: No input validation on project slug generation

**File:** `apps/api/app/services/project_service.py:14-19`
**Issue:** The `_generate_slug()` function accepts arbitrary input and uses a regex that could produce empty strings or very long slugs. The function clamps to 50 chars but does not prevent malicious patterns. Project slugs appear in URLs and could be exploited.
**Fix:**
```python
def _generate_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    # Validate slug is safe
    if not slug or len(slug) < 2:
        slug = 'project'
    slug = slug[:50]
    return slug
```

### CR-04: Secrets version deleted without hard-delete consideration on environment deletion

**File:** `apps/api/app/routers/environments.py:294`
**Issue:** `db.delete(environment)` cascades to delete all VaultBlobs for that environment. However, no soft-delete or archival mechanism exists. Accidental deletion of an environment destroys all secrets irreversibly.
**Impact:** Production data loss risk. No recovery path.
**Fix:** Add `archived` flag to Environment model, or require typing the environment name to confirm deletion.

## High Issues (P1)

### HR-01: Members can escalate privileges via invite system

**File:** `apps/api/app/strategies/invite_transitions.py:38-39`
**Issue:** `AcceptInviteStrategy` checks `invite.email.lower() != current_user.email.lower()` but does NOT verify the invite was actually created by a project admin. Any user can create an invite for any email, and if they control that email, they can accept it to join the project.
**Impact:** A malicious user who creates a project can invite themselves with a higher role (admin/owner) using a secondary email they control.
**Fix:** Validate that the invite was created by an existing project member with appropriate role, or require invite tokens to be sent via the platform (not just created).

### HR-02: Session invalidation does not check expiration before deletion

**File:** `apps/api/app/services/auth_service.py:148-158`
**Issue:** `invalidate_session()` deletes any session matching the token regardless of whether it is expired. This means an attacker with a stolen expired token can still invalidate it, causing a denial-of-service for the legitimate user.
**Fix:**
```python
async def invalidate_session(self, token: str) -> bool:
    result = await self.db.execute(
        select(Session).where(
            Session.token == token,
            Session.expires_at > datetime.now(timezone.utc)
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return False
    await self.db.delete(session)
    return True
```

### HR-03: CORS allows credentials with wildcard origin in production

**File:** `apps/api/app/config.py:13`
**Issue:** `CORS_ORIGINS` defaults to `http://localhost:3000` but if misconfigured in production with a wildcard or multiple origins and `allow_credentials=True`, the browser will reject the request.
**Fix:** Ensure CORS configuration is validated at startup. Consider rejecting credentials=true when origins contain "*".

## Medium Issues (P2)

### MR-01: Auth middleware creates new DB session per request

**File:** `apps/api/app/middleware/auth.py:29-36`
**Issue:** `get_current_user()` creates its own `async_session_factory()` session instead of using the request-scoped `get_db()` dependency. This bypasses any middleware or context that wraps the request's DB session and could cause commit order issues.
**Impact:** Potential for orphaned sessions or inconsistent state in concurrent requests.
**Fix:** Refactor to accept the session as a parameter, injected via FastAPI dependency.

### MR-02: Vault push strategy always deletes all existing blobs

**File:** `apps/api/app/strategies/vault_push.py:30-34`
**Issue:** `ReplaceAllVaultBlobsStrategy.push()` unconditionally deletes all existing VaultBlobs for an environment before inserting new ones. There is no strategy interface variant for incremental updates. A failed push mid-operation could result in data loss.
**Impact:** If the operation fails after deletion but before insert completion, all secrets for that environment are lost.
**Fix:** Use a transactional approach or implement an incremental strategy variant.

### MR-03: No rate limiting on auth endpoints

**File:** `apps/api/app/routers/auth.py`
**Issue:** `/signup` and `/signin` endpoints have no rate limiting. An attacker could brute-force passwords using the signin endpoint.
**Impact:** Online brute force attack feasibility.
**Fix:** Add rate limiting middleware or use a library like `slowapi` to limit signin attempts per IP/email.

### MR-04: Session table has no index on expires_at for cleanup queries

**File:** `apps/api/app/models/user.py`
**Issue:** `Session.expires_at` is queried for validity checks but is not indexed. Over time, expired sessions accumulate and slow down validation queries.
**Impact:** Performance degradation as session table grows.
**Fix:** Add index on `Session.expires_at`.

## Low Issues (P3)

### LR-01: Dead code in project router force-load pattern

**File:** `apps/api/app/routers/projects.py:50-60`
**Issue:** The force-load pattern using `_ = project.id` etc. is unnecessary after `db.refresh(project)`. SQLAlchemy models accessed via `selectinload` already load relationships eagerly.
**Fix:** Remove dead force-load code.

### LR-02: Commented-out code in secret row component

**File:** `apps/web/src/components/shared/secret-row.tsx`
**Issue:** Should be checked for debug artifacts. [Could not verify file contents due to incomplete read].

### LR-03: Magic number for cookie max age

**File:** `apps/web/src/hooks/use-auth.ts:9`
**Issue:** `COOKIE_MAX_AGE = 60 * 60 * 24 * 30` is duplicated in both frontend and backend cookie settings. If one changes, the other may become inconsistent.
**Fix:** Define cookie max age in a shared constants file or ensure it is fetched from the backend config.

## Security Findings

### SF-01: kdf_salt exposed in UserResponse

**File:** `apps/api/app/routers/auth.py:19`, `apps/api/app/schemas/auth.py:22`
**Issue:** `kdf_salt` is returned in the user profile response. While this is not inherently a secret, it is a cryptographic material that could be useful in certain attack scenarios (e.g., if the KDF is weak client-side).
**Fix:** Determine if the salt needs to be client-visible. If not, remove from UserResponse.

### SF-02: No HTTPS enforcement in production

**File:** `apps/api/app/routers/auth.py:64-70`
**Issue:** Cookie is set with `secure=True` but only when `DEBUG=False` or the setting is properly configured. In development mode with HTTP, the cookie is sent without the Secure flag.
**Fix:** Ensure production deployments enforce HTTPS and set `SECURE_COOKIES=true` in production config.

## Files Reviewed

### Backend (apps/api)
- `app/routers/auth.py` - Auth endpoints
- `app/middleware/auth.py` - Session validation middleware
- `app/services/auth_service.py` - Auth business logic
- `app/services/project_service.py` - Project CRUD and access checks
- `app/services/vault_service.py` - Vault operations
- `app/routers/projects.py` - Project endpoints
- `app/routers/vault.py` - Vault endpoints
- `app/routers/members.py` - Member management
- `app/routers/invites.py` - Invite system
- `app/routers/environments.py` - Environment CRUD
- `app/routers/audit.py` - Audit log retrieval
- `app/routers/tokens.py` - CI/CD token management
- `app/strategies/access.py` - Role-based access control
- `app/strategies/invite_transitions.py` - Invite state machine
- `app/strategies/vault_push.py` - Vault push strategy
- `app/models/user.py` - User and Session models
- `app/models/member.py` - Member, Invite, CIToken models
- `app/config.py` - Settings
- `main.py` - FastAPI app initialization

### Frontend (apps/web)
- `src/stores/auth.ts` - Auth state persistence
- `src/hooks/use-auth.ts` - Auth hooks
- `src/lib/api/client.ts` - API client
- `src/lib/api/auth.ts` - Auth API
- `src/app/(auth)/login/page.tsx` - Login page
- `src/app/(dashboard)/layout.tsx` - Dashboard layout with auth guard
- `src/components/shared/vault-unlock-panel.tsx` - Vault unlock UI

---

_Reviewed: 2026-04-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
