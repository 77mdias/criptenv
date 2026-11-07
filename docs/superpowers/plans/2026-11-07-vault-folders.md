# Pastas no cofre pessoal e limites por plano: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o usuário cria pastas (um nível) no cofre pessoal e organiza nelas os itens, com os limites do cofre vindo do plano dele (gratuito: 10 pastas, 200 itens).

**Architecture:** API ganha um registro de planos em `app/plans.py`, a coluna `users.plan`, a rota `GET /api/v1/me/plan`, a tabela `personal_vault_folders` com CRUD em `/api/v1/personal-vault/folders`, e o limite de itens passa a vir do plano (erro 402). No web, o nome da pasta é cifrado com a VK (AAD própria) e a pasta do item vai dentro do resumo cifrado (`folderId`). A lista ganha a coluna de pastas à esquerda, e cada item ganha a ação "Mover para pasta", que só recifra o resumo.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + pytest (aiosqlite nos testes); Next.js 16 / React 19 / next-intl, Jest + Testing Library, Cypress.

**Spec:** `docs/superpowers/specs/2026-11-07-vault-folders-design.md`

## Global Constraints

- Zero-knowledge: o servidor nunca recebe o nome de uma pasta nem qual item está em qual pasta em texto claro. Item não tem coluna de pasta.
- Planos: `free` = `{"personal_vault_items": 200, "personal_vault_folders": 10}`; `unlimited` = os dois `None`. Nenhum plano tem função extra (`features` vazio).
- `DEFAULT_PLAN` (env, padrão `"free"`): valor fora dos planos conhecidos faz `Settings()` falhar. `users.plan` vazio (NULL) = `DEFAULT_PLAN`; valor desconhecido em `users.plan` = `free`.
- Erro de limite: HTTP **402**, `detail` = `"Plan limit reached"`. Conflito de versão continua 409.
- AAD do nome da pasta: `criptenv:pv1:folder:<id>:name`. Nome: 1 a 100 caracteres depois de `trim()` (checado no web). Envelope do nome: `iv` 16, `auth_tag` 24, `ciphertext` 1 a 1024 caracteres (checado na API).
- Rotas do cofre: só cookie web (`get_current_web_user`), filtradas pelo usuário da sessão, `expected_version` + UPDATE condicional, id gerado no cliente.
- Baixar limite nunca apaga, esconde nem impede editar/apagar: só bloqueia criar.
- Textos em pt-BR, en e es; `npm run check:i18n` passa.
- Produção roda Python 3.11.
- Commits em pt-BR, terminando com a linha de coautoria do Claude.

## Review Focus

1. **Editar um item perde a pasta.** Um item numa pasta, editado pelo formulário (comum ou protegido), tem de continuar na mesma pasta. Teste na Task 6.
2. **Mover item protegido abre o corpo.** "Mover para pasta" num item protegido não pode pedir a senha extra, chamar `unlockProtectedKey` nem mudar o envelope do corpo. Teste na Task 6.
3. **Usuário acima do limite fica travado.** Quem já tem mais itens do que o plano permite precisa continuar editando e apagando. Teste na Task 2.
4. **Plano desconhecido vira "sem limite".** Um valor estranho em `users.plan` tem de valer como `free`. Teste na Task 1.
5. **Pasta apagada em outra aba.** Itens que apontam para uma pasta que não existe mais aparecem em "Sem pasta" e nunca somem da lista. Teste na Task 5.

## Decisões deste plano (o Jean confere ao ler)

- **Renomear e apagar ficam ao lado do título da pasta escolhida**, no cabeçalho da lista, como botões de ícone (lápis e lixeira), e não num menu "⋯" em cada linha da coluna. O projeto não tem componente de menu suspenso, e assim o mesmo controle serve no desktop e no celular. Custo se estiver errado: mover dois botões para a coluna.
- **No celular, a coluna vira uma linha de pastas com rolagem lateral, no topo da lista**, com os mesmos botões. Não é um `<select>`.
- **Se `GET /me/plan` falhar, o web não mostra uso nem desliga botões.** A API continua barrando com 402, e o web mostra o aviso de limite quando receber esse erro.
- **Aviso de limite cita "plano gratuito"** porque, por enquanto, só o `free` tem limite. Fica um comentário `shortcut:` para trocar pelo nome do plano quando existirem planos pagos.

