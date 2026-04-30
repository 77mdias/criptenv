# PHASE-1.5: CLI Integration Plan

**Status**: 📋 READY FOR IMPLEMENTATION
**Created**: 2026-04-30
**Goal**: Conectar todos os stubs do CLI com a lógica real (crypto, vault, API)

---

## Estado Atual

| Componente              | Status      | Gap                         |
| ----------------------- | ----------- | --------------------------- |
| Crypto module           | ✅ Completo | Nenhum                      |
| Vault module            | ✅ Completo | Nenhum                      |
| API client              | ✅ Completo | Nenhum                      |
| Session manager         | ✅ Completo | Nenhum                      |
| `init` command          | ⚠️ Stub     | Não cria DB, não pede senha |
| `login` command         | ⚠️ Stub     | Não usa SessionManager      |
| `logout` command        | ⚠️ Stub     | Não limpa sessão            |
| `set` command           | ⚠️ Stub     | Não encripta/salva          |
| `get` command           | ⚠️ Stub     | Não decripta/mostra         |
| `list` command          | ⚠️ Stub     | Não consulta vault          |
| `delete` command        | ⚠️ Stub     | Não remove do vault         |
| `push` command          | ⚠️ Stub     | Não envia para API          |
| `pull` command          | ⚠️ Stub     | Não baixa da API            |
| `env list` command      | ⚠️ Stub     | Não consulta API            |
| `env create` command    | ⚠️ Stub     | Não cria via API            |
| `projects list` command | ⚠️ Stub     | Não consulta API            |
| `doctor` command        | ⚠️ Stub     | Não verifica nada           |
| `import` command        | ⚠️ Stub     | Não parseia .env            |
| `export` command        | ⚠️ Stub     | Não exporta                 |

---

## Desafio Técnico: Async ↔ Sync

O CLI usa **Click** (síncrono), mas o vault usa **aiosqlite** (async) e o API client usa **httpx** (async).

**Solução**: Helper function `run_async()` que executa coroutines de dentro de comandos síncronos.

```python
# cli.py ou utils.py
import asyncio

def run_async(coro):
    """Run an async function from sync Click commands."""
    return asyncio.run(coro)
```

---

## Fluxo de Dados por Comando

### `criptenv init`

```
User → digita master password
  → generate_salt() → salva salt no vault (config table)
  → init_schema(db) → cria tabelas SQLite
  → imprime "Initialized at ~/.criptenv/"
```

**Arquivo**: [`commands/init.py`](apps/cli/src/criptenv/commands/init.py)

**Lógica**:

1. `ensure_config_dir()` — cria `~/.criptenv/`
2. `get_db()` + `init_schema(db)` — inicializa SQLite
3. `getpass.getpass()` — pede master password (2x para confirmar)
4. `generate_salt()` — gera salt aleatório
5. `set_config(db, "master_salt", salt.hex())` — salva salt
6. Verifica se já existe (se sim, pede `--force`)

---

### `criptenv login`

```
User → email + password (API password, não master password)
  → SessionManager.login(email, password)
    → POST /api/auth/signin → recebe token
    → encrypt(token, master_key) → salva no vault
  → imprime "Logged in as user@email.com"
```

**Arquivo**: [`commands/login.py`](apps/cli/src/criptenv/commands/login.py)

**Lógica**:

1. `get_db()` — abre vault
2. `get_config(db, "master_salt")` — recupera salt
3. `getpass.getpass("Master password: ")` — pede master password
4. `derive_master_key(password, salt)` — deriva chave
5. `SessionManager(master_key, db)` — cria manager
6. `manager.login(email, api_password)` — autentica via API
7. Imprime sucesso

**Nota**: São duas senhas diferentes:

- **Master password** → usada para encriptar o token localmente (nunca sai do CLI)
- **API password** → enviada ao servidor para autenticação

**UX simplificada**: Perguntar apenas a senha da conta (que é usada como master password também). Isso evita confusão com duas senhas.

---

### `criptenv logout`

```
  → SessionManager.logout()
    → DELETE /api/auth/signout
    → delete_all_sessions(db)
  → imprime "Logged out"
```

