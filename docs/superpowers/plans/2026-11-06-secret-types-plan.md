# Tipos Config/Secret — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada variável de ambiente de projeto ganha o tipo `config` ou `secret`. O tipo é guardado sem perda em qualquer push. O web e a CLI conseguem marcar o tipo, e o sync com a Vercel envia o tipo certo.

**Architecture:**
- **Guarda:** coluna `kind` em texto claro em `vault_blobs`.
- **Preservação:** o push do vault apaga e regrava todas as linhas do ambiente. Quando um blob chega sem `kind`, o servidor copia o `kind` que a mesma `key_id` tinha antes.
- **Sync:** o `kind` viaja em `SyncSecret`. Se vier ausente, o sync se comporta como hoje.
- **Vercel:** só o `VercelProvider` lê o tipo. Quando o tipo enviado não bate com o que já está na Vercel, ele tira só o target sincronizado do registro existente (PATCH, ou DELETE se o registro só cobre esse target) e então cria a variável.

**Tech Stack:**
- API: FastAPI, SQLAlchemy async, Alembic, httpx, pytest.
- Web: React 19, next-intl, Jest/RTL.
- CLI: Click, pytest.

**Spec:** `docs/superpowers/specs/2026-11-06-secret-types-design.md`

## Global Constraints

- **Valores do tipo:** exatamente `"config"` e `"secret"`. Padrão `"config"`.
- **Payload para a Vercel:**
  - Secret: `"type": "sensitive", "visibility": "secret"`.
  - Config: `"type": "encrypted", "visibility": "config"`.
  - Tipo ausente: o payload de hoje, `"type": "encrypted"` sem `visibility`.
- **Dentro do CriptEnv o tipo não esconde nada:** reveal, copiar e editar continuam iguais para os dois tipos.
- **O `kind` não entra no checksum do blob.** Clientes antigos validam o checksum sem ele.
- **Conversão na Vercel:** só acontece para itens com `kind` explícito. Sem `kind`, nunca apaga, edita nem lista nada a mais.
- **Textos:** os rótulos aparecem como "Config" e "Secret" em pt-BR, en e es.
- **Flags da CLI:** `--secret` / `--config`. Sem flag, uma chave existente mantém o tipo e uma chave nova vira `config`.
- **Nada de valor de secret em log, mensagem de erro ou audit.** Nomes de chave podem aparecer.

## Review Focus

1. **Registro da Vercel sem `target`, ou com `target` em string em vez de lista.** O código precisa tratar como lista, do mesmo jeito que `pull_secrets` já faz.
2. **Dois registros na Vercel com a mesma chave em targets diferentes** (um `sensitive` em production, um `encrypted` em preview). Só o registro que cobre o target sincronizado pode ser tocado.
3. **Registro com `gitBranch`.** Ele é ignorado e nunca é editado nem apagado.
4. **Push do vault que renomeia uma chave** (some `A`, aparece `B` sem `kind`). `B` nasce `config`; ela não herda o tipo de `A`.
5. **Rotação e import pelo web** (`projects/[id]/settings/page.tsx` e o import de `.env`) mandam a lista inteira sem `kind`. Os tipos precisam sobreviver.

Cada item tem um teste na tarefa que é dona do código: itens 1–3 na Tarefa 2, itens 4–5 na Tarefa 1.

---

### Task 1: API — coluna `kind`, schemas e preservação no push

**Files:**
- Modify: `apps/api/app/models/vault.py` (VaultBlob)
- Create: `apps/api/migrations/versions/20261106_0016_add_kind_to_vault_blobs.py`
- Modify: `apps/api/app/schemas/vault.py` (VaultBlobPush, VaultBlobPull)
- Modify: `apps/api/app/strategies/vault_push.py` (ReplaceAllVaultBlobsStrategy.push)
- Modify: `apps/api/tests/test_strategy_vault.py` (só o ajuste da contagem de `executed`)
- Test: `apps/api/tests/test_vault_secret_kind.py` (novo; use o padrão de engine SQLite em memória de `tests/test_personal_vault.py`)

