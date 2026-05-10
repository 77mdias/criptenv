# Next Tasks — CriptEnv

## Completed Since Last Update ✅

### TASK-066 — Resolver CR-01: Session Token em Response Body ✅

**Status:** Completed 2026-05-03  
**Resolution:** `AuthResponse` no longer includes `token` in JSON body. Session delivered exclusively via HTTP-only `session_token` cookie (`httponly=True`, `secure=True`, `samesite="lax"`). CLI extracts token from `Set-Cookie` header.  
**Files modified:** `apps/api/app/routers/auth.py`, `apps/cli/src/criptenv/commands/login.py`  
**Tests:** All auth tests passing

### TASK-067 — Resolver CR-02: Token em localStorage ✅

**Status:** Completed 2026-05-03  
**Resolution:** `useAuthStore` (Zustand) no longer persists to localStorage. Session verified via HTTP-only cookie on app init. Multi-tab auth works via cookie sharing.  
**Files modified:** `apps/web/src/stores/auth.ts`, `apps/web/src/hooks/use-auth.ts`  
**Tests:** Manual verification

### TASK-051 — Completar ExpirationBadge Web Integration ✅

**Status:** Completed 2026-05-03  
**Resolution:** `ExpirationBadge` fully integrated into secrets table. Fetches `/api/v1/projects/{id}/secrets/expiring?include_expired=true`, maps expiration data per secret row, displays green/yellow/red/expired badges.  
**Files modified:** `apps/web/src/components/shared/expiration-badge.tsx`, `apps/web/src/app/(dashboard)/projects/[id]/secrets/page.tsx`  
**Tests:** Manual verification

### TASK-070 — Executar migração VPS Backend ✅

**Status:** Completed 2026-05-06
**Resolution:** API migrada para VPS Docker com Cloudflare Tunnel (`criptenv-api.77mdevseven.tech`), Redis rate limiting, scheduler dedicado e frontend Cloudflare Workers usando proxy `/api/*`.
**Files modified:** `deploy/vps/docker-compose.yml`, `apps/api/Dockerfile`, `apps/api/app/middleware/rate_limit.py`, `apps/api/main.py`, deployment docs
**Tests:** API/CLI/Web build locais passaram; smoke tests públicos `https://criptenv-api.77mdevseven.tech/health`, `https://criptenv-api.77mdevseven.tech/api/health` e `https://criptenv.77mdevseven.tech/api/health` validados manualmente.

### TASK-068 — Criptografar Integration Config At-Rest ✅

**Status:** Completed 2026-05-06
**Resolution:** `integrations.config` agora é salvo em envelope JSONB criptografado com AES-256-GCM e chave dedicada `INTEGRATION_CONFIG_SECRET`; configs plaintext legadas são recriptografadas por migration ou primeiro acesso.
**Files modified:** `apps/api/app/crypto/integration_config.py`, `apps/api/app/services/integration_service.py`, `apps/api/migrations/versions/20260506_0003_encrypt_integration_configs.py`, env examples, docs
**Tests:** Cobertura adicionada para roundtrip, ausência de plaintext no envelope, chave errada, compatibilidade legacy, provider decrypt flow e erro claro sem secret.

---

## Prioridade Alta

### TASK-061 — Implementar RailwayProvider

**Objetivo:** Implementar integração com Railway API seguindo o padrão RenderProvider

**Complexidade:** Média (provider pattern já estabelecido)  
**Tempo estimado:** 2-3 horas

#### Arquivos

- `apps/api/app/strategies/integrations/railway.py` (novo)
- `apps/api/app/strategies/integrations/__init__.py` (registrar)
- `apps/api/tests/test_integration_providers.py` (adicionar testes)

#### Especificação de Implementação

```python
class RailwayProvider(IntegrationProvider):
    @property
    def name(self) -> str:
        return "railway"
    
    @property
    def display_name(self) -> str:
        return "Railway"
    
    async def validate_connection(self, config: dict) -> bool:
        # Testa Railway API token chamando /graphql ou REST
        # Config esperado: {"api_token": "...", "project_id": "..."}
        pass
    
    async def push_secrets(
        self, config: dict, secrets: dict, env: str = "production"
    ) -> bool:
        # Railway GraphQL: mutation variableUpsert
        # Endpoint: https://backboard.railway.app/graphql/v2
        pass
    
    async def pull_secrets(
        self, config: dict, env: str = "production"
    ) -> dict:
        # Railway GraphQL: query variables
        pass
```

#### Critério de aceite

- [ ] `RailwayProvider` implementa `IntegrationProvider`
- [ ] `push_secrets` envia para Railway API via GraphQL
- [ ] `pull_secrets` busca de Railway API
- [ ] `validate_connection` testa conexão com token válido
- [ ] Registrado no `__init__.py` de strategies
- [ ] Unit tests passando (mínimo 6, seguindo padrão RenderProvider)

**Dependências:** VercelProvider/RenderProvider pattern ✅

---

## Prioridade Média

### TASK-063 — Web Alert Configuration UI

**Objetivo:** Página de configuração de alertas por projeto

