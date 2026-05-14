# CriptEnv CLI

> Zero-Knowledge secret management for developers and teams.

CriptEnv CLI is the command-line interface for the [CriptEnv](https://github.com/77mdias/criptenv) platform — an open-source alternative to Doppler and Infisical. Manage environment variables, API keys, and sensitive credentials with client-side AES-256-GCM encryption. Your secrets never reach our servers in plaintext.

## Features

- **Zero-Knowledge Encryption** — Secrets are encrypted 100% client-side with AES-256-GCM before leaving your machine.
- **Remote Terminal** — Commands operate directly on the encrypted project vault in CriptEnv Cloud.
- **Lightweight Local Metadata** — `~/.criptenv/` stores session/config metadata, not a local secrets vault.
- **Team Sync** — Everyone reads and writes the same remote encrypted vault.
- **Secret Rotation** — Built-in commands to rotate and expire secrets.
- **CI/CD Friendly** — Native support for CI tokens, GitHub Actions, and cloud integrations.
- **Cloud Integrations** — Sync secrets with Vercel and Render.

## Installation

```bash
pip install criptenv
```

Requires Python **3.10+**.

## Quick Start

```bash
# Log in to your CriptEnv account
criptenv login --email user@example.com

# Set a secret in the remote project vault
criptenv set DATABASE_URL=postgres://localhost/mydb

# List all secrets (names only — values never exposed)
criptenv list

# Get decrypted value
criptenv get DATABASE_URL

# Export latest remote secrets to a file
criptenv pull -p <project-id> --output .env.production

# Import a local .env file into the remote vault
criptenv push .env.production -p <project-id>
```

## Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `init` | Prepare local CLI metadata and configuration |
| `login` | Authenticate with your CriptEnv account |
| `logout` | Clear local session |
| `set <key>=<value>` | Encrypt and store a secret in the remote vault |
| `get <key>` | Retrieve and decrypt a remote secret in memory |
| `list` | List remote secret keys (names only) |
| `delete <key>` | Remove a secret from the remote vault |

### Sync & Projects

| Command | Description |
|---------|-------------|
| `push <file> -p <project-id>` | Import `.env` secrets into the remote vault |
| `pull -p <project-id> -o <file>` | Export remote secrets to a file |
| `projects` | List projects |
| `projects create` | Create a new cloud project |
| `env` | Manage project environments |

### Import / Export

| Command | Description |
|---------|-------------|
| `import <file>` | Import secrets from `.env` file into the remote vault |
| `export -o <file>` | Export remote secrets to `.env` or JSON |

### Secret Management

| Command | Description |
|---------|-------------|
| `rotate <key>` | Rotate a secret value |
| `secrets expire <key>` | Set secret expiration |
| `secrets alert <key>` | Configure alert timing |
| `rotation list` | List secrets pending rotation |

### CI / CD

| Command | Description |
|---------|-------------|
| `ci login` | Login with CI token |
| `ci logout` | Clear CI session |
| `ci secrets` | List secrets in CI context |
| `ci deploy --file <file>` | Import a file into the remote vault in CI context |
| `ci tokens list` | List CI tokens |
| `ci tokens create` | Create CI token |
| `ci tokens revoke` | Revoke CI token |

### Integrations

| Command | Description |
|---------|-------------|
| `integrations list` | List cloud integrations |
| `integrations connect` | Connect a provider (vercel, render) |
| `integrations disconnect` | Disconnect a provider |
| `integrations sync` | Sync secrets with provider |

### Utilities

| Command | Description |
|---------|-------------|
| `doctor` | Check CLI health and connectivity |

## Security

Secrets are encrypted using a key derived from the project Vault password via PBKDF2-HMAC-SHA256 (100,000 iterations) and HKDF-SHA256. The CLI prompts for that password only when a command must decrypt or mutate secrets, or reads it from `CRIPTENV_VAULT_PASSWORD` for automation. The server only stores opaque encrypted blobs — it has no ability to decrypt your data.

## Development

```bash
cd apps/cli
pip install -e ".[dev]"
python -m pytest tests -q
```

**178 tests passing.**

## License

MIT License — see [LICENSE](../../LICENSE) for details.

---

Made with ❤️ by [Jean Carlos Moreira Dias](https://github.com/77mdias)
