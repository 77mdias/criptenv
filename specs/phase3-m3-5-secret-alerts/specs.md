# Specifications — M3.5: Secret Alerts & Rotation

## Overview

Implementar sistema de expiração de secrets, alertas de rotação, e comandos de rotação manual/automática para melhorar a postura de segurança.

---

## 1. Funcionalidades

### 1.1 Secret Expiration

| Feature         | Description                                         |
| --------------- | --------------------------------------------------- |
| Expiration Date | Optional date when secret should be rotated         |
| Rotation Policy | `manual`, `notify`, `auto`                          |
| Notify Days     | Days before expiration to send alert (default: 7)   |
| Stale Indicator | Visual indicator for secrets approaching expiration |

### 1.2 Alert System

| Channel        | Description                                 |
| -------------- | ------------------------------------------- |
| In-App         | Badge on secrets table, notification center |
| Email          | Digest or immediate notifications           |
| Webhook        | POST to configured URL with event data      |
| Slack (future) | Slack integration for team notifications    |

### 1.3 Secret Rotation

| Type      | Description                               |
| --------- | ----------------------------------------- |
| Manual    | User triggers rotation via CLI/Web        |
| Scheduled | Background job rotates at configured time |
| Auto      | Immediately on expiration (future)        |

### 1.4 Rotation Workflow

1. Create new version of secret
2. Mark old version as `rotated_at`
3. Notify consumers (webhook, email)
4. Track rotation history in audit

### 1.5 CLI Commands

| Command                                 | Description                   |
| --------------------------------------- | ----------------------------- |
| `criptenv rotate KEY --env <env>`       | Rotate a specific secret      |
| `criptenv secrets expire KEY --days 90` | Set expiration on secret      |
| `criptenv secrets alert KEY --days 30`  | Configure alert timing        |
| `criptenv rotation list --env <env>`    | List secrets pending rotation |

### 1.6 Web UI

- Expiration date picker on secret form
- Rotation policy selector (manual/notify/auto)
- "Expires in X days" badge on secrets table
- Rotation history modal
- Webhook configuration in project settings

---

## 2. User Stories

### US-01: Set Expiration

**Como** security engineer  
**Quero** definir data de expiração em secrets críticos  
**Para** garantir rotação periódica

### US-02: Receive Alert

**Como** developer  
**Quero** receber notificação antes de um secret expirar  
**Para** preparar rotação com antecedência

### US-03: Rotate Secret

**Como** developer  
**Quero** fazer rotação manual de um secret  
**Para** atualizar credenciais comprometidas

### US-04: View Rotation History

**Como** auditor  
**Quero** ver histórico de rotações  
**Para** compliance e debugging

---

## 3. Acceptance Criteria

### AC-01: Expiration Model

- [ ] `SecretExpiration` model with fields: secret_key, expires_at, policy, notify_days
- [ ] One expiration record per secret key per environment
- [ ] Expiration queries optimized with indexes

### AC-02: Background Job

- [ ] Job runs every hour (configurable)
- [ ] Checks for secrets expiring within notify_days
- [ ] Sends alerts via configured channels
- [ ] Idempotent (re-sending within 24h blocked)

### AC-03: CLI Rotate

- [ ] `criptenv rotate KEY` creates new version, marks old as rotated
- [ ] Confirmation prompt shows old vs new (truncated)
- [ ] Rotation logged to audit with user context
- [ ] Optional `--value` flag for new value

### AC-04: CLI Expire

- [ ] `criptenv secrets expire KEY --days 90` sets expiration
- [ ] `--policy notify|auto|manual` sets rotation policy
- [ ] Shows confirmation with expiration date

### AC-05: Web Alerts

- [ ] "Expires in 5 days" badge on secrets table
- [ ] Red badge for secrets already expired
- [ ] Notification center shows upcoming expirations
- [ ] Email digest sent daily (if any expirations)

### AC-06: Webhook

- [ ] Webhook URL configurable per project
- [ ] Payload includes: event type, secret key (not value), expires_at, project_id
- [ ] Retry logic: 3 attempts with exponential backoff
- [ ] Webhook delivery logged

### AC-07: Rotation History

