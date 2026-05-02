# Backend — CriptEnv

## Overview

Python FastAPI backend with async SQLAlchemy, providing REST API for the CriptEnv platform.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Framework** | FastAPI 0.110+ |
| **ORM** | SQLAlchemy 2.0+ (async) |
| **Database** | PostgreSQL with asyncpg |
| **Validation** | Pydantic 2.0+ |
| **Auth** | Custom JWT-like session tokens |
| **Background Jobs** | APScheduler |

---

## Project Structure

```
apps/api/
├── main.py              # FastAPI app, middleware, router inclusion
├── requirements.txt     # Python dependencies
├── app/
│   ├── __init__.py
│   ├── config.py        # Settings via pydantic-settings
│   ├── database.py      # SQLAlchemy async engine, session factory
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── auth.py      # Session token validation
│   │   └── jobs/
│   │       ├── __init__.py
│   │       ├── expiration_check.py
│   │       └── scheduler.py
│   ├── models/
│   │   ├── __init__.py  # Base, all models exported
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── environment.py
│   │   ├── vault.py
│   │   ├── member.py     # Includes CIToken, Invite
│   │   ├── audit.py
│   │   └── secret_expiration.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── projects.py
│   │   ├── environments.py
│   │   ├── vault.py
│   │   ├── members.py
│   │   ├── invites.py
│   │   ├── tokens.py
│   │   ├── audit.py
│   │   └── rotation.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── project.py
│   │   └── ... (other schemas)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── project_service.py
│   │   ├── vault_service.py
│   │   ├── audit_service.py
│   │   ├── rotation_service.py    # Phase 3
│   │   └── webhook_service.py     # Phase 3
│   └── strategies/
│       ├── __init__.py
│       ├── access.py         # Vault access control
│       ├── invite_transitions.py
│       ├── vault_push.py
│       ├── audit_filters.py
│       └── integrations/     # Cloud provider strategies
│           ├── __init__.py
│           ├── base.py
│           ├── vercel.py
│           ├── railway.py
│           └── render.py
└── tests/
    └── ... (pytest tests)
```

---

## Key Patterns

### Service Layer

All business logic goes in services, not routers:

```python
# apps/api/app/services/project_service.py
class ProjectService:
    @staticmethod
    async def create(db: AsyncSession, user_id: UUID, name: str) -> Project:
        project = Project(name=name, user_id=user_id)
        db.add(project)
        await db.flush()
        await AuditService.log(
            db, project_id=project.id, user_id=user_id,
            action="project.create", resource_type="project"
        )
        return project
```

### Database Sessions

Routers use `get_db()` dependency which handles commit/rollback:

```python
async def get_db():
    async with async_session() as session:
        yield session

@router.post("/projects")
async def create_project(
    db: AsyncSession = Depends(get_db),
    data: ProjectCreate = Body(...)
):
    project = await ProjectService.create(db, user_id, data.name)
    return project  # auto-commit on success exit
```

### Strategy Pattern

Complex flows use strategies:

```python
# apps/api/app/strategies/vault_push.py
class VaultPushStrategy:
    def __init__(self, strategy_type: str):
        self.strategy = STRATEGIES[strategy_type]()
    
    async def execute(self, project_id: UUID, secrets: list, db: AsyncSession):
        return await self.strategy.push(project_id, secrets, db)
```

---

## Routers

### Auth Router

**File:** `apps/api/app/routers/auth.py`

Handles user authentication, session management.

```python
@router.post("/signup")
async def signup(data: AuthSignup, db: AsyncSession = Depends(get_db)):
    # Create user, return user data (no token in body per CR-01)
    pass

@router.post("/signin")
async def signin(data: AuthSignin, db: AsyncSession = Depends(get_db)):
    # Validate credentials, set cookie, return user data
    pass
```

### Projects Router

**File:** `apps/api/app/routers/projects.py`

CRUD for projects.

```python
@router.get("/projects")
async def list_projects(
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    projects = await ProjectService.list_by_user(db, user_id)
    return {"projects": projects}

@router.post("/projects")
async def create_project(
    data: ProjectCreate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await ProjectService.create(db, user_id, data.name)
```

### Vault Router

**File:** `apps/api/app/routers/vault.py`

Secret push/pull operations.

```python
@router.post("/projects/{p_id}/environments/{e_id}/vault")
async def push_secrets(
    p_id: UUID, e_id: UUID,
    data: VaultPush,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await VaultService.push(db, p_id, e_id, data.secrets)
```

---

## Middleware

### Auth Middleware

**File:** `apps/api/app/middleware/auth.py`

Validates session tokens from cookies or Authorization header:

```python
async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    token = extract_token(request)  # From cookie or header
    payload = verify_token(token)   # JWT-like verification
    user = await get_user_by_id(db, payload["sub"])
    return user
```

### Scheduler Jobs

**File:** `apps/api/app/middleware/jobs/`

APScheduler for background tasks:

```python
# expiration_check.py
class ExpirationChecker:
    async def check_expirations():
        # Query SecretExpiration for items needing notification
        # Trigger WebhookService for each
        pass

# scheduler.py
class SchedulerManager:
    _instance = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
```

---

## Services

### AuthService

**File:** `apps/api/app/services/auth_service.py`

User registration, login, session management.

### ProjectService

**File:** `apps/api/app/services/project_service.py`

Project CRUD with audit logging.

### VaultService

**File:** `apps/api/app/services/vault_service.py`

Secret storage, versioning, push/pull.

### AuditService

**File:** `apps/api/app/services/audit_service.py`

Audit log creation and retrieval.

### RotationService (Phase 3)

**File:** `apps/api/app/services/rotation_service.py`

Secret rotation with audit trail.

### WebhookService (Phase 3)

**File:** `apps/api/app/services/webhook_service.py`

HTTP notifications with exponential backoff retry.

---

## Strategies

### Access Strategy

**File:** `apps/api/app/strategies/access.py`

Vault access control based on user role.

### Invite Transitions

**File:** `apps/api/app/strategies/invite_transitions.py`

State machine for invite flow.

### Vault Push Strategy

**File:** `apps/api/app/strategies/vault_push.py`

Handles complex vault push scenarios.

### Audit Filters

**File:** `apps/api/app/strategies/audit_filters.py`

Audit log filtering and aggregation.

### Integration Providers

**File:** `apps/api/app/strategies/integrations/`

Strategy pattern for cloud providers:
- `base.py` — Interface definition
- `vercel.py` — Vercel integration (pending)
- `railway.py` — Railway integration (pending)
- `render.py` — Render integration (pending)

---

## Security Considerations

### Token Handling

- Session tokens stored in HTTP-only cookies
- JWT-like format with configurable expiration
- Token verification on every protected request

### Password Hashing

- Uses `passlib` with bcrypt
- Salt rounds configured in security settings

### Input Validation

- All inputs validated via Pydantic schemas
- SQL injection prevented by SQLAlchemy ORM
- XSS prevention via frontend sanitization

### Known Issues (from Phase 2 Review)

| Issue | Priority | Status |
|-------|----------|--------|
| CR-01: Token in response body | P0 | Needs fix |
| CR-02: Token in localStorage | P0 | Needs fix |
| MR-03: Rate limiting | P1 | Not implemented |

---

## Running the Server

```bash
cd apps/api
pip install -r requirements.txt
cp .env.example .env  # Configure

# Development
uvicorn main:app --reload --port 8000

# Production
gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

API docs at `http://localhost:8000/docs` (when `DEBUG=true`).

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01