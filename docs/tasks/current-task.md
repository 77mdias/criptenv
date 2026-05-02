# Current Task — CriptEnv

## Status atual

**Phase 3 (CI/CD Integrations) em andamento.** A API de rotação de secrets foi implementada (RotationService, RotationRouter), os comandos CLI de rotação foram implementados (rotate, expire, alert, rotation list), o GitHub Action foi implementado, e o ExpirationChecker com WebhookService estão prontos. Agora é necessário completar a integração web da ExpirationBadge e avançar para as integrações com cloud providers.

---

## Tarefa em foco

**M3.5: Completar integração do ExpirationBadge na interface web**

A interface web precisa mostrar badges de expiração nos secrets. O componente ExpirationBadge já existe parcialmente mas precisa ser integrado na tabela de secrets.

---

## Contexto

Phase 3 está em progresso. As seguintes funcionalidades já foram implementadas:

**API:**
- ✅ SecretExpiration model
- ✅ RotationService
- ✅ RotationRouter (POST /rotate, GET /rotation, GET /secrets/expiring)
- ✅ WebhookService
- ✅ ExpirationChecker background job

**CLI:**
- ✅ `criptenv rotate` command
- ✅ `criptenv secrets expire` command
- ✅ `criptenv secrets alert` command
- ✅ `criptenv rotation list` command

**GitHub Action:**
- ✅ action.yml
- ✅ src/index.ts

A próxima etapa é completar a UI web para expiração de secrets.

---

## Arquivos relacionados

**Para integração do ExpirationBadge:**
- `apps/web/src/components/shared/expiration-badge.tsx` (verificar se existe)
- `apps/web/src/app/(dashboard)/projects/[id]/secrets/page.tsx`
- `apps/api/app/routers/rotation.py`
- `apps/api/app/models/secret_expiration.py`

**Para segurança (CR-01, CR-02):**
- `apps/api/app/routers/auth.py`
- `apps/api/app/middleware/auth.py`
- `apps/web/src/stores/auth.ts`

**Para Vercel integration (próximo passo):**
- `apps/api/app/strategies/integrations/base.py` (criar interface)
- `apps/api/app/strategies/integrations/vercel.py` (criar provider)
- `apps/api/app/services/integration_service.py` (criar serviço)

---

## Próximos passos recomendados

1. **Completar ExpirationBadge web integration**
   - Verificar se componente existe
   - Integrar na secrets table
   - Adicionar colors (green/yellow/red/expired)
   - Adicionar roation modal trigger

2. **Resolver security issues (CR-01, CR-02)**
   - Remover token do response body em auth.py
   - Mover token storage para HTTP-only cookies

3. **Iniciar Vercel integration**
   - Criar IntegrationProvider interface
   - Implementar VercelProvider
   - Criar IntegrationService

4. **Implementar rate limiting**
   - Criar middleware de rate limiting
   - Configurar limites por endpoint type

---

## Bloqueios

- Nenhum identificado no momento

---

## Observações para o próximo agente

**IMPORTANTE:** 
1. Leia `docs/index.md` antes de começar qualquer trabalho
2. Leia `docs/project/current-state.md` para entender o estado atual
3. Leia `docs/features/in-progress.md` para ver o que está em progresso
4. A feature de rotação CLI/API está implementada — o gap está na integração web
5. Security issues (CR-01, CR-02) são prioridade P0 antes de lançar API pública
6. Para integrações cloud, use o Strategy pattern já estabelecido em `strategies/integrations/`

**Estado dos testes:**
- CLI rotation tests: 33+ tests passing
- API rotation tests: passing
- Webhook service tests: passing
- Tests para CI auth, tokens, etc: passing

**Para não perder contexto:**
- O Phase 3 está documentado em `plans/phase3-cicd-integrations.md`
- O Roadmap está em `roadmap/README.md`
- Histórico de mudanças em `docs/development/CHANGELOG.md`

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01  
**Status**: Active Development — Phase 3