**Interfaces:**
- Produces:
  - `SecretKind = Literal["config", "secret"]`, exportado de `app/schemas/vault.py`.
  - `VaultBlobPush.kind: SecretKind | None = None`.
  - `VaultBlobPull.kind: SecretKind`.
  - `VaultBlob.kind`: `Column(String(16), nullable=False, server_default="config", default="config")`.

- [ ] **Step 1: Write the failing tests** em `test_vault_secret_kind.py`. Todos fazem o push com `VaultService.push_blobs` contra SQLite real.
  - `test_new_blob_without_kind_is_config`: um push de `[{key_id:"A", ...}]` sem `kind` grava `kind == "config"`.
  - `test_explicit_kind_is_stored`: um push com `kind="secret"` grava `"secret"`, e o pull devolve `"secret"`.
  - `test_push_without_kind_keeps_previous_kind`: primeiro push `A` com `secret`; segundo push `A` sem `kind` → continua `"secret"`.
  - `test_explicit_kind_overrides_previous`: primeiro `A` com `secret`; depois `A` com `config` → `"config"`.
  - `test_renamed_key_does_not_inherit_kind` (Review Focus 4): primeiro `A` com `secret`; depois só `B` sem `kind` → `B == "config"`.
  - `test_full_list_resend_without_kinds_preserves_all` (Review Focus 5): `A` com `secret` e `B` com `config`; reenvio dos dois sem `kind` → os tipos continuam os mesmos.
  - `test_invalid_kind_rejected`: `VaultBlobPush(kind="public", ...)` gera `ValidationError`.
  - `test_kind_is_scoped_to_environment`: `A` é `secret` no ambiente 1; um push de `A` sem `kind` no ambiente 2 → `"config"`.

- [ ] **Step 2: Run** `cd apps/api && .venv/bin/python -m pytest tests/test_vault_secret_kind.py -q`
  Expected: FAIL (`VaultBlob` has no attribute `kind` / `ValidationError` not raised).

- [ ] **Step 3: Implement**
  - Coluna `kind` no model, com os valores do bloco Interfaces.
  - Migration `20261106_0016`, revisando `20261106_0015`, no mesmo formato da 0015: `add_column` não nula com `server_default="config"`; `downgrade` faz `drop_column`.
  - `SecretKind` e os campos novos em `schemas/vault.py`.
  - Em `ReplaceAllVaultBlobsStrategy.push`, **antes** do DELETE: `SELECT key_id, kind` daquele `environment_id`, montando o dict `previous`. Cada blob novo recebe `kind = blob_data.get("kind") or previous.get(key_id, "config")`.
  - Ajustar `test_replace_all_vault_blobs_strategy_deletes_and_creates_blobs` para contar 2 execuções (o SELECT e o DELETE). O `FakeDb` devolve um resultado vazio para o SELECT: adicione um `FakeResult` com `.all()` retornando `[]`, se o SELECT usar `.all()`.

- [ ] **Step 4: Run** `cd apps/api && .venv/bin/python -m pytest tests/test_vault_secret_kind.py tests/test_strategy_vault.py tests/test_vault_concurrency.py tests/test_project_vault_security.py -q`
  Expected: PASS.

- [ ] **Step 5: Run the migration against Postgres.** Use o container `criptenv-postgres-e2e` (`docker start criptenv-postgres-e2e`, e `alembic upgrade head` com a URL que o e2e já usa). Expected: upgrade e downgrade de 0016 sem erro.

- [ ] **Step 6: Commit** `feat(api): store a config/secret kind per vault blob and keep it across pushes`

---

### Task 2: API — sync com tipo e conversão na Vercel

**Files:**
- Modify: `apps/api/app/strategies/integrations/base.py` (IntegrationProvider)
- Modify: `apps/api/app/strategies/integrations/vercel.py`
- Modify: `apps/api/app/services/integration_service.py` (`sync_integration`, ramo push)
- Modify: `apps/api/app/routers/integrations.py` (SyncSecret, SyncResponse, retorno do sync)
- Test: `apps/api/tests/test_integration_provider_contracts.py` (classe `TestVercelContract`, fixture `http` existente)
- Test: o teste do router de sync que já cobre push (procure por `SyncResponse` / `"direction": "push"` em `apps/api/tests/`)