**Complexidade:** Média  
**Tempo estimado:** 2-3 horas

#### Arquivos

- `apps/web/src/app/(dashboard)/projects/[id]/settings/page.tsx` (adicionar seção)
- `apps/web/src/lib/api/alerts.ts` (novo — API client para alertas)
- `apps/api/app/routers/rotation.py` (verificar/adicionar endpoints se necessário)

#### Especificação de Implementação

1. **Seção em Settings:** "Notification Preferences"
   - Webhook URL input
   - Notify days before expiration (select: 1, 3, 7, 14, 30 dias)
   - Toggle enable/disable notifications
2. **API:** Usar endpoints existentes de `/api/v1/projects/{id}/rotation` ou criar `/api/v1/projects/{id}/alert-config`
3. **Schema:** `{ webhook_url: string | null, notify_days_before: number, enabled: boolean }`

#### Critério de aceite

- [ ] UI mostra configuração atual
- [ ] Salvar atualiza webhook URL e dias de notificação
- [ ] Validação de URL
- [ ] Feedback visual (toast) de sucesso/erro

**Dependências:** TASK-051 ✅

---

### TASK-064 — Publish GitHub Action to Marketplace

**Objetivo:** Publicar action no GitHub Marketplace

**Complexidade:** Baixa (processo de publicação)  
**Tempo estimado:** 1 hora

#### Arquivos

- `packages/github-action/README.md` (criar)
- `packages/github-action/action.yml` (verificar metadata)
- GitHub release/tag

#### Checklist de Publicação

1. [ ] Escrever README com:
   - Descrição do que a action faz
   - Exemplo de workflow YAML
   - Inputs (`api-url`, `ci-token`, `project-id`, `environment`)
   - Outputs (`secrets-count`, `exported-secrets`)
2. [ ] Verificar `action.yml` — name, description, author, branding (icon + color)
3. [ ] Garantir que `dist/index.js` está compilado e commitado
4. [ ] Criar tag `v1.0.0` no repositório
5. [ ] Publicar release no GitHub
6. [ ] Submeter para GitHub Marketplace review

#### Critério de aceite

- [ ] Action publicada no GitHub Marketplace
- [ ] README completo com exemplos
- [ ] Tag `v1.0.0` criada

**Dependências:** M3.1 completo ✅

---

### TASK-065 — Email Notifications

**Objetivo:** Implementar notificações por email para expirações

**Complexidade:** Média  
**Tempo estimado:** 3-4 horas

#### Arquivos

- `apps/api/app/services/email_service.py` (novo)
- `apps/api/app/services/notification_service.py` (extender)
- `apps/api/app/jobs/expiration_check.py` (integrar)
- `apps/api/.env` (adicionar SMTP config)

#### Especificação de Implementação

1. **EmailChannel:** Implementação de `NotificationChannel` (mesma interface que `WebhookChannel`)
2. **SMTP Config:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
3. **Template básico:** HTML simples com nome do secret, dias até expiração, link para dashboard
4. **Integração:** `ExpirationChecker` verifica se usuário tem email configurado e envia via `EmailChannel`

```python
class EmailChannel(NotificationChannel):
    async def send(self, recipient: str, payload: dict) -> bool:
        # Envia email via aiosmtplib
        pass
```

#### Critério de aceite

- [ ] Email enviado quando secret está próximo de expirar
- [ ] Template HTML funcional
- [ ] Configuração via environment variables
- [ ] Testes unitários para EmailChannel

**Dependências:** TASK-051 ✅, M3.5 ✅

---

## Prioridade Baixa

### TASK-069 — Slack Webhook Integration

**Objetivo:** Notificações via Slack com botão "Rotate Now"

**Complexidade:** Média  
**Tempo estimado:** 2-3 horas

#### Arquivos

- `apps/api/app/services/slack_channel.py` (novo)
- `apps/api/app/routers/webhooks.py` (novo — handler para Slack interactive)

**Dependências:** TASK-065

---

### TASK-070 — Auto-Rotation Policy

**Objetivo:** Rotação automática de secrets em schedule

**Complexidade:** Alta  
**Tempo estimado:** 4-6 horas

#### Arquivos

- `apps/api/app/services/rotation_service.py` (extender)
- `apps/api/app/jobs/auto_rotation.py` (novo)
- `apps/api/app/models/secret_expiration.py` (adicionar auto_rotate flag)

**Dependências:** M3.5 ✅

---

## Recommended Execution Order

```
1. TASK-061 (RailwayProvider) — Close M3.2 milestone
2. TASK-063 (Web Alert Configuration UI) — Close M3.5 web gap
3. TASK-064 (GitHub Action Publishing) — Marketing/DevEx win
4. TASK-065 (Email Notifications) — Complete notification system
5. TASK-069 (Slack) — Nice to have
6. TASK-070 (Auto-Rotation) — Future milestone
```

---

## Task History Reference

Tarefas completadas são registradas em `docs/tasks/task-history.md`.

---

**Document Version**: 1.3
**Last Updated**: 2026-05-06
