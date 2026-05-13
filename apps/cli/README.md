# CriptEnv CLI

> Zero-Knowledge secret management for developers and teams.

CriptEnv CLI is the command-line interface for the [CriptEnv](https://github.com/77mdias/criptenv) platform — an open-source alternative to Doppler and Infisical. Manage environment variables, API keys, and sensitive credentials with client-side AES-256-GCM encryption. Your secrets never reach our servers in plaintext.

## Features

- **Zero-Knowledge Encryption** — Secrets are encrypted 100% client-side with AES-256-GCM before leaving your machine.
- **Local Vault** — SQLite-backed local cache at `~/.criptenv/vault.db` for offline access.
- **Team Sync** — Securely push and pull secrets across environments and team members.
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
# Initialize the CLI (creates ~/.criptenv/, prompts for master password)
criptenv init

# Log in to your CriptEnv account
criptenv login --email user@example.com

# Set a secret (encrypted locally)
criptenv set DATABASE_URL postgres://localhost/mydb

# List all secrets (names only — values never exposed)
criptenv list

# Get decrypted value
criptenv get DATABASE_URL

# Pull latest secrets from the server
criptenv pull -p <project-id>

# Push local secrets to the server
criptenv push -p <project-id>
```

## Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize local vault and configuration |
| `login` | Authenticate with your CriptEnv account |
| `logout` | Clear local session |
| `set <key>=<value>` | Encrypt and store a secret |
| `get <key>` | Retrieve and decrypt a secret |
| `list` | List all secrets (names only) |
| `delete <key>` | Remove a secret |

### Sync & Projects

| Command | Description |
|---------|-------------|
| `push -p <project-id>` | Upload encrypted secrets to cloud |
| `pull -p <project-id>` | Download encrypted secrets from cloud |
| `projects` | List projects |
| `projects create` | Create a new cloud project |
| `env` | Manage project environments |

### Import / Export

| Command | Description |
|---------|-------------|
| `import <file>` | Import secrets from `.env` file |
| `export -o <file>` | Export secrets to `.env` or JSON |

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
| `ci deploy` | Deploy local secrets to cloud |
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

Secrets are encrypted using a key derived from your password via PBKDF2-HMAC-SHA256 (100,000 iterations) and HKDF-SHA256. The server only stores opaque encrypted blobs — it has no ability to decrypt your data.

## Development

```bash
cd apps/cli
pip install -e ".[dev]"
python -m pytest tests -q
```

**173 tests passing.**

## License

MIT License — see [LICENSE](../../LICENSE) for details.

---

Made with ❤️ by [Jean Carlos Moreira Dias](https://github.com/77mdias)