**Interfaces:**
- Consumes: `SecretKind` (Task 1).
- Produces:
  - `SyncSecret.kind: SecretKind | None = None`.
  - `SyncResponse.recreated: Optional[list[str]] = None`: nomes das chaves que foram tiradas de um registro existente e criadas de novo com o outro tipo.
  - `IntegrationProvider.recreated_keys: tuple[str, ...] = ()`: atributo de classe. O provider é instanciado por chamada (`get_provider`), então a instância pode sobrescrever.
  - `sync_integration` continua retornando `(success, error, third)`. No push, o terceiro valor passa a ser `list(provider.recreated_keys)` em vez de `[]`; o docstring é atualizado.
  - `VercelProvider._list_envs(client, project_id) -> list[dict]`: a paginação que hoje vive dentro de `pull_secrets`, extraída sem mudar o comportamento.

- [ ] **Step 1: Write the failing tests** em `TestVercelContract`. As rotas usam `routes[(METHOD, path)]`.
  - `test_push_without_kind_keeps_todays_payload_and_lists_nothing`: o teste existente `test_push_upserts_all_secrets_in_one_request` continua igual. Some uma asserção de que `len(calls) == 1` (nenhum GET de listagem).
  - `test_push_sends_type_and_visibility_per_kind`: secrets `[{key:"A",value:"1",kind:"secret"},{key:"B",value:"2",kind:"config"}]` para `"development"`, com a listagem vazia (`GET /v10/projects/prj_1/env` → `{"envs":[]}`). O corpo do POST precisa ser:
    ```python
    [
        {"key": "A", "value": "1", "type": "sensitive", "visibility": "secret", "target": ["development"]},
        {"key": "B", "value": "2", "type": "encrypted", "visibility": "config", "target": ["development"]},
    ]
    ```
  - `test_config_over_single_target_secret_deletes_then_creates`: a listagem tem `{"id":"env_1","key":"B","type":"sensitive","target":["production"]}`; push de B como `config` em production.
    - Ordem das chamadas: GET, depois `DELETE /v9/projects/prj_1/env/env_1`, depois POST.
    - `provider.recreated_keys == ("B",)`.
  - `test_secret_over_single_target_config_deletes_then_creates`: o mesmo cenário ao contrário (o registro é `encrypted` e o push manda `secret`).
  - `test_mismatch_on_multi_target_record_patches_out_only_this_target`: o registro tem `target: ["production","preview"]`, tipo `sensitive`; push de B como `config` em production.
    - `PATCH /v9/projects/prj_1/env/env_1` com corpo `{"target": ["preview"]}`, depois o POST.
    - Nenhum DELETE.
  - `test_matching_kind_does_not_touch_record`: o registro é `sensitive` e o push manda `secret` → só GET e POST.
  - `test_record_with_git_branch_is_ignored` (Review Focus 3): um registro `sensitive` com `gitBranch: "feat"` e um push `config` → nenhum PATCH/DELETE.
  - `test_record_target_as_string` (Review Focus 1): `target: "production"`, tipo `sensitive`, push `config` → DELETE.
  - `test_other_target_record_untouched` (Review Focus 2): a listagem tem B `sensitive` em `["preview"]` e B `encrypted` em `["production"]`; push B `config` em production → nenhum PATCH/DELETE.
  - `test_patch_failure_aborts_before_any_delete`: dois desencontros, B (vários targets) e C (target único). O PATCH de B responde 400.
    - Levanta `ProviderError`; a mensagem cita `B` e o target `preview`.
    - Nenhum DELETE e nenhum POST acontecem.
  - `test_create_failure_after_removal_names_missing_keys`: um desencontro em C; o DELETE responde 200 e o POST devolve `{"failed":[{"error":{"envVarKey":"C","message":"bad"}}]}`.
    - Levanta `ProviderError`, e a mensagem contém `Removed from Vercel production and not recreated: C`.
  - No teste do router de push: um `sync_integration` falso que retorna `(True, None, ["B"])` → a resposta tem `recreated == ["B"]`. Com `(True, None, [])` → `recreated is None`.