---

### Task 1: Planos, `DEFAULT_PLAN`, `users.plan` e `GET /api/v1/me/plan`

**Files:**
- Create: `apps/api/app/plans.py`
- Create: `apps/api/app/schemas/plan.py`
- Create: `apps/api/migrations/versions/20261107_0017_add_plan_to_users.py`
- Modify: `apps/api/app/config.py` (campo `DEFAULT_PLAN` + validator)
- Modify: `apps/api/app/models/user.py` (coluna `plan`)
- Modify: `apps/api/app/routers/me.py` (rota `/plan`)
- Modify: `apps/api/.env.example`, `deploy/vps/README.md` (variável `DEFAULT_PLAN` e o plano `unlimited`)
- Test: `apps/api/tests/test_plans.py`

**Interfaces:**
- Produces:
  - `app.plans.Plan` (dataclass frozen): `id: str`, `limits: Mapping[str, int | None]`, `features: frozenset[str]`
  - `app.plans.PLANS: dict[str, Plan]` (`"free"`, `"unlimited"`)
  - `app.plans.plan_for(user_plan: str | None) -> Plan`
  - `app.plans.PERSONAL_VAULT_ITEMS = "personal_vault_items"`, `app.plans.PERSONAL_VAULT_FOLDERS = "personal_vault_folders"`
  - `User.plan` (String(32), nullable)
  - `GET /api/v1/me/plan` → `{"id": str, "limits": {"personal_vault_items": int|null, "personal_vault_folders": int|null}, "features": [str]}`

- [ ] **Step 1: Write the failing tests** em `tests/test_plans.py`:

```python
def test_free_plan_limits():
    assert dict(PLANS["free"].limits) == {"personal_vault_items": 200, "personal_vault_folders": 10}
    assert PLANS["free"].features == frozenset()

def test_unlimited_plan_has_no_limits():
    assert dict(PLANS["unlimited"].limits) == {"personal_vault_items": None, "personal_vault_folders": None}

def test_plan_for_prefers_user_plan_then_default(monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_PLAN", "unlimited")
    assert plan_for(None).id == "unlimited"
    assert plan_for("free").id == "free"

def test_plan_for_unknown_value_is_free(monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_PLAN", "unlimited")
    assert plan_for("enterprise-typo").id == "free"

def test_default_plan_setting_rejects_unknown():
    with pytest.raises(ValidationError):
        Settings(DATABASE_URL="postgresql://x/y", SECRET_KEY="k" * 32, DEFAULT_PLAN="unlimted")

async def test_me_plan_route(client, as_user):  # mesmo padrão de fixtures de tests/test_personal_vault.py, com get_current_user
    # usuário com plan=None e DEFAULT_PLAN="free"
    r = await client.get("/api/v1/me/plan")
    assert r.status_code == 200
    assert r.json() == {"id": "free", "limits": {"personal_vault_items": 200, "personal_vault_folders": 10}, "features": []}
    # usuário com plan="unlimited": limits com null
```

