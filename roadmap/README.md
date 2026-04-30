# Roadmap — CriptEnv

## Phased Execution Plan

---

## Overview Timeline

```
2026 Q2        2026 Q3        2026 Q4        2027 Q1
   │              │              │              │
   ▼              ▼              ▼              ▼
┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
│ P1   │      │ P2   │      │ P3   │      │ P4   │
│ MVP  │      │ Web  │ ───▶ │ CI/CD│ ───▶ │Ent.  │
│CLI   │      │ UI   │      │ Int. │      │Ready │
└──────┘      └──────┘      └──────┘      └──────┘
               ✅ DONE
```

> **Status**: Phase 1 ✅ COMPLETE (April 2026). Phase 2 ✅ COMPLETE (April 2026). Phase 3 next.

---

## Phase 1: MVP — CLI & Encryption Core

**Timeline**: Completed April 2026 (adapted from original Q2 2024 plan)
**Status**: ✅ COMPLETE
**Goal**: CLI funcional com criptografia Zero-Knowledge

### Objectives

- [x] CLI completa com todos os comandos básicos (14 comandos)
- [x] Criptografia AES-256-GCM client-side com PBKDF2HMAC + HKDF
- [x] Local vault SQLite (~/.criptenv/vault.db)
- [x] Integração com FastAPI backend existente
- [x] Session token encriptado no vault local
- [x] Import/export .env files
- [x] 93 testes unitários passando

### Deliverables

#### CLI Commands (MVP Set) — All Implemented ✅

```bash
criptenv init                           # Inicializar vault local
criptenv login --email user@example.com # Login via API
criptenv logout                         # Limpar sessão
criptenv set KEY=value                  # Adicionar secret (encriptado)
criptenv get KEY                        # Obter secret (decriptado)
criptenv list                           # Listar secrets (nomes)
criptenv delete KEY                     # Deletar secret
criptenv push -p <project-id>           # Enviar para cloud
criptenv pull -p <project-id>           # Puxar da cloud
criptenv env list -p <project-id>       # Listar environments
criptenv env create NAME -p <id>        # Criar environment
criptenv projects list                  # Listar projetos
criptenv doctor                         # Diagnosticar problemas
criptenv import .env                    # Importar arquivo
criptenv export -o .env                 # Exportar para .env
```

#### Technical Deliverables — All Implemented ✅

| Deliverable           | Description                             | Status |
| --------------------- | --------------------------------------- | ------ |
| **Encryption Module** | AES-256-GCM + PBKDF2HMAC (100k) + HKDF  | ✅     |
| **Local Vault**       | SQLite (~/.criptenv/vault.db)           | ✅     |
| **API Client**        | httpx async client for FastAPI backend  | ✅     |
| **Session Manager**   | Encrypted token storage                 | ✅     |
| **Import/Export**     | .env and JSON formats                   | ✅     |
| **Doctor**            | Config, vault, session, API diagnostics | ✅     |

### Milestones — All Complete ✅

| Milestone                   | Criteria                                       | Status |
| --------------------------- | ---------------------------------------------- | ------ |
| **M1.1**: CLI scaffolding   | All 14 commands listed in `--help`             | ✅     |
| **M1.2**: Encryption module | Round-trip encrypt/decrypt verified (30 tests) | ✅     |
| **M1.3**: Local vault       | SQLite CRUD working (22 tests)                 | ✅     |
| **M1.4**: Auth integration  | Login/logout with encrypted session            | ✅     |
| **M1.5**: Core commands     | set/get/list/delete with real crypto           | ✅     |
| **M1.6**: Sync & utilities  | push/pull, doctor, import/export               | ✅     |

---

## Phase 2: Web UI & Cloudflare Runtime Alignment

**Timeline**: 3 months (Q3 2024) → Completed April 2026
**Status**: ✅ COMPLETE
**Goal**: Dashboard web completo com runtime Vinext e deploy em Cloudflare Pages + Workers

