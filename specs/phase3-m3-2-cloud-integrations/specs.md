# Specifications — M3.2: Cloud Integrations (Vercel, Railway, Render)

## Overview

Criar sistema de integrações com provedores de nuvem (Vercel, Railway, Render) que permite sync automático de secrets e configuração simplificada via CLI e Web dashboard.

---

## 1. Funcionalidades

### 1.1 Integration Provider Interface

- Strategy pattern para abstrair provedores
- Métodos: `push_secrets()`, `pull_secrets()`, `validate_connection()`
- Provider-specific configuration (tokens, project IDs, etc.)

### 1.2 Supported Providers

| Provider | Priority | API Endpoint                           | Auth              |
| -------- | -------- | -------------------------------------- | ----------------- |
| Vercel   | P0       | `api.vercel.com/v10/projects/{id}/env` | Vercel API Token  |
| Railway  | P1       | `backboard.railway.app/api/v2`         | Railway API Token |
| Render   | P1       | `api.render.com/v1`                    | Render API Token  |

### 1.3 Integration Management

- Create, list, update, delete integrations
- Connection validation on create and periodically
- Sync status tracking (last_sync_at, sync_errors)
- Environment-specific mapping (production → production env)

### 1.4 Sync Operations

- Manual sync via CLI and Web
- Push secrets TO provider (criptenv → provider)
- Pull secrets FROM provider (provider → criptenv)
- Conflict resolution: last-write-wins with version tracking

### 1.5 CLI Commands

| Command                                                        | Description                     |
| -------------------------------------------------------------- | ------------------------------- |
| `criptenv integrations list`                                   | List all connected integrations |
| `criptenv integrations connect <provider>`                     | Connect new provider            |
| `criptenv integrations disconnect <id>`                        | Disconnect provider             |
| `criptenv integrations sync --provider <provider> --env <env>` | Sync secrets                    |
| `criptenv vercel link`                                         | Link Vercel project             |
| `criptenv railway link`                                        | Link Railway project            |

### 1.6 Web Dashboard

- Grid/List view de integrações por projeto
- Status indicators (active, disconnected, error)
- Connect/disconnect flows com OAuth/API token
- Sync history and logs

---

## 2. User Stories

### US-01: Connect Vercel

**Como** DevOps engineer  
**Quero** conectar meu projeto Vercel ao CriptEnv  
**Para** manter secrets sincronizados automáticamente

### US-02: Sync Secrets

**Como** developer  
**Quero** fazer sync dos secrets para Vercel  
**Para** deploys usarem valores atualizados

### US-03: View Sync Status

**Como** developer  
**Quero** ver status das integrações  
**Para** saber se tudo está funcionando

### US-04: Disconnect Integration

**Como** admin  
**Quero** desconectar um provider  
**Para** remover acesso quando não precisar mais

---

## 3. Acceptance Criteria

### AC-01: Vercel Integration

- [ ] Can connect with Vercel API token
- [ ] Can push secrets to Vercel environment variables
- [ ] Can pull current secrets from Vercel
- [ ] Connection validation works

### AC-02: Railway Integration

- [ ] Can connect with Railway API token
- [ ] Can push secrets to Railway variables
- [ ] Can pull current secrets from Railway

### AC-03: Render Integration

- [ ] Can connect with Render API token
- [ ] Can push secrets to Render environment groups
- [ ] Can pull current secrets from Render

### AC-04: CLI Commands

- [ ] `integrations list` shows all integrations
- [ ] `integrations connect vercel` starts OAuth/token flow
- [ ] `integrations sync` pushes secrets to provider

### AC-05: Web Dashboard

- [ ] Shows all integrations per project
- [ ] Status indicators are accurate
- [ ] Can connect/disconnect from UI
- [ ] Sync history is visible

### AC-06: Error Handling

- [ ] Invalid API token shows clear error
- [ ] Network failures are retried with backoff
- [ ] Partial sync failures don't corrupt existing config

---

## 4. Dependencies

### Internal