Use `tests/test_config_security.py` como modelo para construir `Settings(...)` sem ler o `.env`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && .venv/bin/python -m pytest tests/test_plans.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'app.plans'`.

- [ ] **Step 3: Implement**
  - `app/plans.py` **não importa `app.config` no topo** (o `config` importa `PLANS` para validar). `plan_for` importa `settings` dentro da função, com um comentário explicando o motivo. Valor desconhecido → `PLANS["free"]`.
  - `config.py`: `DEFAULT_PLAN: str = "free"`, com um `field_validator` que recusa o que não estiver em `PLANS`.
  - `User.plan = Column(String(32), nullable=True)`; migração `20261107_0017` (revises `20261106_0016`) com `add_column` e um `downgrade` que remove a coluna.
  - `schemas/plan.py`: `PlanResponse(id: str, limits: dict[str, int | None], features: list[str])`; rota `@router.get("/plan")` em `me.py` com `get_current_user`.
  - `.env.example`: `DEFAULT_PLAN=free` com comentário de uma linha ("`unlimited` para quem hospeda o próprio CriptEnv"). `deploy/vps/README.md`: um parágrafo curto com o mesmo.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && .venv/bin/python -m pytest tests/test_plans.py tests/test_config_security.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/plans.py apps/api/app/schemas/plan.py apps/api/app/config.py apps/api/app/models/user.py apps/api/app/routers/me.py apps/api/migrations/versions/20261107_0017_add_plan_to_users.py apps/api/.env.example deploy/vps/README.md apps/api/tests/test_plans.py
git commit -m "feat(api): planos com limites e plano padrão configurável"
```

---

### Task 2: Limite de itens do cofre vindo do plano (402)

**Files:**
- Modify: `apps/api/app/services/personal_vault_service.py` (remover `MAX_PERSONAL_VAULT_ITEMS`; `create_item` recebe o limite)
- Modify: `apps/api/app/routers/personal_vault.py` (passa o limite do plano; 402 para `PersonalVaultLimitReached`)
- Test: `apps/api/tests/test_personal_vault.py` (trocar `test_item_limit`, somar os testes abaixo)

**Interfaces:**
- Consumes: `plan_for`, `PERSONAL_VAULT_ITEMS` (Task 1)
- Produces:
  - `PersonalVaultService.create_item(user_id: UUID, data: PersonalVaultItemCreate, limit: int | None) -> PersonalVaultItem`
  - `_http(exc)` → 402 `"Plan limit reached"` para `PersonalVaultLimitReached`
  - Helper de teste `_plan(monkeypatch, **limits)`, que troca `PLANS["free"]` via `monkeypatch.setitem`, reaproveitado nas Tasks 3 e seguintes

- [ ] **Step 1: Write the failing tests**

```python
async def test_item_limit_comes_from_plan(client, setup_vault, monkeypatch):
    _plan(monkeypatch, personal_vault_items=2)
    for _ in range(2):
        assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 201
    r = await client.post("/api/v1/personal-vault/items", json=_item())
    assert r.status_code == 402 and r.json()["detail"] == "Plan limit reached"

async def test_unlimited_plan_has_no_item_limit(client, setup_vault, monkeypatch):
    _plan(monkeypatch, personal_vault_items=1)
    monkeypatch.setattr(settings, "DEFAULT_PLAN", "unlimited")
    for _ in range(3):
        assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 201

async def test_over_limit_user_can_still_edit_and_delete(client, setup_vault, monkeypatch):
    # cria 3 itens com limite 3, baixa o limite para 2:
    # PUT → 200, DELETE → 204, POST → 402 (agora com 2 itens no limite 2)
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && .venv/bin/python -m pytest tests/test_personal_vault.py -q -k "limit or over_limit"`
Expected: FAIL (hoje responde 409 e o limite é 1000).

- [ ] **Step 3: Implement.** `limit is None` = sem checagem. Mantenha o comentário `shortcut:` do count + insert. O roteador passa `plan_for(user.plan).limits[PERSONAL_VAULT_ITEMS]`. `_http` vira um mapeamento por tipo de exceção: 404, 409 e 402.

- [ ] **Step 4: Run the whole vault file**

Run: `cd apps/api && .venv/bin/python -m pytest tests/test_personal_vault.py -q`
Expected: PASS (inclusive o teste antigo, agora reescrito).

- [ ] **Step 5: Commit** — `feat(api): limite de itens do cofre pelo plano do usuário`

---

### Task 3: Pastas na API

