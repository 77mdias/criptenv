# Cofre Pessoal: Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** criar um cofre pessoal por usuário, parecido com o do Bitwarden. Ele guarda logins (redes sociais etc.) e notas seguras fora dos projetos e ambientes, fica só no dashboard web e mantém o zero-knowledge.

**Arquitetura:** o navegador sorteia uma chave do cofre e uma chave de proteção extra, e o servidor guarda as duas só embrulhadas (cifradas): pela senha mestra, pela senha de proteção extra e pela chave de recuperação. Os itens vão para o servidor como envelopes AES-256-GCM. A API expõe `/api/v1/personal-vault/*` e só aceita o cookie de sessão do dashboard. Por isso CLI, API key e token de CI recebem 403.

**Stack:** FastAPI + SQLAlchemy async + Alembic · React 19/Vinext + TailwindCSS v4 + Radix · React Query · WebCrypto nativo (sem dependência nova) · Jest + Cypress · next-intl (`apps/web/messages/{pt-BR,en,es}`).

**Spec:** a seção "Decisões de design" logo abaixo. Ela registra as respostas do Jean de 2026-11-06 e é a referência das tarefas.

---

## Decisões de design

### Decididas pelo Jean (2026-11-06)

1. **Senha mestra própria do cofre.** É diferente da senha de login e precisa ser digitada a cada acesso ao cofre.
2. **Zero-knowledge de verdade.** Se o usuário perder a senha mestra e a chave de recuperação, perde os dados. Na criação, mostramos uma **chave de recuperação** para imprimir.
3. **KDF mais forte.** PBKDF2-SHA256 com **600.000 iterações**, o valor que a OWASP recomenda e o padrão do Bitwarden. Os projetos continuam com 100.000.
4. **Só web.** Nenhum comando novo na CLI, e a API recusa qualquer credencial que não seja o cookie do dashboard.

### Proposta para a segunda camada (o Jean confirma na revisão deste plano)

Itens marcados como **"Proteção extra"** são cifrados com uma segunda chave, que só abre com uma **senha de proteção extra**. Essa senha é definida na criação do cofre e é diferente da mestra.

- A camada é **criptográfica, não só de interface**. Com o cofre aberto, o corpo de um item protegido continua ilegível até o usuário digitar a senha extra.
- Para abrir é preciso **as duas** senhas, porque a chave extra fica embrulhada duas vezes: por dentro pela senha extra, por fora pela chave do cofre.
- A chave extra **nunca fica guardada na memória**. A cada "revelar" o usuário digita a senha extra, o item é decifrado e a chave é descartada.
- O título, o usuário e a URL do item protegido continuam visíveis na lista (eles ficam no resumo, cifrado com a chave do cofre). Só senha, notas e conteúdo ficam atrás da segunda camada.

Alternativas descartadas por enquanto:
- **Só pedir a senha mestra de novo**, como o "master password re-prompt" do Bitwarden. É mais simples, mas é proteção só de interface: com o cofre aberto, o dado já está decifrado na memória.
- **Passkey/WebAuthn PRF**, uma chave física ou biometria. É a opção mais forte, mas o suporte dos navegadores ainda é irregular. Fica como evolução possível, já que entraria como mais um embrulho da chave extra sem mudar os itens.

### Hierarquia de chaves

```
senha mestra ──PBKDF2 600k──▶ KEK_mestra ──embrulha──▶ chave do cofre (VK, 32 bytes aleatórios)
chave de recuperação ─HKDF──▶ KEK_rec ────embrulha──▶ VK  e  chave extra (PK, 32 bytes aleatórios)
senha extra ───PBKDF2 600k──▶ KEK_extra ──embrulha──▶ PK ──e o resultado é cifrado de novo com VK
VK  cifra: resumo de todo item {type,title,username,url} + corpo dos itens comuns
PK  cifra: corpo dos itens com proteção extra {password,notes} | {content}
```

- Senha errada é detectada pela falha de autenticação do AES-GCM ao desembrulhar. Não guardamos verificador.
- Para trocar a senha mestra, basta embrulhar a VK de novo. Os itens não são cifrados outra vez.
- Usar a recuperação **gera uma nova chave de recuperação** e redefine a senha mestra e a extra.
- No navegador, VK e PK são `CryptoKey` não extraíveis. Os bytes brutos só existem durante o embrulho e são zerados (`fill(0)`) em seguida.

---

## Restrições globais

- KDF `"PBKDF2-SHA256"`, `iterations` ≥ `600000` e ≤ `10000000` (o servidor responde 422 fora disso). No web, `PERSONAL_VAULT_ITERATIONS = 600_000`.
- Senha mestra com ≥ 12 caracteres. Senha extra com ≥ 8 caracteres e diferente da mestra. As duas regras são checadas no cliente.
- Envelope `{iv, ciphertext, auth_tag}` em base64: `iv` com exatamente 16 caracteres, `auth_tag` com exatamente 24. `ciphertext` com até 4.096 caracteres no resumo e nas chaves embrulhadas, e até 65.536 no corpo.
- Até `MAX_PERSONAL_VAULT_ITEMS = 1000` itens por usuário (acima disso, 409 `"Item limit reached"`).
- Rotas `/api/v1/personal-vault/*` só com o cookie `session_token`. Com header `Authorization`, a resposta é 403 `"Personal vault is only available in the web dashboard"`.
- Concorrência otimista: todo PUT leva `expected_version`. Se a versão não bater, 409 `"Version conflict"`.
- O cofre aberto tranca sozinho após `PERSONAL_VAULT_IDLE_MS = 600_000` (10 min) sem interação, ou ao sair da rota `/vault`.
- Nenhuma dependência nova no web nem na API. Nenhum comando novo na CLI.
- Toda string nova nas 3 locales, e `npm run check:i18n` passando.
- Commits no padrão do repo (`feat(api): …`, `feat(web): …`, `docs: …`). Branch `feature/personal-vault`, worktree em `~/projects/worktrees/criptenv-personal-vault`.