- [ ] **Step 2: Run** `cd apps/api && .venv/bin/python -m pytest tests/test_integration_provider_contracts.py -q -k Vercel`
  Expected: FAIL nos testes novos; os antigos continuam passando.

- [ ] **Step 3: Implement** `VercelProvider.push_secrets`:
  1. Montar o payload: o item recebe `type`/`visibility` pelo `kind` de cada secret (Global Constraints); sem `kind`, fica o item de hoje.
  2. Se nenhum item tem `kind`: POST como hoje e fim.
  3. `_list_envs`. Para cada secret com `kind`, selecionar os registros com `key` igual, que cobrem `environment` (normalizando `target` em string para lista), sem `gitBranch`, e cujo `type == "sensitive"` é diferente de `kind == "secret"`.
  4. Primeiro todos os PATCH (registros com outros targets, corpo `{"target": outros}`). Na primeira falha, levantar `ProviderError` com a chave e os outros targets, e dizer que nada foi apagado. As chaves já editadas entram na mesma mensagem como removidas.
  5. Depois os DELETE (registros só deste target).
  6. Depois o POST. As chaves removidas que voltarem em `failed`, ou que não foram criadas porque o POST deu erro, entram em `ProviderError` com o texto exato `Removed from Vercel {environment} and not recreated: {chaves separadas por ", "}`, seguido dos detalhes que já existem hoje.
  7. Em sucesso: `self.recreated_keys = tuple(chaves removidas)`.
  - **Ruling previsto (spec, "Deixado para o builder"):** sem acesso à API real para saber se `upsert` converte o tipo no mesmo lugar, a mudança Config→Secret também usa tirar-e-criar. Registre no ledger.
  - **Endpoints:** `PATCH` e `DELETE` em `/v9/projects/{id}/env/{envId}`. Confira contra <https://vercel.com/docs/rest-api> antes de fechar; se o caminho for outro, use o da doc e registre.
  - **Router:** `SyncSecret.kind`; `SyncResponse.recreated` preenchido só em push e só quando a lista não está vazia.
  - **Audit:** inclua `recreated` no metadata (só nomes).

- [ ] **Step 4: Run** `cd apps/api && .venv/bin/python -m pytest tests/ -q -k "integration or sync or vault"`
  Expected: PASS.

- [ ] **Step 5: Commit** `feat(api): sync the config/secret kind to Vercel and convert mismatched records safely`

---

### Task 3: Web — tipo no formulário, na lista e no sync

**Files:**
- Modify: `apps/web/src/lib/api/client.ts` (VaultBlob, VaultBlobPush; exportar `SecretKind`)
- Modify: `apps/web/src/lib/api/integrations.ts` (tipo do item do sync push e da resposta)
- Modify: `apps/web/src/components/shared/secret-row.tsx` (DecryptedSecret + badge)
- Modify: `apps/web/src/components/shared/secret-form.tsx` (SecretFormValue + controle)
- Modify: `apps/web/src/app/[locale]/(dashboard)/projects/[id]/secrets/vault-crypto.ts`
- Modify: `apps/web/src/app/[locale]/(dashboard)/projects/[id]/secrets/use-project-secrets.ts` (saveSecret)
- Modify: `apps/web/src/app/[locale]/(dashboard)/projects/[id]/secrets/secrets-client.tsx` (passar `kind` como `initialValue` ao editar, se for ele quem monta o form)
- Modify: `apps/web/src/components/shared/sync-modal.tsx`
- Modify: `apps/web/messages/{pt-BR,en,es}/secrets.json`
- Test: `apps/web/src/app/[locale]/(dashboard)/projects/[id]/secrets/__tests__/vault-crypto.test.ts`, e em `apps/web/src/components/shared/__tests__/`: `secret-form.test.tsx`, `secret-row.test.tsx`, `sync-modal.test.tsx`.

