# Current Task — CriptEnv

## Status atual

**TASK-068 — Integration Config Encryption implementada localmente; pronta para deploy/migration na VPS.**

---

## Tarefa em foco

Criptografar `integrations.config` at-rest com AES-256-GCM e chave dedicada `INTEGRATION_CONFIG_SECRET`, mantendo compatibilidade com configs plaintext legadas.

---

## O que foi implementado nesta sessão

### TASK-068 — Integration Config Encryption ✅
- Criado helper `app.crypto.integration_config` com AES-256-GCM, envelope JSONB versionado e HKDF-SHA256.
- `IntegrationService` agora salva `config` criptografado e decripta apenas antes de chamar providers.
- Configs plaintext legadas são aceitas temporariamente e regravadas criptografadas no primeiro acesso.
- Adicionada migration Alembic `20260506_0003_encrypt_integration_configs` para backfill de configs existentes.
- Adicionado `INTEGRATION_CONFIG_SECRET` aos exemplos de env da API e VPS.
- Fluxos reais do deploy VPS/Workers foram validados manualmente antes desta task.

### Smoke tests VPS validados ✅
- `curl https://criptenv.duckdns.org/health`
- `curl https://criptenv.duckdns.org/api/health`
- `curl https://criptenv.jean-carlos3.workers.dev/api/health`
- Login/signup/OAuth/projetos/vault pelo frontend Workers foram validados manualmente.

---

## Documentação atualizada

- [x] `docs/project/decisions.md` — DEC-017
- [x] `docs/development/CHANGELOG.md` — seção Integration Config Encryption
- [x] `docs/project/current-state.md` — estado e contagens atualizadas
- [x] `docs/tasks/task-history.md` — TASK-068 registrada
- [x] `docs/tasks/next-tasks.md` — TASK-068 movida para completed
- [x] `docs/tasks/current-task.md` — este arquivo

---

## Próximos passos recomendados

1. Configurar `INTEGRATION_CONFIG_SECRET` real no `deploy/vps/.env`.
2. Recriar API/scheduler na VPS: `docker compose up -d --build --force-recreate api scheduler`.
3. Aplicar migration no Supabase de produção com `alembic upgrade head`.
4. Confirmar via banco que `integrations.config` usa envelope criptografado.
5. Continuar pendências Phase 3: RailwayProvider e Web Alert UI.

---

**Document Version**: 1.6
**Last Updated**: 2026-05-06
**Status**: TASK-068 implemented — production migration pending