## Pontos de atenção na revisão

1. **Duas abas editando o mesmo item ou a config.** A segunda gravação recebe 409, e a interface recarrega sem sobrescrever (testes nas Tarefas 4 e 9).
2. **Chave de recuperação digitada de qualquer jeito** (minúsculas, espaços, sem hífens, `O` no lugar de `0`, `I`/`L` no lugar de `1`). Precisa ser aceita (Tarefa 6).
3. **Senha mestra errada.** Mostra "Senha mestra incorreta", não faz nenhuma chamada à API e deixa tentar de novo (Tarefas 6 e 8).
4. **Token válido de CLI ou API key** em `Authorization: Bearer` contra o cofre. Recebe 403 mesmo com o token válido (Tarefa 2).
5. **O cofre tranca por inatividade com um item revelado na tela.** O conteúdo decifrado some da tela e da memória (Tarefa 8).

## Riscos conhecidos (aceitos no v1)

- Quem roubar uma sessão web pode baixar os envelopes e tentar adivinhar as senhas offline. As 600 mil iterações e o mínimo de 12 caracteres reduzem esse risco.
- Quem roubar uma sessão web também pode **substituir a config** (PUT). Ele não consegue ler nada, mas deixa o dono sem acesso aos próprios dados, ou seja, é negação de serviço. A mitigação (reautenticação ou e-mail de aviso na troca da config) fica para depois.
- O limite de itens é checado com count + insert. Duas criações simultâneas podem passar de 1000 por um item.

## Fora do escopo

Comandos de CLI, gerador de senhas, limpeza automática da área de transferência, anexos, compartilhamento de itens, importação do Bitwarden ou CSV, passkey (PRF), auditoria dos eventos do cofre.

---

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/app/models/personal_vault.py` (novo) | `PersonalVault` (config, 1 por usuário) e `PersonalVaultItem` |
| `apps/api/migrations/versions/20261106_0014_create_personal_vault.py` (novo) | tabelas `personal_vaults` e `personal_vault_items` |
| `apps/api/app/schemas/personal_vault.py` (novo) | validação dos envelopes, da config e dos itens |
| `apps/api/app/middleware/auth.py` | `get_current_web_user` (só cookie) |
| `apps/api/app/services/personal_vault_service.py` (novo) | regras: versão, limite, isolamento por usuário |
| `apps/api/app/routers/personal_vault.py` (novo) + `main.py` | rotas `/api/v1/personal-vault` |
| `apps/api/app/services/auth_service.py` | `delete_account` apaga o cofre |
| `apps/api/tests/test_personal_vault.py` (novo) | testes da API (SQLite real, como `test_me_overview.py`) |
| `apps/web/src/lib/crypto.ts` | exportar `derivePbkdf2Bits`, `importAesKey`, `importHkdfKey` |
| `apps/web/src/lib/personal-vault/crypto.ts` (novo) | hierarquia de chaves, recuperação, cifrar/decifrar itens |
| `apps/web/src/lib/api/personal-vault.ts` (novo) | cliente HTTP |
| `apps/web/src/app/[locale]/(dashboard)/vault/` (novo) | página `/vault` e `_components/` |
| `apps/web/src/components/layout/dashboard-nav.ts` | item "Cofre" na sidebar |
| `apps/web/src/i18n/messages.ts` + `messages/{pt-BR,en,es}/vault.json` | namespace `vault` |
| `apps/web/cypress/e2e/personal-vault.cy.ts` (novo) | fluxo ponta a ponta |
| `docs/security/personal-vault.md` (novo) + `docs/development/CHANGELOG.md` | modelo criptográfico e entrada no changelog |

---

### Tarefa 1: Modelos, migration e schemas da API

**Arquivos:**
- Criar: `apps/api/app/models/personal_vault.py`, `apps/api/app/schemas/personal_vault.py`, `apps/api/migrations/versions/20261106_0014_create_personal_vault.py`
- Modificar: `apps/api/app/models/__init__.py` (exportar os dois modelos, como os outros)
- Teste: `apps/api/tests/test_personal_vault.py`

**Interfaces:**
- Produz:
  - `PersonalVault` (`__tablename__ = "personal_vaults"`) com `user_id` (UUID, PK, FK `users.id` `ondelete="CASCADE"`), `version` (Integer, default 1), `kdf` (String(32)), `iterations` (Integer), `master_salt` e `extra_salt` (String(64)), `master_wrapped_vault_key`, `recovery_wrapped_vault_key`, `extra_wrapped_protected_key` e `recovery_wrapped_protected_key` (JSONB, not null), `created_at` e `updated_at` (iguais aos de `User`).
  - `PersonalVaultItem` (`"personal_vault_items"`) com `id` (UUID PK), `user_id` (FK CASCADE, index), `protected` (Boolean, default False), `summary` e `body` (JSONB), `version` (Integer, default 1), `created_at`, `updated_at`. Índice `ix_personal_vault_items_user_id_updated_at` em `(user_id, updated_at)`.
  - Schemas: `EncryptedSummary` e `EncryptedBody` (`iv`, `ciphertext`, `auth_tag`, com os limites das Restrições globais); `PersonalVaultConfigCreate` (`kdf: Literal["PBKDF2-SHA256"]`, `iterations`, `master_salt`, `extra_salt` com 44 caracteres e as 4 chaves embrulhadas como `EncryptedSummary`); `PersonalVaultConfigUpdate(PersonalVaultConfigCreate)` mais `expected_version: int ≥ 1`; `PersonalVaultConfigResponse` mais `version`, `created_at`, `updated_at` (`from_attributes`); `PersonalVaultItemCreate` (`protected: bool`, `summary: EncryptedSummary`, `body: EncryptedBody`); `PersonalVaultItemUpdate` mais `expected_version`; `PersonalVaultItemResponse` mais `id`, `version`, `created_at`, `updated_at`.

- [ ] **Passo 1: escrever os testes que falham**

```python
def _envelope(ct_len=60):
    return {"iv": "A" * 16, "ciphertext": "B" * ct_len, "auth_tag": "C" * 24}

