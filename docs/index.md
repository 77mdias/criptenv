# CriptEnv — Documentation Index

> **Zero-Knowledge Secret Management Platform** — Open source alternative to Doppler and Infisical.

---

## 📋 Project Overview

- **Name**: CriptEnv
- **Type**: Secret Management Platform (CLI + Web Dashboard)
- **Problem Solved**: Secret Sprawl — credentials scattered across `.env` files, Git repos, Slack, email, and generic password managers.
- **Solution**: Zero-Knowledge encryption where secrets never leave the device unencrypted. AES-GCM 256-bit client-side encryption.

---

## 🚦 Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1 (MVP)** | ✅ COMPLETE | CLI with 14 commands, AES-256-GCM encryption, local SQLite vault |
| **Phase 2 (Web UI)** | ✅ COMPLETE | Vinext/Next.js dashboard, auth, CRUD, audit logs |
| **Phase 3 (CI/CD)** | 🔄 IN PROGRESS | Public API, CI, integrations, rotation, notifications and OAuth; Railway/UI/ops gaps remain |
| **Phase 4 (Enterprise)** | 📋 PLANNED | SSO/SAML, SCIM, self-hosted |

**Current Focus**: Documentation and operational accuracy, then Railway provider, web alert configuration and VPS operations baseline.

---

## 📚 Documentation Structure

### Project Documentation

- [Overview](./project/overview.md) — What is CriptEnv, problem solved, target audience
- [Current State](./project/current-state.md) — Development status, implemented features, risks
- [Architecture](./project/architecture.md) — System architecture, component diagrams
- [Tech Stack](./project/tech-stack.md) — Technologies used in each layer
- [Decisions](./project/decisions.md) — Technical decision log (ADR)

### Workflow Documentation

- [Development Workflow](./workflow/development-workflow.md) — How to develop, run, test
- [Agent Workflow](./workflow/agent-workflow.md) — Rules for AI agents working on this project
- [Task Management](./workflow/task-management.md) — Task templates and management
- [Context Map](./workflow/context-map.md) — Where to find what in the codebase

### Features

- [Implemented](./features/implemented.md) — Completed features
- [In Progress](./features/in-progress.md) — Features being developed
- [Backlog](./features/backlog.md) — Planned and future features

### Technical Documentation

- [Folder Structure](./technical/folder-structure.md) — Project directory layout
- [Environment](./technical/environment.md) — Environment variables, setup
- [Database](./technical/database.md) — Database schema, ORM, migrations
- [API](./technical/api.md) — Backend API endpoints, auth, patterns
- [Frontend](./technical/frontend.md) — Frontend structure, components, routing
- [Backend](./technical/backend.md) — Backend services, routers, strategies
- [Deployment](./technical/deployment.md) — Deploy instructions, platforms

### Tasks

- [Current Task](./tasks/current-task.md) — What to work on right now
- [Next Tasks](./tasks/next-tasks.md) — Prioritized task list
- [Task History](./tasks/task-history.md) — Historical record of completed tasks

---

## 🔑 Quick Links

| Resource | Description |
|----------|-------------|
| [README.md](../README.md) | Main project README (start here) |
| [CLAUDE.md](../CLAUDE.md) | AI agent guidance for this project |
| [PRD](../prd/README.md) | Product Requirements Document |
| [Roadmap](../roadmap/README.md) | Phased execution plan |
| [Changelog](../docs/development/CHANGELOG.md) | Version history |

---

## 🚀 How to Start

### For New Developers

1. Read this `index.md` to understand the project
2. Read [Overview](./project/overview.md) to understand the problem
3. Read [Current State](./project/current-state.md) to know what's implemented
4. Read [Local Development Guide](./development/local-setup.md) to set up your environment
5. Read [Development Workflow](./workflow/development-workflow.md) for workflow rules
6. Check [Current Task](./tasks/current-task.md) to know what to work on

### For AI Agents

**Before writing any code, you MUST:**

1. Read [Agent Workflow](./workflow/agent-workflow.md)
2. Read [Current State](./project/current-state.md)
3. Read [Current Task](./tasks/current-task.md)
4. Follow the checklist in the Agent Workflow document

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| API Tests | 416 passing, 2 skipped at last local verification |
| CLI Tests | 184 passing at last local verification |
| Web Unit Tests | 84 passing at last local verification |
| Web lint | Passing at last local verification |
| Vinext compatibility | 100% (58 pages, 6 layouts) |
| CLI/Web tests | Run `make cli-test` and `make web-test`; counts are intentionally not hard-coded here |
| CLI Commands | See `apps/cli/src/criptenv/commands/` and `criptenv --help` |
| API Routers | See `apps/api/app/routers/` and `/openapi.json` |
| Phase Progress | Phase 1 ✅, Phase 2 ✅, Phase 3 🔄, Phase 4 📋 |

---

**Document Version**: 1.2
**Last Updated**: 2026-09-18
**Status**: Organized
