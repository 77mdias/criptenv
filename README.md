<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/images/logocriptenv-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="apps/web/public/images/logocriptenv-light.png">
    <img alt="CriptEnv Logo" src="apps/web/public/images/logocriptenv-light.png" width="160">
  </picture>
</p>

<h1 align="center">CriptEnv</h1>

<p align="center">
  <strong>Zero-Knowledge Secret Management for Developers & Teams</strong><br>
  The open-source alternative to Doppler and Infisical. Your secrets never leave your device unencrypted.
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
  <a href="https://www.python.org/">
    <img src="https://img.shields.io/badge/Python-3.10+-306998?logo=python&logoColor=white" alt="Python">
  </a>
  <a href="https://criptenv.77mdevseven.tech">
    <img src="https://img.shields.io/badge/Live_Demo-Online-22c55e?logo=cloudflare&logoColor=white" alt="Live Demo">
  </a>
</p>

<p align="center">
  <a href="https://criptenv.77mdevseven.tech">🌐 Web App</a> •
  <a href="https://criptenv.77mdevseven.tech/docs">📖 Docs</a> •
  <a href="#-quick-start">⚡ Quick Start</a> •
  <a href="#-security">🔒 Security</a>
</p>

---

## 🔐 What is CriptEnv?

**CriptEnv** is a secret management platform built for developers who need to securely store, share, and sync environment variables, API keys, and sensitive credentials across teams and infrastructure.

Unlike traditional secret managers, CriptEnv uses **Zero-Knowledge Encryption**: your secrets are encrypted **on your device** with AES-256-GCM before ever reaching our servers. We store only opaque encrypted blobs — we cannot read your secrets, even if we wanted to.

### The Problem

Your secrets are scattered everywhere:
- `.env` files on multiple machines, accidentally committed to Git
- Plain-text messages in Slack, Email, or WhatsApp
- Hosting dashboards (Vercel, Render) without central control
- Personal notes and generic password managers

**75% of data breaches involve exposed credentials.** CriptEnv solves this with a unified, encrypted vault that stays under your control.

### How It Works

```
Your Device                          CriptEnv Servers
───────────                          ───────────────
┌─────────────┐    Encrypted Blob    ┌─────────────┐
│  Password   │ ──────────────────►  │   Vault     │
│     │       │                      │   Storage   │
│     ▼       │                      │             │
│  PBKDF2     │                      │  (We can    │
│     │       │                      │   NEVER     │
│     ▼       │                      │  decrypt    │
│  AES-256    │    Encrypted Blob    │   this)     │
│  Encrypt    │ ◄──────────────────  │             │
└─────────────┘                      └─────────────┘
```

1. You enter the project's **Vault password** on your device
2. Secrets are encrypted with **AES-256-GCM** using a key derived from that password
3. Only the **encrypted blob** is sent to our servers
4. Decryption happens **in memory** inside the CLI or web app, never on the server

---

## 🚀 Quick Start

### Install the CLI

```bash
pip install criptenv
```

Requires **Python 3.10+**.

### Login

```bash
# Authenticate with your account
criptenv login --email you@example.com
```

`criptenv init` is optional and only prepares local CLI metadata under `~/.criptenv/`.

### Manage Secrets

```bash
# Add a secret to the remote project vault (encrypted locally before sending)
criptenv set DATABASE_URL=postgres://localhost/mydb
criptenv set API_KEY=your_api_key_here

# List all secrets (names only — values are never exposed)
criptenv list

# Get a decrypted value
criptenv get DATABASE_URL

# Import from an existing .env file
criptenv import .env

# Export to .env
criptenv export -o .env.production
```

### Import / Export Files

```bash
# Import a .env file into the remote vault
criptenv push .env.production -p my-project

# Export the remote vault to a local .env file
criptenv pull -p my-project --output .env.production
```

### Full Command Reference