**Files:**
- Modify: `apps/api/app/models/personal_vault.py` (classe `PersonalVaultFolder`)
- Create: `apps/api/migrations/versions/20261107_0018_add_personal_vault_folders.py`
- Modify: `apps/api/app/schemas/personal_vault.py` (`EncryptedFolderName`, `PersonalVaultFolderCreate`, `PersonalVaultFolderUpdate`, `PersonalVaultFolderResponse`)
- Modify: `apps/api/app/services/personal_vault_service.py` (métodos de pasta)
- Modify: `apps/api/app/routers/personal_vault.py` (4 rotas)
- Modify: `apps/api/app/services/auth_service.py` (`delete_account` apaga as pastas)
- Test: `apps/api/tests/test_personal_vault.py`

**Interfaces:**
- Consumes: `plan_for`, `PERSONAL_VAULT_FOLDERS` (Task 1); `_http` com 402 (Task 2)
- Produces:
  - Tabela `personal_vault_folders`: `id` UUID PK (vem do cliente), `user_id` FK `users.id` `ondelete=CASCADE` com índice, `name` JSONB, `version` int, `created_at`, `updated_at`
  - `GET /api/v1/personal-vault/folders` → `[{id, name: {iv, ciphertext, auth_tag}, version, created_at, updated_at}]` (ordem: `created_at`, `id`)
  - `POST /api/v1/personal-vault/folders` `{id, name}` → 201 | 404 (cofre não criado) | 409 `"Folder id already exists"` | 402
  - `PUT /api/v1/personal-vault/folders/{folder_id}` `{name, expected_version}` → 200 | 404 | 409 `"Version conflict"`
  - `DELETE /api/v1/personal-vault/folders/{folder_id}` → 204 | 404
  - Service: `list_folders(user_id)`, `create_folder(user_id, data, limit: int | None)`, `update_folder(user_id, folder_id, data)`, `delete_folder(user_id, folder_id)`, com os mesmos padrões de `create_item` / `update_item` / `delete_item` (savepoint para id duplicado, UPDATE condicional)