### Objectives

- [x] Frontend em Vinext + TailwindCSS + Radix UI preparado para Cloudflare Pages + Workers
- [x] Session-based auth (NOT BetterAuth - custom JWT-like sessions)
- [x] CRUD completo de projects/environments/secrets
- [x] Audit logs visual
- [x] Team management (invites, roles)
- [x] Landing page + documentation

### Implementation Notes

| Planned                  | Actual                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| Vinext + Cloudflare edge | Vinext runtime on top of the existing App Router, targeting Cloudflare |
| BetterAuth               | Custom session-based auth (apps/api/app/middleware/auth.py)            |
| Supabase Realtime        | Not implemented                                                        |
| GitHub/Google OAuth      | Not implemented                                                        |
| 2FA (TOTP)               | Not implemented                                                        |

### Deliverables

#### Web Screens

| Screen               | Priority | Description                        |
| -------------------- | -------- | ---------------------------------- |
| **Landing Page**     | P0       | Marketing page, pricing, docs link |
| **Auth Pages**       | P0       | Login, signup, forgot password     |
| **Dashboard**        | P0       | Overview do usuário                |
| **Project List**     | P0       | Grid de projetos                   |
| **Project Detail**   | P0       | Environments + secrets             |
| **Secrets Browser**  | P0       | CRUD de secrets (masked)           |
| **Audit Log**        | P1       | Timeline de eventos                |
| **Team Settings**    | P1       | Members, roles                     |
| **Account Settings** | P1       | Profile, security, API keys        |
| **Billing**          | P2       | Usage, upgrade CTA                 |

#### Technical Deliverables

| Deliverable              | Description                                   |
| ------------------------ | --------------------------------------------- |
| **Vinext App**           | Full-stack dashboard preparado para Cloudflare |
| **Custom Session Auth**  | Session management                            |
| **Supabase Realtime**    | Live updates no dashboard                     |
| **SSO Providers**        | GitHub, Google, GitLab                        |
| **Cloudflare Runtime**   | Worker entry, wrangler config e edge deploy   |

### Milestones

| Milestone                  | Week | Criteria                    |
| -------------------------- | ---- | --------------------------- |
| **M2.1**: Project scaffold | 2    | Vinext + Tailwind + Cloudflare baseline |
| **M2.2**: Auth complete    | 4    | Login/signup + OAuth        |
| **M2.3**: Secrets CRUD     | 6    | Full CRUD no dashboard      |
| **M2.4**: Team features    | 8    | Invite flow, RBAC           |
| **M2.5**: Audit logs       | 10   | Event timeline              |
| **M2.6**: Public launch    | 12   | v1.0 release                |

### Success Metrics (Phase 2)

```
- MAU: 500+
- DAU: 100+
- CLI installs: 5,000+
- Web sessions: 10,000+
- Projects created: 200+
- NPS: > 50
```

---

## Phase 3: CI/CD Integrations & Dynamic Secrets

**Timeline**: 3 months (Q4 2024)  
**Goal**: Ecossistema de integrações

### Objectives

- [ ] GitHub Actions official action
- [ ] Vercel, Railway, Render integrations
- [ ] CLI tokens for CI/CD
- [ ] Secret expiration/alerts
- [ ] Secret rotation basics
- [ ] Public API

### Deliverables

#### Integrations

| Integration          | Type           | Priority |
| -------------------- | -------------- | -------- |
| **@criptenv/action** | GitHub Actions | P0       |
| **Vercel**           | Native API     | P0       |
| **Railway**          | Native API     | P1       |
| **Render**           | Native API     | P1       |
| **Docker**           | Compose plugin | P1       |
| **Kubernetes**       | Operator       | P2       |
| **Terraform**        | Provider       | P2       |

#### CLI Extensions

```bash
criptenv ci-login          # Login com CI token
criptenv ci-deploy         # Deploy com secrets
criptenv ci-secrets        # Listar secrets disponíveis
criptenv github connect     # Conectar repo GitHub
criptenv vercel link        # Link project Vercel
```

