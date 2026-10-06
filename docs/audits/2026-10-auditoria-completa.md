# Auditoria Completa — CriptEnv (2026-10)

**Escopo:** API, CLI, Web, infraestrutura/processo. Auditoria de código feita com leitura real dos arquivos; evidências citadas como `arquivo:linha` aproximada.
**Validação executada nesta auditoria:** API `585 passed, 2 skipped` · CLI `191 passed` · Web `107 passed` (26 suites) — todas verdes.

---

## 1. Sumário executivo

O projeto está **maduro e saudável no geral**: CI completo (5 workflows), Docker multi-stage, migrations Alembic lineares com downgrades reais, dependências pinned, arquitetura em camadas (services/strategies) deny-by-default, e correções de segurança anteriores verificadas no código. Os problemas reais concentram-se em:

1. **1 P0 de segurança novo** — account takeover via OAuth com e-mail não verificado.
2. **1 P0 de produto** — ExportModal expõe todos os segredos em plaintext na tela.
3. **2 bugs funcionais** — `criptenv ci login` quebra em runtime (`import json` faltando) e provável `MissingGreenletError` no auth por API key com banco real.
4. **Documentação de agente mentirosa** — AGENTS.md/CLAUDE.md negam a existência de CI e Docker que existem.
5. **Observabilidade inexistente** — sem logging estruturado, Sentry, métricas ou request-id.
6. **Dívida frontend** — React Query declarado e nunca usado; cache caseiro duplicando esse papel.

---

## 2. Pontos fortes (verificados)

- **Cripto CLI correta**: AES-256-GCM com IV de 12 bytes por encriptação e tag validada; PBKDF2 com salt de 32 bytes por projeto; HKDF por ambiente; verifier cifrado (`apps/cli/src/criptenv/crypto/`).
- **Zero-knowledge no web**: crypto store memory-only; sessão por cookie HTTP-only revalidada no load; sem XSS (3 `dangerouslySetInnerHTML`, todos scripts de tema estáticos); open redirect corrigido.
- **Hardening anterior confirmado**: sessões/CI/API keys como digest; PKCE S256 + loopback no device flow; rate limit por credencial com trusted proxies; fail-fast de DEBUG/CORS em prod.
- **Infra**: `security.yml` com Gitleaks + CodeQL + pip-audit + npm audit + Trivy (histórico mostra fixes de CVEs reais); health checks em `/health` e `/health/ready`; entrypoint roda `alembic upgrade head`.
- **Docs de projeto** (`docs/project/current-state.md`) honestas sobre lacunas.

---

## 3. Problemas por severidade

### P0 — corrigir imediatamente

| # | Onde | Problema |
|---|------|----------|
| P0-1 | API `app/services/oauth_service.py:360-369, 142-154, 194-209` | **ATO via OAuth**: link automático de conta OAuth a User existente por e-mail sem checar `email_verified` (Google) e aceitando e-mail não verificado (Discord). Atacante registra o e-mail da vítima no provider e assume a conta. Fix: só linkar com e-mail verificado pelo provider; senão fluxo de confirmação. |
| P0-2 | Web `export-modal.tsx:55-59` | **Export renderiza todos os segredos em plaintext** num `<textarea>` sem re-confirmação. Gerar o arquivo on-demand no click, sem preview, ou exigir senha do vault novamente. |

### P1 — alta prioridade

**API:**
- Tokens de **reset de senha e verificação de e-mail em plaintext** no DB (`models/user.py:95,110`) — guardar sha256/digest como nas sessões.
- **Race no `expected_version`** (`services/vault_service.py:56-73`): read-then-write sem `FOR UPDATE` nem `UPDATE ... WHERE secrets_version = expected` → lost update silencioso.
- **`rotate_secret` não incrementa `secrets_version`** nem usa OCC (`services/rotation_service.py:200-271`) — cache por versão não detecta rotação; push concorrente pode ressuscitar ciphertext antigo.
- **Provável lazy-load quebrado em API key auth** (`middleware/api_key_auth.py:119-141`, sem eager loading no app) — testes só passam porque mockam o repositório. Reproduzir com PG real.
- **Integrações recebem plaintext** dos segredos (`routers/integrations.py:68-71`) — quebra a proposta zero-knowledge; decidir: documentar exceção ou cifrar por projeto.

