# Current Task — CriptEnv

## Status atual

**VPS backend migration — ARTEFATOS E DOCUMENTAÇÃO EM IMPLEMENTAÇÃO.**

---

## Tarefa em foco

Migrar o plano de produção da API de Render Free Tier para VPS Docker com DuckDNS, Nginx Proxy Manager, Let's Encrypt, Supabase externo e Redis para rate limiting multi-worker.

---

## O que foi implementado nesta sessão

### VPS backend deployment ✅
- API ganhou `Dockerfile` para Gunicorn/Uvicorn.
- `deploy/vps/docker-compose.yml` define API, scheduler dedicado, Redis, Nginx Proxy Manager e DuckDNS updater.
- Redis passa a ser opção real para rate limiting em produção multi-worker.
- Cloudflare Pages deve manter chamadas de browser relativas e configurar `API_URL` no Worker runtime.
- Render hosting fica como legado/rollback; RenderProvider continua como integração de produto.

---

## Documentação atualizada

- [x] `docs/project/decisions.md` — DEC-016
- [x] `docs/development/CHANGELOG.md` — seção VPS Backend Migration Planning
- [x] `docs/project/current-state.md` — estado e contagens atualizadas
- [x] `docs/tasks/current-task.md` — este arquivo

---

## Próximos passos recomendados

1. Subir `deploy/vps` na VPS e configurar Nginx Proxy Manager para `API_DUCKDNS_HOST -> api:8000`.
2. Configurar Cloudflare Pages runtime `API_URL=https://<API_DUCKDNS_HOST>` e deixar `NEXT_PUBLIC_API_URL` vazio.
3. Rodar smoke tests: `/health`, `/health/ready`, `/api/health` via Worker, login/signup e OAuth.
4. Continuar pendências Phase 3: Integration Config Encryption, RailwayProvider e Web Alert UI.

---

**Document Version**: 1.4
**Last Updated**: 2026-05-06
**Status**: Implementation in progress — deployment artifacts ready
