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
| **Phase 3 (CI/CD)** | 🔄 IN PROGRESS | GitHub Action, secret rotation, cloud integrations |
| **Phase 4 (Enterprise)** | 📋 PLANNED | SSO/SAML, SCIM, self-hosted |

**Current Focus**: Phase 3 — CI/CD Integrations (M3.5 Secret Alerts & Rotation)

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
4. Read [Development Workflow](./workflow/development-workflow.md) to set up your environment
5. Check [Current Task](./tasks/current-task.md) to know what to work on

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
| CLI Tests | 93+ passing |
| API Tests | 40+ (CI auth, tokens, rate limiting, etc.) |
| CLI Commands | 14 (init, login, logout, set, get, list, delete, push, pull, env, projects, doctor, import, export) |
| API Routers | 9 (auth, projects, environments, vault, members, invites, tokens, audit) |
| Frontend Pages | 13 routes |
| Phase Progress | Phase 1 ✅, Phase 2 ✅, Phase 3 🔄 |

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01  
**Status**: Organized