def _config(**over):
    base = {"kdf": "PBKDF2-SHA256", "iterations": 600_000,
            "master_salt": "S" * 44, "extra_salt": "T" * 44,
            "master_wrapped_vault_key": _envelope(), "recovery_wrapped_vault_key": _envelope(),
            "extra_wrapped_protected_key": _envelope(), "recovery_wrapped_protected_key": _envelope()}
    return {**base, **over}

def test_config_rejects_weak_iterations():
    with pytest.raises(ValidationError):
        PersonalVaultConfigCreate(**_config(iterations=599_999))

def test_config_rejects_other_kdf():
    with pytest.raises(ValidationError):
        PersonalVaultConfigCreate(**_config(kdf="argon2id"))

def test_envelope_lengths_are_enforced():
    with pytest.raises(ValidationError):
        EncryptedSummary(**{**_envelope(), "iv": "A" * 15})
    with pytest.raises(ValidationError):
        EncryptedSummary(**_envelope(ct_len=4097))
    EncryptedBody(**_envelope(ct_len=65_536))
    with pytest.raises(ValidationError):
        EncryptedBody(**_envelope(ct_len=65_537))

async def test_item_row_roundtrip(db_session, user):
    item = PersonalVaultItem(user_id=user.id, protected=True, summary=_envelope(), body=_envelope())
    db_session.add(item); await db_session.flush()
    assert item.version == 1 and item.protected is True
```

Fixtures `db_session` e `user`: SQLite em memória com `Base.metadata.create_all` e os `@compiles` de CITEXT/JSONB, copiados de `tests/test_me_overview.py`.

- [ ] **Passo 2:** `cd apps/api && python -m pytest tests/test_personal_vault.py -v`. Esperado: FAIL com `ImportError` em `app.models.personal_vault`.
- [ ] **Passo 3:** criar os modelos, os schemas (`Field(min_length=…, max_length=…)`, `ge`/`le` em `iterations`) e a migration (`revision = "20261106_0014"`, `down_revision = "20261026_0013"`, `downgrade` derrubando índice e tabelas).
- [ ] **Passo 4:** rodar de novo. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(api): add personal vault models, schemas and migration`.

### Tarefa 2: autenticação só por cookie

**Arquivos:**
- Modificar: `apps/api/app/middleware/auth.py`
- Teste: `apps/api/tests/test_personal_vault.py`

**Interfaces:**
- Produz: `async def get_current_web_user(request: Request, db: AsyncSession = Depends(get_db)) -> User`. Também extrai `async def _user_from_session_token(token: str, db: AsyncSession) -> User` de `get_current_user`, mantendo os 401/403 atuais (sessão inválida, e-mail não verificado). As duas dependências passam a usar essa função.

- [ ] **Passo 1: testes que falham**

```python
async def test_web_user_rejects_bearer_even_if_valid(monkeypatch):
    request = _request(headers={"Authorization": "Bearer cek_valid"}, cookies={"session_token": "tok"})
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(request, db=MagicMock())
    assert exc.value.status_code == 403
    assert exc.value.detail == "Personal vault is only available in the web dashboard"

async def test_web_user_requires_cookie():
    with pytest.raises(HTTPException) as exc:
        await get_current_web_user(_request(), db=MagicMock())
    assert exc.value.status_code == 401

async def test_web_user_accepts_session_cookie(monkeypatch):
    user = _user("ana")
    monkeypatch.setattr(AuthService, "validate_session", AsyncMock(return_value=user))
    assert await get_current_web_user(_request(cookies={"session_token": "tok"}), db=MagicMock()) is user
```

`_request` monta um `starlette.requests.Request` a partir de um scope com `headers` e o header `cookie`.

- [ ] **Passo 2:** rodar `-k web_user`. Esperado: FAIL (`ImportError`).
- [ ] **Passo 3:** implementar. Se houver `Authorization`, responder 403 antes de olhar o cookie. O token vem só de `request.cookies.get("session_token")`.
- [ ] **Passo 4:** `python -m pytest tests/test_personal_vault.py tests/test_dual_auth.py tests/test_auth_routes.py -v`. Esperado: PASS (os testes atuais de auth seguem verdes).
- [ ] **Passo 5:** commit `feat(api): add cookie-only web auth dependency`.

### Tarefa 3: service e rotas da config

**Arquivos:**
- Criar: `apps/api/app/services/personal_vault_service.py`, `apps/api/app/routers/personal_vault.py`
- Modificar: `apps/api/main.py` (`app.include_router(personal_vault_router)` depois de `me_router`)
- Teste: `apps/api/tests/test_personal_vault.py`