- [ ] **Step 1: Write the failing tests**
  - `test_folder_lifecycle`: POST 201 versão 1 → GET lista 1 → PUT com `expected_version=1` → 200 versão 2 com o nome novo → DELETE 204 → GET vazio
  - `test_folder_stale_version_conflicts`: dois PUT com `expected_version=1` → o segundo dá 409 `"Version conflict"`
  - `test_folder_duplicate_id_conflicts`: o mesmo id duas vezes → 409 `"Folder id already exists"`
  - `test_folder_requires_vault`: POST sem config → 404
  - `test_folders_are_per_user`: a pasta da ana, vista pela bia: GET vazio, PUT 404, DELETE 404
  - `test_folder_limit_comes_from_plan`: `_plan(monkeypatch, personal_vault_folders=2)`; a terceira dá 402 `"Plan limit reached"`
  - `test_folder_name_size_is_limited`: `ciphertext` com 1025 caracteres → 422
  - `test_deleting_folder_keeps_items`: com 2 itens criados, apagar a pasta deixa `GET /items` ainda com 2 itens, com `summary` igual ao de antes
  - `test_delete_account_removes_folders`: estender `test_delete_account_removes_personal_vault` para contar `PersonalVaultFolder` igual a 0
  - Estender `test_every_route_rejects_bearer` com as 4 rotas novas (corpo do POST: `_folder()`, do PUT: `{"name": _envelope(), "expected_version": 1}`)

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && .venv/bin/python -m pytest tests/test_personal_vault.py -q -k folder`
Expected: FAIL com `ImportError` (sem `PersonalVaultFolder`) ou 404/405 nas rotas.

- [ ] **Step 3: Implement.** Migração `20261107_0018` (revises `20261107_0017`) cria a tabela com o índice `ix_personal_vault_folders_user_id`, e o `downgrade` remove a tabela. Em `delete_account`, apagar as pastas antes da config, ao lado das duas linhas que já apagam itens e config.

- [ ] **Step 4: Run API suite**

Run: `cd apps/api && .venv/bin/python -m pytest -q > /tmp/api.log 2>&1; tail -3 /tmp/api.log && .venv/bin/ruff check app tests`
Expected: todos passam (777 de antes + os novos), ruff limpo.

- [ ] **Step 5: Commit** — `feat(api): pastas cifradas no cofre pessoal`

---

### Task 4: Web: criptografia das pastas e clientes da API

**Files:**
- Modify: `apps/web/src/lib/personal-vault/crypto.ts`
- Modify: `apps/web/src/lib/api/personal-vault.ts`
- Modify: `apps/web/src/lib/api/me.ts`
- Test: `apps/web/src/lib/personal-vault/__tests__/crypto.test.ts`

**Interfaces:**
- Consumes: rotas das Tasks 1 e 3; 402 da Task 2
- Produces:
  - `ItemSummary.folderId?: string`; as duas variantes de `PersonalVaultItemPlain` ganham `folderId?: string`
  - `encryptItem(...)` grava `folderId` no resumo **só quando tiver valor**; `decryptItem(...)` devolve o `folderId` do resumo
  - `encryptFolderName(id: string, name: string, vaultKey: CryptoKey): Promise<EncryptedField>`
  - `decryptFolderName(id: string, name: EncryptedField, vaultKey: CryptoKey): Promise<string>`
  - `resealSummary(id: string, summary: ItemSummary, vaultKey: CryptoKey): Promise<EncryptedField>` (mesma AAD `item:<id>:summary`)
  - `PersonalVaultFolder { id: string; name: EncryptedField; version: number; created_at: string; updated_at: string }`
  - `listPersonalVaultFolders(): Promise<PersonalVaultFolder[]>`
  - `createPersonalVaultFolder(input: { id: string; name: EncryptedField }): Promise<PersonalVaultFolder>`
  - `updatePersonalVaultFolder(id: string, name: EncryptedField, expectedVersion: number): Promise<PersonalVaultFolder>`
  - `deletePersonalVaultFolder(id: string): Promise<void>`
  - `isPlanLimitError(err: unknown): boolean` (`ApiError` com `status === 402`)
  - Em `me.ts`: `export interface Plan { id: string; limits: { personal_vault_items: number | null; personal_vault_folders: number | null }; features: string[] }` e `meApi.plan(): Promise<Plan>`

- [ ] **Step 1: Write the failing tests** (`crypto.test.ts`, mesmo estilo dos testes de item que já existem):
  - `folder name round-trips`: `decryptFolderName(id, await encryptFolderName(id, "Trabalho", vk), vk)` → `"Trabalho"`
  - `folder name is bound to its id`: abrir com outro id rejeita com `CryptoError`
  - `summary keeps folderId`: `encryptItem` com `folderId: "f1"` → `decryptSummary(...).folderId === "f1"` e `decryptItem(...).folderId === "f1"`
  - `summary without folderId has no folderId key`
  - `resealSummary moves an item without touching the body`: item protegido; `resealSummary(id, {...summary, folderId: "f2"}, vk)` → `decryptItem({id, protected: true, summary: novo, body: corpoOriginal}, vk, pk)` funciona, com `folderId === "f2"` e a senha igual à de antes

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && npx jest src/lib/personal-vault/__tests__/crypto.test.ts`
Expected: FAIL (`encryptFolderName is not a function`).

- [ ] **Step 3: Implement.** `AAD.folderName = (id) => \`criptenv:pv1:folder:${id}:name\``. Os clientes seguem o mesmo jeito dos de item, com `encodeURIComponent(id)` na URL.

- [ ] **Step 4: Run**

