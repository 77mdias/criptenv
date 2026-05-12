# Current Task — CriptEnv

## Status atual

**CLI auth production worker state — fixed.**

---

## Tarefa em foco

Corrigir `criptenv login` em produção após a migração para múltiplos workers Gunicorn:

- Frontend: `https://criptenv.77mdevseven.tech`
- Backend: `https://criptenv-api.77mdevseven.tech`
- Redis: `redis://redis:6379/0`

---

## O que foi implementado nesta sessão

### Redis-Backed CLI Auth State ✅
- `apps/api/app/routers/cli_auth.py` passa a usar Redis para `state`, auth code e device code quando `REDIS_URL` estiver configurado.
- Fallback em memória permanece para desenvolvimento local sem Redis.
- `apps/cli/src/criptenv/config.py` passa a usar `https://criptenv-api.77mdevseven.tech` como default.
- `CRIPTENV_API_URL=http://localhost:8000` continua sendo o override para desenvolvimento local.

---

## Documentação atualizada

- [x] `docs/project/decisions.md` — DEC-025.
- [x] `docs/development/CHANGELOG.md`.
- [x] `docs/tasks/task-history.md`.
- [x] `docs/technical/environment.md`.

---

## Próximos passos recomendados

1. Publicar a nova imagem da API e reiniciar o serviço `api`.
2. Confirmar que `REDIS_URL=redis://redis:6379/0` está disponível no container da API.
3. Rodar smoke test: `CRIPTENV_API_URL=https://criptenv-api.77mdevseven.tech criptenv login`.

---

**Document Version**: 1.13
**Last Updated**: 2026-05-12
**Status**: CLI auth state fixed for production multi-worker API