- `apps/api/app/strategies/integrations/base.py` — **NOVO**
- `apps/api/app/strategies/integrations/vercel.py` — **NOVO**
- `apps/api/app/strategies/integrations/railway.py` — **NOVO**
- `apps/api/app/strategies/integrations/render.py` — **NOVO**
- `apps/api/app/models/integration.py` — **NOVO**
- `apps/api/app/schemas/integration.py` — **NOVO**
- `apps/api/app/services/integration_service.py` — **NOVO**
- `apps/api/app/routers/integrations.py` — **NOVO**

### External

- Vercel REST API v10
- Railway REST API v2
- Render REST API v1

---

## 5. Constraints

### Security

- API tokens are encrypted at rest
- No plaintext secrets in logs
- Rate limiting per provider

### Performance

- Sync should complete in < 30 seconds
- Batch operations for multiple secrets
- Connection timeout: 10 seconds

### Rate Limits

- Vercel: 100 req/hour per token
- Railway: 200 req/hour per token
- Render: 60 req/hour per token

---

## 6. Technical Design

### Integration Model

```python
class Integration(Base):
    __tablename__ = "integrations"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID, ForeignKey("projects.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # vercel, railway, render
    name = Column(String(255), nullable=False)
    config = Column(JSONB, nullable=False)  # encrypted provider config
    status = Column(String(20), default="active")  # active, disconnected, error
    last_sync_at = Column(DateTime)
    last_error = Column(String(1000))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
```

### Provider Interface

```python
from abc import ABC, abstractmethod
from typing import Optional

class IntegrationProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return provider identifier."""
        ...

    @property
    @abstractmethod
    def api_base_url(self) -> str:
        """Return provider API base URL."""
        ...

    @abstractmethod
    async def push_secrets(
        self,
        secrets: list[dict],  # [{key, value, version}]
        config: dict,  # provider-specific config
        environment: str
    ) -> bool:
        """Push secrets to provider. Returns True on success."""
        ...

    @abstractmethod
    async def pull_secrets(
        self,
        config: dict,
        environment: str
    ) -> list[dict]:
        """Pull secrets from provider. Returns list of secrets."""
        ...

    @abstractmethod
    async def validate_connection(self, config: dict) -> bool:
        """Validate connection to provider."""
        ...

    @abstractmethod
    async def get_environments(self, config: dict) -> list[str]:
        """List available environments in provider."""
        ...
```

### Vercel Implementation

```python
class VercelProvider(IntegrationProvider):
    provider_name = "vercel"
    api_base_url = "https://api.vercel.com/v10"

    async def push_secrets(
        self,
        secrets: list[dict],
        config: dict,
        environment: str
    ) -> bool:
        token = config["api_token"]
        project_id = config["project_id"]

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        for secret in secrets:
            payload = {
                "key": secret["key"],
                "value": secret["value"],
                "type": "encrypted" if secret.get("encrypted") else "plain",
                "environment": environment  # production, preview, development
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base_url}/projects/{project_id}/env",
                    headers=headers,
                    json=payload
                )

                if response.status_code not in (200, 201):
                    return False

        return True

    async def pull_secrets(self, config: dict, environment: str) -> list[dict]:
        token = config["api_token"]
        project_id = config["project_id"]

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/projects/{project_id}/env",
                headers={"Authorization": f"Bearer {token}"},
                params={"environment": environment}
            )

            if response.status_code != 200:
                return []

            data = response.json()
            return [
                {"key": env["key"], "value": env["value"]}
                for env in data.get("envs", [])
            ]

    async def validate_connection(self, config: dict) -> bool:
        token = config["api_token"]

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/user",
                headers={"Authorization": f"Bearer {token}"}
            )

            return response.status_code == 200

    async def get_environments(self, config: dict) -> list[str]:
        return ["production", "preview", "development"]
```

---

**Document Version**: 1.0  
**Created**: 2026-04-30  
**Status**: SPEC — Pending Review  
**Milestone**: M3.2  
**Dependencies**: M3.1 (GitHub Action)
