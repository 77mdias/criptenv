# Task History — CriptEnv

## Overview

This file records completed tasks and major project milestones.

---

## 2026-05-08 — Blocking CI/Test/Security Gates

**Resumo:**
Adicionados gates de CI, E2E, segurança e Docker build, com correções de estabilidade para frontend cache/E2E, API route manifest, scheduler, CLI e GitHub Action.

**Arquivos criados:**
- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/security.yml`
- `.github/workflows/docker-build.yml`
- `.github/dependabot.yml`
- `apps/api/tests/test_backend_integration_db.py`
- `apps/cli/tests/test_integrations_commands.py`
- `apps/web/src/app/(auth)/signup/__tests__/page.test.tsx`
- `apps/web/src/__tests__/proxy.test.ts`
- `packages/github-action/jest.config.js`
- `packages/github-action/.eslintrc.cjs`
- `packages/github-action/src/__tests__/index.test.ts`
- `packages/github-action/dist/`

**Arquivos alterados:**
- `apps/web/src/lib/api/client.ts` — cache generation para evitar GET stale após mutation.
- `apps/api/app/routers/v1.py` — remove re-mount duplicado de routers já versionados.
- `apps/api/app/jobs/expiration_check.py`, `apps/api/app/jobs/scheduler.py`, `apps/api/main.py` — scheduler com sessão DB por execução.
- `apps/cli/src/criptenv/context.py`, `apps/cli/src/criptenv/commands/ci.py`, `apps/cli/src/criptenv/commands/integrations.py` — contexto async para CI deploy e erro claro para Railway pendente.
- `packages/github-action/src/index.ts` — funções exportadas e runner testável.

**Observações:**
- E2E e backend DB integration usam apenas banco local com `test` no nome.
- Security workflow é blocking e pode exigir triagem de advisory em dependências.

---

## 2026-05-07 — Frontend Test Suite With Local E2E Database

**Resumo:**
Adicionada suíte de testes frontend com Jest, React Testing Library e Cypress usando FastAPI + PostgreSQL local isolado para E2E.

**Arquivos criados:**
- `apps/web/jest.config.cjs`, `apps/web/jest.setup.ts`
- `apps/web/cypress.config.ts`, `apps/web/cypress/`
- `docker-compose.e2e.yml`
- `apps/api/scripts/reset_e2e_db.py`, `apps/api/scripts/run_e2e_api.py`
- `apps/api/.env.test.example`, `apps/web/.env.test.example`

**Verificação:**
- Unit/RTL: 41 passed ✅
- Cypress E2E: 4 passed ✅
- API tests: 292 passed ✅
- Web build: passed ✅
- Web lint: still blocked by pre-existing docs lint errors (`CodeBlock` missing and unescaped quotes) ⚠️

---

## 2026-05-06 — TASK-068 Integration Config Encryption

**Resumo:**
Criptografia at-rest para `integrations.config`, protegendo tokens de Vercel/Render com AES-256-GCM e chave dedicada `INTEGRATION_CONFIG_SECRET`.

**Arquivos criados:**
- `apps/api/app/crypto/__init__.py`
- `apps/api/app/crypto/integration_config.py`
- `apps/api/migrations/versions/20260506_0003_encrypt_integration_configs.py`
- `apps/api/tests/test_integration_config_encryption.py`

**Arquivos alterados:**
- `apps/api/app/config.py` — adiciona `INTEGRATION_CONFIG_SECRET`
- `apps/api/app/services/integration_service.py` — encrypt on create, decrypt on sync/validate, legacy re-encrypt
- `apps/api/tests/test_integration_providers.py` — cobertura service/provider decrypt flow
- `apps/api/.env.example`, `apps/api/.env.production.example`, `deploy/vps/.env.example` — nova env dedicada
- `docs/project/decisions.md` — DEC-017 Integration Config At-Rest Encryption
- `docs/project/current-state.md`, `docs/tasks/current-task.md`, `docs/tasks/next-tasks.md`, `docs/development/CHANGELOG.md`

**Verificação:**
- API tests: 292 passed ✅
- CLI tests: 130 passed ✅
- Web build: passed ✅
- Alembic history/heads: `20260506_0003` is the single head ✅

**Observações:**
- A migration não altera schema; `config` permanece JSONB com envelope criptografado.
- `INTEGRATION_CONFIG_SECRET` deve ser preservado em produção; perdê-lo torna configs de integração irrecuperáveis.

---

## 2026-05-06 — VPS Backend Migration Validated

**Resumo:**
Migração do backend de Render Free Tier para VPS Docker validada com DuckDNS, Nginx Proxy Manager, Redis rate limiting, Supabase externo e Cloudflare Workers proxy `/api/*`.

**Arquivos criados:**
- `.dockerignore`
- `apps/api/Dockerfile`
- `apps/api/.env.production.example`
- `deploy/vps/.env.example`
- `deploy/vps/README.md`
- `deploy/vps/docker-compose.yml`
- `docs/tasks/session-compact.md`

**Arquivos alterados:**
- `apps/api/app/middleware/rate_limit.py` — Redis-backed rate limit storage
- `apps/api/main.py` — config-driven rate limit storage and `/api/health` aliases
- `apps/api/tests/test_rate_limit.py` — Redis storage behavior coverage
- `apps/api/tests/test_openapi_docs.py` — Worker proxy health alias coverage
- `docs/project/decisions.md` — DEC-016 VPS Docker Backend Deployment
- `docs/technical/deployment-guide.md` e `docs/technical/deployment.md` — deployment stack atualizado
- `docs/project/current-state.md`, `docs/tasks/current-task.md`, `docs/tasks/next-tasks.md`, `docs/development/CHANGELOG.md`

**Verificação:**
- API tests: 282 passed ✅
- CLI tests: 130 passed ✅
- Web build: passed ✅
- Docker Compose config: valid ✅
- Production smoke:
  - `https://criptenv.duckdns.org/health` ✅
  - `https://criptenv.duckdns.org/api/health` ✅
  - `https://criptenv.jean-carlos3.workers.dev/api/health` ✅

**Observações:**
- Nginx Proxy Manager admin permanece privado em `127.0.0.1:81`; acesso recomendado via `ssh -L 8181:127.0.0.1:81 root@<VPS_IP>`.
- `NEXT_PUBLIC_API_URL` deve ficar vazio em produção; o Worker usa `API_URL=https://criptenv.duckdns.org`.
- Ainda falta validar fluxos de app completos: login/signup, OAuth, projetos e vault push/pull.

---

## 2026-05-05 — Floating Bar Docs Link

**Resumo:**
Adicionado link `Docs` no floating-bar da landing page e renderizado o floating-bar na página inicial de `/docs`, mantendo os links de seção com navegação suave quando a seção está presente e navegação por hash para a landing quando a seção não existe na rota atual.

**Arquivos alterados:**
- `apps/web/src/components/floating-bar/floating-bar.tsx`
- `apps/web/src/app/(docs)/layout.tsx`
- `docs/project/decisions.md`
- `docs/development/CHANGELOG.md`
- `docs/tasks/task-history.md`

**Observações:**
O item `Docs` fica por último e separado por uma linha visual; nas subrotas de docs, o floating-bar não é renderizado para evitar conflito visual com sidebar e TOC.

---

## 2026-05-05 — Docs Navbar Brand Alignment

**Resumo:**
Ajustada a navbar de `/docs` para ficar mais próxima da referência AbacatePay, usando o logo CriptEnv em black/white theme, linhas visuais limpas, link `Início` para `/`, CTA `Dashboard` compacto e abertura da busca por clique.

**Arquivos alterados:**
- `apps/web/src/app/(docs)/layout.tsx`
- `apps/web/src/app/(docs)/docs.css`
- `apps/web/src/components/docs/search-modal.tsx`
- `docs/project/decisions.md`
- `docs/development/CHANGELOG.md`
- `docs/tasks/task-history.md`

**Observações:**
O lint já falhava antes da alteração por erros preexistentes em páginas de docs; o erro relacionado ao `search-modal.tsx` foi corrigido junto com a integração do clique na busca.

---

## 2026-05-05 — Project-Scoped Vault Passwords

**Resumo:**
Implementado vault password por projeto com zero-knowledge rígido para API, Web e CLI. A senha do vault nunca é armazenada nem enviada em claro; o backend guarda apenas metadata sanitizada e hash bcrypt da prova.

**Arquivos criados:**
- `apps/api/tests/test_project_vault_security.py` — cobertura de sanitização, criação obrigatória com vault config e push sem prova

**Arquivos alterados:**
- `apps/api/app/schemas/project.py` — `ProjectVaultConfig`, `vault_config`, `vault_proof`, rekey payload e resposta sanitizada
- `apps/api/app/services/project_service.py` — hash/verificação de `vault_proof`, settings sanitizados e update de vault settings
- `apps/api/app/routers/projects.py` — criação com vault config e endpoint `/vault/rekey`
- `apps/api/app/routers/vault.py` — `push` exige `vault_proof` para projetos v1
- `apps/web/src/lib/crypto.ts` — contrato cripto de vault por projeto, proof e HKDF por environment
- `apps/web/src/components/shared/create-project-dialog.tsx` — senha do vault na criação
- `apps/web/src/components/shared/vault-unlock-panel.tsx` — unlock com senha do projeto
- `apps/web/src/app/(dashboard)/projects/[id]/secrets/page.tsx` — decrypt/encrypt com key material do projeto
- `apps/web/src/app/(dashboard)/projects/[id]/settings/page.tsx` — rotação de senha com recriptografia client-side
- `apps/cli/src/criptenv/commands/projects.py` — `criptenv projects create`
- `apps/cli/src/criptenv/commands/sync.py` — push/pull convertem entre vault local e vault do projeto
- `apps/cli/src/criptenv/commands/ci.py` — `ci deploy` exige/converte com `CRIPTENV_VAULT_PASSWORD`
- `docs/project/decisions.md` — DEC-013

**Verificação:**
- API: 280 passed ✅
- CLI: 130 passed ✅
- Web: `npm run lint` ✅, `npm run check:vinext` ✅, `npm run build` ✅

**Observações:**
- Projetos legados sem `vault_config` podem ser migrados pela seção de senha do vault em Settings.
- Recuperação de senha esquecida permanece impossível por decisão zero-knowledge.

---

## 2026-05-03 — Phase 3 Objectives Closure (M3.2 + M3.3 + M3.4)

**Resumo:**
Fechamento dos 3 objetivos pendentes do ROADMAP marcados como NOT STARTED: Public API (M3.4), CI Tokens (M3.3), e Cloud Integrations (M3.2 — Vercel + Render).

**Arquivos criados:**
- `apps/api/app/strategies/integrations/render.py` — RenderProvider implementation
- `apps/api/tests/test_dual_auth.py` — 7 integration tests for dual auth
- `apps/cli/src/criptenv/commands/integrations.py` — CLI integrations commands
- `apps/cli/src/criptenv/commands/ci.py` (rewritten) — Real ci deploy + cli_context fix

**Arquivos alterados:**
- `apps/api/main.py` — RateLimitMiddleware registered, custom OpenAPI with dual security
- `apps/api/app/middleware/auth.py` — `get_current_user_or_api_key()` for dual auth
- `apps/api/app/middleware/rate_limit.py` — Already existed, now activated
- `apps/api/app/routers/vault.py` — vault pull/version accept API keys
- `apps/api/app/routers/projects.py` — projects list/get accept API keys
- `apps/api/app/routers/environments.py` — environments list/get accept API keys
- `apps/api/app/strategies/integrations/__init__.py` — RenderProvider registered
- `apps/api/tests/test_integration_providers.py` — 6 RenderProvider tests added
- `apps/api/tests/test_openapi_docs.py` — Rate limit error format updated
- `apps/cli/src/criptenv/context.py` — `CRIPTENV_MASTER_PASSWORD` env var support
- `apps/cli/src/criptenv/cli.py` — integrations_group registered
- `apps/cli/src/criptenv/api/client.py` — `list_integrations()`, `sync_integration()` added
- `ROADMAP.md` — Status updated for M3.2/M3.3/M3.4
- `docs/development/CHANGELOG.md` — New section for M3.2+M3.3+M3.4 completion
- `docs/project/current-state.md` — Updated to ~85% Phase 3
- `docs/tasks/current-task.md` — Session closure documented

**Observações:**
- Railway provider (TASK-061) ainda pendente — segue mesmo padrão do RenderProvider
- Integration config encryption at-rest ainda pendente
- Todos os testes passando: API 275 ✅, CLI 127 ✅

---

## 2026-05-03 — Phase 3 Rescue Implementation

**Resumo:**
Security P0, M3.5 ExpirationBadge, CI auth, GitHub Action readiness, and Vercel integration consolidation implemented from the Phase 3 rescue plan.

**Arquivos criados:**
- `apps/web/src/lib/api/rotation.ts`
- `apps/web/src/lib/api/integrations.ts`
- `apps/cli/tests/test_api_client.py`

**Arquivos alterados:**
- Auth response/session handling in API, CLI, and web auth hook
- CI auth middleware/router/model with persisted `ci_sessions`
- Web secrets page and integrations page
- GitHub Action metadata, README, package config, and generated dist bundle
- Phase 3 docs and database notes

**Observações:**
Requires manual PostgreSQL migration for `ci_sessions` before real CI auth testing. Existing uncommitted docs and `testsprite_tests/` changes were preserved.

---

## 2026-05-01 — Initial Documentation Organization

**Resumo:**
Organização inicial da documentação do projeto. Criada estrutura completa em `/docs` para fornecer fonte da verdade para desenvolvedores e agentes de IA.

**Arquivos criados:**
- `docs/index.md` — Documentation index
- `docs/project/overview.md` — Project overview
- `docs/project/current-state.md` — Current development state
- `docs/project/architecture.md` — System architecture
- `docs/project/tech-stack.md` — Technology stack
- `docs/project/decisions.md` — Technical decision log (ADR)
- `docs/workflow/development-workflow.md` — Development workflow
- `docs/workflow/agent-workflow.md` — AI agent workflow guidelines
- `docs/workflow/task-management.md` — Task management template
- `docs/workflow/context-map.md` — Project context map
- `docs/features/implemented.md` — Implemented features
- `docs/features/in-progress.md` — Features in progress
- `docs/features/backlog.md` — Feature backlog
- `docs/technical/folder-structure.md` — Folder structure
- `docs/technical/environment.md` — Environment configuration
- `docs/technical/database.md` — Database documentation
- `docs/technical/api.md` — API documentation
- `docs/technical/frontend.md` — Frontend documentation
- `docs/technical/backend.md` — Backend documentation
- `docs/technical/deployment.md` — Deployment documentation
- `docs/tasks/current-task.md` — Current task
- `docs/tasks/next-tasks.md` — Next tasks
- `docs/tasks/task-history.md` — This file

**Observações:**
- Estado atual: Phase 1 ✅ COMPLETE, Phase 2 ✅ COMPLETE, Phase 3 🔄 IN PROGRESS
- Phase 3 focus: M3.5 Secret Alerts & Rotation — API e CLI implementados, web integration pendente
- Security issues CR-01 e CR-02 identificados como P0 para resolver antes de API pública
- Vercel integration é próximo passo após completar web expiration UI

---

## 2026-04-30 — Phase 3 M3.5 Implementation Complete (inferred from CHANGELOG)

**Resumo:**
Implementação de Secret Rotation, Expiration, Alerts e Webhooks para Phase 3.

**Entregáveis:**
- SecretExpiration model
- RotationService
- RotationRouter
- WebhookService com exponential backoff
- ExpirationChecker background job
- CLI commands: rotate, secrets expire, secrets alert, rotation list
- 33+ CLI rotation tests
- 6 integration tests

**Observações:**
Ver CHANGELOG.md para detalhes completos.

---

## 2026-05-03 — Alembic Migration Setup

**Resumo:**
Criação do setup Alembic async e aplicação da primeira revisão para `ci_sessions`.

**Arquivos criados:**
- `apps/api/migrations/001_create_ci_sessions.sql`
- `apps/api/alembic.ini`
- `apps/api/migrations/env.py`
- `apps/api/migrations/script.py.mako`
- `apps/api/migrations/versions/20260503_0001_create_ci_sessions.py`
- `scripts/db_migrate.sh`

**Arquivos alterados:**
- `Makefile`
- `apps/api/requirements.txt`
- `docs/development/CHANGELOG.md`
- `docs/tasks/task-history.md`

**Observações:**
- `make db-upgrade` foi executado com sucesso contra o `DATABASE_URL` de `apps/api/.env`.
- `make db-migrate` agora é alias de `make db-upgrade`.
- `scripts/db_migrate.sh` foi mantido como wrapper de compatibilidade.
- Token sandbox Vercel removido do `.env` da API porque estava como linha inválida e deve ser cadastrado pela UI de integrações.

---

## 2026-04-30 — Phase 2 Web UI Complete (inferred from CHANGELOG)

**Resumo:**
Dashboard web completo com Vinext, autenticação, CRUD de projects/environments/secrets, audit logs, team management.

**Entregáveis:**
- 13 rotas frontend
- Zustand stores + React Query
- Dark mode default com CSS variables
- Radix UI primitives
- Auth pages (login, signup, forgot-password)
- Marketing landing page

**Observações:**
Ver CHANGELOG.md para detalhes completos.

---

## 2026-04-30 — Phase 1 CLI MVP Complete (inferred from CHANGELOG)

**Resumo:**
CLI completo com 14 comandos, criptografia AES-256-GCM, local vault SQLite, 93+ testes.

**Entregáveis:**
- 14 CLI commands (init, login, logout, set, get, list, delete, push, pull, env, projects, doctor, import, export)
- AES-256-GCM encryption with PBKDF2HMAC (100k iterations) + HKDF
- Local SQLite vault at ~/.criptenv/vault.db
- Session management with encrypted tokens
- Import/export .env and JSON

**Observações:**
Ver CHANGELOG.md para detalhes completos.

---

## Template for Future Entries

```markdown
## YYYY-MM-DD — [Task Title]

**Resumo:**
[Brief description of what was done]

**Arquivos criados:**
- `path/to/file`

**Arquivos alterados:**
- `path/to/file`

**Observações:**
[Any important notes, blockers, or follow-up items]
```

---

**Document Version**: 1.1
**Last Updated**: 2026-05-03
