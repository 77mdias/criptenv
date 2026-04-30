# Specifications — M3.1: GitHub Action for CI/CD

## Overview

Criar a GitHub Action oficial `@criptenv/action` que permite workflows de CI/CD puxarem secrets do CriptEnv de forma segura usando CI tokens. A action deve injetar secrets como variáveis de ambiente no runner.

---

## 1. Funcionalidades

### 1.1 CI Token Authentication

- Login via CI token (`ci_xxxxx`) retornando session token temporário (1 hora)
- Validação de token com update de `last_used_at`
- Validação de `expires_at` (se definido)
- Scopes limitados: `read:secrets` obrigatório

### 1.2 Secrets Retrieval

- Endpoint para buscar secrets por environment
- Retorno de blobs encriptados com metadados
- Versionamento de secrets (optimistic locking)
- Formato compatível com decryption client-side

### 1.3 GitHub Action Inputs/Outputs

| Input         | Tipo   | Obrigatório | Default      | Descrição            |
| ------------- | ------ | ----------- | ------------ | -------------------- |
| `token`       | string | ✅          | —            | CI token do CriptEnv |
| `project`     | string | ✅          | —            | Project ID           |
| `environment` | string | ❌          | `production` | Environment name     |
| `api-url`     | string | ❌          | API padrão   | URL base da API      |

| Output          | Tipo   | Descrição                    |
| --------------- | ------ | ---------------------------- |
| `secrets-count` | number | Número de secrets carregados |
| `version`       | number | Versão dos secrets           |

### 1.4 Environment Variables

- Todos os secrets são exportados como `SECRET_<key_name>` (uppercase, normalized)
- Prefixo configurável via input `prefix` (default: `SECRET_`)
- Prefixo vazio significa sem prefixo

### 1.5 Error Handling

- Token inválido/expirado → falha com mensagem clara
- Projeto não encontrado → falha com mensagem clara
- Environment não encontrado → falha com mensagem clara
- Secrets não encontrados → warning, não falha
- Erro de rede → retry com backoff exponencial (3 tentativas)

---

## 2. User Stories

### US-01: CI Login

**Como** desenvolvedor de CI  
**Quero** fazer login com meu CI token  
**Para** obter uma session temporária e poder acessar secrets

### US-02: Pull Secrets

**Como** workflow de CI  
**Quero** puxar todos os secrets de um environment específico  
**Para** injetar como variáveis de ambiente no job

### US-03: Version Check

**Como** developer  
**Quero** saber qual versão dos secrets foi carregada  
**Para** debugging e audit trail

### US-04: Configuration

**Como** DevOps engineer  
**Quero** customizar o prefixo das variáveis  
**Para** compatibilidade com diferentes stacks

---

## 3. Acceptance Criteria

### AC-01: Authentication

- [ ] `criptenv ci-login --token ci_xxxxx` retorna session token válido
- [ ] Session expira em 1 hora
- [ ] `last_used_at` é atualizado no token
- [ ] Token expirado retorna erro 401

### AC-02: Secrets Endpoint

- [ ] `GET /api/v1/ci/secrets?environment=production` retorna blobs encriptados
- [ ] Response inclui `blobs[]` e `version`
- [ ] Environment não encontrado retorna 404

### AC-03: GitHub Action

- [ ] Action publica em `criptenv/action` no GitHub Marketplace
- [ ] Action aceita `token`, `project`, `environment`, `api-url` inputs
- [ ] Action exporta `secrets-count` e `version` outputs
- [ ] Secrets são injetados como `SECRET_*` no environment

### AC-04: Error Messages

- [ ] Mensagens de erro são claras e acionáveis
- [ ] Token expirado: "CI token has expired. Please generate a new token in project settings."
- [ ] Projeto não encontrado: "Project 'xyz' not found or you don't have access."
- [ ] Environment não encontrado: "Environment 'production' not found in project 'xyz'."

### AC-05: Testes

- [ ] Unit tests para CI auth middleware (100% coverage)
- [ ] Integration tests para secrets endpoint
- [ ] E2E tests para GitHub Action com mock server

---

## 4. Dependencies

### Internal

- `apps/api/app/middleware/auth.py` — existente, referência
- `apps/api/app/middleware/ci_auth.py` — **NOVO**
- `apps/api/app/routers/tokens.py` — existente, expandido
- `apps/api/app/routers/ci.py` — **NOVO**
- `apps/api/app/models/member.py` — CIToken existente
- `apps/api/app/schemas/member.py` — CIToken schemas existentes

### External

- GitHub Actions runtime (Node.js 20)
- @actions/core (para outputs)
- @actions/http-client (para requests)

---

## 5. Constraints

### Security

- CI tokens são stored como hash SHA-256 (já implementado)
- Session tokens são HttpOnly (futuro)
- Rate limiting: 200 req/min por CI token
- Não exponer plaintext secrets no log

