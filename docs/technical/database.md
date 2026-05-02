# Database — CriptEnv

## Overview

CriptEnv uses PostgreSQL as its primary database with SQLAlchemy async for ORM operations.

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Database** | PostgreSQL | 14+ |
| **ORM** | SQLAlchemy (async) | 2.0+ |
| **Driver** | asyncpg | 0.9+ |
| **Connection Pool** | asyncpg built-in | — |
| **Migrations** | Manual (no Alembic) | — |

---

## Connection Configuration

**Connection URL format:**

```python
# Synchronous (SQLAlchemy core - not used)
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/db

# Asynchronous (actual connection)
ASYNC_DATABASE_URL=postgresql://user:password@host:5432/db
```

**Pool settings (in `apps/api/app/database.py`):**
- Pool size: 2
- Max overflow: 5
- Prepared statements: disabled (compatibility with pgbouncer)

**Note:** The `ASYNC_DATABASE_URL` removes the `asyncpg` prefix because `asyncpg` connects directly without needing SQLAlchemy's native async driver translation.

---

## Models

### User

**File:** `apps/api/app/models/user.py`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | Primary key |
| email | String(255) | Unique, not null |
| password_hash | String(255) | Not null |
| created_at | DateTime | Server default |
| updated_at | DateTime | On update |

### Project

**File:** `apps/api/app/models/project.py`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String(255) | Not null |
| user_id | UUID | Foreign key → users.id |
| created_at | DateTime | Server default |
| updated_at | DateTime | On update |

### Environment

**File:** `apps/api/app/models/environment.py`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String(255) | Not null |
| project_id | UUID | Foreign key → projects.id |
| created_at | DateTime | Server default |
| updated_at | DateTime | On update |

### VaultBlob

**File:** `apps/api/app/models/vault.py`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Foreign key → projects.id |
| environment_id | UUID | Foreign key → environments.id |
| key_id | String(255) | Not null (encrypted key name) |
| encrypted_value | Text | Not null (base64 encoded blob) |
| version | Integer | Default 1 |
| created_at | DateTime | Server default |
| updated_at | DateTime | On update |

### Member (includes CI tokens)

**File:** `apps/api/app/models/member.py`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key → users.id |
| project_id | UUID | Foreign key → projects.id |
| role | String(50) | Not null (owner, admin, member, viewer) |
| created_at | DateTime | Server default |

### CIToken (within Member)

**File:** `apps/api/app/models/member.py`

| Column | Type | Constraints |
|--------|------|-------------|
| token_hash | String(255) | Unique, not null |
| prefix | String(10) | Not null (starts with `ci_`) |
| name | String(255) | Not null |
| expires_at | DateTime | Nullable |
| last_used_at | DateTime | Nullable |
| created_at | DateTime | Server default |

### Invite

**File:** `apps/api/app/models/member.py`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Foreign key → projects.id |
| email | String(255) | Not null |
| role | String(50) | Not null |
| token | String(255) | Unique, not null |
| expires_at | DateTime | Not null |
| created_at | DateTime | Server default |

### AuditLog

**File:** `apps/api/app/models/audit.py`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Foreign key → projects.id, indexed |
| user_id | UUID | Foreign key → users.id, nullable |
| action | String(50) | Not null |
| resource_type | String(50) | Not null |
| resource_id | UUID | Nullable |
| metadata | JSONB | Nullable |
| ip_address | String(45) | Nullable |
| created_at | DateTime | Server default, indexed |

### SecretExpiration (Phase 3)

**File:** `apps/api/app/models/secret_expiration.py`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Foreign key → projects.id, indexed |
| environment_id | UUID | Foreign key → environments.id, indexed |
| secret_key | String(255) | Not null |
| expires_at | DateTime | Not null |
| rotation_policy | String(20) | Default 'manual' |
| notify_days_before | Integer | Default 7 |
| last_notified_at | DateTime | Nullable |
| rotated_at | DateTime | Nullable |
| created_at | DateTime | Server default |

---

## Schema Diagram