| Command | Description |
|---------|-------------|
| `criptenv init` | Prepare local CLI metadata (optional) |
| `criptenv login` | Sign in to your CriptEnv account |
| `criptenv set KEY=VALUE` | Encrypt and store a secret in the remote vault |
| `criptenv get KEY` | Decrypt and retrieve a secret in memory |
| `criptenv list` | List remote secret keys (names only) |
| `criptenv delete KEY` | Remove a secret from the remote vault |
| `criptenv push FILE -p PROJECT` | Import `.env` secrets into the remote vault |
| `criptenv pull -p PROJECT -o FILE` | Export remote secrets to a file |
| `criptenv import FILE` | Import secrets from `.env` file into the remote vault |
| `criptenv export -o FILE` | Export remote secrets to `.env` or JSON |
| `criptenv rotate KEY` | Rotate a secret value |
| `criptenv doctor` | Check CLI health and connectivity |

---

## 🌐 Web Dashboard

Prefer a visual interface? Use the web dashboard at:

**👉 [https://criptenv.77mdevseven.tech](https://criptenv.77mdevseven.tech)**

Features:
- **Projects & Environments** — Organize secrets by project and environment
- **Team Management** — Invite members, manage roles
- **Audit Logs** — Complete history of who accessed what and when
- **Secret Rotation** — Set expiration dates and receive alerts
- **Cloud Integrations** — Sync secrets with Vercel and Render
- **2FA / OAuth** — GitHub, Google, Discord login + TOTP support

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔒 **Zero-Knowledge** | Server never sees plaintext. AES-256-GCM client-side encryption. |
| ⚡ **CLI-First** | Natural terminal workflow. Fast, scriptable, automation-friendly. |
| 🌐 **Web Dashboard** | Visual interface for teams and non-technical members. |
| 🔄 **Team Sync** | Securely share encrypted vaults across devices and teammates. |
| 📋 **Audit Logs** | Complete trail of every secret operation. |
| 🔑 **CI/CD Native** | GitHub Action, CI tokens, and cloud provider sync. |
| 🛡️ **2FA & OAuth** | TOTP + GitHub/Google/Discord authentication. |
| 🏗️ **Self-Hostable** | Open source. Deploy on your own infrastructure. |

---

## 🔒 Security

CriptEnv is built with security as the primary design constraint:

- **AES-256-GCM** — Industry-standard authenticated encryption
- **PBKDF2-HMAC-SHA256** — 100,000 iterations for project vault key derivation
- **HKDF-SHA256** — Per-environment key derivation
- **HTTP-Only Cookies** — Session tokens protected from XSS attacks
- **Rate Limiting** — Tiered protection against abuse
- **Audit Logs** — Complete traceability of all operations

> **We cannot decrypt your secrets.** Even with full database access, your data remains cryptographically secure because the encryption key never leaves your devices.

---

## 📚 Documentation

- **User Guide**: [https://criptenv.77mdevseven.tech/docs](https://criptenv.77mdevseven.tech/docs)
- **API Reference**: [https://criptenv-api.77mdevseven.tech/docs](https://criptenv-api.77mdevseven.tech/docs)
- **Local Development**: [docs/development/local-setup.md](docs/development/local-setup.md)
- **Architecture & Decisions**: [docs/project/architecture.md](docs/project/architecture.md)
- **Changelog**: [docs/development/CHANGELOG.md](docs/development/CHANGELOG.md)

---

## 🏗️ For Developers

Want to contribute or self-host? Check out:

- **[Local Development Guide](docs/development/local-setup.md)** — Clone, build, and run the full stack locally
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines, commit conventions, and PR process
- **[AGENTS.md](AGENTS.md)** — Guidelines for AI coding agents

### Tech Stack

| Layer | Technology |
|-------|------------|
| **CLI** | Python, Click, cryptography |
| **Backend** | FastAPI, SQLAlchemy, PostgreSQL, Redis |
| **Frontend** | Vinext (Next.js), React, Tailwind CSS |
| **Deploy** | Cloudflare Pages + Workers, VPS Docker |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with 🔒 by developers, for developers.</strong><br>
  <a href="https://criptenv.77mdevseven.tech">Website</a> •
  <a href="https://github.com/77mdias/criptenv">GitHub</a> •
  <a href="https://criptenv.77mdevseven.tech/docs">Documentation</a>
</p>
