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
  <a href="https://pypi.org/project/criptenv/">
    <img src="https://img.shields.io/pypi/v/criptenv?label=PyPI&logo=pypi&logoColor=white" alt="PyPI">
  </a>
  <a href="https://www.python.org/">
    <img src="https://img.shields.io/badge/Python-3.10+-306998?logo=python&logoColor=white" alt="Python 3.10+">
  </a>
  <a href="https://github.com/77mdias/criptenv/actions/workflows/ci.yml">
    <img src="https://github.com/77mdias/criptenv/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="https://criptenv.77mdevseven.tech">
    <img src="https://img.shields.io/badge/Live_Demo-Online-22c55e?logo=cloudflare&logoColor=white" alt="Live Demo">
  </a>
</p>

<p align="center">
  <a href="https://criptenv.77mdevseven.tech">🌐 Web App</a> •
  <a href="https://criptenv.77mdevseven.tech/docs">📖 Docs</a> •
  <a href="#-quick-start">⚡ Quick Start</a> •
  <a href="#-cicd--cloud-sync">🔁 CI/CD</a> •
  <a href="#-security">🔒 Security</a>
</p>

---

## 🔐 What is CriptEnv?

**CriptEnv** is a secret management platform built for developers who need to securely store, share, and sync environment variables, API keys, and sensitive credentials across teams and infrastructure.

Unlike traditional secret managers, CriptEnv uses **Zero-Knowledge Encryption**: your secrets are encrypted **on your device** with AES-256-GCM before ever reaching our servers. We store only opaque encrypted blobs — we cannot read your secrets, even if we wanted to.

It ships as three pieces that share the same encrypted vault:

- **CLI** (`pip install criptenv`) — the main workflow: set, pull, run, diff, sync.
- **Web dashboard** — projects, environments, team, audit logs, integrations and a personal vault.
- **REST API + GitHub Action** — for CI/CD pipelines and automation.

### The Problem

Your secrets are scattered everywhere:
- `.env` files on multiple machines, accidentally committed to Git
- Plain-text messages in Slack, Email, or WhatsApp
- Hosting dashboards (Vercel, Render, Cloudflare) without central control
- Personal notes and generic password managers

CriptEnv replaces that with one encrypted vault per project that stays under your control.

### How It Works

```
Your Device                                   CriptEnv Servers
───────────                                   ────────────────
┌──────────────────┐                          ┌─────────────┐
│  Vault password  │                          │   Vault     │
│        │         │                          │   Storage   │
│        ▼         │                          │             │
│  PBKDF2-SHA256   │                          │  (We can    │
│        │         │                          │   NEVER     │
│        ▼         │                          │   decrypt   │
│  HKDF per env    │      Encrypted Blob      │   this)     │
│        │         │ ───────────────────────► │             │
│        ▼         │                          │             │
│  AES-256-GCM     │ ◄─────────────────────── │             │
└──────────────────┘      Encrypted Blob      └─────────────┘
```

1. Each project has its own **Vault password**, chosen on your device and never sent to the API
2. A key is derived from that password (PBKDF2-SHA256), then one key per environment (HKDF-SHA256)
3. Secrets are encrypted with **AES-256-GCM**; only the **encrypted blob** is sent to the server
4. Decryption happens **in memory** inside the CLI or the web app, never on the server

---

## 🚀 Quick Start

### 1. Install the CLI

```bash
pip install criptenv        # or: pipx install criptenv
```

Requires **Python 3.10+**. No Python on the machine? Use the single binary (Linux x86_64, glibc):

```bash
curl -fsSLo criptenv https://github.com/77mdias/criptenv/releases/latest/download/criptenv-linux-x86_64
chmod +x criptenv && sudo mv criptenv /usr/local/bin/
```

In a Docker image (Debian/Ubuntu/`*-slim` bases; Alpine is not supported):

```dockerfile
COPY --from=ghcr.io/77mdias/criptenv-cli:latest /usr/local/bin/criptenv /usr/local/bin/criptenv
```

Check the install with `criptenv doctor`.

### 2. Sign in

```bash
criptenv login                                    # opens the browser (OAuth / web login)
criptenv login --device                           # device code flow, for SSH and headless machines
criptenv login --email-address you@example.com   # email + password
```

