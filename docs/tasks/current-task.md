# Current Task — CriptEnv

## Status atual

**Custom production domains — frontend/backend configuration updated.**

---

## Tarefa em foco

Atualizar CORS, URLs públicas, OAuth redirects, webhooks e documentação para os domínios de produção:

- Frontend: `https://criptenv.77mdevseven.tech`
- Backend: `https://criptenv-api.77mdevseven.tech`

---

## O que foi implementado nesta sessão

### Custom Production Domains ✅
- Backend env templates passam a usar `API_URL=https://criptenv-api.77mdevseven.tech`.
- Backend `FRONTEND_URL` e `CORS_ORIGINS` passam a usar `https://criptenv.77mdevseven.tech`.
- Frontend env template mantém `NEXT_PUBLIC_API_URL=` vazio e usa runtime `API_URL=https://criptenv-api.77mdevseven.tech`.
- Testes OAuth e scripts de webhook apontam para os novos domínios.
- Documentação de deploy foi alinhada ao stack atual com Cloudflare Tunnel.

---

## Documentação atualizada

- [x] `deploy/vps/README.md` — domínios e tunnel.
- [x] `docs/technical/deployment-guide.md` — guia completo atualizado.
- [x] `docs/technical/deployment.md` — stack resumido atualizado.
- [x] `docs/project/decisions.md` — DEC-022.
- [x] `docs/project/current-state.md` — estado atual com custom domains.
- [x] `docs/project/architecture.md` e `docs/project/tech-stack.md`.
- [x] `docs/development/CHANGELOG.md` e `docs/tasks/task-history.md`.

---

## Próximos passos recomendados

1. Atualizar variáveis reais na VPS e no Cloudflare Pages/Workers.
2. Confirmar o public hostname do Cloudflare Tunnel: `criptenv-api.77mdevseven.tech -> http://api:8000`.
3. Rodar smoke tests públicos de health, login/OAuth e vault pull/push.

---

**Document Version**: 1.12
**Last Updated**: 2026-05-10
**Status**: Custom production domains configured in repo