**Interfaces:**
- Consome: schemas da Tarefa 1 e `get_current_web_user` da Tarefa 2.
- Produz:
  - Exceções `PersonalVaultNotFound`, `PersonalVaultConflict` e `PersonalVaultLimitReached` em `personal_vault_service.py`.
  - `PersonalVaultService(db)` com `get_config(user_id) -> PersonalVault | None`, `create_config(user_id, data) -> PersonalVault` (lança Conflict se já existe) e `update_config(user_id, data: PersonalVaultConfigUpdate) -> PersonalVault` (NotFound / Conflict).
  - `router = APIRouter(prefix="/api/v1/personal-vault", tags=["Personal Vault"])`:
    - `GET /config`: 200 com `PersonalVaultConfigResponse`, ou 404 `"Personal vault not set up"`.
    - `POST /config`: 201, ou 409 `"Personal vault already exists"`.
    - `PUT /config`: 200 com a versão +1, ou 404 / 409 `"Version conflict"`.

- [ ] **Passo 1: testes que falham** (cliente `httpx.AsyncClient` com `get_db` e `get_current_web_user` sobrescritos, alternando o usuário entre A e B)

```python
async def test_config_lifecycle(client, as_user):
    as_user("ana")
    assert (await client.get("/api/v1/personal-vault/config")).status_code == 404
    r = await client.post("/api/v1/personal-vault/config", json=_config())
    assert r.status_code == 201 and r.json()["version"] == 1
    assert (await client.post("/api/v1/personal-vault/config", json=_config())).status_code == 409
    r = await client.put("/api/v1/personal-vault/config", json={**_config(master_salt="M" * 44), "expected_version": 1})
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["master_salt"] == "M" * 44

async def test_config_stale_version_conflicts(client, as_user):
    as_user("ana"); await client.post("/api/v1/personal-vault/config", json=_config())
    await client.put("/api/v1/personal-vault/config", json={**_config(), "expected_version": 1})
    r = await client.put("/api/v1/personal-vault/config", json={**_config(), "expected_version": 1})
    assert r.status_code == 409 and r.json()["detail"] == "Version conflict"

async def test_config_is_per_user(client, as_user):
    as_user("ana"); await client.post("/api/v1/personal-vault/config", json=_config())
    as_user("bia")
    assert (await client.get("/api/v1/personal-vault/config")).status_code == 404
```

- [ ] **Passo 2:** rodar `-k config`. Esperado: FAIL (404 da rota inexistente / ImportError).
- [ ] **Passo 3:** implementar. `update_config` usa um UPDATE condicional atômico: `update(PersonalVault).where(user_id == …, version == data.expected_version).values(…, version=data.expected_version + 1)`. Se `rowcount == 0`, checar se existe: se não existe, NotFound; se existe, Conflict. O router só traduz as exceções em HTTP.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(api): add personal vault config endpoints`.

### Tarefa 4: rotas dos itens

**Arquivos:**
- Modificar: `apps/api/app/services/personal_vault_service.py`, `apps/api/app/routers/personal_vault.py`
- Teste: `apps/api/tests/test_personal_vault.py`

**Interfaces:**
- Produz:
  - `MAX_PERSONAL_VAULT_ITEMS = 1000` e os métodos `list_items(user_id) -> list[PersonalVaultItem]` (por `updated_at` desc), `create_item(user_id, data) -> PersonalVaultItem` (NotFound sem config, LimitReached), `update_item(user_id, item_id, data: PersonalVaultItemUpdate)` (NotFound / Conflict) e `delete_item(user_id, item_id) -> None` (NotFound).
  - Rotas `GET /items` → 200 com `list[PersonalVaultItemResponse]`; `POST /items` → 201 (404 sem config, 409 `"Item limit reached"`); `PUT /items/{item_id}` → 200 / 404 / 409; `DELETE /items/{item_id}` → 204 / 404. Item de outro usuário responde **404**, nunca 403.

- [ ] **Passo 1: testes que falham** (fixture `setup_vault`: `as_user("ana")` + `POST /config` com `_config()`)

```python
def _item(protected=False):
    return {"protected": protected, "summary": _envelope(), "body": _envelope(ct_len=200)}

async def test_item_crud(client, setup_vault):
    r = await client.post("/api/v1/personal-vault/items", json=_item(protected=True))
    assert r.status_code == 201; item = r.json()
    assert item["protected"] is True and item["version"] == 1
    r = await client.put(f"/api/v1/personal-vault/items/{item['id']}", json={**_item(), "expected_version": 1})
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["protected"] is False
    assert [i["id"] for i in (await client.get("/api/v1/personal-vault/items")).json()] == [item["id"]]
    assert (await client.delete(f"/api/v1/personal-vault/items/{item['id']}")).status_code == 204
    assert (await client.get("/api/v1/personal-vault/items")).json() == []

async def test_item_requires_config(client, as_user):
    as_user("ana")
    assert (await client.post("/api/v1/personal-vault/items", json=_item())).status_code == 404

async def test_item_stale_version_conflicts(client, setup_vault): ...  # 2 PUTs com expected_version=1 → o 2º dá 409

async def test_items_are_isolated(client, setup_vault, as_user):
    item = (await client.post("/api/v1/personal-vault/items", json=_item())).json()
    as_user("bia")
    assert (await client.get("/api/v1/personal-vault/items")).json() == []
    assert (await client.put(f"/api/v1/personal-vault/items/{item['id']}", json={**_item(), "expected_version": 1})).status_code == 404
    assert (await client.delete(f"/api/v1/personal-vault/items/{item['id']}")).status_code == 404

