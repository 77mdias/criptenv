# Task History — CriptEnv

## Overview

This file records completed tasks and major project milestones.

---

## 2026-05-13 — Professional Auth Screens Redesign

**Resumo:**
Redesign das telas `/login`, `/signup` e `/forgot-password` com layout split profissional, superfície de formulário compartilhada e OAuth providers compactos em linha.

**Arquivos alterados:**
- `apps/web/src/app/(auth)/layout.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/signup/page.tsx`
- `apps/web/src/app/(auth)/forgot-password/page.tsx`
- `apps/web/src/components/ui/oauth-button.tsx`
- `docs/development/CHANGELOG.md`
- `docs/project/decisions.md`
- `docs/tasks/task-history.md`

**Observações:**
- Preservados os fluxos existentes de auth, validação e redirects OAuth.
- `DEC-030` foi usado porque `DEC-026` já existia no decision log.

---

## 2026-05-12 — Redis-Backed CLI Auth State

**Resumo:**
Corrigido o erro `Invalid or expired state` no `criptenv login` em produção. A causa era o armazenamento em memória do fluxo CLI auth em uma API Gunicorn com múltiplos workers.

**Arquivos criados:**
- `apps/cli/tests/test_config.py`

**Arquivos alterados:**
- `apps/api/app/routers/cli_auth.py` — adiciona Redis como store compartilhado para `state`, auth code e device code, com fallback em memória.
- `apps/api/tests/test_cli_auth.py` — adiciona cobertura para chaves Redis e TTL.
- `apps/cli/src/criptenv/api/client.py` — aumenta timeout HTTP e transforma timeouts vazios do `httpx` em mensagem clara.
- `apps/cli/src/criptenv/config.py` — default da API passa para `https://criptenv-api.77mdevseven.tech`.
- `apps/cli/src/criptenv/commands/completion.py` — corrige geração de completion scripts com versões atuais do Click.
- `docs/project/decisions.md` — DEC-025.
- `docs/development/CHANGELOG.md`, `docs/tasks/task-history.md`, `docs/tasks/current-task.md`, `docs/technical/environment.md`.

**Observações:**
- Produção usa `REDIS_URL=redis://redis:6379/0`, então workers públicos compartilham o estado temporário do login CLI.
- Desenvolvimento local continua podendo usar `CRIPTENV_API_URL=http://localhost:8000`.
- Chamadas via Cloudflare Tunnel podem exceder o timeout padrão de 5s do `httpx`; o cliente agora usa timeout explícito de conexão/leitura.
- `make test` também validou o ajuste de shell completion, que apareceu durante a verificação completa.

---

## 2026-05-11 — Problem to Vault Vault Ceremony

**Resumo:**
Redesenhada a dobra “Problem to Vault” da landing como uma cerimônia visual de selagem, dando protagonismo ao vault criptografado e aos sinais técnicos de zero plaintext.

**Arquivos criados:**
- `apps/web/src/components/marketing/problem-to-vault-section.tsx`
- `apps/web/src/components/marketing/__tests__/problem-to-vault-section.test.tsx`

**Arquivos alterados:**
- `apps/web/src/app/(marketing)/page.tsx` — substitui o bloco inline pelo novo componente.
- `docs/project/decisions.md` — DEC-024.
- `docs/development/CHANGELOG.md`, `docs/tasks/task-history.md`.

**Observações:**
- A animação usa GSAP localmente, sem novas dependências e sem React Three Fiber nesta dobra.
- Reduced motion renderiza a cena estática e totalmente visível.
- A dobra enfatiza `plain env -> AES-GCM local seal -> encrypted vault`.

---

## 2026-05-11 — Landing Security Scrollytelling

**Resumo:**
Redesenhada a seção Security da landing como narrativa scrollytelling desktop, com pin/snap por tópico e fallback mobile empilhado sem travamento de rolagem.

**Arquivos criados:**
- `apps/web/src/components/marketing/security-scrollytelling.tsx`
- `apps/web/src/components/marketing/security-vault-scene.tsx`

**Arquivos alterados:**
- `apps/web/src/app/(marketing)/page.tsx` — substitui o bloco Security estático pelo novo componente.
- `apps/web/src/app/globals.css` — adiciona estados visuais do rail de tópicos.
- `docs/project/decisions.md` — DEC-023.
- `docs/development/CHANGELOG.md`, `docs/tasks/task-history.md`.

