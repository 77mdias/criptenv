# Specifications — M3.4: Public API

## Overview

Criar API REST versionada e documentada para uso externo, com autenticação via API keys, rate limiting robusto, e OpenAPI/Swagger documentation.

---

## 1. Funcionalidades

### 1.1 API Versioning

- Base path: `/api/v1/`
- Version negotiation via Accept header (optional)
- Backwards compatibility for v1
- Deprecation policy: 12 months notice before sunset

### 1.2 API Key Authentication

| Feature     | Description                                              |
| ----------- | -------------------------------------------------------- |
| Key Format  | `cek_<prefix><random>` (e.g., `cek_live_abc123`)         |
| Storage     | SHA-256 hash, prefix stored for identification           |
| Scopes      | Same as CI tokens: `read:secrets`, `write:secrets`, etc. |
| Expiration  | Optional, configurable                                   |
| Rate Limits | 1000 req/min per API key                                 |

### 1.3 Rate Limiting

| Endpoint Type    | Limit | Window            |
| ---------------- | ----- | ----------------- |
| Auth endpoints   | 5     | req/min per IP    |
| CI tokens        | 200   | req/min per token |
| API keys         | 1000  | req/min per key   |
| Public endpoints | 100   | req/min per IP    |

### 1.4 Endpoints

#### Authentication

```
POST /api/v1/auth/login
POST /api/v1/auth/signup
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
```

#### Projects

```
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id
```

#### Environments

```
GET    /api/v1/projects/:project_id/environments
POST   /api/v1/projects/:project_id/environments
GET    /api/v1/projects/:project_id/environments/:id
PUT    /api/v1/projects/:project_id/environments/:id
DELETE /api/v1/projects/:project_id/environments/:id
```

#### Secrets (Vault)

```
GET    /api/v1/projects/:project_id/secrets
POST   /api/v1/projects/:project_id/secrets/push
GET    /api/v1/projects/:project_id/secrets/pull
```

#### CI Tokens

```
GET    /api/v1/projects/:project_id/tokens
POST   /api/v1/projects/:project_id/tokens
GET    /api/v1/projects/:project_id/tokens/:id
DELETE /api/v1/projects/:project_id/tokens/:id
```

#### Integrations (Future)

```
GET    /api/v1/projects/:project_id/integrations
POST   /api/v1/projects/:project_id/integrations
DELETE /api/v1/projects/:project_id/integrations/:id
POST   /api/v1/projects/:project_id/integrations/:id/sync
```

### 1.5 OpenAPI Documentation

- Swagger UI at `/docs` (development only)
- ReDoc at `/redoc` (production)
- OpenAPI 3.1 spec
- Schema definitions for all models
- Security schemes documented
- Examples for all endpoints

---

## 2. User Stories

### US-01: Create API Key

**Como** developer  
**Quero** criar uma API key no dashboard  
**Para** usar em automações e scripts

### US-02: Use API in Scripts

**Como** developer  
**Quero** fazer requests autenticadas via API key  
**Para** integrar CriptEnv com minhas ferramentas

### US-03: Understand Rate Limits

**Como** developer  
**Quero** saber quantas requests ainda tenho  
**Para** otimizar uso e evitar falhas

### US-04: Explore API

**Como** developer  
**Quero** explorar a API via Swagger UI  
**Para** entender endpoints antes de implementar

---

## 3. Acceptance Criteria

### AC-01: API Key Management

- [ ] Can create API key with name and scopes
- [ ] Plaintext key shown only once on creation
- [ ] Can list API keys (without revealing secret)
- [ ] Can revoke API key
- [ ] API key auth works for all endpoints

### AC-02: Rate Limiting

- [ ] Rate limit headers in all responses (`X-RateLimit-*`)
- [ ] 429 Too Many Requests when exceeded
- [ ] Rate limit persists across requests
- [ ] Different limits per auth method (session, CI token, API key)

### AC-03: API Versioning

- [ ] All endpoints prefixed with `/api/v1/`
- [ ] Version returned in response header (`X-API-Version: 1.0`)
- [ ] Invalid version returns 400