Run: `cd apps/web && npx jest src/lib/personal-vault src/lib/api`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(web): nome de pasta cifrado e pasta dentro do resumo do item`

---

### Task 5: Web: coluna de pastas, filtros, uso e limites

**Files:**
- Create: `apps/web/src/app/[locale]/(dashboard)/vault/_components/folder-column.tsx`
- Create: `apps/web/src/app/[locale]/(dashboard)/vault/_components/folder-dialog.tsx`
- Modify: `apps/web/src/app/[locale]/(dashboard)/vault/_components/vault-items.tsx`
- Modify: `apps/web/messages/{pt-BR,en,es}/vault.json`
- Test: `apps/web/src/app/[locale]/(dashboard)/vault/__tests__/vault-items.test.tsx`

**Interfaces:**
- Consumes: tudo da Task 4
- Produces:
  - `type FolderSelection = "all" | "none" | string` (o `string` é o id da pasta)
  - `interface DecryptedFolder { folder: PersonalVaultFolder; name: string | null }` (`null` = ilegível)
  - `FolderColumn` props: `{ folders: DecryptedFolder[]; counts: Record<FolderSelection, number>; selected: FolderSelection; onSelect(s): void; onNew(): void; newDisabled: boolean; usage: string }`
  - `FolderDialog` props: `{ folder: DecryptedFolder | null | undefined /* undefined = fechado, null = nova */; vaultKey: CryptoKey; onClose(): void; onSaved(): void; onStale(): void; onLimit(): void }`
  - Chaves i18n novas: `folders.{title,all,none,new,rename,delete,deleteConfirm,unreadable,usage,usageUnlimited,limitReached}`, `folderDialog.{newTitle,editTitle,name,nameRequired,nameTooLong,save}`, `items.{usage,usageUnlimited,limitReached}`

- [ ] **Step 1: Write the failing tests** (mocks novos: `listPersonalVaultFolders`, `createPersonalVaultFolder`, `updatePersonalVaultFolder`, `deletePersonalVaultFolder`, `isPlanLimitError` (real), `meApi.plan`, `encryptFolderName`, `decryptFolderName`):
  - `lists folders alphabetically with counts and filters together with the type filter`: as pastas "Trabalho" (1 login, 1 nota) e "Pessoal" (1 login) aparecem como Pessoal, Trabalho; clicar em Trabalho deixa 2 itens visíveis; com Trabalho + Logins, só 1
  - `items without a folder or pointing to a deleted folder are under "Sem pasta"`: um item sem `folderId` e um com `folderId: "gone"` → os dois em Sem pasta, contagem 2, nenhum some de "Todas"
  - `creates a folder with an encrypted name`: Nova pasta → digita "  Trabalho  " → `encryptFolderName` com `"Trabalho"` e `createPersonalVaultFolder` com `{id: <uuid>, name: <envelope>}`
  - `refuses an empty or too long folder name`: só espaços → `folderDialog.nameRequired`; 101 caracteres → `nameTooLong`; nenhuma chamada à API
  - `renames and deletes the selected folder without touching items`: renomear chama `updatePersonalVaultFolder(id, env, version)`; apagar com `window.confirm` true chama `deletePersonalVaultFolder(id)`, volta para "Todas" e não chama `updatePersonalVaultItem`
  - `unreadable folder shows only delete`: `decryptFolderName` rejeita → "Pasta ilegível", sem o botão de renomear
  - `shows usage and disables creation at the plan limit`: plano com `personal_vault_folders: 2` e 2 pastas → "2 de 2 pastas", "Nova pasta" desligado e aviso `folders.limitReached`; `personal_vault_items: 1` com 1 item → "Novo item" desligado
  - `unlimited plan shows plain counts`: limites `null` → "2 pastas" e "3 itens", nada desligado
  - `a 402 from the server shows the limit notice`: `createPersonalVaultFolder` rejeita com `ApiError(…, 402, …)` → aviso de limite
  - `plan request failing keeps creation enabled`: `meApi.plan` rejeita → botões ligados, sem texto de uso

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && npx jest 'src/app/\[locale\]/(dashboard)/vault/__tests__/vault-items.test.tsx'`
Expected: FAIL (sem coluna de pastas).