```mermaid
erDiagram
    USER ||--o{ PROJECT : owns
    USER ||--o{ MEMBER : "is member of"
    PROJECT ||--o{ MEMBER : has
    PROJECT ||--o{ ENVIRONMENT : has
    PROJECT ||--o{ AUDIT_LOG : generates
    PROJECT ||--o{ VAULT_BLOB : stores
    PROJECT ||--o{ INVITE : has
    PROJECT ||--o{ SECRET_EXPIRATION : tracks
    ENVIRONMENT ||--o{ VAULT_BLOB : contains
    ENVIRONMENT ||--o{ SECRET_EXPIRATION : tracks
    USER ||--o{ AUDIT_LOG : performs

    USER {
        uuid id PK
        string email UK
        string password_hash
        datetime created_at
        datetime updated_at
    }

    PROJECT {
        uuid id PK
        string name
        uuid user_id FK
        datetime created_at
        datetime updated_at
    }

    ENVIRONMENT {
        uuid id PK
        string name
        uuid project_id FK
        datetime created_at
        datetime updated_at
    }

    VAULT_BLOB {
        uuid id PK
        uuid project_id FK
        uuid environment_id FK
        string key_id
        text encrypted_value
        int version
        datetime created_at
        datetime updated_at
    }

    MEMBER {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        string role
        datetime created_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        string action
        string resource_type
        uuid resource_id
        json metadata
        string ip_address
        datetime created_at
    }

    SECRET_EXPIRATION {
        uuid id PK
        uuid project_id FK
        uuid environment_id FK
        string secret_key
        datetime expires_at
        string rotation_policy
        int notify_days_before
        datetime last_notified_at
        datetime rotated_at
        datetime created_at
    }
```

---

## Database Operations

### Creating Tables

Tables are created via SQLAlchemy's `Base.metadata.create_all()` on app startup when `DEBUG=true`. In production, use proper migration tooling.

```python
# In apps/api/main.py or database.py
from sqlalchemy.ext.asyncio import create_async_engine
from models import Base

async def init_db():
    engine = create_async_engine(settings.async_database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

### Manual Migration Pattern

For production, manual SQL migrations are stored in `apps/api/migrations/` (if created). The current approach:

1. Make schema changes in models
2. Generate migration SQL manually
3. Apply via `psql` or migration tool

---

## Query Patterns

### Async Session Usage

```python
# Always use dependency injection
async def get_db():
    async with async_session() as session:
        yield session

# Router usage
@router.post("/projects")
async def create_project(db: AsyncSession = Depends(get_db)):
    project = Project(name="My Project", user_id=user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project
```

### Transaction Handling

The `get_db()` dependency handles commit/rollback automatically:
- Success: auto-commit
- Exception: auto-rollback

```python
# This is handled automatically:
async with get_db() as db:
    try:
        db.add(project)
        await db.commit()  # auto on success exit
    except:
        await db.rollback()  # auto on exception
```

---

## Common Operations

### Insert

```python
project = Project(name="New Project", user_id=user.id)
db.add(project)
await db.flush()  # Get ID without commit
await db.commit()
```

### Select with Join

```python
from sqlalchemy import select
from sqlalchemy.orm import joinedload

stmt = select(Project).options(joinedload(Project.environments)).where(Project.user_id == user.id)
result = await db.execute(stmt)
projects = result.scalars().unique().all()
```

### Update

```python
project.name = "Updated Name"
await db.commit()
```

### Delete (Soft)

```python
# Soft delete pattern (if implemented)
project.deleted_at = datetime.utcnow()
await db.commit()
```

### Pagination

```python
from sqlalchemy import select, func

# Count
count_stmt = select(func.count()).select_from(Project).where(Project.user_id == user.id)
total = await db.scalar(count_stmt)

# Paginated query
stmt = select(Project).where(Project.user_id == user.id).offset(offset).limit(limit)
result = await db.execute(stmt)
```

---

## Audit Logging

All significant operations create audit log entries:

```python
await AuditService.log(
    db=db,
    project_id=project.id,
    user_id=user.id,
    action="project.create",
    resource_type="project",
    resource_id=project.id,
    metadata={"name": project.name},
    ip_address=request.client.host if request else None
)
```

---

## Testing

Tests use a separate test database or temporary directories with SQLite for CLI tests. API tests use pytest fixtures with proper cleanup.

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01