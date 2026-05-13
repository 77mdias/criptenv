# Plano de Alinhamento API ↔ WEB ↔ CLI

> **Data:** 2026-05-13
> **Escopo:** Identificar gaps entre backend (API), frontend (WEB) e CLI, e propor correções/features para deixar todos coerentes.
> **Metodologia:** Mapeamento completo dos 3 domínios, comparação funcional, priorização por severidade.

---

## 1. Resumo Executivo

| Componente | Status Geral |
|------------|-------------|
| **API** | ~85% implementada. Alguns routers existem mas não estão registrados. Auth de usuário incompleto (falta forgot/reset/change password, 2FA, update profile, delete account). |
| **WEB** | ~75% implementada. Faltam telas para API Keys, rotação de secrets, aceite de convites. Auth de conta parcial (forgot-password sem endpoint, sem 2FA). |
| **CLI** | ~80% implementada. Cliente HTTP cobre a maioria dos endpoints mas faltam 8 métodos. Comando `projects rekey` quebrado. Railway é stub. |

**Conclusão:** O maior desalinhamento está em:
1. **Secret Rotation (M3.5)** — API tem router não registrado → ninguém consegue usar
2. **Account Management** — API não tem endpoints de password/profile → WEB e CLI não conseguem implementar
3. **API Keys (M3.4)** — API e CLI existem, WEB não tem nada
4. **Secret Expiration & Rotation UI** — CLI tem comandos completos, API tem endpoints (inativos), WEB só exibe badges

---

## 2. Gaps Críticos (P0 — Quebram Funcionalidade)

### GAP-01: Router de Secret Rotation NÃO Registrado
- **Onde:** `apps/api/app/routers/rotation.py` existe, mas **não está importado nem registrado** em `main.py` nem `app/routers/__init__.py`
- **Impacto:** TODO o módulo M3.5 (Secret Rotation & Alerts) está inacessível. Endpoints de `rotate`, `expiration`, `history`, `expiring` retornam 404.
- **Afeta:** WEB (só consegue listar expirando se chamar diretamente, mas não consegue rotacionar), CLI (comandos de rotation existem mas falham), API (código morto).
- **Correção:** Importar e registrar `rotation_router` e `expiring_router` em `main.py`.

### GAP-02: CLI `projects rekey` Envia Payload Vazio
- **Onde:** `apps/cli/src/criptenv/api/client.py` → `rekey_project()`
- **Impacto:** Chamada `POST /api/v1/projects/{id}/vault/rekey` sem body. A API espera `ProjectVaultRekeyRequest` (current_vault_proof, new_vault_config, new_vault_proof, environments). Retorna 422.
- **Afeta:** CLI apenas. WEB implementa rekey corretamente no frontend (descriptografa e re-encripta no client, envia payload completo).
- **Correção:** Implementar construção do payload no comando `projects rekey` (similar à WEB) ou remover comando e documentar que rekey é web-only.

---

## 3. Gaps Maiores (P1 — Funcionalidade Ausente na API)

### GAP-03: Forgot / Reset Password
- **API:** ❌ Não existe `POST /api/auth/forgot-password` nem `POST /api/auth/reset-password`
- **WEB:** ✅ Página `/forgot-password` existe com UI completa, mas **não chama API** (comentário `TODO` no código)
- **CLI:** ❌ Não existe comando
- **Correção:**
  1. API: Criar endpoints `POST /api/auth/forgot-password` (gera token único, envia email com link) e `POST /api/auth/reset-password` (valida token, atualiza senha). Requer serviço de email (SMTP/Resend/etc.) ou, no MVP, token retornado no response para testes.
  2. WEB: Conectar página ao novo endpoint.
  3. CLI: Adicionar comando `auth forgot-password` e `auth reset-password`.

### GAP-04: Change Password (Usuário Logado)
- **API:** ❌ Não existe endpoint para trocar senha do usuário autenticado
- **WEB:** ❌ `/account` não tem UI de change password
- **CLI:** ❌ Não existe comando
- **Correção:**
  1. API: `POST /api/auth/change-password` (current_password, new_password) — valida current com bcrypt, atualiza hash, gera novo KDF salt, opcionalmente re-encripta wrapped_dek.
  2. WEB: Adicionar formulário em `/account`.
  3. CLI: Adicionar comando `auth change-password`.