**Interfaces:**
- Consumes: `kind` em pull e push do vault (Task 1); `SyncSecret.kind` e `SyncResponse.recreated` (Task 2).
- Produces:
  - `export type SecretKind = "config" | "secret"` em `lib/api/client.ts`.
  - `VaultBlob.kind: SecretKind` e `VaultBlobPush.kind?: SecretKind`.
  - `DecryptedSecret.kind?: SecretKind`.
  - `SecretFormValue.kind: SecretKind`.

**Textos** (namespace `secrets.kinds`, novo):

| chave | pt-BR | en | es |
|---|---|---|---|
| `label` | Tipo | Type | Tipo |
| `config` | Config | Config | Config |
| `configHint` | Dá para ler na Vercel | Readable in Vercel | Se puede leer en Vercel |
| `secret` | Secret | Secret | Secret |
| `secretHint` | Na Vercel ninguém lê depois de salvo | No one can read it in Vercel after saving | En Vercel nadie lo lee después de guardarlo |

Em `secrets.sync`, a chave `recreated`:
- pt-BR: "Recriadas na Vercel com o novo tipo: {keys}"
- en: "Recreated in Vercel with the new type: {keys}"
- es: "Recreadas en Vercel con el nuevo tipo: {keys}"

- [ ] **Step 1: Write the failing tests**
  - **vault-crypto:**
    - `decryptVault` copia `blob.kind` para `secret.kind`.
    - `encryptVault` inclui `kind` quando o secret tem `kind`, e não inclui a chave `kind` quando não tem.
  - **secret-form:**
    - O form novo mostra o grupo "Tipo" com "Config" marcado.
    - Escolher "Secret" e salvar chama `onSubmit` com `{key:"DATABASE_URL", value:"postgres://localhost", kind:"secret"}`.
    - Com `initialValue={{key:"A", value:"1", kind:"secret"}}`, "Secret" já vem marcado.
    - Ajustar o teste existente "uppercases the key..." para esperar `kind: "config"`.
  - **secret-row:**
    - Um secret com `kind:"secret"` mostra o texto "Secret".
    - Sem `kind`, mostra "Config".
    - O botão de revelar continua mostrando o valor nos dois casos.
  - **sync-modal:**
    - O push envia `secrets: [{key, value, kind}]` para itens que têm `kind`.
    - Quando a resposta traz `recreated: ["B"]`, a tela mostra "Recriadas na Vercel com o novo tipo: B".

- [ ] **Step 2: Run** `cd apps/web && npx jest src/components/shared/__tests__ "src/app/\[locale\]/(dashboard)/projects/\[id\]/secrets"`
  Expected: FAIL nos testes novos.

- [ ] **Step 3: Implement**
  - **Controle do form:** um `<fieldset>` com `<legend>` `kinds.label` e dois `<input type="radio">` nativos com `<label>` visível ("Config" / "Secret") e a frase de dica embaixo de cada um. Siga as classes de texto mono pequeno que o form já usa.
  - **Badge na linha:** use o `Badge` que já aparece em `secret-row.tsx`, ao lado do badge do ambiente.
  - **`saveSecret`:** grava `kind` no item.
  - **Sync modal:** inclui `kind` quando existe e mostra `recreated` junto da mensagem de "pushed".
  - **Fica sem mudança:** `projects/[id]/settings/page.tsx` e o import de `.env`. Eles mandam sem `kind`, e o servidor preserva.

- [ ] **Step 4: Run** `cd apps/web && npx jest && npm run lint && npm run check:i18n`
  Expected:
  - Jest: tudo passa (a base de hoje é 247 testes).
  - Lint: 0 erros e nenhum aviso novo nos arquivos tocados.
  - i18n: "i18n keys OK".

- [ ] **Step 5: Commit** `feat(web): choose Config or Secret per variable and send it on sync`

---

### Task 4: CLI — `--secret/--config`, lista e sync

**Files:**
- Modify: `apps/cli/src/criptenv/commands/secrets.py` (`set_command`, `list_command`)
- Modify: `apps/cli/src/criptenv/remote_vault.py` (`push_shape`)
- Modify: `apps/cli/src/criptenv/commands/integrations.py` (montagem dos secrets no push)
- Test: `apps/cli/tests/test_secrets_flow.py`, `apps/cli/tests/test_remote_vault.py`, `apps/cli/tests/test_integrations_commands.py`