**CLI:**
- **`ci login` quebra em runtime**: `queries.py:282` usa `json.dumps` sem `import json` no escopo (import só dentro de `get_active_ci_session`, linha 293). Nenhum teste cobre `save_ci_session`. Fix de 1 linha + teste.
- **Segredos como flags/argumentos de comando** (`ci.py:149`, `login.py:259-261`, `secrets.py:15-33`) — expõem no history do shell e no `ps`. Usar prompts ocultos, stdin, `--value-file`.
- **`pull`/`export` escrevem plaintext com umask 0644** (`sync.py:94`, `import_export.py:142`) — criar com 0600.

**Web:**
- **Rotação com dupla escrita** (rotation API + push completo do vault, `use-project-secrets.ts:410-424`) — divergência sem rollback se o push falhar.
- **Modais hand-rolled** sem focus trap/Esc/`aria-modal` (`secret-form.tsx:69-76`, `export-modal.tsx:34-40`) — usar Radix Dialog como nos outros modais.
- **Cache GET caseiro de 15s** com invalidação global blunt (`lib/api/client.ts:476-624`) + `peekCached` lido durante render.

**Infra:**
- **AGENTS.md:265,390 e CLAUDE.md desatualizados** — afirmam "sem CI/sem Docker"; qualquer agente IA ou dev novo toma decisão errada.
- **Observabilidade zero**: `logging.basicConfig` texto plano (`main.py:36`), prod loga só WARNING+, sem Sentry/métricas/request-id.

### P2 — médio prazo (seleção)

- OAuth access/refresh tokens dos providers em plaintext no DB (`models/oauth_account.py`).
- Boundary transacional inconsistente: services com `commit()` interno antes do audit log (`rotation_service.py:75,117,268,359`; `integration_service.py:162,174,234,251`).
- Write-per-request (`last_accessed_at` por validação de sessão; commit de `last_used_at` por request de API key).
- Rate limit de sessão keyado por IP (NAT compartilha bucket); contador Redis não atômico (`rate_limit.py:154-185, 279-283`).
- 2FA sem lockout por desafio (só 5/min por IP) — brute force distribuído de TOTP.
- Vault push exige `admin` mas pull aceita viewer — developers não escrevem (confirmar intenção).
- Discord cria conta com e-mail sintético `email_verified=True` (`oauth_service.py:202,382`).
- CLI: sem tratamento amigável de 401 ("rode `criptenv login`"); AsyncClient novo por request (sem retry/backoff); downgrade de iterações PBKDF2 aceito do servidor; SQLite sem WAL/busy_timeout; PBKDF2 100k vs recomendação OWASP 600k.
- Web: `account/page.tsx` com 1078 linhas; `state` do hook não memoizado (re-renders em cascata); `clipboard.writeText("")` limpa clipboard do usuário sem aviso; OAuth callback reflete `errorParam` da URL.
- Infra: **container da API roda como root sem HEALTHCHECK no Dockerfile**; ~83 PNGs de preview commitados na raiz; `make lint` não cobre Python (sem ruff/mypy); branches mortas + worktree docker duplicada.

### P3 — backlog

- API: rotas legacy + v1 duplicadas; helpers repetidos (`_set_session_cookie` etc.); caminho morto em `get_current_ci_user`; `oauth_state` cookie sempre `secure=True` (quebra dev HTTP); índices faltando em `vault_blobs`; `class Config` Pydantic deprecated.
- CLI: fallback silencioso para ambiente "production"; CISessionManager duplica SessionManager; padrão de except repetido em ~15 comandos; `secrets alert` grava expiração de 90 dias como efeito colateral.
- Web: `document.execCommand` deprecated; safeParse manual no secret-form (inconsistente com RHF+zodResolver); monkey-patch de `console.warn`.

---

## 4. Gaps de testes (críticos)

1. **OAuth com e-mail não verificado / link por e-mail** — o teste mais urgente dado o P0-1.
2. **`use-project-secrets.ts`** (535 linhas, coração do zero-knowledge no web) — zero testes: conflito `expected_version`, rotação, lock/unlock.
3. **API key auth contra banco real** (hoje só mocks — esconderia o P1 do lazy-load).
4. **Concorrência real**: expected_version e push-vs-rotate.
5. **`save_ci_session` e comandos `ci`/`login` no CLI** — o bug do `import json` passou pela suíte.
6. `test_rotation_commands.py:30` testa `client.rotate_secret`, método que o código real não usa — teste do caminho errado.
7. ~~`testsprite_tests/` ainda assertam comportamento pré-fix~~ — **resolvido na Sprint 3**: suíte obsoleta removida (coberta pelas suítes mantidas, que rodam no CI).

