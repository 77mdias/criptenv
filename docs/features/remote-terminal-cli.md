# Remote Terminal CLI

## Summary

The CriptEnv CLI now behaves like the web dashboard inside the terminal: it operates directly on the remote project vault. There is no local secrets vault or local master password in the main flow. Secrets remain zero-knowledge because encryption and decryption happen client-side in the CLI process, and the API only receives opaque encrypted blobs.

This document is the source feature note for updating `criptenv.77mdevseven.tech/docs`.

## Behavior

- `set`, `get`, `list`, `delete`, `import`, `export`, and `rotate` target the remote project vault.
- The CLI resolves the project and environment through the API.
- The CLI reads the project's `vault_config`, asks for the project Vault password when needed, derives the environment key locally, and decrypts only in memory.
- Mutating commands perform pull, decrypt in memory, change the secret set, re-encrypt, and push the new ciphertext.
- `list` reads remote blob metadata and shows keys/versions without decrypting values.
- No plaintext secret is written to the local SQLite database.

## Password Model

The only password used for secret access is the project Vault password.

- Interactive usage: the CLI prompts `Vault password:`.
- Automation: set `CRIPTENV_VAULT_PASSWORD`.
- The Vault password is not stored by the CLI.
- API-only commands such as `projects list`, `env list`, `doctor`, `integrations list`, and `ci tokens list` do not ask for a vault password.

Local CLI sessions are encrypted with `~/.criptenv/auth.key`, not with a local master password.

## Local Files

`~/.criptenv/` remains useful, but only for metadata:

- `vault.db`: auth/session metadata, current project, cached project/environment metadata, CI session metadata, compatibility tables.
- `auth.key`: local encryption key for session tokens, created with restrictive file permissions.

The normal CLI workflow does not store a local copy of encrypted secrets.

## Command Semantics

### Setup

```bash
pip install criptenv
criptenv login --email you@example.com
```

`criptenv init` is optional. It prepares the local metadata directory and database but does not create a local secrets vault or ask for a master password.

### Secrets

```bash
criptenv set DATABASE_URL=postgres://user:pass@host/db -p <project-id> -e production
criptenv get DATABASE_URL -p <project-id> -e production
criptenv list -p <project-id> -e production
criptenv delete DATABASE_URL -p <project-id> -e production
criptenv rotate API_KEY -p <project-id> -e production
```

### Import and Export

```bash
criptenv import .env.production -p <project-id> -e production
criptenv export -p <project-id> -e production -o .env.production
```

### Push and Pull Aliases

`push` and `pull` are now explicit file aliases:

```bash
criptenv push .env.production -p <project-id> -e production
criptenv pull -p <project-id> -e production --output .env.production
```

Bare `criptenv push` and bare `criptenv pull` fail with a clear message pointing to `import` and `export`.

## Concurrency Protection

The CLI sends the vault version it read before mutation as `expected_version`.

- If the version still matches, the API accepts the push and increments the vault version.
- If another client changed the vault first, the API returns `409 Conflict`.
- The CLI tells the user to repeat the command so it can read the latest vault before writing.

## Zero-Knowledge Guarantees

- Plaintext secrets never leave the CLI process.
- The API stores ciphertext, IVs, auth tags, checksums, and metadata only.
- Project Vault passwords are never sent to the API.
- `vault_proof` proves knowledge of the Vault password without revealing it.

## Docs Update Checklist

- Quickstart should start with `criptenv login`, not mandatory `criptenv init`.
- CLI configuration should describe metadata/session storage, not local secrets storage.
- Commands reference should describe remote semantics for secrets/import/export/push/pull.
- CI docs should show `CRIPTENV_VAULT_PASSWORD` and `ci deploy --file`.
- Security docs should use "project Vault password" for project secrets instead of "local master password".
