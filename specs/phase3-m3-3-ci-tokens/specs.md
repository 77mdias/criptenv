# Specifications — M3.3: CI Tokens Enhancement

## Overview

Melhorar o sistema de CI tokens existente com scopes granulares, permissões por environment, CLI commands completos e UI de gerenciamento no dashboard web.

---

## 1. Funcionalidades

### 1.1 Token Scopes

| Scope                | Description                     |
| -------------------- | ------------------------------- |
| `read:secrets`       | Read secrets from environments  |
| `write:secrets`      | Create/update secrets           |
| `delete:secrets`     | Delete secrets                  |
| `read:audit`         | Read audit logs                 |
| `write:integrations` | Manage integrations             |
| `admin:project`      | Full project access (dangerous) |

### 1.2 Environment Scoping

- Tokens can be restricted to specific environments
- `environment_scope: null` = all environments
- `environment_scope: "production"` = production only
- Enables least-privilege for CI tokens

### 1.3 Token Metadata

- Name/description for identification
- Created by user tracking
- Last used timestamp
- Expiration date (optional)
- IP allowlist (optional, future)

### 1.4 CLI Commands

| Command                                                     | Description                           |
| ----------------------------------------------------------- | ------------------------------------- |
| `criptenv ci-login --token <token>`                         | Login with CI token, save session     |
| `criptenv ci-deploy --env <env> [--provider <provider>]`    | Deploy secrets to environment         |
| `criptenv ci-secrets --env <env>`                           | List available secrets for CI context |
| `criptenv ci-tokens list`                                   | List CI tokens for current project    |
| `criptenv ci-tokens create --name <name> --scopes <scopes>` | Create new token                      |
| `criptenv ci-tokens revoke <token-id>`                      | Revoke a token                        |

### 1.5 Web UI

- CI Tokens table in project settings
- Create token modal with scope selection
- Environment scope selector
- Expiration date picker
- Token copy with one-click
- Last used tracking
- Revoke action with confirmation

---

## 2. User Stories

### US-01: Create Token with Scopes

**Como** project admin  
**Quero** criar um CI token com scope `read:secrets` apenas  
**Para** dar acesso de leitura para um serviço de monitoramento

### US-02: Restrict to Environment

**Como** security engineer  
**Quero** limitar tokens a environments específicos  
**Para** garantir que tokens de staging não acessam produção

### US-03: Track Token Usage

**Como** DevOps  
**Quero** ver quando cada token foi usado por último  
**Para** identificar tokens órfãos e fazer cleanup

### US-04: CI Login Flow

**Como** developer  
**Quero** fazer login via CI token na CLI  
**Para** automatizar scripts sem browser interaction

---

## 3. Acceptance Criteria

### AC-01: Token Scopes

- [ ] CIToken model has `scopes` JSONB field
- [ ] CIToken model has `environment_scope` field
- [ ] Scope validation on API requests
- [ ] Invalid scope returns 403 Forbidden

### AC-02: Environment Scoping

- [ ] Token with `environment_scope: "production"` can only access production secrets
- [ ] Token with `environment_scope: null` can access all environments
- [ ] Access denied returns 403 with clear message

### AC-03: Token CRUD

- [ ] Can create token with name and scopes
- [ ] Can list all tokens for project (without revealing token value)
- [ ] Can revoke token (soft delete)
- [ ] Token revocation immediately invalidates sessions

### AC-04: CLI ci-login

- [ ] `criptenv ci-login --token ci_xxx` saves session locally
- [ ] Session stored in vault with metadata (project, scopes, expires)
- [ ] Subsequent commands use CI session automatically
- [ ] `criptenv ci-secrets --env production` shows secrets in CI context

### AC-05: CLI ci-deploy

- [ ] `criptenv ci-deploy --env production` pushes local secrets to cloud
- [ ] Supports `--provider` flag for direct provider sync
- [ ] Shows confirmation before destructive operations

### AC-06: Web Token Management

- [ ] Token list in project settings page
- [ ] Create token modal with scope checkboxes
- [ ] Environment selector (optional restriction)
- [ ] Expiration date picker
- [ ] Copy token button (one-time reveal)
- [ ] Revoke button with confirmation dialog

### AC-07: Audit Trail

- [ ] All token operations logged to audit
- [ ] Token used actions logged with last_used_at update
- [ ] Audit shows which token accessed which environment

---

## 4. Dependencies

### Internal

- `apps/api/app/models/member.py` — Modify: add scopes, environment_scope
- `apps/api/app/schemas/member.py` — Modify: add scope validation
- `apps/api/app/middleware/ci_auth.py` — Modify: scope validation logic
- `apps/cli/src/criptenv/commands/ci.py` — **CREATE**
- `apps/web/src/app/(dashboard)/projects/[id]/settings/page.tsx` — Modify: add token tab

### External

- None

---

## 5. Constraints

### Security

- Tokens are hashed before storage (SHA-256)
- Plaintext token shown only once on creation
- Session tokens expire after 1 hour
- Rate limiting: 100 req/min per token

### Data Model

```python
# Modifications to CIToken model
class CIToken(Base):
    __tablename__ = "ci_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    token_hash = Column(String(255), nullable=False, unique=True)

    # NEW FIELDS
    scopes = Column(JSONB, default=["read:secrets"])  # List of scope strings
    environment_scope = Column(String(255), nullable=True)  # null = all, or specific env

    last_used_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    project = relationship("Project", back_populates="ci_tokens")
```

### Schema Validation

```python
# New CITokenCreateWithScopes schema
class CITokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    expires_at: Optional[datetime] = None
    scopes: list[str] = Field(default=["read:secrets"])
    environment_scope: Optional[str] = Field(
        None,
        pattern=r'^[a-z0-9-]+$',  # kebab-case env names only
        description="Restrict token to specific environment"
    )

class CITokenResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    scopes: list[str]
    environment_scope: Optional[str]
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    revoked_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
```

---

## 6. CLI Implementation

### ci-login

```python
@clicommand.group()
def ci():
    """CI/CD integration commands."""
    pass

@ci.command("login")
@click.option("--token", required=True, help="CI token from CriptEnv")
@click.option("--project", help="Project ID (optional, uses default)")
def ci_login(token: str, project: Optional[str]):
    """Login with CI token.

    Stores session in local vault with metadata:
    - project_id
    - scopes
    - expires_at
    - created_at
    """
    # 1. Validate token via API
    # 2. Store session in vault
    # 3. Set as active CI session
```

### ci-secrets

```python
@ci.command("secrets")
@click.option("--env", "environment", required=True, help="Environment name")
def ci_secrets(environment: str):
    """List secrets available in CI context.

    Uses stored CI session to fetch secrets.
    Shows key names only (not values) for security.
    """
    # 1. Load CI session from vault
    # 2. Validate session not expired
    # 3. Fetch secrets from API
    # 4. Display key names and versions
```

### ci-deploy

```python
@ci.command("deploy")
@click.option("--env", "environment", required=True)
@click.option("--provider", help="Sync to provider after push")
def ci_deploy(environment: str, provider: Optional[str]):
    """Deploy local secrets to cloud.

    Pushes local vault secrets to CriptEnv cloud,
    then optionally syncs to connected providers.
    """
    # 1. Load CI session
    # 2. Get local changes since last push
    # 3. Push to API
    # 4. If provider specified, trigger sync
```

---

**Document Version**: 1.0  
**Created**: 2026-04-30  
**Status**: SPEC — Pending Review  
**Milestone**: M3.3  
**Dependencies**: M3.1 (GitHub Action)