#### API

```bash
# REST API v1
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id/secrets
POST   /api/v1/secrets
PUT    /api/v1/secrets/:id
DELETE /api/v1/secrets/:id
GET    /api/v1/audit
POST   /api/v1/integrations/verify
```

### Milestones

| Milestone                    | Week | Criteria                  |
| ---------------------------- | ---- | ------------------------- |
| **M3.1**: GitHub Action      | 4    | Official action published |
| **M3.2**: Cloud integrations | 6    | Vercel + Railway working  |
| **M3.3**: CI tokens          | 8    | Token-based auth for CI   |
| **M3.4**: Public API         | 10   | REST API documented       |
| **M3.5**: Secret alerts      | 12   | Expiration notifications  |

---

## Phase 4: Enterprise Ready

**Timeline**: 2025 Q1  
**Goal**: Enterprise features

### Objectives

- [ ] SSO/SAML (Okta, Azure AD)
- [ ] SCIM provisioning
- [ ] Audit log export (SIEM)
- [ ] Self-hosted option
- [ ] Custom roles
- [ ] Secret policies (rotation, complexity)

### Deliverables

| Feature             | Description                          |
| ------------------- | ------------------------------------ |
| **SAML SSO**        | Okta, Azure AD, Google Workspace     |
| **SCIM**            | Automated user provisioning          |
| **SIEM Export**     | Splunk, Datadog, Elastic             |
| **Self-Hosted**     | Docker compose / Kubernetes          |
| **Secret Policies** | Enforce rotation, naming conventions |
| **Audit Archive**   | Long-term storage + search           |

---

## Resource Allocation

### Team (Assumed)

| Role                   | Phase 1 | Phase 2 | Phase 3 |
| ---------------------- | ------- | ------- | ------- |
| **Backend (FastAPI)**  | 50%     | 30%     | 30%     |
| **Frontend (Vinext)**  | 20%     | 50%     | 30%     |
| **DevOps/Infra**       | 20%     | 10%     | 20%     |
| **Security**           | 10%     | 10%     | 20%     |

### Infrastructure Cost (Monthly)

| Service        | Phase 1   | Phase 2   | Phase 3    |
| -------------- | --------- | --------- | ---------- |
| **Supabase**   | $0 (free) | $25 (pro) | $75 (team) |
| **Cloudflare Pages + Workers** | $0 (free) | $20 (paid) | $20        |
| **Domain**     | $12       | $12       | $12        |
| **Monitoring** | $0        | $0        | $50        |
| **Total**      | ~$12/mo   | ~$57/mo   | ~$157/mo   |

---

## Risk Assessment

| Risk                         | Probability | Impact   | Mitigation                      |
| ---------------------------- | ----------- | -------- | ------------------------------- |
| **Encryption vulnerability** | Low         | Critical | Audit by 3rd party              |
| **Supabase pricing change**  | Medium      | Medium   | Migration path documented       |
| **Low adoption**             | Medium      | High     | Early community building        |
| **Competitor feature drop**  | High        | Medium   | Differentiate on UX + ZK        |
| **Key derivation too slow**  | Low         | Medium   | Web Workers, progress indicator |

---

## Dependencies

### External

- Supabase CLI for local dev
- BetterAuth stability
- Vinext plugin maturity
- npm registry availability

### Internal

- Phase 1 must complete before Phase 2 (CLI = primary product)
- Web UI depends on BetterAuth web integration patterns
- CI/CD depends on having stable public API

---

## Success Criteria for Full Roadmap

```
Year 1 End:
├── 50,000 CLI installs
├── 10,000 projects created
├── 1,000,000 secrets managed
├── 500 GitHub stars
├── 50 contributors
├── $0 Infrastructure cost (covered by sponsors)
└── 0 security incidents
```

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Approved  
**Next**: Technical Specifications
