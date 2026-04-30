# PHASE-1 CLI Implementation Plan

**Status**: 📋 READY FOR IMPLEMENTATION
**Created**: 2026-04-30
**Scope**: CLI + Encryption Core for CriptEnv

---

## Decisões de Design

| Decisão            | Escolha                                          | Justificativa                                |
| ------------------ | ------------------------------------------------ | -------------------------------------------- |
| Token no body      | Modificar `AuthResponse` para incluir `token`    | CLI precisa do token sem depender de cookies |
| Encoding blobs     | Base64                                           | Compatibilidade com frontend web existente   |
| Resolução de nomes | Comandos auxiliares `projects list` + `env list` | UX amigável com fallback para IDs            |

---

## Pré-requisito: Modificação na API

Antes de criar o CLI, o endpoint de signin precisa retornar o token no body.

### Alteração em `apps/api/app/schemas/auth.py`

Adicionar campo `token` ao `AuthResponse`:

```python
class AuthResponse(BaseModel):
    user: UserResponse
    session: SessionResponse
    token: str  # Session token for CLI usage
```

### Alteração em `apps/api/app/routers/auth.py`

Nos endpoints `signup` e `signin`, incluir `token=session.token` no retorno:

```python
return AuthResponse(
    user=_user_to_response(user),
    session=_session_to_response(session),
    token=session.token  # Adicionar isto
)
```

**Impacto**: Zero breaking change - o frontend web usa cookies, ignora o campo `token` no body.

---

## Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER WORKFLOW                            │
│                                                                 │
│  1. criptenv init          → Cria ~/.criptenv/, gera salt       │
│  2. criptenv login         → Autentica, armazena token          │
│  3. criptenv set KEY=val   → Deriva key, encripta, salva local  │
│  4. criptenv get KEY       → Busca local, decripta, mostra      │
│  5. criptenv push          → Envia blobs encriptados p/ cloud   │
│  6. criptenv pull          → Baixa blobs do cloud p/ local      │
└─────────────────────────────────────────────────────────────────┘
```

### Hierarquia de Chaves

```
User Password (nunca armazenado)
    │
    ▼ PBKDF2-SHA256 (100k iterations, salt aleatório)
Master Key (32 bytes, em memória apenas)
    │
    ▼ HKDF-SHA256(env_id)
Environment Key (32 bytes, por ambiente)
    │
    ▼ AES-256-GCM(plaintext, env_key)
Ciphertext + IV + AuthTag → armazenado no vault
```

### Encoding dos Blobs

Todos os campos binários (iv, ciphertext, auth_tag) são serializados como **base64** para:

- Compatibilidade com o frontend web
- Compatibilidade com o schema `VaultBlobPush` da API
- Eficiência de transporte (menor que hex)

---

## Estrutura de Diretórios

```
apps/cli/
├── pyproject.toml
├── src/
│   └── criptenv/
│       ├── __init__.py
│       ├── cli.py              # Click entry point
│       ├── config.py           # Config paths, env vars
│       ├── session.py          # Session token management
│       ├── commands/
│       │   ├── __init__.py
│       │   ├── init.py         # criptenv init
│       │   ├── login.py        # criptenv login/logout
│       │   ├── secrets.py      # set/get/list/delete
│       │   ├── sync.py         # push/pull
│       │   ├── environments.py # env list/create
│       │   ├── projects.py     # projects list (name resolution)
│       │   ├── doctor.py       # Diagnostic
│       │   └── import_export.py # import/export .env
│       ├── crypto/
│       │   ├── __init__.py
│       │   ├── core.py         # AES-256-GCM encrypt/decrypt
│       │   ├── keys.py         # PBKDF2 + HKDF key derivation
│       │   └── utils.py        # base64 helpers, checksum
│       ├── vault/
│       │   ├── __init__.py
│       │   ├── database.py     # SQLite connection + schema
│       │   ├── models.py       # Dataclasses
│       │   └── queries.py      # CRUD operations
│       └── api/
│           ├── __init__.py
│           ├── client.py       # httpx HTTP client
│           ├── auth.py         # Auth endpoint wrappers
│           └── vault.py        # Vault endpoint wrappers
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_crypto.py
    ├── test_vault.py
    └── test_commands.py