- [ ] **Step 3: Implement.**
  - `vault-items.tsx` carrega itens, pastas e plano juntos. As pastas são decifradas com `Promise.allSettled`, e as que falham ficam com `name: null`. O plano carrega separado e, se falhar, fica `null`.
  - O `visible` também filtra por pasta. Um `folderId` que não está na lista de pastas conta como "none".
  - Layout `flex flex-col md:flex-row`. A coluna fica `flex md:flex-col overflow-x-auto`. O título da lista mostra a pasta escolhida e, numa pasta real, os botões Renomear (só se legível) e Apagar.
  - Apagar usa `window.confirm(t("folders.deleteConfirm", { name }))`. Um 404 só recarrega a lista.
  - O texto de uso usa `usage` ou `usageUnlimited`, com plural no ICU. O aviso de limite leva o comentário `// shortcut: cita o plano gratuito porque só ele tem limite; usar o nome do plano quando houver planos pagos`.
  - Textos pt-BR, por exemplo:
    - `folders.deleteConfirm`: "Apagar a pasta \"{name}\"? Os itens dela vão para Sem pasta."
    - `folders.limitReached`: "Você chegou ao limite de {max} pastas do plano gratuito."
    - `items.limitReached`: "Você chegou ao limite de {max} itens do plano gratuito."

- [ ] **Step 4: Run**

Run: `cd apps/web && npx jest 'src/app/\[locale\]/(dashboard)/vault' && npm run lint -- 'src/app/[locale]/(dashboard)/vault' && npm run check:i18n`
Expected: PASS; lint sem erros; i18n OK.

- [ ] **Step 5: Commit** — `feat(web): coluna de pastas no cofre com uso e limites do plano`

---

### Task 6: Web: campo "Pasta" no formulário e "Mover para pasta"

**Files:**
- Modify: `apps/web/src/app/[locale]/(dashboard)/vault/_components/vault-item-dialog.tsx`
- Create: `apps/web/src/app/[locale]/(dashboard)/vault/_components/move-item-dialog.tsx`
- Modify: `apps/web/src/app/[locale]/(dashboard)/vault/_components/vault-items.tsx` (botão por linha, props novas do formulário, 402 ao criar item)
- Modify: `apps/web/messages/{pt-BR,en,es}/vault.json` (`itemDialog.folder`, `items.move`, `moveDialog.{title,folder,save}`)
- Test: `apps/web/src/app/[locale]/(dashboard)/vault/__tests__/vault-items.test.tsx`

**Interfaces:**
- Consumes: `DecryptedFolder`, `FolderSelection` (Task 5); `resealSummary`, `folderId` em `encryptItem` / `decryptItem` (Task 4)
- Produces:
  - `VaultItemDialog` props novas: `folders: DecryptedFolder[]`, `defaultFolderId?: string`, `onLimit: () => void`
  - `MoveItemDialog` props: `{ entry: DecryptedEntry | null; folders: DecryptedFolder[]; vaultKey: CryptoKey; onClose(): void; onSaved(): void; onStale(reason: "changed" | "deleted"): void }`

