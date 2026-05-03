# Next Tasks — CriptEnv

## Prioridade Alta

### TASK-066 — Resolver CR-01: Session Token em Response Body

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

### TASK-067 — Resolver CR-02: Token em localStorage

**Objetivo:** Mover token storage do localStorage para HTTP-only cookies

**Arquivos prováveis:**
- `apps/web/src/stores/auth.ts`
- `apps/web/src/hooks/use-auth.ts`

**Critério de aceite:**
- [ ] Token não está mais em localStorage
- [ ] Token vem via HTTP-only cookie
- [ ] Auth funciona em múltiplas abas
- [ ] Refresh token funciona corretamente

**Dependências:** TASK-066 (CR-01)

---

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

## Prioridade Média

### TASK-061 — Implementar RailwayProvider

**Objetivo:** Implementar integração com Railway API

**Arquivos prováveis:**
- `apps/api/app/strategies/integrations/railway.py`
- `apps/api/tests/test_integration_providers.py`

**Critério de aceite:**
- [ ] RailwayProvider implementa IntegrationProvider
- [ ] push_secrets envia para Railway API
- [ ] pull_secrets busca de Railway API
- [ ] validate_connection testa conexão
- [ ] Unit tests passando

**Dependências:** VercelProvider/RenderProvider pattern ✅ (reference implementation exists)

---

### TASK-068 — Criptografar Integration Config At-Rest

**Objetivo:** Criptografar tokens de API de integrações no banco de dados

**Arquivos prováveis:**
- `apps/api/app/models/integration.py`
- `apps/api/app/services/integration_service.py`

**Critério de aceite:**
- [ ] Campo `config` criptografado com AES-256-GCM
- [ ] Chave de criptografia derivada de `SECRET_KEY`
- [ ] Validação de conexão ainda funciona após criptografia
- [ ] Migration para dados existentes (se houver)

**Dependências:** Nenhuma

---

## Prioridade Baixa

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

**Document Version**: 1.1  
**Last Updated**: 2026-05-03