### GAP-05: Update Profile (Nome/Email)
- **API:** ❌ Não existe `PATCH /api/auth/me` ou similar
- **WEB:** ❌ `/account` exibe nome/email em modo leitura apenas
- **CLI:** ❌ Não existe comando
- **Correção:**
  1. API: `PATCH /api/auth/me` — atualiza `name`, `email` (com validação de email único).
  2. WEB: Tornar campos editáveis em `/account`.
  3. CLI: Adicionar comando `profile update`.

### GAP-06: Delete Account
- **API:** ❌ Não existe `DELETE /api/auth/me`
- **WEB:** ❌ `/account` não tem botão de deletar conta
- **CLI:** ❌ Não existe comando
- **Correção:**
  1. API: `DELETE /api/auth/me` — soft-delete ou hard-delete em cascata (remover projetos onde é owner? transferir? definir política).
  2. WEB: Adicionar botão perigoso com confirmação em `/account`.
  3. CLI: Adicionar comando `profile delete`.

### GAP-07: Two-Factor Authentication (2FA/TOTP)
- **API:** ❌ Model `User` tem `two_factor_enabled` e `two_factor_secret`, mas **zero endpoints**
- **WEB:** ❌ `/account` exibe badge "2FA ativo" como leitura apenas, sem capacidade de ligar/desligar
- **CLI:** ❌ Não existe comando
- **Correção:**
  1. API: Criar endpoints `POST /api/auth/2fa/setup` (gera secret TOTP, retorna QR code URI), `POST /api/auth/2fa/verify` (valida código, ativa), `POST /api/auth/2fa/disable` (desativa com confirmação).
  2. WEB: Adicionar fluxo de setup 2FA em `/account`.
  3. CLI: Adicionar comando `auth 2fa setup` e `auth 2fa disable`.

---

## 4. Gaps Médios (P2 — WEB Não Implementa API Existente)

### GAP-08: API Keys (M3.4) — WEB Inexistente
- **API:** ✅ Endpoints completos em `/api/v1/projects/{id}/api-keys` (CRUD + revoke)
- **WEB:** ❌ Zero. Não existe `src/lib/api/api-keys.ts`, nem página, nem componente.
- **CLI:** ✅ Comandos `api-keys list/create/revoke` implementados
- **Correção:**
  1. WEB: Criar `src/lib/api/api-keys.ts`, adicionar painel em `/projects/[id]/settings` (ou nova tab). Permitir criar (com scopes, env, expiração), listar, revogar. Exibir plaintext uma única vez.
  2. Opcional: página de docs embutida já cobre API Keys — manter atualizada.

### GAP-09: Secret Rotation UI — WEB Incompleta
- **API:** ✅ Endpoints existem em `rotation.py` (mas ver GAP-01 — não registrado)
- **WEB:** ⚠️ Parcial. `rotationApi` só tem `listExpiring()`. Exibe `ExpirationBadge` mas **não permite** rotacionar manualmente, ver histórico, nem configurar expiração.
- **CLI:** ✅ Comandos completos: `rotate`, `expire`, `alert`, `rotation list`, `rotation history`
- **Correção:**
  1. WEB (pré-requisito: GAP-01): Adicionar à `rotationApi` métodos `rotateSecret()`, `getRotationHistory()`, `setExpiration()`, `deleteExpiration()`.
  2. WEB: Em `/projects/[id]/secrets`, adicionar ações de rotação no menu de cada secret (rotacionar agora, configurar expiração, ver histórico).
  3. WEB: Criar modal/formulário de configuração de expiração (dias, política: manual/notify/auto).

### GAP-10: Accept Invite — WEB Não Tem Fluxo
- **API:** ✅ `POST /api/v1/projects/{id}/invites/{invite_id}/accept`
- **WEB:** ❌ Não existe página `/invites/[token]` ou similar para aceitar convite. A página `/projects/[id]/members` permite criar/revogar convites, mas não aceitar.
- **CLI:** ✅ `invites accept ID` implementado
- **Correção:**
  1. WEB: Criar página pública ou logada `/invites/accept?token=xxx` que valida o token e permite o usuário aceitar o convite (login se necessário).
  2. Alternativa: endpoint de aceite via link com token JWT no email (webhook/email service necessário).

### GAP-11: OAuth Accounts Link/Unload na WEB
- **API:** ✅ `GET /api/auth/oauth/accounts` e `DELETE /api/auth/oauth/{provider}`
- **WEB:** ❌ `/account` não lista contas OAuth vinculadas nem permite desvincular
- **CLI:** ❌ Não existe comando (faz sentido ser web-only)
- **Correção:**
  1. WEB: Em `/account`, adicionar seção "Connected Accounts" listando GitHub/Google/Discord. Botão "Disconnect" para cada.
  2. Opcional: botão "Connect" para vincular conta OAuth adicional.