```

---

## Milestones

### M1.1: CLI Scaffolding

Criar estrutura do projeto com todos os comandos retornando output correto (stubs).

**Arquivos:**

- `apps/cli/pyproject.toml` - Pacote com Click, cryptography, httpx, aiosqlite, python-dotenv
- `apps/cli/src/criptenv/__init__.py` - Version
- `apps/cli/src/criptenv/cli.py` - Click group principal
- `apps/cli/src/criptenv/config.py` - Paths e configuração
- `apps/cli/src/criptenv/commands/__init__.py`
- `apps/cli/src/criptenv/commands/init.py` - Stub
- `apps/cli/src/criptenv/commands/login.py` - Stub
- `apps/cli/src/criptenv/commands/secrets.py` - Stubs set/get/list/delete
- `apps/cli/src/criptenv/commands/sync.py` - Stubs push/pull
- `apps/cli/src/criptenv/commands/environments.py` - Stubs env list/create
- `apps/cli/src/criptenv/commands/projects.py` - Stub projects list
- `apps/cli/src/criptenv/commands/doctor.py` - Stub
- `apps/cli/src/criptenv/commands/import_export.py` - Stubs import/export
- `apps/cli/tests/__init__.py`

**Verificação:** `criptenv --help` lista todos os comandos.

---

### M1.2: Encryption Module

Implementar criptografia client-side AES-256-GCM com round-trip verificado.

**Arquivos:**

- `apps/cli/src/criptenv/crypto/__init__.py` - Exports públicos
- `apps/cli/src/criptenv/crypto/keys.py` - `generate_salt()`, `derive_master_key()`, `derive_env_key()`
- `apps/cli/src/criptenv/crypto/core.py` - `encrypt()`, `decrypt()`
- `apps/cli/src/criptenv/crypto/utils.py` - `to_base64()`, `from_base64()`, `compute_checksum()`
- `apps/cli/tests/test_crypto.py` - Round-trip tests, key derivation tests

**Parâmetros:**

- PBKDF2-SHA256, 100k iterações, salt 32 bytes
- HKDF-SHA256 para chaves por ambiente
- AES-256-GCM, IV 12 bytes, AuthTag 16 bytes
- Checksum SHA-256 do plaintext

**Verificação:** `pytest tests/test_crypto.py -v` - round-trip encrypt→decrypt.

---

### M1.3: Local Vault

SQLite em `~/.criptenv/vault.db` armazenando secrets encriptados.

**Arquivos:**

- `apps/cli/src/criptenv/vault/__init__.py` - Exports
- `apps/cli/src/criptenv/vault/database.py` - Conexão SQLite, schema init
- `apps/cli/src/criptenv/vault/models.py` - Dataclasses: Session, Environment, Secret
- `apps/cli/src/criptenv/vault/queries.py` - CRUD: save_secret, get_secret, list_secrets, delete_secret, config ops
- `apps/cli/tests/test_vault.py` - CRUD tests

**Schema:**

- `config` - key/value store (master_salt, etc.)
- `sessions` - token encriptado, user_id, email
- `environments` - id, project_id, name, env_key_encrypted
- `secrets` - id, environment_id, key_id, iv, ciphertext, auth_tag, version, checksum

**Verificação:** `pytest tests/test_vault.py -v` - CRUD operations.

---

### M1.4: Auth Integration

Integrar com endpoints `/api/auth/*` existentes.

**Arquivos:**

- `apps/cli/src/criptenv/api/__init__.py`
- `apps/cli/src/criptenv/api/client.py` - `CriptEnvClient` com httpx
- `apps/cli/src/criptenv/api/auth.py` - Wrappers para signin/signout/session
- `apps/cli/src/criptenv/api/vault.py` - Wrappers para push/pull/version
- `apps/cli/src/criptenv/session.py` - `SessionManager` com token encriptado

**Endpoints consumidos:**

- `POST /api/auth/signin` → retorna `AuthResponse` com `token`
- `POST /api/auth/signout` → invalida sessão
- `GET /api/auth/session` → valida token, retorna user

**Fluxo login:**

1. Usuário digita email + password
2. CLI chama `/api/auth/signin`
3. Recebe `token` no body
4. Deriva master key do password (PBKDF2)
5. Encripta token com master key
6. Armazena em `sessions` table no vault local

**Verificação:** `criptenv login --email test@test.com` armazena sessão.

---

### M1.5: Core Commands

Implementar comandos principais de gerenciamento de secrets.

**Arquivos (implementação completa):**

- `apps/cli/src/criptenv/commands/secrets.py` - set/get/list/delete
- `apps/cli/src/criptenv/commands/environments.py` - env list/create
- `apps/cli/src/criptenv/commands/projects.py` - projects list (resolução de nomes)
- `apps/cli/src/criptenv/commands/init.py` - Implementação completa

**Comandos:**

```
criptenv init                           # Cria ~/.criptenv/, gera salt, init DB
criptenv set API_KEY=secret123          # Encripta e salva local
criptenv set API_KEY=secret123 -e staging  # Em ambiente específico
criptenv get API_KEY                    # Decripta e mostra
criptenv list                           # Lista nomes dos secrets
criptenv delete API_KEY                 # Remove secret
criptenv projects list                  # Lista projetos (nome + ID)
criptenv env list                       # Lista ambientes
criptenv env create staging             # Cria ambiente
```

**Verificação:** Todos os comandos funcionam localmente.

---

### M1.6: Sync & Advanced Commands

Push/pull cloud sync e comandos utilitários.

**Arquivos:**

- `apps/cli/src/criptenv/commands/sync.py` - push/pull com resolução de conflitos
- `apps/cli/src/criptenv/commands/doctor.py` - Diagnóstico completo
- `apps/cli/src/criptenv/commands/import_export.py` - Import/export .env

**Comandos:**

```
criptenv push                           # Envia local → cloud
criptenv pull                           # Baixa cloud → local
criptenv doctor                         # Verifica config, conectividade, crypto
criptenv import .env                    # Importa de arquivo .env
criptenv export                         # Exporta para .env
```

**Resolução de conflitos (push):**

1. Verifica versão remota via `GET .../vault/version`
2. Se conflito, mostra diff e pergunta ao usuário
3. Opções: keep local, keep remote, merge manual

**Verificação:** Push/pull sem perda de dados.

---

## Testes

### Unit Tests

```bash
cd apps/cli && pytest tests/ -v
```

- `test_crypto.py` - Round-trip encrypt/decrypt, key derivation consistency, IV uniqueness
- `test_vault.py` - CRUD operations, schema creation, foreign keys
- `test_commands.py` - Command output, error handling (com mocks)

### Integration Tests

```bash
# 1. Subir API
cd apps/api && uvicorn main:app --port 8000 &

# 2. Testar fluxo completo
cd apps/cli
pip install -e .
criptenv init
criptenv login --email test@test.com --password testpass123
criptenv set TEST_KEY=secret_value
criptenv list
criptenv get TEST_KEY
criptenv push
criptenv pull
criptenv delete TEST_KEY
```

### Security Verification

- Master key nunca escrito em disco
- Session token encriptado no vault local
- PBKDF2 100k iterações mínimo
- IV = 96 bits aleatório (testar unicidade)
- Auth tag verificado no decrypt

---

## Dependências

| Pacote        | Versão | Propósito             |
| ------------- | ------ | --------------------- |
| click         | ^8.1   | Framework CLI         |
| cryptography  | ^42.0  | AES-GCM, PBKDF2, HKDF |
| httpx         | ^0.27  | HTTP client async     |
| aiosqlite     | ^0.20  | SQLite async          |
| python-dotenv | ^1.0   | Parsing .env          |

---

## Riscos

| Risco                   | Impacto | Mitigação                                  |
| ----------------------- | ------- | ------------------------------------------ |
| Key derivation lento    | Médio   | Indicador de progresso, 100k iterações     |
| Password esquecida      | Crítico | Não recuperável (ZK), aviso claro no init  |
| Conflitos de sync       | Médio   | Version vectors, usuário escolhe resolução |
| Token de sessão perdido | Alto    | Backup encriptado, fluxo de re-login       |