**Arquivo**: [`commands/login.py`](apps/cli/src/criptenv/commands/login.py)

---

### `criptenv set KEY=value`

```
User → KEY=value
  → get_active_session() → valida login
  → get_config("master_salt") + getpass → deriva master_key
  → derive_env_key(master_key, env_id) → deriva env_key
  → encrypt(value, env_key) → ciphertext, iv, auth_tag, checksum
  → save_secret(db, Secret(...)) → salva no vault local
  → imprime "Set KEY"
```

**Arquivo**: [`commands/secrets.py`](apps/cli/src/criptenv/commands/secrets.py)

**Lógica**:

1. Parse `KEY=value`
2. Resolver `--env` → environment_id (por nome ou ID)
3. Se não especificado, usar "default" ou o único ambiente disponível
4. Derivar master key (pedir senha)
5. Derivar env key
6. Encriptar valor
7. Salvar no vault local (upsert por environment_id + key_id)

---

### `criptenv get KEY`

```
  → get_secret(db, env_id, key_id)
  → decrypt(ciphertext, iv, auth_tag, env_key, checksum)
  → imprime plaintext (ou copia para clipboard com -c)
```

**Arquivo**: [`commands/secrets.py`](apps/cli/src/criptenv/commands/secrets.py)

---

### `criptenv list`

```
  → list_secrets(db, env_id)
  → imprime tabela: KEY_NAME (v1) | updated_at
```

**Arquivo**: [`commands/secrets.py`](apps/cli/src/criptenv/commands/secrets.py)

---

### `criptenv delete KEY`

```
  → delete_secret_by_key(db, env_id, key_id)
  → imprime "Deleted KEY"
```

**Arquivo**: [`commands/secrets.py`](apps/cli/src/criptenv/commands/secrets.py)

---

### `criptenv push`

```
  → list_secrets(db, env_id) → secrets locais
  → Para cada secret: serializar como blob base64
  → get_vault_version(project_id, env_id) → verificar conflito
  → Se conflito: perguntar ao usuário
  → push_vault(project_id, env_id, blobs) → enviar
  → imprime "Pushed N secrets (version V)"
```

**Arquivo**: [`commands/sync.py`](apps/cli/src/criptenv/commands/sync.py)

**Serialização do blob**:

```python
{
    "key_id": secret.key_id,
    "iv": base64.b64encode(secret.iv).decode(),
    "ciphertext": base64.b64encode(secret.ciphertext).decode(),
    "auth_tag": base64.b64encode(secret.auth_tag).decode(),
    "version": secret.version,
    "checksum": secret.checksum,
}
```

---

### `criptenv pull`

```
  → pull_vault(project_id, env_id) → blobs do servidor
  → Para cada blob: deserializar de base64
  → save_secret(db, Secret(...)) → salvar localmente
  → Se conflito local: perguntar ao usuário
  → imprime "Pulled N secrets (version V)"
```

**Arquivo**: [`commands/sync.py`](apps/cli/src/criptenv/commands/sync.py)

---

### `criptenv env list`

```
  → list_environments(project_id) via API
  → imprime tabela: NAME | ID | created_at
```

**Arquivo**: [`commands/environments.py`](apps/cli/src/criptenv/commands/environments.py)

---

### `criptenv env create NAME`

```
  → create_environment(project_id, name) via API
  → imprime "Created environment 'NAME' (id: UUID)"
```

**Arquivo**: [`commands/environments.py`](apps/cli/src/criptenv/commands/environments.py)

---

### `criptenv projects list`

```
  → list_projects() via API
  → imprime tabela: NAME | ID | slug
```

**Arquivo**: [`commands/projects.py`](apps/cli/src/criptenv/commands/projects.py)

---

### `criptenv doctor`

```
  → Check 1: ~/.criptenv/ existe?
  → Check 2: vault.db acessível?
  → Check 3: master_salt configurado?
  → Check 4: sessão ativa existe?
  → Check 5: API reachable? (GET /api/auth/session)
  → Check 6: crypto round-trip funciona?
  → Imprime relatório ✓/✗
```

**Arquivo**: [`commands/doctor.py`](apps/cli/src/criptenv/commands/doctor.py)

---

### `criptenv import .env`