- [ ] **Step 1: Write the failing tests**
  - `new item takes the selected folder by default`: com "Trabalho" selecionada, o novo item chama `encryptItem` com `folderId` da Trabalho; trocando para "Sem pasta", vai sem `folderId`
  - `editing an item keeps its folder` (Review Focus 1): editar um item comum com `folderId: "f1"` sem mexer no campo → `encryptItem` recebe `folderId: "f1"`; o mesmo para um item protegido depois do desbloqueio
  - `moving a protected item never asks for the extra password` (Review Focus 2): Mover → escolhe "Pessoal" → `resealSummary` com `{...summary, folderId: <Pessoal>}` e `updatePersonalVaultItem(id, {id, protected: true, summary: <novo>, body: item.body}, item.version)`; `unlockProtectedKey` e `encryptItem` não são chamados
  - `a stale move reloads with the conflict notice`: update rejeita com 409 → `itemDialog.conflict`; com 404 → `itemDialog.deleted`
  - `a 402 when creating an item shows the item limit notice`

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/web && npx jest 'src/app/\[locale\]/(dashboard)/vault/__tests__/vault-items.test.tsx'`
Expected: FAIL.

- [ ] **Step 3: Implement.**
  - O formulário ganha um `<select id="vault-item-folder">` com o mesmo estilo do `vault-item-type`. "Sem pasta" vale `""`, e as pastas ilegíveis ficam de fora. O estado `folderId` vem de `fill(plain)` na edição ou de `defaultFolderId` na criação, e entra no `plain` passado para `encryptItem`.
  - O `MoveItemDialog` usa o mesmo `<select>` e um botão Salvar. A linha da lista ganha um botão de ícone `FolderInput` com `aria-label={t("items.move", { title })}`.

- [ ] **Step 4: Run**

Run: `cd apps/web && npx jest > /tmp/web.log 2>&1; tail -5 /tmp/web.log && npm run lint && npm run check:i18n`
Expected: suíte inteira passa (286 de antes + os novos); lint sem erros; i18n OK.

- [ ] **Step 5: Commit** — `feat(web): escolher a pasta do item e mover sem a senha extra`

---

### Task 7: E2E, documentação de segurança e changelog

**Files:**
- Modify: `apps/web/cypress/e2e/personal-vault.cy.ts`
- Modify: `docs/security/personal-vault.md`
- Modify: `docs/development/CHANGELOG.md` (seção `[Unreleased]`)
- Modify: `docs/superpowers/specs/2026-11-07-vault-folders-design.md` (status: aprovado)

- [ ] **Step 1: Write the e2e test** `organizes items in folders and keeps them when the folder is deleted`, usando `createVault()` e `addNote()` que já existem no spec:
  1. Nova pasta "Trabalho".
  2. Nota "Chave" criada com a pasta Trabalho.
  3. Em "Sem pasta" a nota não aparece; em "Trabalho" ela aparece.
  4. Mover a nota para "Sem pasta" e conferir que ela aparece lá.
  5. Mover de volta para Trabalho.
  6. Apagar a pasta Trabalho (aceitar o `confirm`) e conferir que "Chave" aparece em "Sem pasta".

- [ ] **Step 2: Run it**

Run: `cd apps/web && npm run test:e2e`
Expected: todos os specs passam, inclusive o novo. Se der EACCES em `.vinext/dev/lock.json`, é o lock velho de root que já apareceu antes: confira que nenhum `vinext` está rodando antes de apagar.

- [ ] **Step 3: Docs**
  - `personal-vault.md`:
    - Em "O que o servidor vê": por pasta, o envelope do nome, a versão e as datas, mais a quantidade de pastas. Ele não vê quais itens estão em cada pasta, porque o `folderId` fica no resumo cifrado.
    - A AAD `folder:<id>:name` na lista de contextos.
    - Em "O que o servidor garante": limites por plano no lugar do "até 1000 itens" (gratuito: 200 itens e 10 pastas; `unlimited` sem limite; `DEFAULT_PLAN`).
    - Em "No navegador": mover de pasta só recifra o resumo com a VK e reenvia o corpo como está, então não pede a senha extra.
    - Em "Riscos conhecidos": a aba antiga durante o deploy tira o item da pasta ao editar.
  - CHANGELOG: entrada "Pastas no cofre pessoal e limites por plano — 2026-11-07", no mesmo formato das outras, com as migrações `20261107_0017` e `20261107_0018`.
  - Spec: status "aprovado".

- [ ] **Step 4: Full verification**

Run: `cd apps/api && .venv/bin/python -m pytest -q | tail -2 && .venv/bin/ruff check app tests && cd ../web && npx jest 2>&1 | tail -4 && npm run lint && npm run check:i18n`
Expected: tudo verde.

- [ ] **Step 5: Commit** — `test(e2e): pastas no cofre; docs: o que o servidor vê das pastas e limites por plano`