---

## 5. Gaps Menores (P3 — CLI Incompleto / Stubs)

### GAP-12: CLI Client Faltam 8 Métodos
- **Onde:** `apps/cli/src/criptenv/api/client.py`
- **Faltam:**
  1. `list_ci_secrets_keys()` → `GET /api/v1/ci/secrets/list`
  2. `delete_ci_token()` → `DELETE /api/v1/projects/{id}/tokens/{tid}`
  3. `get_integration()` → `GET /api/v1/projects/{id}/integrations/{iid}`
  4. `delete_expiration()` → `DELETE /api/v1/projects/{id}/environments/{eid}/secrets/{key}/expiration`
  5. `get_api_key()` → `GET /api/v1/projects/{id}/api-keys/{kid}`
  6. `update_api_key()` → `PATCH /api/v1/projects/{id}/api-keys/{kid}`
  7. `list_oauth_accounts()` → `GET /api/auth/oauth/accounts`
  8. `unlink_oauth_account()` → `DELETE /api/auth/oauth/{provider}`
- **Correção:** Adicionar métodos ao `CriptEnvClient`. Adicionar comandos CLI correspondentes onde fizer sentido (especialmente `api-keys update`, `ci tokens delete`, `integrations info`).

### GAP-13: Railway Provider Stub
- **Onde:** `apps/cli/src/criptenv/commands/integrations.py` e `apps/api/app/strategies/integrations/`
- **Impacto:** CLI aceita `railway` mas retorna erro. API tem `railway` registrado em `base.py` (registry) mas sem provider implementado.
- **Correção:** Implementar `RailwayProvider` na API (seguindo padrão de `VercelProvider`/`RenderProvider`) ou remover `railway` das choices da CLI até implementar.

### GAP-14: Audit Export na WEB?
- **API:** ✅ Audit logs com filtros
- **WEB:** ❌ Página `/projects/[id]/audit` exibe logs, mas não permite exportar para JSON/CSV
- **CLI:** ✅ `audit export --format json/csv` implementado
- **Correção:** Adicionar botão "Export" na página de audit da WEB.

---

## 6. Gaps de Documentação / Meta

### GAP-15: AGENTS.md Desatualizado
- **Onde:** `AGENTS.md` menciona `src/stores/project.ts` — arquivo **não existe**
- **Correção:** Remover referência ou criar a store se necessário.

### GAP-16: API Keys Registrado Indiretamente
- **Onde:** `api_keys_router` não está em `main.py`, mas sim dentro de `v1_router` em `v1.py`
- **Impacto:** Confusão na navegação do código. Rota funciona, mas não é óbvio.
- **Correção:** Mover registro direto para `main.py` para consistência com outros routers.

---

## 7. Matriz de Coerência API/WEB/CLI

| Domínio | API | WEB | CLI | Status |
|---------|-----|-----|-----|--------|
| Auth (signup/signin/signout/session) | ✅ | ✅ | ✅ | ✅ Alinhado |
| OAuth (GitHub/Google/Discord) | ✅ | ✅ | ⚠️ | ⚠️ CLI não faz OAuth (device flow sim) |
| CLI Auth (device/browser) | ✅ | ✅ | ✅ | ✅ Alinhado |
| Forgot/Reset Password | ❌ | ⚠️ UI sem API | ❌ | 🔴 Desalinhado |
| Change Password | ❌ | ❌ | ❌ | 🔴 Desalinhado |
| Update Profile | ❌ | ❌ | ❌ | 🔴 Desalinhado |
| Delete Account | ❌ | ❌ | ❌ | 🔴 Desalinhado |
| 2FA/TOTP | ❌ | ⚠️ leitura | ❌ | 🔴 Desalinhado |
| OAuth Link/Unload | ✅ | ❌ | N/A | 🟡 API sobrando |
| Projects CRUD | ✅ | ✅ | ✅ | ✅ Alinhado |
| Project Rekey | ✅ | ✅ | ❌ quebrado | 🔴 CLI quebrado |
| Environments CRUD | ✅ | ⚠️ lista/create/delete | ✅ | 🟡 WEB sem update? |
| Vault Push/Pull | ✅ | ✅ | ✅ | ✅ Alinhado |
| Secrets CRUD (local) | N/A | N/A | ✅ | N/A |
| Import/Export .env | N/A | ✅ | ✅ | ✅ Alinhado |
| Members CRUD | ✅ | ✅ | ✅ | ✅ Alinhado |
| Invites (create/revoke) | ✅ | ✅ | ✅ | ✅ Alinhado |
| Invites (accept) | ✅ | ❌ | ✅ | 🟡 WEB faltando |
| Audit Logs | ✅ | ✅ | ✅ | ✅ Alinhado |
| Audit Export | ✅ | ❌ | ✅ | 🟡 WEB faltando |
| CI Tokens (gerenciamento) | ✅ | ✅ | ✅ | ✅ Alinhado |
| CI/CD (runtime) | ✅ | N/A | ✅ | N/A |
| Secret Rotation | ❌ não registrado | ⚠️ parcial | ✅ | 🔴 Desalinhado |
| Secret Expiration | ❌ não registrado | ⚠️ exibe só | ✅ | 🔴 Desalinhado |
| API Keys (M3.4) | ✅ | ❌ | ✅ | 🔴 Desalinhado |
| Integrations (Vercel/Render) | ✅ | ✅ | ✅ | ✅ Alinhado |
| Integrations (Railway) | ⚠️ stub | ✅ docs | ❌ stub | 🟡 Não implementado |
| Contributions/Pix | ✅ | ✅ | ❌ | 🟡 CLI não precisa |
| Webhooks (MercadoPago) | ✅ | N/A | N/A | N/A |