async def test_item_limit(client, setup_vault, monkeypatch):
    monkeypatch.setattr(personal_vault_service, "MAX_PERSONAL_VAULT_ITEMS", 2)
    for _ in range(2):
        await client.post("/api/v1/personal-vault/items", json=_item())
    r = await client.post("/api/v1/personal-vault/items", json=_item())
    assert r.status_code == 409 and r.json()["detail"] == "Item limit reached"
```

- [ ] **Passo 2:** rodar `-k item`. Esperado: FAIL.
- [ ] **Passo 3:** implementar. O UPDATE condicional por `(id, user_id, version)` segue o padrão da Tarefa 3. O limite é lido como `personal_vault_service.MAX_PERSONAL_VAULT_ITEMS` em tempo de execução. Comentário no código: `# shortcut: count+insert can exceed the limit by one under concurrent creates; add a DB constraint if it matters`.
- [ ] **Passo 4:** rodar o arquivo inteiro. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(api): add personal vault item endpoints`.

### Tarefa 5: apagar a conta apaga o cofre

**Arquivos:**
- Modificar: `apps/api/app/services/auth_service.py` (`delete_account`, antes de `self.db.delete(user)`)
- Teste: `apps/api/tests/test_personal_vault.py`

- [ ] **Passo 1: teste que falha**

```python
async def test_delete_account_removes_personal_vault(db_session, user):
    db_session.add(PersonalVault(user_id=user.id, **_config()))
    db_session.add(PersonalVaultItem(user_id=user.id, summary=_envelope(), body=_envelope()))
    await db_session.flush()
    await AuthService(db_session).delete_account(user)
    assert (await db_session.execute(select(func.count()).select_from(PersonalVaultItem))).scalar() == 0
    assert (await db_session.execute(select(func.count()).select_from(PersonalVault))).scalar() == 0
```

- [ ] **Passo 2:** rodar. Esperado: FAIL (o SQLite não aplica o CASCADE sem PRAGMA).
- [ ] **Passo 3:** acrescentar `delete(PersonalVaultItem)` e `delete(PersonalVault)` filtrados por `user_id`, no mesmo estilo dos deletes de `Session`.
- [ ] **Passo 4:** `python -m pytest tests/test_personal_vault.py tests/test_auth_service.py -v`. Esperado: PASS.
- [ ] **Passo 5:** commit `fix(api): delete personal vault with the account`.

### Tarefa 6: criptografia do cofre no web

**Arquivos:**
- Modificar: `apps/web/src/lib/crypto.ts` (exportar `derivePbkdf2Bits`, `importAesKey`, `importHkdfKey`, sem mudar o comportamento)
- Criar: `apps/web/src/lib/personal-vault/crypto.ts`
- Teste: `apps/web/src/lib/personal-vault/__tests__/crypto.test.ts`

**Interfaces:**
- Consome: `encrypt`, `decrypt`, `bufferToBase64`, `base64ToBuffer` e `CryptoError` de `@/lib/crypto`.
- Produz:
  - Constantes `PERSONAL_VAULT_ITERATIONS = 600_000` e `PERSONAL_VAULT_KDF = "PBKDF2-SHA256"`.
  - Tipos `EncryptedField = { iv: string; ciphertext: string; auth_tag: string }` e `PersonalVaultConfigInput`, com os campos de `PersonalVaultConfigCreate` da Tarefa 1.
  - `PersonalVaultItemPlain = { type: "login"; title; username; password; url; notes } | { type: "note"; title; content }` (todos `string`). `ItemSummary = { type: "login" | "note"; title: string; username?: string; url?: string }`.
  - `encodeRecoveryKey(bytes: Uint8Array): string`: Crockford base32 de 32 bytes (52 caracteres) em 13 grupos de 4 separados por `-`.
  - `decodeRecoveryKey(input: string): Uint8Array`: ignora caixa, espaços e `-`, mapeia `O→0` e `I/L→1`. Lança `CryptoError(…, "INVALID_RECOVERY_KEY")` se não der 32 bytes.
  - `createPersonalVault(master: string, extra: string, iterations = PERSONAL_VAULT_ITERATIONS): Promise<{ config: PersonalVaultConfigInput; recoveryKey: string; vaultKey: CryptoKey }>`
  - `unlockVault(config: PersonalVaultConfigInput, master: string): Promise<CryptoKey>`: lança `"WRONG_PASSWORD"`.
  - `unlockProtectedKey(config, vaultKey: CryptoKey, extra: string): Promise<CryptoKey>`: lança `"WRONG_PASSWORD"`.
  - `recoverVault(config, recoveryKey: string, newMaster: string, newExtra: string, iterations?): Promise<{ config; recoveryKey; vaultKey }>`: lança `"INVALID_RECOVERY_KEY"` ou `"WRONG_RECOVERY_KEY"`, e devolve uma chave de recuperação **nova**.
  - `rewrapMaster(config, currentMaster: string, newMaster: string, iterations?): Promise<PersonalVaultConfigInput>`: muda só `master_salt` e `master_wrapped_vault_key`.
  - `rewrapExtra(config, vaultKey, currentExtra: string, newExtra: string, iterations?): Promise<PersonalVaultConfigInput>`: muda só `extra_salt` e `extra_wrapped_protected_key`.
  - `encryptItem(item: PersonalVaultItemPlain, vaultKey: CryptoKey, protectedKey: CryptoKey | null): Promise<{ protected: boolean; summary: EncryptedField; body: EncryptedField }>`: o resumo é `{type,title,username,url}`; o corpo é `{password,notes}` ou `{content}`.
  - `decryptSummary(summary: EncryptedField, vaultKey: CryptoKey): Promise<ItemSummary>` e `decryptItem(item: { summary; body }, vaultKey: CryptoKey, bodyKey: CryptoKey): Promise<PersonalVaultItemPlain>`.
- Detalhes que o implementador não deduz sozinho:
  - Embrulhar é `encrypt(bufferToBase64(raw), kek)`.
  - `KEK_rec` = HKDF-SHA256 da chave de recuperação, com `salt` vazio e `info "criptenv-personal-recovery-v1"`.
  - `extra_wrapped_protected_key` = `encrypt(JSON.stringify(envelopeInterno), vaultKey)`.
  - Toda chave importada para uso é **não extraível**.

- [ ] **Passo 1: testes que falham** (`ITER = 1_000` nos testes, para ficarem rápidos)

```ts
it("roundtrips recovery keys and tolerates sloppy typing", () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const key = encodeRecoveryKey(bytes)
  expect(key).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){12}[0-9A-HJKMNP-TV-Z]{4}$/)
  const sloppy = key.toLowerCase().replace(/-/g, " ").replace(/0/g, "o").replace(/1/g, "l")
  expect(decodeRecoveryKey(sloppy)).toEqual(bytes)
  expect(() => decodeRecoveryKey("abc")).toThrow(expect.objectContaining({ code: "INVALID_RECOVERY_KEY" }))
})

