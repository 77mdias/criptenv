# CriptEnv CLI

> Zero-Knowledge secret management for developers and teams.

CriptEnv CLI is the command-line interface for the [CriptEnv](https://github.com/77mdias/criptenv) platform — an open-source alternative to Doppler and Infisical. Manage environment variables, API keys, and sensitive credentials with client-side AES-256-GCM encryption. Your secrets never reach our servers in plaintext.

## Features

- **Zero-Knowledge Encryption** — Secrets are encrypted 100% client-side with AES-256-GCM before leaving your machine.
- **Local Vault** — SQLite-backed local cache for offline access to your secrets.
- **Team Sync** — Securely push and pull secrets across environments and team members.
- **Audit Ready** — Every operation is logged and traceable.
- **CI/CD Friendly** — Built-in support for CI tokens and GitHub Actions integration.

## Installation

```bash
pip install criptenv
```

Requires Python **3.10+**.

## Quick Start

```bash
# Initialize the CLI
criptenv init

# Log in to your CriptEnv account
criptenv login

# Set a secret in the current environment
criptenv secrets set DATABASE_URL postgres://localhost/mydb

# List all secrets
criptenv secrets list

# Pull latest secrets from the server
criptenv sync pull

# Push local secrets to the server
criptenv sync push
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize local vault and configuration |
| `login` | Authenticate with your CriptEnv account |
| `secrets set <key> <value>` | Encrypt and store a secret |
| `secrets get <key>` | Retrieve and decrypt a secret |
| `secrets list` | List all secrets in the current environment |
| `secrets delete <key>` | Remove a secret |
| `sync push` | Upload encrypted secrets to the server |
| `sync pull` | Download encrypted secrets from the server |
| `environments` | Manage project environments |
| `projects` | Manage projects |
| `doctor` | Check CLI health and connectivity |

## Security

Secrets are encrypted using a key derived from your password via PBKDF2-HMAC-SHA256 (100,000 iterations) and HKDF-SHA256. The server only stores opaque encrypted blobs — it has no ability to decrypt your data.

## Development

```bash
cd apps/cli
pip install -e ".[dev]"
python -m pytest tests -q
```

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Made with ❤️ by [Jean Carlos Moreira Dias](https://github.com/77mdias)
