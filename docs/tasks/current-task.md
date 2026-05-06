# Current Task — CriptEnv

## Status atual

**VPS backend migration — VALIDADA EM PRODUÇÃO.**

---

## Tarefa em foco

Migrar o plano de produção da API de Render Free Tier para VPS Docker com DuckDNS, Nginx Proxy Manager, Let's Encrypt, Supabase externo e Redis para rate limiting multi-worker.

---

## O que foi implementado nesta sessão

### VPS backend deployment ✅
- API ganhou `Dockerfile` para Gunicorn/Uvicorn.
- `deploy/vps/docker-compose.yml` define API, scheduler dedicado, Redis, Nginx Proxy Manager e DuckDNS updater.
- Redis passa a ser opção real para rate limiting em produção multi-worker.
- Cloudflare Workers mantém chamadas de browser relativas e configura `API_URL=https://criptenv.duckdns.org` no runtime.
- Render hosting fica como legado/rollback; RenderProvider continua como integração de produto.
- Nginx Proxy Manager foi acessado por túnel SSH na porta local `8181`, preservando o admin na VPS como `127.0.0.1:81`.
- Proxy público `criptenv.duckdns.org -> api:8000` foi salvo e validado.
- Health aliases `/api/health` e `/api/health/ready` foram adicionados para compatibilidade com o Worker proxy `/api/*`.

### Smoke tests validados ✅
- `curl https://criptenv.duckdns.org/health`
- `curl https://criptenv.duckdns.org/api/health`
- `curl https://criptenv.jean-carlos3.workers.dev/api/health`

---

## Documentação atualizada

- [x] `docs/project/decisions.md` — DEC-016
- [x] `docs/development/CHANGELOG.md` — seção VPS Backend Migration Planning
- [x] `docs/project/current-state.md` — estado e contagens atualizadas
- [x] `docs/tasks/task-history.md` — migração registrada
- [x] `docs/tasks/session-compact.md` — handoff compacto da sessão
- [x] `docs/tasks/current-task.md` — este arquivo

---

## Próximos passos recomendados

1. Validar manualmente login/signup, OAuth callback, listagem de projetos e fluxo de vault pelo frontend em `https://criptenv.jean-carlos3.workers.dev`.
2. Aplicar/confirmar migrations no Supabase de produção com `alembic upgrade head`.
3. Configurar backup/monitoramento básico da VPS e volumes do Nginx Proxy Manager.
4. Continuar pendências Phase 3: Integration Config Encryption, RailwayProvider e Web Alert UI.

---

**Document Version**: 1.5
**Last Updated**: 2026-05-06
**Status**: VPS migration validated — app flow validation pending