it("opens with the master password and rejects a wrong one", async () => {
  const { config } = await createPersonalVault("mestra-forte-123", "extra-123", ITER)
  expect(config.iterations).toBe(ITER)
  await expect(unlockVault(config, "mestra-forte-123")).resolves.toBeDefined()
  await expect(unlockVault(config, "errada-errada-1")).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
})

it("protected body needs the extra password on top of the vault key", async () => {
  const { config, vaultKey } = await createPersonalVault("mestra-forte-123", "extra-123", ITER)
  const plain = { type: "login", title: "Instagram", username: "jean", password: "s3nh@", url: "https://instagram.com", notes: "" } as const
  const pk = await unlockProtectedKey(config, vaultKey, "extra-123")
  const enc = await encryptItem(plain, vaultKey, pk)
  expect(enc.protected).toBe(true)
  expect(await decryptSummary(enc.summary, vaultKey)).toEqual({ type: "login", title: "Instagram", username: "jean", url: "https://instagram.com" })
  await expect(decryptItem(enc, vaultKey, vaultKey)).rejects.toMatchObject({ code: "DECRYPTION_FAILED" })
  expect(await decryptItem(enc, vaultKey, pk)).toEqual(plain)
  await expect(unlockProtectedKey(config, vaultKey, "outra-123")).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
})

it("recovery resets both passwords, keeps data and rotates the recovery key", async () => {
  const created = await createPersonalVault("mestra-forte-123", "extra-123", ITER)
  const pk = await unlockProtectedKey(created.config, created.vaultKey, "extra-123")
  const enc = await encryptItem({ type: "note", title: "Banco", content: "PIN 1234" }, created.vaultKey, pk)
  const rec = await recoverVault(created.config, created.recoveryKey, "nova-mestra-456", "nova-extra-4", ITER)
  expect(rec.recoveryKey).not.toBe(created.recoveryKey)
  const vk = await unlockVault(rec.config, "nova-mestra-456")
  const pk2 = await unlockProtectedKey(rec.config, vk, "nova-extra-4")
  expect(await decryptItem(enc, vk, pk2)).toEqual({ type: "note", title: "Banco", content: "PIN 1234" })
  await expect(recoverVault(rec.config, created.recoveryKey, "x".repeat(12), "y".repeat(8), ITER))
    .rejects.toMatchObject({ code: "WRONG_RECOVERY_KEY" })
})

it("rewrapMaster changes only the master fields", async () => {
  const { config } = await createPersonalVault("mestra-forte-123", "extra-123", ITER)
  const next = await rewrapMaster(config, "mestra-forte-123", "outra-mestra-789", ITER)
  expect({ ...next, master_salt: 0, master_wrapped_vault_key: 0 }).toEqual({ ...config, master_salt: 0, master_wrapped_vault_key: 0 })
  await expect(unlockVault(next, "outra-mestra-789")).resolves.toBeDefined()
  await expect(unlockVault(next, "mestra-forte-123")).rejects.toMatchObject({ code: "WRONG_PASSWORD" })
})
// idem para rewrapExtra: muda só extra_salt/extra_wrapped_protected_key e a senha extra antiga para de funcionar
```

- [ ] **Passo 2:** `cd apps/web && npx jest src/lib/personal-vault`. Esperado: FAIL (módulo inexistente).
- [ ] **Passo 3:** implementar. Na base32, os bits sobrando do último caractere são zero. Os bytes brutos de VK e PK são zerados com `fill(0)` depois de embrulhados.
- [ ] **Passo 4:** rodar `npx jest src/lib` (inclui os testes atuais de `crypto.ts`/`vault.test.ts`). Esperado: PASS.
- [ ] **Passo 5:** commit `feat(web): add personal vault key hierarchy and item crypto`.

### Tarefa 7: cliente HTTP

**Arquivos:**
- Criar: `apps/web/src/lib/api/personal-vault.ts` (e exportar em `src/lib/api/index.ts`, se o padrão do arquivo for esse)
- Teste: `apps/web/src/lib/api/__tests__/personal-vault.test.ts`

**Interfaces:**
- Consome: `request` e `ApiError` de `./client`; tipos da Tarefa 6.
- Produz:
  - `PersonalVaultConfig = PersonalVaultConfigInput & { version: number; created_at: string; updated_at: string }` e `PersonalVaultItem = { id: string; protected: boolean; summary: EncryptedField; body: EncryptedField; version: number; created_at: string; updated_at: string }`.
  - Funções `getPersonalVaultConfig(): Promise<PersonalVaultConfig | null>` (404 → `null`), `createPersonalVaultConfig(input)`, `updatePersonalVaultConfig(input, expectedVersion: number)`, `listPersonalVaultItems(): Promise<PersonalVaultItem[]>`, `createPersonalVaultItem(input)`, `updatePersonalVaultItem(id: string, input, expectedVersion: number)` e `deletePersonalVaultItem(id: string): Promise<void>`.

- [ ] **Passo 1:** testes com `fetch` mockado, no estilo de `__tests__/vault.test.ts`: 404 vira `null`; outros erros sobem como `ApiError`; o PUT manda `expected_version` no corpo; as rotas são `/api/v1/personal-vault/config` e `/api/v1/personal-vault/items/{id}`; nenhuma chamada manda header `Authorization`.
- [ ] **Passo 2:** `npx jest src/lib/api/__tests__/personal-vault.test.ts`. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(web): add personal vault API client`.

