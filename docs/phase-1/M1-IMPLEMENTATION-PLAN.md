# PHASE-1 Implementation Plan

## CLI & Zero-Knowledge Encryption Core

**Status**: ✅ COMPLETE
**Timeline**: Completed 2026-04-30
**Last Updated**: 2026-04-30

---

## Context

PHASE-1 was originally designed for Q2 2024 with Supabase + BetterAuth. With PHASE-2 completed in April 2026 using FastAPI + PostgreSQL + custom session tokens, this plan adapts PHASE-1 to use existing infrastructure.

**Core Principle**: Zero-Knowledge - secrets are encrypted client-side before leaving the CLI.

---

## Scope

### Objectives

- [x] CLI complete with all MVP commands (14 commands)
- [x] AES-256-GCM client-side encryption (PBKDF2HMAC + HKDF)
- [x] Local vault (SQLite at `~/.criptenv/vault.db`)
- [x] Backend API integration (existing FastAPI)
- [x] Sync between local vault and cloud (push/pull)
- [x] Import/export .env files
- [x] 93 unit tests passing

### Out of Scope

- BetterAuth (use existing custom session auth)
- Supabase (use existing FastAPI + PostgreSQL)
- Binary releases (build scripts only, publish separately)

---

## Milestones

| Milestone | Duration  | Goal                                | Status |
| --------- | --------- | ----------------------------------- | ------ |
| **M1.1**  | Week 1    | CLI scaffold with all commands      | ✅     |
| **M1.2**  | Week 2    | Encryption module working           | ✅     |
| **M1.3**  | Week 3    | Local vault (SQLite)                | ✅     |
| **M1.4**  | Week 4    | Auth integration                    | ✅     |
| **M1.5**  | Weeks 5-6 | Core commands (set/get/list/delete) | ✅     |
| **M1.6**  | Weeks 7-8 | Sync + utility commands             | ✅     |

---

## Architecture

```
┌─────────────────────────────────────────┐
│            CLI (apps/cli/)              │
│  ┌──────────┐  ┌───────────┐  ┌───────┐ │
│  │ Commands│  │  Crypto   │  │ Vault │ │
│  │ (Click) │  │ AES-256   │  │SQLite │ │
│  └────┬─────┘  └─────┬─────┘  └───┬───┘ │
│       └──────────────┼────────────┘     │
│                      ▼                   │
│              ┌─────────────┐           │
│              │API Client    │           │
│              └──────┬───────┘           │
└──────────────────────┼──────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────┐
│    Backend API (apps/api/)             │
│  /api/auth/*, /api/v1/*                │
└─────────────────────────────────────────┘
```

---

## Directory Structure

```
apps/cli/
├── pyproject.toml
├── src/criptenv/
│   ├── cli.py
│   ├── commands/
│   │   ├── init.py
│   │   ├── login.py
│   │   ├── secrets.py
│   │   ├── sync.py
│   │   ├── environments.py
│   │   ├── doctor.py
│   │   └── import_export.py
│   ├── crypto/
│   │   ├── core.py
│   │   ├── keys.py
│   │   └── utils.py
│   ├── vault/
│   │   ├── database.py
│   │   ├── models.py
│   │   └── queries.py
│   ├── api/
│   │   ├── client.py
│   │   ├── auth.py
│   │   └── vault.py
│   ├── session.py
│   └── config.py
└── tests/
    ├── test_crypto.py
    ├── test_vault.py
    └── test_commands.py
```

---

## CLI Commands (MVP Set)

```bash
criptenv init                           # Initialize (~/.criptenv/)
criptenv login --email EMAIL --password PASS
criptenv set KEY=value                  # Add/update secret
criptenv get KEY                         # Get secret value
criptenv list                            # List all secrets
criptenv delete KEY                      # Delete secret
criptenv push                            # Push local to cloud
criptenv pull                            # Pull cloud to local
criptenv env list                        # List environments
criptenv env create NAME                 # Create environment
criptenv doctor                          # Diagnostic check
criptenv import .env                     # Import from .env file
criptenv export                          # Export to .env file
```

---

## Success Criteria

| Metric                           | Target       |
| -------------------------------- | ------------ |
| CLI installed (internal testing) | 10+ users    |
| Round-trip encryption verified   | 100%         |
| Push/pull sync working           | No data loss |
| Import/export .env working       | All formats  |
| Zero security incidents          | 0            |

---

## Risks

| Risk                | Mitigation                                 |
| ------------------- | ------------------------------------------ |
| Key derivation slow | Progress indicator, 100k iterations max    |
| Password forgotten  | Cannot recover (ZK), clear warning on init |
| Sync conflicts      | Version vectors, user chooses              |
| Session token loss  | Encrypted backup, re-login flow            |

---

## Dependencies

| Package       | Version |
| ------------- | ------- |
| click         | ^8.1    |
| cryptography  | ^42.0   |
| httpx         | ^0.27   |
| aiosqlite     | ^0.20   |
| python-dotenv | ^1.0    |

---

## Document Index

| Document      | Path                                     | Description            |
| ------------- | ---------------------------------------- | ---------------------- |
| **This Plan** | `docs/phase-1/M1-IMPLEMENTATION-PLAN.md` | Main plan              |
| **M1.1**      | `docs/phase-1/M1-1-CLI-SCAFFOLD.md`      | CLI scaffold details   |
| **M1.2**      | `docs/phase-1/M1-2-ENCRYPTION.md`        | Encryption module spec |
| **M1.3**      | `docs/phase-1/M1-3-LOCAL-VAULT.md`       | Local vault spec       |
| **M1.4**      | `docs/phase-1/M1-4-AUTH.md`              | Auth integration spec  |
| **M1.5**      | `docs/phase-1/M1-5-CORE-COMMANDS.md`     | Core commands spec     |
| **M1.6**      | `docs/phase-1/M1-6-SYNC.md`              | Sync commands spec     |

---

**Next**: See [M1-1-CLI-SCAFFOLD.md](M1-1-CLI-SCAFFOLD.md)