### AC-04: Documentation

- [ ] Swagger UI at `/docs` in development
- [ ] ReDoc at `/redoc` in production
- [ ] All schemas documented
- [ ] Security requirements documented
- [ ] Error responses documented

### AC-05: Error Responses

- [ ] Consistent error format: `{ "error": { "code": "...", "message": "...", "details": {...} } }`
- [ ] HTTP status codes used correctly
- [ ] Validation errors include field information

---

## 4. Dependencies

### Internal

- `apps/api/app/models/api_key.py` — **CREATE**
- `apps/api/app/schemas/api_key.py` — **CREATE**
- `apps/api/app/middleware/api_key_auth.py` — **CREATE**
- `apps/api/app/middleware/rate_limit.py` — **CREATE**
- `apps/api/app/routers/api_keys.py` — **CREATE**
- `apps/api/main.py` — Modify: add versioning, docs

### External

- slowapi (for rate limiting)
- openapi-python-client (for client generation, optional)

---

## 5. Constraints

### Security

- API keys hashed with SHA-256
- HTTPS required in production
- No sensitive data in logs
- Audit logging for all API key operations

### Performance

- Rate limit checking < 1ms overhead
- Caching for rate limit counters
- Pagination on list endpoints (default: 50, max: 100)

### Data Model

```python
class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    description = Column(String(500))

    prefix = Column(String(20), nullable=False)  # "cek_live_" for display
    key_hash = Column(String(255), nullable=False, unique=True)

    scopes = Column(JSONB, default=["read:secrets"])
    environment_scope = Column(String(255), nullable=True)

    last_used_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    user = relationship("User", back_populates="api_keys")
    project = relationship("Project", back_populates="api_keys")
```

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1714521600
```

---

## 6. Technical Design

### API Key Middleware

```python
# apps/api/app/middleware/api_key_auth.py
from fastapi import Request, HTTPException, status

API_KEY_PREFIX = "cek_"

def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

async def get_api_key_user(request: Request) -> Optional[User]:
    """Extract and validate API key from Authorization header."""
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    api_key = auth_header[7:]  # Remove "Bearer "

    if not api_key.startswith(API_KEY_PREFIX):
        return None

    key_hash = hash_api_key(api_key)

    # Look up in database
    result = await db.execute(
        select(APIKey).where(
            APIKey.key_hash == key_hash,
            APIKey.revoked_at.is_(None)
        )
    )

    api_key_record = result.scalar_one_or_none()

    if not api_key_record:
        return None

    # Check expiration
    if api_key_record.expires_at and api_key_record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key has expired"
        )

    # Update last_used_at
    api_key_record.last_used_at = datetime.now(timezone.utc)
    await db.commit()

    # Return user from API key
    return api_key_record.user
```

### Rate Limit Middleware

```python
# apps/api/app/middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# Decorators for different rate limits
@limiter.limit("5/minute")  # Auth endpoints
async def auth_endpoint(request: Request):
    pass

@limiter.limit("1000/minute")  # API key endpoints
async def api_endpoint(request: Request, api_key: str):
    pass

# Custom key function for API keys
def get_api_key_identifier(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer cek_"):
        return auth_header[7:20]  # Use prefix for rate limiting
    return get_remote_address(request)
```

### Error Response Format

```python
class APIError(BaseModel):
    code: str  # e.g., "TOKEN_EXPIRED", "VALIDATION_ERROR"
    message: str  # Human-readable message
    details: Optional[dict] = None  # Additional context
    request_id: Optional[str] = None  # For support

class ErrorResponse(BaseModel):
    error: APIError

# Usage in handlers
raise HTTPException(
    status_code=401,
    detail={
        "code": "TOKEN_EXPIRED",
        "message": "Your session has expired. Please login again.",
        "request_id": request.state.request_id
    }
)
```

---

**Document Version**: 1.0  
**Created**: 2026-04-30  
**Status**: SPEC — Pending Review  
**Milestone**: M3.4  
**Dependencies**: M3.2 (Cloud Integrations), M3.3 (CI Tokens)