### Tarefa 8: página `/vault`, com sessão, criação, desbloqueio e recuperação

**Arquivos:**
- Criar em `apps/web/src/app/[locale]/(dashboard)/vault/`: `page.tsx`, `_components/vault-session.tsx`, `_components/vault-setup.tsx`, `_components/recovery-key-sheet.tsx`, `_components/vault-unlock.tsx`, `_components/vault-recovery.tsx`
- Modificar: `src/components/layout/dashboard-nav.ts` (`{ icon: KeyRound, labelKey: "vault", href: "/vault", matchMode: "prefix" }` em `mainNavItems`, depois de `projects`), `src/i18n/messages.ts` (`"vault"` em `NAMESPACES`), `messages/{pt-BR,en,es}/dashboard.json` (`nav.vault`: "Cofre" / "Vault" / "Bóveda"), `messages/{pt-BR,en,es}/vault.json` (novos)
- Teste: `vault/__tests__/vault-page.test.tsx`

**Interfaces:**
- Consome: Tarefas 6 e 7.
- Produz:
  - `PersonalVaultSessionProvider` e `usePersonalVaultSession(): { vaultKey: CryptoKey | null; unlock(key: CryptoKey): void; lock(): void }`, com `PERSONAL_VAULT_IDLE_MS = 600_000`. O timer reinicia a cada `pointerdown`/`keydown`. O estado vive só no provider: sair da rota destrói tudo, e nada vai para store, `localStorage` ou React Query.
  - `lock()` chama `queryClient.removeQueries({ queryKey: ["personal-vault"] })`.
  - Query keys `["personal-vault", "config"]` e `["personal-vault", "items"]`.
- Comportamento da página:
  - Config `null` mostra `VaultSetup`.
  - Cofre trancado mostra `VaultUnlock`, com o link "Esqueci a senha mestra" que leva a `VaultRecovery`.
  - Cofre aberto mostra a lista (Tarefa 9).
  - Em `VaultSetup`, o usuário digita a mestra e a confirmação, depois a extra e a confirmação, com as regras das Restrições globais. A chave é gerada localmente e `RecoveryKeySheet` mostra a chave, um botão "Imprimir" (`window.print()` com CSS de impressão só da folha) e um checkbox "Guardei a chave de recuperação" que habilita "Concluir". **Só no "Concluir"** acontece o `createPersonalVaultConfig`, então desistir no meio não grava nada.
  - Em `VaultRecovery`, o usuário digita a chave de recuperação, a nova mestra e a nova extra. Depois vê a nova folha de recuperação e confirma, e aí acontece o `updatePersonalVaultConfig(…, config.version)`.
- Texto fixo (pt-BR) da folha de recuperação: **"Sem a senha mestra ou esta chave de recuperação, ninguém consegue abrir este cofre, nem a equipe do CriptEnv."**

- [ ] **Passo 1: testes que falham** (mockar `@/lib/api/personal-vault` e `@/lib/personal-vault/crypto`; `jest.useFakeTimers()` no teste de inatividade)
  - `shows setup when there is no config`: `getPersonalVaultConfig` → `null`, e aparece o título da criação.
  - `setup does not save until the recovery key is confirmed`: preencher as senhas e avançar; `createPersonalVaultConfig` não foi chamado; "Concluir" está desabilitado até marcar o checkbox; depois do clique, foi chamado 1 vez.
  - `setup rejects short or equal passwords`: mestra com 11 caracteres mostra erro; extra igual à mestra mostra erro; `createPersonalVault` não foi chamado.
  - `wrong master password shows an error and allows retry`: `unlockVault` rejeita com `WRONG_PASSWORD` → aparece "Senha mestra incorreta", o campo fica limpo e focado, e nenhuma função da API foi chamada além de `getPersonalVaultConfig`.
  - `locks after 10 minutes idle and clears decrypted content`: abrir o cofre, aparece a lista; `jest.advanceTimersByTime(600_000)` → volta a tela de desbloqueio e o título do item some do DOM.
  - `nav shows the vault entry`: `getDashboardNavGroups().mainNavItems` contém `href: "/vault"`.
