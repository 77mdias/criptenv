# Next Tasks — CriptEnv

## Prioridade Alta

### TASK-051 — Completar ExpirationBadge Web Integration

**Objetivo:** Integrar badge de expiração na interface web de secrets

**Arquivos prováveis:**
- `apps/web/src/components/shared/expiration-badge.tsx`
- `apps/web/src/app/(dashboard)/projects/[id]/secrets/page.tsx`

**Critério de aceite:**
- [ ] ExpirationBadge aparece na tabela de secrets
- [ ] Cores corretas: verde (fresco), amarelo (aviso), vermelho (breve), expirado
- [ ] Click no badge abre modal de rotação
- [ ] API endpoint retorna dados de expiração corretos

**Dependências:** RotationService ✅ (implementado)

---

### TASK-052 — Resolver CR-01: Session Token em Response Body

**Objetivo:** Remover session token do response body de auth endpoints

**Arquivos prováveis:**
- `apps/api/app/routers/auth.py`

**Critério de aceite:**
- [ ] signup response não inclui token
- [ ] signin response não inclui token
- [ ] Cookie HTTP-only é configurado corretamente
- [ ] Tests existentes passam

**Dependências:** Nenhuma

---

### TASK-053 — Resolver CR-02: Token em localStorage

**Objetivo:** Mover token storage do localStorage para HTTP-only cookies

**Arquivos prováveis:**
- `apps/web/src/stores/auth.ts`
- `apps/web/src/hooks/use-auth.ts`

**Critério de aceite:**
- [ ] Token não está mais em localStorage
- [ ] Token vem via HTTP-only cookie
- [ ] Auth funciona em múltiplas abas
- [ ] Refresh token funciona corretamente

**Dependências:** TASK-052 (CR-01)

---

### TASK-054 — Criar IntegrationProvider Interface

**Objetivo:** Criar interface base para cloud provider integrations

**Arquivos prováveis:**
- `apps/api/app/strategies/integrations/base.py`

**Critério de aceite:**
- [ ] Interface IntegrationProvider definida
- [ ] Métodos: push_secrets, pull_secrets, validate_connection, get_provider_name
- [ ] ABC comabstractmethod decorator
- [ ] Tests para interface

**Dependências:** Nenhuma

---

### TASK-055 — Implementar VercelProvider

**Objetivo:** Implementar integração com Vercel API

**Arquivos prováveis:**
- `apps/api/app/strategies/integrations/vercel.py`
- `apps/api/app/models/integration.py`

**Critério de aceite:**
- [ ] VercelProvider implementa IntegrationProvider
- [ ] push_secrets envia para Vercel API
- [ ] pull_secrets busca de Vercel API
- [ ] validate_connection testa conexão
- [ ] Unit tests passando

**Dependências:** TASK-054 (Interface)

---

## Prioridade Média

### TASK-056 — Implementar Rate Limiting

**Objetivo:** Criar middleware de rate limiting para API pública

**Arquivos prováveis:**
- `apps/api/app/middleware/rate_limit.py`

**Critério de aceite:**
- [ ] Middleware implementado
- [ ] Limites por tipo de autenticação (auth: 5/min, API key: 100/min, CI: 200/min)
- [ ] Response 429 quando exceder
- [ ] Tests passando

**Dependências:** TASK-052, TASK-053 (Security issues)

---

### TASK-057 — Criar IntegrationService

**Objetivo:** Serviço que gerencia integrações e seleciona provider correto

**Arquivos prováveis:**
- `apps/api/app/services/integration_service.py`

**Critério de aceite:**
- [ ] Service cria Integration record
- [ ] Seleciona provider correto baseado no tipo
- [ ] Executa push/pull via provider
- [ ] Atualiza last_sync_at

**Dependências:** TASK-055 (VercelProvider)

---

### TASK-058 — CLI ci-login Command

**Objetivo:** Comando para login com CI token

**Arquivos prováveis:**
- `apps/cli/src/criptenv/commands/ci.py`

**Critério de aceite:**
- [ ] `criptenv ci-login --token ci_xxxxx` funciona
- [ ] Salva CI session no vault local
- [ ] Separate from user session

**Dependências:** TASK-052 (CR-01 resolution)

---

### TASK-059 — CLI ci-deploy Command

**Objetivo:** Comando para deploy com secrets

**Arquivos prováveis:**
- `apps/cli/src/criptenv/commands/ci.py`

**Critério de aceite:**
- [ ] `criptenv ci-deploy --env production --provider vercel` funciona
- [ ] Push secrets e sync com provider
- [ ] Reporta status de sync

**Dependências:** TASK-058, TASK-057

---

### TASK-060 — CLI ci-secrets Command

**Objetivo:** Listar secrets disponíveis no contexto CI

**Arquivos prováveis:**
- `apps/cli/src/criptenv/commands/ci.py`

**Critério de aceite:**
- [ ] `criptenv ci-secrets --env production` lista secrets
- [ ] Filtra por permissões do CI token
- [ ] Output formatado

**Dependências:** TASK-058

---

## Prioridade Baixa

### TASK-061 — RailwayProvider

**Objetivo:** Implementar integração com Railway API

**Dependências:** TASK-054, TASK-057

---

### TASK-062 — RenderProvider

**Objetivo:** Implementar integração com Render API

**Dependências:** TASK-054, TASK-057

---

### TASK-063 — Web Alert Configuration UI

**Objetivo:** Página de configuração de alertas por projeto

**Arquivos prováveis:**
- `apps/web/src/app/(dashboard)/projects/[id]/settings/page.tsx`

**Dependências:** TASK-051

---

### TASK-064 — Publish GitHub Action to Marketplace

**Objetivo:** Publicar action no GitHub Marketplace

**Dependências:** M3.1 completo (implementado ✅, publishing pending)

---

### TASK-065 — Email Notifications

**Objetivo:** Implementar notificações por email para expirações

**Dependências:** TASK-051

---

## Task History Reference

Tarefas completadas são registradas em `docs/tasks/task-history.md`.

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01