### Performance

- Action deve completar em < 5 segundos (excluindo network)
- Retry com exponential backoff: 1s, 2s, 4s

### Compatibility

- GitHub Actions runtime: Node.js 20 LTS
- GitHub Enterprise Server 3.x+ compatible

### API Contract

```
POST /api/v1/auth/ci-login
Body: { "token": "ci_xxxxx", "project_id": "uuid" }
Response: {
  "session_token": "s_xxxxx",
  "expires_in": 3600,
  "project_id": "uuid",
  "permissions": ["read:secrets"]
}

GET /api/v1/ci/secrets
Headers: Authorization: Bearer <session_token>
Query: ?environment=production
Response: {
  "blobs": [
    {
      "id": "uuid",
      "key_id": "DATABASE_URL",
      "iv": "base64",
      "ciphertext": "base64",
      "auth_tag": "base64",
      "version": 5
    }
  ],
  "version": 5,
  "environment": "production"
}
```

---

## 6. Technical Design

### Files to Create/Modify

| File                                            | Action | Descrição                      |
| ----------------------------------------------- | ------ | ------------------------------ |
| `apps/api/app/middleware/ci_auth.py`            | CREATE | CI token validation middleware |
| `apps/api/app/routers/ci.py`                    | CREATE | CI secrets endpoints           |
| `apps/api/app/routers/auth.py`                  | MODIFY | Add ci-login endpoint          |
| `apps/api/app/routers/__init__.py`              | MODIFY | Export ci_router               |
| `packages/github-action/action.yml`             | CREATE | Action metadata                |
| `packages/github-action/package.json`           | CREATE | Dependencies                   |
| `packages/github-action/src/index.ts`           | CREATE | Action logic                   |
| `packages/github-action/tsconfig.json`          | CREATE | TypeScript config              |
| `packages/github-action/__tests__/main.test.ts` | CREATE | Unit tests                     |

### CI Auth Middleware Design

```python
# apps/api/app/middleware/ci_auth.py
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.member import CIToken
from app.database import async_session_factory

CIT_TOKEN_PREFIX = "ci_"
CI_SESSION_EXPIRE_SECONDS = 3600

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

async def validate_ci_token(token: str, project_id: UUID) -> CIToken:
    """Validate CI token and return CIToken if valid."""
    if not token.startswith(CIT_TOKEN_PREFIX):
        raise HTTPException(status_code=401, detail="Invalid token format")

    token_hash = hash_token(token)

    async with async_session_factory() as db:
        result = await db.execute(
            select(CIToken).where(
                CIToken.token_hash == token_hash,
                CIToken.project_id == project_id
            )
        )
        ci_token = result.scalar_one_or_none()

        if not ci_token:
            raise HTTPException(status_code=401, detail="Invalid CI token")

        # Check expiration
        if ci_token.expires_at and ci_token.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="CI token has expired")

        # Update last_used_at
        ci_token.last_used_at = datetime.now(timezone.utc)
        await db.commit()

        return ci_token

def create_ci_session(project_id: UUID, permissions: list[str]) -> tuple[str, datetime]:
    """Create temporary CI session token."""
    session_token = f"ci_s_{secrets.token_urlsafe(32)}"
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=CI_SESSION_EXPIRE_SECONDS)
    # Store session in cache/redis (future) or return token directly
    return session_token, expires_at
```

### GitHub Action Structure

```typescript
// packages/github-action/src/index.ts
import * as core from "@actions/core";
import * as httpClient from "@actions/http-client";

const API_URL = core.getInput("api-url") || "https://api.criptenv.com";

async function run() {
  const token = core.getInput("token", { required: true });
  const projectId = core.getInput("project", { required: true });
  const environment = core.getInput("environment") || "production";

  try {
    // Step 1: CI Login
    const loginResponse = await ciLogin(token, projectId);
    const sessionToken = loginResponse.session_token;

    // Step 2: Get Secrets
    const secrets = await getSecrets(sessionToken, projectId, environment);

    // Step 3: Export as environment variables
    const prefix = core.getInput("prefix") || "SECRET_";
    let count = 0;

    for (const blob of secrets.blobs) {
      const decrypted = await decryptBlob(blob);
      const varName = `${prefix}${normalizeKey(blob.key_id)}`;
      core.exportVariable(varName, decrypted);
      count++;
    }

    // Set outputs
    core.setOutput("secrets-count", count.toString());
    core.setOutput("version", secrets.version.toString());
  } catch (error) {
    core.setFailed(error.message);
  }
}
```

---

**Document Version**: 1.0  
**Created**: 2026-04-30  
**Status**: SPEC — Pending Review  
**Milestone**: M3.1  
**Dependencies**: M3.3 (CI Tokens Enhancement)