- [ ] **Passo 2:** `npx jest src/app/\[locale\]/\(dashboard\)/vault`. Esperado: FAIL.
- [ ] **Passo 3:** implementar, seguindo o padrão de `integrations/page.tsx` (client component, `useTranslations("vault")`) e os componentes Radix de `src/components/ui/`.
- [ ] **Passo 4:** `npx jest src/app/\[locale\]/\(dashboard\)/vault src/components/layout && npm run check:i18n && npm run lint`. Esperado: tudo passa.
- [ ] **Passo 5:** commit `feat(web): add personal vault page with setup, unlock and recovery`.

### Tarefa 9: itens, proteção extra e troca de senhas

**Arquivos:**
- Criar em `vault/_components/`: `vault-items.tsx`, `vault-item-dialog.tsx`, `protected-reveal-dialog.tsx`, `vault-settings-dialog.tsx`
- Modificar: `vault/page.tsx`, `messages/{pt-BR,en,es}/vault.json`
- Teste: `vault/__tests__/vault-items.test.tsx`

**Interfaces:**
- Consome: `usePersonalVaultSession` (Tarefa 8), crypto (Tarefa 6), API (Tarefa 7).
- Comportamento:
  - `VaultItems` decifra os resumos ao carregar e oferece busca local por título, usuário e URL, filtro por tipo (Todos / Logins / Notas) e cadeado nos itens protegidos.
  - Ações: copiar usuário e senha (`navigator.clipboard.writeText`), editar, apagar (com confirmação).
  - Revelar ou copiar a senha de um item protegido abre o `ProtectedRevealDialog`. Ele pede a senha extra, chama `unlockProtectedKey` e decifra. A PK fica só no escopo da função e não vai para estado. Fechar o diálogo descarta o conteúdo.
  - `VaultItemDialog` cria ou edita login e nota, com o switch "Proteção extra". Ligar o switch pede a senha extra para cifrar; desligar num item protegido pede a senha extra para decifrar antes de cifrar de novo com a VK.
  - Um 409 no PUT mostra o aviso "Este item mudou em outra aba. Recarregamos a versão mais recente." e invalida `["personal-vault","items"]` **sem tentar gravar de novo**.
  - `VaultSettingsDialog` tem "Trocar senha mestra" (`rewrapMaster` → `updatePersonalVaultConfig`) e "Trocar senha extra" (`rewrapExtra` → idem), com o mesmo tratamento de 409.

- [ ] **Passo 1: testes que falham**
  - `filters by search and type`: 3 resumos mockados (2 logins e 1 nota); buscar "insta" deixa 1; o filtro "Notas" deixa 1.
  - `protected item asks for the extra password and forgets it`: clicar em "Revelar" abre o diálogo; com a senha certa a senha aparece; ao fechar e revelar de novo, a senha extra é pedida outra vez (`unlockProtectedKey` chamado 2 vezes).
  - `new protected item is encrypted with the protected key`: com o switch ligado e a senha extra digitada, `encryptItem` recebe um `protectedKey` diferente de `null` e `createPersonalVaultItem` recebe `protected: true`.
  - `version conflict reloads instead of overwriting`: `updatePersonalVaultItem` rejeita com `ApiError(409)` → aparece o aviso, a query é invalidada e `updatePersonalVaultItem` foi chamado só 1 vez.
  - `change master password sends the rewrapped config with the current version`: `updatePersonalVaultConfig` recebe o retorno de `rewrapMaster` e `config.version`.
- [ ] **Passo 2:** rodar `npx jest …/vault/__tests__/vault-items.test.tsx`. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx jest src/app/\[locale\]/\(dashboard\)/vault && npm run check:i18n && npm run lint`. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(web): manage personal vault items with extra protection`.

### Tarefa 10: e2e, documentação de segurança e changelog

**Arquivos:**
- Criar: `apps/web/cypress/e2e/personal-vault.cy.ts`, `docs/security/personal-vault.md`
- Modificar: `docs/development/CHANGELOG.md`

- [ ] **Passo 1: spec Cypress**, com `cy.resetDb()` e `cy.signup()` como em `project-vault.cy.ts`:
  1. Visitar `/vault`, criar o cofre (mestra `MestraForte123!`, extra `Extra1234!`), marcar "Guardei" e concluir.
  2. Criar o login protegido "Instagram" e a nota comum "Wi-Fi".
  3. Recarregar a página: o cofre está trancado. Desbloquear com a mestra; os dois títulos aparecem.
  4. Revelar a senha do Instagram com a senha extra: a senha aparece.
  5. Garantir pelo `cy.request` que `GET /api/v1/personal-vault/items` com `Authorization: Bearer x` dá 403.
- [ ] **Passo 2:** `cd apps/web && npm run test:e2e -- --spec cypress/e2e/personal-vault.cy.ts`. Esperado: PASS.
- [ ] **Passo 3:** escrever `docs/security/personal-vault.md`: a hierarquia de chaves, o que o servidor vê (envelopes, flag `protected`, datas e quantidade de itens), o que não vê, os riscos conhecidos e as alternativas descartadas, copiados das seções deste plano. Também a entrada no CHANGELOG.
- [ ] **Passo 4:** rodar a suíte completa: `cd apps/api && python -m pytest tests/ -q` e `cd apps/web && npm run test:unit && npm run check:i18n && npm run lint && npm run build`. Esperado: tudo verde.
- [ ] **Passo 5:** commit `docs: document personal vault crypto model` e abrir o PR `feature/personal-vault` → `main`.

---

## Ordem

```
T1 ─▶ T2 ─▶ T3 ─▶ T4 ─▶ T5        (API)
T6 ─▶ T7 ─▶ T8 ─▶ T9              (web; T6 pode começar junto com T1)
                         └─▶ T10  (depois de T5 e T9)
```
