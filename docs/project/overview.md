# Project Overview — CriptEnv

## What is CriptEnv?

**CriptEnv** is a Zero-Knowledge secret management platform — an open-source alternative to Doppler and Infisical designed for developers who need secure, team-friendly management of environment variables, API keys, and other sensitive credentials.

The core differentiator: **encryption happens 100% client-side**. The server never sees secrets in plain-text. Even with full database access, attackers cannot decrypt the secrets.

---

## The Problem: Secret Sprawl

Secrets (API keys, database credentials, tokens, certificates) are scattered across:

| Problem Area | Description |
|--------------|-------------|
| `.env` files | Multiple machines, frequently committed to Git accidentally |
| Git repositories | Plain-text secrets in commit history |
| Communication tools | Shared via Slack, Email, WhatsApp |
| Personal notes | Text files, notes apps |
| Hosting dashboards | Environment variables in Vercel, Railway, Render |
| Generic password managers | 1Password/LastPass without DevOps context |

### Impact

| Issue | Real Impact |
|-------|-------------|
| **Data Breaches** | 75% of 2023 breaches involved exposed credentials |
| **Productivity Loss** | Developers spend ~2.5h/week searching/configuring secrets |
| **Compliance Risk** | GDPR, SOC2, HIPAA require access control |
| **Rotation Pain** | Manual secret rotation = time + risk |

---

## Solution: Zero-Knowledge Architecture

CriptEnv provides:

- 🔒 **Zero-Knowledge Encryption** — AES-GCM 256-bit, client-side only
- ⚡ **CLI-First** — Natural terminal workflow for developers
- 🌐 **Web Dashboard** — Visual interface for non-technical team members
- 📋 **Audit Logs** — Complete trail of all secret operations
- 🔄 **Team Sync** — Secure sharing without plain-text exposure

---

## Target Audience

### Primary (80%): Developers

| Persona | Description | Pain Points |
|---------|------------|-------------|
| **Backend Dev** | Multi-service, multiple APIs/databases | Managing 20+ env vars per project |
| **Full-Stack Dev** | Alternates frontend/backend | Insecure credential sharing |
| **DevOps/SRE** | Infrastructure maintenance | Manual secret rotation |
| **Freelancer** | Multi-client work | Isolating credentials per project |

### Secondary (15%): Teams

- Startups with 2-10 developers
- Open-source maintainers
- Digital agencies

### Tertiary (5%): Enterprise

- SSO/SAML requirements
- Compliance and audit needs
- (Future Phase 4)

---

## Current Scope (Phase 1-2)

### Implemented

| Component | Description |
|-----------|-------------|
| **CLI** | 14 commands for secret management, sync, import/export |
| **Web Dashboard** | Full CRUD for projects, environments, secrets, team management |
| **Auth** | Session-based authentication with JWT-like tokens |
| **Encryption** | AES-256-GCM with PBKDF2HMAC (100k iterations) + HKDF |
| **Local Vault** | SQLite at `~/.criptenv/vault.db` for offline access |
| **Audit Logs** | Paginated timeline of all operations |

### Partially Implemented (Phase 3)

| Feature | Status |
|---------|--------|
| GitHub Action | Implemented in `packages/github-action/` |
| Secret Rotation | API + CLI commands implemented |
| Secret Expiration | Model + background job implemented |
| Webhook Notifications | Service implemented |
| Vercel/Railway/Render | Not yet implemented |

---

## Future Scope (Phase 3-4)

### Phase 3: CI/CD Integrations (In Progress)

- GitHub Actions official action
- Cloud provider integrations (Vercel, Railway, Render)
- CLI commands for CI workflows
- Public API with versioning
- Rate limiting and API keys

### Phase 4: Enterprise Ready (Planned)

- SSO/SAML (Okta, Azure AD)
- SCIM provisioning
- SIEM export (Splunk, Datadog)
- Self-hosted option
- Custom secret policies

---

## Competitive Landscape

| Feature | CriptEnv | Doppler | Infisical | HashiCorp Vault |
|---------|----------|---------|-----------|----------------|
| **Pricing** | Free/Open | $6/seat | Free tier | Self-hosted |
| **Zero-Knowledge** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **CLI-First** | ✅ Yes | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial |
| **Self-Hosted** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Encryption** | AES-GCM 256 | AES-256 | AES-256 | Multiple |
| **Open Source** | ✅ MIT | ❌ No | ⚠️ Partial | ✅ Yes |

---

## Key Differentiator

> **Zero-Knowledge Real**: Encryption happens 100% in the client. The server stores only encrypted blobs. Even with complete database access, attackers can **never** decrypt secrets.

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01