```
  → Ler arquivo .env
  → Parsear KEY=VALUE (ignorar comentários e linhas vazias)
  → Para cada par: encriptar e salvar no vault
  → imprime "Imported N secrets"
```

**Arquivo**: [`commands/import_export.py`](apps/cli/src/criptenv/commands/import_export.py)

**Parsing**: Usar `python-dotenv` ou parsing manual:

```python
from dotenv import dotenv_values
values = dotenv_values(file)
```

---

### `criptenv export`

```
  → list_secrets(db, env_id)
  → Para cada secret: decriptar
  → Formatar como .env ou JSON
  → Escrever em arquivo ou stdout
```

**Arquivo**: [`commands/import_export.py`](apps/cli/src/criptenv/commands/import_export.py)

---

## Helper: Context Manager

Para evitar repetição de "abrir DB, derivar chave, etc.", criar um context manager:

```python
# criptenv/context.py

@contextmanager
def cli_context(require_auth=True):
    """Context manager that sets up DB, master key, and session."""
    db = run_async(get_db())
    run_async(init_schema(db))

    salt_hex = run_async(queries.get_config(db, "master_salt"))
    if not salt_hex:
        click.echo("Error: Run 'criptenv init' first", err=True)
        raise SystemExit(1)

    password = getpass.getpass("Master password: ")
    master_key = derive_master_key(password, bytes.fromhex(salt_hex))

    session_mgr = None
    client = None
    if require_auth:
        session_mgr = SessionManager(master_key, db)
        client = run_async(session_mgr.get_authenticated_client())
        if not client:
            click.echo("Error: Not logged in. Run 'criptenv login'", err=True)
            raise SystemExit(1)

    yield db, master_key, client

    run_async(close_db(db))
```

---

## Ordem de Implementação

### Step 1: Helper Infrastructure

- [`context.py`](apps/cli/src/criptenv/context.py) — `cli_context()` + `run_async()`

### Step 2: Local-Only Commands (sem API)

- [`commands/init.py`](apps/cli/src/criptenv/commands/init.py) — init completo
- [`commands/secrets.py`](apps/cli/src/criptenv/commands/secrets.py) — set/get/list/delete local

### Step 3: Auth Commands

- [`commands/login.py`](apps/cli/src/criptenv/commands/login.py) — login/logout com SessionManager

### Step 4: API Commands

- [`commands/projects.py`](apps/cli/src/criptenv/commands/projects.py) — projects list
- [`commands/environments.py`](apps/cli/src/criptenv/commands/environments.py) — env list/create

### Step 5: Sync Commands

- [`commands/sync.py`](apps/cli/src/criptenv/commands/sync.py) — push/pull

### Step 6: Utility Commands

- [`commands/doctor.py`](apps/cli/src/criptenv/commands/doctor.py) — diagnóstico completo
- [`commands/import_export.py`](apps/cli/src/criptenv/commands/import_export.py) — import/export

### Step 7: Integration Tests

- [`tests/test_integration.py`](apps/cli/tests/test_integration.py) — fluxo completo init→login→set→get→push→pull

---

## Testes por Step

| Step | Testes                  | Cobertura                               |
| ---- | ----------------------- | --------------------------------------- |
| 1    | `test_context.py`       | cli_context abre/fecha DB, deriva chave |
| 2    | `test_secrets_local.py` | set/get/list/delete com vault real      |
| 3    | `test_login_flow.py`    | login com API mockada                   |
| 4    | `test_api_commands.py`  | projects/env com API mockada            |
| 5    | `test_sync.py`          | push/pull com API mockada               |
| 6    | `test_doctor.py`        | diagnóstico com cenários variados       |
| 7    | `test_integration.py`   | fluxo E2E contra API real               |

---

## Riscos

| Risco                                 | Mitigação                                         |
| ------------------------------------- | ------------------------------------------------- |
| Master password pedida a cada comando | Cache em memória durante sessão do terminal       |
| Async/sync mismatch                   | Helper `run_async()` testado                      |
| Conflitos de sync                     | Implementar merge strategy com version check      |
| .env com encoding variado             | Suportar UTF-8, Latin-1, detectar automaticamente |