> **Legenda:** ✅ Completo / ⚠️ Parcial / ❌ Ausente / 🔴 Crítico / 🟡 Médio

---

## 8. Plano de Execução Recomendado

### Wave 1: Correções Críticas (P0) ✅ CONCLUÍDA
1. **GAP-01:** Registrar `rotation.py` em `main.py` ✅
2. **GAP-02:** Corrigir `rekey_project()` no CLI client para enviar payload completo ✅

### Wave 2: Auth do Usuário (P1) ✅ CONCLUÍDA
3. **GAP-03:** Implementar forgot/reset password na API + WEB ✅
4. **GAP-04:** Implementar change password na API + WEB + CLI ✅
5. **GAP-05:** Implementar update profile na API + WEB + CLI ✅
6. **GAP-07:** Implementar 2FA na API + WEB + CLI ✅
7. **GAP-06:** Implementar delete account na API + WEB + CLI ✅

### Wave 3: WEB Cobrindo API (P2) ✅ CONCLUÍDA
8. **GAP-08:** Implementar UI de API Keys na WEB ✅
9. **GAP-09:** Complementar UI de Secret Rotation (pré-requisito Wave 1) ✅
10. **GAP-10:** Criar fluxo de aceite de convite na WEB ✅
11. **GAP-11:** Adicionar OAuth accounts link/unload em `/account` ✅

### Wave 4: CLI Completo (P3) ✅ CONCLUÍDA
12. **GAP-12:** Adicionar 8 métodos faltantes ao CLI client + comandos ✅
13. **GAP-13:** Implementar RailwayProvider ou remover stub ✅ (removido das choices)
14. **GAP-14:** Adicionar export de audit na WEB ✅ (CSV + JSON)

### Wave 5: Polish (P3) ✅ CONCLUÍDA
15. **GAP-15:** Atualizar `AGENTS.md` ✅
16. **GAP-16:** Consistentizar registro de routers em `main.py` ✅ (verificado como intencional)

---

## 9. Estimativa de Esforço

| Wave | Tarefas | Estimativa |
|------|---------|------------|
| Wave 1 (P0) | 2 gaps | ~4h |
| Wave 2 (P1) | 5 gaps | ~16-24h |
| Wave 3 (P2) | 4 gaps | ~12-16h |
| Wave 4 (P3) | 3 gaps | ~6-8h |
| Wave 5 (Polish) | 2 gaps | ~2h |
| **Total** | **16 gaps** | **~40-54h** |

---

## 10. Riscos e Dependências

1. **Email Service (GAP-03):** Forgot password requer envio de email. Se não houver serviço configurado (SMTP/Resend/SendGrid), o endpoint pode retornar o token no response para testes locais (não seguro em produção).
2. **2FA Secret Storage (GAP-07):** O campo `two_factor_secret` no modelo `User` precisa ser criptografado em repouso (atualmente provavelmente em plaintext).
3. **Delete Account Cascata (GAP-06):** Decidir política — deletar projetos onde é owner? Transferir ownership? Impedir delete se for owner?
4. **Railway API (GAP-13):** Railway não tem API pública oficial de env vars (usa GraphQL interno). Implementação pode ser complexa.