**Interfaces:**
- Consumes: `kind` no pull e no push do vault (Task 1); `SyncSecret.kind` (Task 2).
- Produces: `RemoteVault.push_shape(blob)` inclui `"kind"` só quando `blob.get("kind")` existe.

- [ ] **Step 1: Write the failing tests**
  - `test_push_shape_keeps_kind`: `push_shape({..., "kind": "secret"})["kind"] == "secret"`.
  - `test_push_shape_omits_missing_kind`: sem `kind`, o dict não tem a chave `"kind"`.
  - `test_set_secret_flag_marks_kind`: `criptenv set A=1 --secret` empurra o blob de A com `kind == "secret"`.
  - `test_set_without_flag_keeps_existing_kind`: o estado tem A com `kind:"secret"`; `criptenv set A=2` empurra A com `"secret"`.
  - `test_set_config_flag_switches_kind`: o estado tem A `secret`; `set A=2 --config` → `"config"`.
  - `test_set_new_key_without_flag_omits_kind`: `set B=1` para uma chave nova, sem flag → o blob vai **sem** `kind` (o servidor decide `config`). Declare a opção como `@click.option("--secret/--config", "secret", default=None)`.
  - `test_list_shows_kind`: a saída de `criptenv list` traz `secret` na linha de A.
  - `test_sync_push_sends_kind`: estende `test_sync_push_sends_decrypted_environment`; o payload de push traz `{"key","value","kind"}` para blobs que têm `kind`.

- [ ] **Step 2: Run** `cd apps/cli && .venv/bin/python -m pytest tests/test_secrets_flow.py tests/test_remote_vault.py tests/test_integrations_commands.py -q`. Se não houver `.venv`, use o mesmo interpretador do CI da CLI.
  Expected: FAIL nos testes novos.

- [ ] **Step 3: Implement**
  - **`set`:** `kind = "secret"` se a flag for True, `"config"` se for False, senão `existing.get("kind")`. Só coloca `"kind"` no blob novo quando não é `None`.
  - **Help do `set`:** ganha o exemplo `criptenv set API_KEY=sk_live --secret`.
  - **`list`:** uma coluna com o tipo (`blob.get("kind", "config")`).
  - **Sync push:** monta a lista a partir de `state.blobs` e da decriptação, para cada item levar o `kind` do blob.

- [ ] **Step 4: Run** `cd apps/cli && .venv/bin/python -m pytest -q`
  Expected: PASS.

- [ ] **Step 5: Commit** `feat(cli): mark variables as secret or config and send the kind on sync`

---

### Task 5: Fechamento — docs, CHANGELOG e verificação completa

**Files:**
- Modify: `docs/development/CHANGELOG.md`
- Modify: a página de docs da CLI que lista o `set` (procure "criptenv set" em `apps/web/src/app/[locale]/(docs)/`). Adicione a flag `--secret` nos três idiomas, se a página tiver textos traduzidos.

- [ ] **Step 1:** Entrada no CHANGELOG cobrindo:
  - o tipo por variável;
  - o mapeamento para a Vercel;
  - a regra de preservação;
  - a conversão segura;
  - as flags da CLI.
- [ ] **Step 2: Run tudo:**
  - API: `cd apps/api && .venv/bin/python -m pytest -q` → PASS (a base de hoje é 688).
  - Web: `cd apps/web && npx jest && npm run lint && npm run check:i18n && npm run build` → PASS.
  - CLI: `cd apps/cli && .venv/bin/python -m pytest -q` → PASS.
  - Cypress: `cd apps/web && npx cypress run --spec cypress/e2e/auth.cy.ts`, com o mesmo setup de e2e (Postgres `criptenv-postgres-e2e`) → PASS. Ele prova que a migration nova sobe num banco real.
- [ ] **Step 3: Commit** `docs: changelog and CLI docs for Config/Secret variable types`