**Observações:**
- Desktop usa GSAP ScrollTrigger com pin e snap em quatro tópicos: AES-GCM, Zero-knowledge, Client-side only e 100% open source e auditável.
- Mobile e reduced motion não carregam canvas nem criam scroll trap.
- QA visual foi feito em produção local via Vinext start com Playwright.

---

## 2026-05-10 — Custom Production Domains

**Resumo:**
Atualizados frontend, backend, CORS, OAuth redirects, scripts de webhook e documentação para os domínios customizados `77mdevseven.tech`, com API exposta via Cloudflare Tunnel.

**Arquivos alterados:**
- `apps/api/.env.example`, `deploy/vps/.env.example`, `apps/web/.env.example` — URLs de produção atualizadas.
- `apps/api/render.yaml`, `apps/api/railway.toml` — rollback configs usam o frontend customizado em CORS/redirect.
- `apps/api/tests/test_oauth.py` — expectativas de redirect/callback atualizadas.
- `apps/api/scripts/test_webhook.py`, `apps/api/scripts/test_webhook_production.py` — webhook production URL atualizado.
- `scripts/production-checklist.sh` — smoke target atualizado.
- `deploy/vps/README.md`, `docs/technical/deployment-guide.md`, `docs/technical/deployment.md` — docs de deploy com Cloudflare Tunnel e domínios customizados.
- `docs/project/decisions.md` — DEC-022.

**Observações:**
- `NEXT_PUBLIC_API_URL` permanece vazio em produção para manter requests do browser em `/api/*`.
- `API_URL` do Worker deve ser `https://criptenv-api.77mdevseven.tech`.

---

## 2026-05-10 — VPS DuckDNS Drift Recovery

**Resumo:**
Diagnosticada instabilidade pública em `criptenv.duckdns.org`: API, Nginx Proxy Manager e health checks internos estavam saudáveis, mas o A record do DuckDNS apontava para um IPv4 diferente do IPv4 público da VPS. O update manual do DuckDNS restaurou o acesso.

**Arquivos alterados:**
- `deploy/vps/docker-compose.yml` — updater passa a detectar o IPv4 público via `api4.ipify.org` e enviá-lo explicitamente ao DuckDNS.
- `deploy/vps/.env.example` — adiciona `DUCKDNS_FORCE_IP` como override opcional.
- `deploy/vps/README.md` — adiciona runbook de drift DuckDNS.
- `docs/technical/deployment-guide.md` — adiciona recuperação de drift e checklist de comparação IP/DNS.
- `docs/project/current-state.md` — registra updater DuckDNS com IPv4 explícito e risco operacional atualizado.
- `docs/project/decisions.md` — DEC-021.
- `docs/development/CHANGELOG.md`, `docs/tasks/current-task.md`, `docs/tasks/task-history.md`.

**Observações:**
- A causa provável é dependência anterior de `ip=` vazio no update DuckDNS, deixando o serviço inferir o IP pela origem da requisição.
- Se o registro voltar a apontar para outro IP, investigar updater DuckDNS concorrente usando o mesmo subdomínio/token.

---

## 2026-05-08 — Landing Pricing Redesign

**Resumo:**
Redesenhada a seção pricing da landing para manter o carousel com 3 cards honestos e compatíveis com o estado atual do produto: contribuição, open source e roadmap futuro.

**Arquivos alterados:**
- `apps/web/src/app/(marketing)/page.tsx` — novos cards em inglês, título atualizado e CTA de contribuição apontando para `/contribute`.
- `apps/web/src/components/marketing/pricing-card-carousel.tsx` — autoplay e navegação passam a usar o índice real atual, evitando troca para card inesperado.
- `docs/development/CHANGELOG.md`, `docs/tasks/current-task.md`, `docs/tasks/task-history.md`.

**Observações:**
- Não foi criada nova DEC porque a mudança é visual/conteúdo de landing.
- Planos comerciais fictícios foram removidos da copy pública.

---

## 2026-05-08 — Mercado Pago Pix Contribution Flow

**Resumo:**
Implementada a página pública `/contribute` para contribuições via Pix/Mercado Pago, com formulário React Hook Form + Zod, QR code, código copia-e-cola e acompanhamento de status.

**Arquivos criados:**
- `apps/web/src/app/(marketing)/contribute/page.tsx`
- `apps/web/src/app/(marketing)/contribute/__tests__/page.test.tsx`