---

## 5. Ideias de produto (vs Doppler/Infisical)

**CLI:**
- `criptenv run -- <comando>` — injetar segredos como env vars num subprocesso (o comando-curinga que falta).
- `criptenv diff` local vs remoto; `secrets copy --env dev --to staging`.
- `secrets edit` no `$EDITOR` com re-criptografia atômica; `--json` em todos os listes; `eval "$(criptenv export --shell)"`.
- Auto-retry do 409 com refresh de estado; fallback de ambientes no pull (estilo Infisical).

**API:**
- Webhooks de auditoria por projeto com assinatura HMAC (notificar acesso a segredos).
- Endpoint de "vault diff" por checksum (CLI sincroniza sem baixar tudo).
- Rotação automática de CI tokens com alerta pré-expiração.
- Trilha de auditoria append-only com hash chain (compliance, abre caminho Phase 4).

**Web:**
- Auto-lock do vault por inatividade (`unlockedAt` já existe em `crypto.ts:13` e nunca expira).
- Tratamento amigável de conflito de versão ("recarregar e tentar de novo").
- Diff/preview ao importar `.env`; opção de export cifrado.

---

## 6. Roadmap recomendado

> **Status de execução:** **Sprint 1 concluído** (P0-1, P0-2, fix do `import json`, lazy-load do API key auth reproduzido e corrigido, AGENTS.md/CLAUDE.md sincronizados, Dockerfile non-root + healthcheck, PNGs da raiz removidos). **Sprint 2 concluído** (OCC real no vault + rotação incrementando `secrets_version`, digests para reset/verificação, tokens OAuth cifrados, lockout 2FA, rate limit atômico, logging JSON + request-id + Sentry opcional, hardening do CLI, React Query como store único no web). **Sprint 3 concluído** (transações unificadas, Radix Dialog + quebra da página de conta, `criptenv run`/`diff`, lint Python e gate de migrações no CI, limpeza de `testsprite_tests/` e de 14 branches mergeadas). Suítes finais: **API 615 · CLI 210 · Web 113**, ruff, lint e build verdes. Detalhes em DEC-064/DEC-065/DEC-066 e no CHANGELOG.

> **Achado extra dos gates novos:** o ruff (F823) revelou que `criptenv integrations connect` falhava com `UnboundLocalError` em **100% das execuções** — mesmo padrão do bug do `import json` da Sprint 1 (código nunca exercitado por testes). Corrigido com `nonlocal` e teste de regressão que falha sem o fix.

**Sprint 1 (quick wins, ~2-3 dias):**
1. Fix P0-1 (OAuth `email_verified`) + testes de regressão.
2. Fix P0-2 (export sem preview em plaintext).
3. Fix `import json` no `queries.py` + teste.
4. Reproduzir e corrigir lazy-load de API key auth com PG real.
5. Corrigir AGENTS.md/CLAUDE.md (CI e Docker existem).
6. `USER` não-root + HEALTHCHECK no Dockerfile da API; remover PNGs da raiz.

**Sprint 2 (1-2 semanas):**
7. OCC real no vault (`FOR UPDATE`/UPDATE condicional) + rotação incrementando `secrets_version`; testes de concorrência.
8. Digest para tokens de reset/verificação; cifrar OAuth tokens de provider.
9. Logging estruturado (structlog JSON) + Sentry + request-id middleware.
10. Migrar web para React Query e deletar o cache caseiro do `client.ts`.
11. Lockout por desafio 2FA; rate limit Redis atômico (INCR).
12. CLI: prompts ocultos para segredos, export 0600, 401 com mensagem acionável, piso de iterações PBKDF2.

**Sprint 3 (contínuo):**
13. Unificar transações (services só flush; `get_db` commita) + eager loading em auth.
14. Modais Radix + quebrar `account/page.tsx` em componentes.
15. `criptenv run`/`diff` (diferencial de produto).
16. CI: ruff no pipeline, `alembic heads` check, E2E como required check; limpar branches mortas e `testsprite_tests/`.