- [ ] Audit log shows `secret.rotated` events
- [ ] Web UI shows modal with rotation timeline
- [ ] Old versions accessible for rollback (future)

---

## 4. Dependencies

### Internal

- `apps/api/app/models/secret_expiration.py` — **CREATE**
- `apps/api/app/schemas/secret_expiration.py` — **CREATE**
- `apps/api/app/services/rotation_service.py` — **CREATE**
- `apps/api/app/routers/rotation.py` — **CREATE**
- `apps/api/app/jobs/expiration_check.py` — **CREATE**
- `apps/api/app/services/webhook_service.py` — **CREATE**
- `apps/cli/src/criptenv/commands/secrets.py` — Modify: add rotate, expire
- `apps/web/src/components/shared/secret-row.tsx` — Modify: add expiration badge

### External

- SMTP server for email (or integration like SendGrid)
- APScheduler or similar for background jobs

---

## 5. Constraints

### Security

- Secret values never in notifications
- Rotation requires project membership
- Audit logs for all rotation operations
- Webhook payloads signed (future)

### Performance

- Background job < 30 seconds for 1000 secrets
- Batch notifications (digest vs immediate)
- Index on expires_at for efficient queries

### Data Model

```python
class SecretExpiration(Base):
    __tablename__ = "secret_expirations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False, index=True)
    secret_key = Column(String(255), nullable=False)  # key_id from vault_blobs

    expires_at = Column(DateTime(timezone=True), nullable=False)
    rotation_policy = Column(String(20), default="notify")  # manual, notify, auto
    notify_days_before = Column(Integer, default=7)

    last_notified_at = Column(DateTime(timezone=True))
    rotated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index('ix_secret_expirations_project_env_key', 'project_id', 'environment_id', 'secret_key', unique=True),
        Index('ix_secret_expirations_expires_at', 'expires_at'),
    )

    project = relationship("Project")
    environment = relationship("Environment")
```

### Webhook Payload

```json
{
  "event": "secret.expiring",
  "project_id": "uuid",
  "environment": "production",
  "secret_key": "DATABASE_PASSWORD",
  "expires_at": "2024-06-01T00:00:00Z",
  "notify_days_before": 7,
  "timestamp": "2024-05-25T12:00:00Z"
}
```

### Background Job

```python
# apps/api/app/jobs/expiration_check.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job("hourly")
async def check_expirations():
    """Check for secrets expiring soon and send alerts."""
    now = datetime.now(timezone.utc)

    # Find secrets expiring within notify_days
    results = await db.execute(
        select(SecretExpiration).where(
            SecretExpiration.expires_at <= now + timedelta(days=secret_expiration.notify_days_before),
            SecretExpiration.rotated_at.is_(None),
            or_(
                SecretExpiration.last_notified_at.is_(None),
                SecretExpiration.last_notified_at < now - timedelta(hours=24)
            )
        )
    )

    for expiration in results.scalars():
        await send_alert(expiration)
        expiration.last_notified_at = now
        await db.commit()
```

---

## 6. Rotation API

```bash
# Rotate a secret
POST /api/v1/projects/:project_id/environments/:env/secrets/:key_id/rotate
Body: {
  "new_value": "encrypted_value",  # encrypted ciphertext
  "iv": "base64",
  "auth_tag": "base64"
}
Response: {
  "rotation_id": "uuid",
  "rotated_at": "2024-05-25T12:00:00Z",
  "new_version": 6
}

# Get rotation status
GET /api/v1/projects/:project_id/environments/:env/secrets/:key_id/rotation
Response: {
  "current_version": 5,
  "expires_at": "2024-06-01T00:00:00Z",
  "rotation_policy": "notify",
  "rotated_at": null,
  "last_notified_at": "2024-05-25T12:00:00Z"
}

# Configure expiration
POST /api/v1/projects/:project_id/environments/:env/secrets/:key_id/expiration
Body: {
  "expires_at": "2024-06-01T00:00:00Z",
  "rotation_policy": "notify",
  "notify_days_before": 7
}
```

---

**Document Version**: 1.0  
**Created**: 2026-04-30  
**Status**: SPEC — Pending Review  
**Milestone**: M3.5  
**Dependencies**: M3.4 (Public API)