**Arquivos alterados:**
- `apps/api/app/routers/contributions.py` — criação de contribuição passa a aceitar visitante anônimo.
- `apps/api/app/schemas/contribution.py` — normaliza nome/email opcionais em branco.
- `apps/api/tests/test_contributions.py` — cobertura para criação anônima.
- `apps/web/src/lib/validators/schemas.ts` — schema Zod 4-safe para valor numérico e opcionais trimados.
- `apps/web/src/lib/validators/__tests__/schemas.test.ts` — cobertura de conversão/normalização de contribuição.
- `docs/project/decisions.md` — DEC-020.
- `docs/development/CHANGELOG.md`, `docs/tasks/current-task.md`, `docs/tasks/task-history.md`.

**Observações:**
- Webhook do Mercado Pago continua sendo a fonte primária de verdade.
- Frontend usa polling local leve e sync periódico para cobrir atraso de webhook.
- O fluxo de pagamento não envolve vaults, secrets ou material zero-knowledge.

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
Migração do backend de Render Free Tier para VPS Docker validada inicialmente com DuckDNS, Nginx Proxy Manager, Redis rate limiting, Supabase externo e Cloudflare Workers proxy `/api/*`.

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
  - `https://criptenv-api.77mdevseven.tech/health` ✅
  - `https://criptenv-api.77mdevseven.tech/api/health` ✅
  - `https://criptenv.77mdevseven.tech/api/health` ✅

**Observações:**
- Nginx Proxy Manager foi usado na primeira versão do deploy VPS; o stack atual usa Cloudflare Tunnel.
- `NEXT_PUBLIC_API_URL` deve ficar vazio em produção; o Worker usa `API_URL=https://criptenv-api.77mdevseven.tech`.
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

## 2026-05-13 — Pipeline E2E and Web Lint Fixes

**Resumo:**
Correção de falhas de pipeline na coleta dos testes da API e no lint WEB.

**Arquivos alterados:**
- `apps/api/app/services/auth_service.py`
- `apps/web/src/components/shared/api-keys-panel.tsx`
- `apps/web/src/app/(auth)/invites/accept/page.tsx`
- `docs/development/CHANGELOG.md`
- `docs/project/decisions.md`
- `docs/tasks/task-history.md`

**Observações:**
- `ProjectInvite` agora é importado no escopo do módulo para compatibilidade com versões de Python que avaliam annotations durante import.
- Os effects iniciais do WEB foram ajustados para não chamar setters de estado no corpo síncrono do `useEffect`.
- Verificação executada: `make api-test`, `make web-lint`, `make web-build` e `tests/test_backend_integration_db.py` com variáveis E2E locais.

---

## 2026-05-14 — CLI Auth/Vault Separation and Doctor Health Fix

**Resumo:**
Correção do falso 404 em `criptenv doctor` e separação entre sessão autenticada da CLI e desbloqueio do vault local de secrets.

**Arquivos criados:**
- `apps/cli/tests/test_session_context.py`

**Arquivos alterados:**
- `apps/cli/src/criptenv/config.py`
- `apps/cli/src/criptenv/session.py`
- `apps/cli/src/criptenv/context.py`
- `apps/cli/src/criptenv/commands/login.py`
- `apps/cli/src/criptenv/commands/doctor.py`
- `apps/cli/src/criptenv/commands/sync.py`
- `apps/cli/src/criptenv/commands/auth.py`
- `apps/cli/src/criptenv/commands/environments.py`
- `apps/cli/src/criptenv/commands/secrets.py`
- `apps/cli/tests/conftest.py`
- `apps/cli/tests/test_commands.py`
- `docs/project/decisions.md`
- `docs/development/CHANGELOG.md`
- `docs/tasks/task-history.md`

**Observações:**
- `doctor` agora consulta `/health`, validado contra a API pública com HTTP 200.
- API-only commands usam `~/.criptenv/auth.key` para sessão local e não precisam mais da master password do vault.
- Fluxos que decryptam ou sincronizam secrets continuam exigindo senha de vault/local conforme necessário.
- Verificações executadas: `python -m pytest apps/cli/tests -q`, `python -m pytest apps/api/tests/test_api_versioning.py -q`, `python -m pytest apps/api/tests/test_openapi_docs.py::TestOpenAPISchema::test_worker_proxy_health_alias_exists -q`.

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

**Document Version**: 1.2
**Last Updated**: 2026-05-11