API keys (`criptenv login --api-key` or `CRIPTENV_API_KEY`) are for automation on an existing project and cannot create projects — see [CI/CD](#-cicd--cloud-sync).

### 3. Create a project and select it

```bash
criptenv projects create my-app      # asks for the project's Vault password
criptenv use <project-id>            # default project for the next commands
```

Secret and file commands (`set`, `get`, `list`, `delete`, `rotate`, `run`, `diff`, `import`, `export`, `push`, `pull`) also accept `-p/--project` and `-e/--env` (environment name or ID). Without `-e`, the project's default environment is used.

### 4. Manage secrets

```bash
# Encrypted locally, then stored in the remote vault
criptenv set DATABASE_URL=postgres://localhost/mydb
criptenv set STRIPE_KEY=sk_live_xxx --secret      # write-only "Secret" when synced to Vercel

criptenv list                  # key names and type only — values are never shown
criptenv get DATABASE_URL      # decrypted in memory

# Run a command with the secrets injected — nothing is written to disk
criptenv run -e production -- npm start

# Compare a local .env with the vault (exits 1 on drift, so it can gate CI)
criptenv diff .env -e production
```

### 5. Import and export `.env` files

```bash
criptenv import .env -e development              # .env → vault
criptenv push .env.production -e production --overwrite

criptenv export -e staging -o .env.staging       # vault → file (env or --format json)
criptenv pull -e production -o .env.production
```

> Exported files contain plaintext secrets. Prefer `criptenv run` whenever you can.

### CLI command reference

| Area | Commands |
|------|----------|
| **Secrets** | `set`, `get`, `list`, `delete`, `rotate`, `run`, `diff` |
| **Files** | `import`, `export`, `push`, `pull` |
| **Projects & environments** | `projects create\|list\|info\|update\|delete\|rekey`, `env list\|get\|create\|update\|delete`, `use`, `status` |
| **Team** | `members list\|add\|update\|remove`, `invites list\|create\|accept\|revoke`, `audit list\|export` |
| **Expiration & rotation** | `secrets expire`, `secrets alert`, `rotation list\|history` |
| **Automation** | `ci login\|logout\|secrets\|deploy`, `ci tokens list\|create\|revoke`, `api-keys list\|create\|revoke`, `integrations list\|connect\|disconnect\|validate\|sync` |
| **Account** | `login`, `logout`, `sessions`, `2fa setup\|verify\|disable`, `auth forgot-password\|reset-password\|change-password`, `profile update\|delete` |
| **Tooling** | `init` (optional, prepares `~/.criptenv/`), `doctor`, `completion` |

Run `criptenv <command> --help` for options and examples, or see the [CLI reference](https://criptenv.77mdevseven.tech/docs/cli/commands).

---

## 🔁 CI/CD & Cloud Sync

**GitHub Action** — pull secrets into a workflow with a CI token:

```yaml
- uses: 77mdias/criptenv/packages/github-action@github-action-v1
  with:
    token: ${{ secrets.CRIPTENV_TOKEN }}          # created with `criptenv ci tokens create`
    project: ${{ secrets.CRIPTENV_PROJECT_ID }}
    environment: production
    vault-password: ${{ secrets.CRIPTENV_VAULT_PASSWORD }}
```

Set `vault-password` to get usable plaintext values. Without it, each variable holds the encrypted ciphertext (kept for backwards compatibility). See [packages/github-action](packages/github-action/README.md) for every input and output.

**Other pipelines** — `criptenv ci login` with a CI token, or an API key in `CRIPTENV_API_KEY` (read only, optionally restricted to one environment). A pipeline that writes or syncs needs a CI token; set `CRIPTENV_VAULT_PASSWORD` so it runs without a prompt. A restricted environment is reached only by a token or key created for it.

**Cloud providers** — push secrets to **Vercel**, **Render** and **Cloudflare Workers**, or pull existing values from Vercel and Render (`--direction pull`; Cloudflare does not expose secret values):

```bash
criptenv integrations connect vercel --token <vercel-token> --project-id <vercel-project-id>
criptenv integrations sync --provider vercel --env production
```

Each variable is a **Config** (default) or a **Secret**. Both stay readable inside CriptEnv; on Vercel a Secret is stored as write-only (`sensitive`).

---

## 🌐 Web Dashboard

Prefer a visual interface? Use the web dashboard at **[criptenv.77mdevseven.tech](https://criptenv.77mdevseven.tech)** — available in English, Português (BR) and Español.

- **Projects & Environments** — Organize secrets by project and environment, with Config/Secret types
- **Team Management** — Invite members and manage roles
- **Audit Logs** — History of who did what and when, with filters and JSON/CSV export
- **Expiration & Rotation** — Expiration dates, rotation policies and alerts (in-app, email or webhook)
- **Integrations** — Vercel, Render and Cloudflare Workers sync
- **API keys & CI tokens** — Scoped credentials for automation
- **Personal Vault** — A per-user vault for logins and secure notes outside your projects, with its own master password, an optional "extra protection" password and a printable recovery key (web only)
- **Account security** — GitHub, Google and Discord login, TOTP 2FA and session management

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔒 **Zero-Knowledge** | Server never sees plaintext. AES-256-GCM client-side encryption. |
| ⚡ **CLI-First** | `run`, `diff`, import/export, shell completion — fast and scriptable. |
| 🌐 **Web Dashboard** | Visual interface for teams and non-technical members, in 3 languages. |
| 🔄 **Team Sync** | Securely share encrypted vaults across devices and teammates. |
| 📋 **Audit Logs** | Trail of every secret operation. |
| 🔑 **CI/CD Native** | GitHub Action, CI tokens, API keys, and Vercel/Render/Cloudflare sync. |
| ⏰ **Expiration & Rotation** | Expiry dates, rotation policies and alerts. |
| 🗝️ **Personal Vault** | Bitwarden-style vault for your own logins and notes. |
| 🛡️ **2FA & OAuth** | TOTP + GitHub/Google/Discord authentication. |
| 🏗️ **Self-Hostable** | Open source. Docker images for the API and web app. |

---

## 🔒 Security

CriptEnv is built with security as the primary design constraint:

- **AES-256-GCM** — Authenticated encryption, done on the client
- **PBKDF2-HMAC-SHA256** — 100,000 iterations for the project vault key
- **HKDF-SHA256** — One key per environment, derived from the project key
- **Personal vault** — PBKDF2-SHA256 with 600,000 iterations, AES-GCM associated data (AAD) binding each field to its item, and keys handled only through WebCrypto `wrapKey`/`unwrapKey` ([model](docs/security/personal-vault.md))
- **HTTP-only cookies** — Web session tokens are not readable by JavaScript
- **Rate limiting** — Tiered protection against abuse
- **Audit logs** — Traceability of all operations

> **We cannot decrypt your secrets.** Even with full database access, your data remains cryptographically secure because the encryption key never leaves your devices. If you lose a project's Vault password, its secrets cannot be recovered.

More in the [security docs](https://criptenv.77mdevseven.tech/docs/security) (encryption, zero-knowledge model, threat model).

---

## 📚 Documentation

- **User guide**: [criptenv.77mdevseven.tech/docs](https://criptenv.77mdevseven.tech/docs) — quickstart, CLI, guides, integrations, security
- **API reference**: [criptenv.77mdevseven.tech/docs/api](https://criptenv.77mdevseven.tech/docs/api)
- **Local development**: [docs/development/local-setup.md](docs/development/local-setup.md)
- **Architecture & decisions**: [docs/project/architecture.md](docs/project/architecture.md)
- **Self-hosting on a VPS**: [deploy/vps/README.md](deploy/vps/README.md)
- **Changelog**: [docs/development/CHANGELOG.md](docs/development/CHANGELOG.md)

---

## 🏗️ For Developers

Want to contribute or self-host? Check out:

- **[Local Development Guide](docs/development/local-setup.md)** — Clone, build, and run the full stack locally
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines, commit conventions, and PR process
- **[AGENTS.md](AGENTS.md)** — Architecture notes and guidelines for AI coding agents

Common tasks from the repository root (`make help` lists all of them):

```bash
make install     # install web, API and CLI dependencies
make api-dev     # FastAPI on http://localhost:8000
make web-dev     # web app dev server
make test        # API and CLI test suites
make lint        # frontend and Python lint
```

### Repository layout

```
apps/api              FastAPI backend (routers → services → models, Alembic migrations)
apps/web              Web dashboard and docs site
apps/cli              Python CLI, published to PyPI as `criptenv`
packages/github-action  GitHub Action
deploy/vps            Production Docker Compose (API, scheduler, Postgres, Redis, Cloudflare Tunnel)
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **CLI** | Python 3.10+, Click, cryptography — also a single binary and a GHCR image |
| **Backend** | FastAPI, SQLAlchemy (async), Alembic, PostgreSQL 15, Redis (rate limiting) |
| **Frontend** | Next.js 16 built with Vinext, React 19, Tailwind CSS v4, Radix UI, next-intl |
| **Deploy** | Web on Cloudflare Workers; API in Docker on a VPS behind Cloudflare Tunnel |
| **CI** | GitHub Actions (tests, E2E with Cypress, security scans, Docker builds, CLI release) |
| **Avatar storage** | Cloudflare R2 (recommended) or Supabase Storage |

---

## 💜 Support

CriptEnv is free. If it helps you, you can support the project with a Pix contribution on the [contribute page](https://criptenv.77mdevseven.tech/contribute).

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
