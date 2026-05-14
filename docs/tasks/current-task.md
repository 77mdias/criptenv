# Current Task — CriptEnv

## Status atual

**API/WEB/CLI Alignment — 16 gaps em 5 waves, 100% CONCLUÍDO. Hotfix CLI auth/vault + doctor aplicado em 2026-05-14.**

---

## Tarefa em foco

Alinhamento completo entre API, WEB e CLI — cobrir todos os endpoints disponíveis na API com suporte correspondente no WEB e CLI.

---

## O que foi implementado nesta sessão

### Wave 1: P0 Critical (GAP-01, GAP-02) ✅
- **GAP-01:** Registro de `rotation_router` e `expiring_router` em `main.py` e `__init__.py`
- **GAP-02:** Reescrita completa do CLI `projects rekey` com fluxo zero-knowledge (pull → decrypt → re-encrypt → push)

### Wave 2: P1 Auth (GAP-03 a GAP-07) ✅
- **Forgot/Reset Password:** API endpoints, WEB pages, CLI commands
- **Change Password:** API + WEB + CLI
- **Update Profile / Delete Account:** API + WEB + CLI
- **2FA/TOTP:** Setup com QR code, verify, disable — API + WEB + CLI
- **EmailService:** Integração com Resend para emails de produção

### Wave 3: P2 WEB Coverage (GAP-08 a GAP-11) ✅
- **GAP-08:** API Keys UI panel (`api-keys-panel.tsx` + `api-keys.ts`)
- **GAP-09:** Secret Rotation UI (`expiration-modal.tsx`, rotate/expire buttons)
- **GAP-10:** Accept Invite flow (`/invites/accept?token=` page)
- **GAP-11:** OAuth accounts section in `/account` with unlink

### Wave 4: P3 CLI Completeness (GAP-12 a GAP-14) ✅
- **GAP-12:** 8 métodos faltantes adicionados ao CLI client
- **GAP-13:** Removido `railway` das choices do CLI (não implementado na API)
- **GAP-14:** Export CSV de audit na WEB

### Wave 5: Polish (GAP-15, GAP-16) ✅
- **GAP-15:** `AGENTS.md` atualizado (removida referência a `project.ts` inexistente)
- **GAP-16:** Verificação de registro de routers (intencional via `v1_router`)

### Testes
- API: **365 passed, 2 skipped**
- CLI: **175 passed**

### Hotfix 2026-05-14 ✅
- `criptenv doctor` agora usa `/health` em vez de `/docs`, removendo falso 404 contra produção.
- Sessões autenticadas da CLI agora usam `~/.criptenv/auth.key`, separado da master password do vault local.
- Comandos API-only deixam de pedir master password; fluxos que acessam/decryptam secrets continuam exigindo senha de vault/local.
- Corrigido uso de project ID resolvido em comandos `env` e helpers de sync.

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

**Document Version**: 1.14
**Last Updated**: 2026-05-14
**Status**: CLI auth/vault separation fixed; doctor health check fixed
