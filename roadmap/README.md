# Roadmap — CriptEnv

## Phased Execution Plan

---

## Overview Timeline

```
2024 Q2        2024 Q3        2024 Q4        2025 Q1
   │              │              │              │
   ▼              ▼              ▼              ▼
┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
│ P1   │      │ P2   │      │ P3   │      │ P4   │
│ MVP  │ ───▶ │ Web  │ ───▶ │ CI/CD│ ───▶ │Ent.  │
│CLI   │      │ UI   │      │ Int. │      │Ready │
└──────┘      └──────┘      └──────┘      └──────┘
```

---

## Phase 1: MVP — CLI & Encryption Core

**Timeline**: 3 months (Q2 2024)  
**Goal**: CLI funcional com criptografia Zero-Knowledge

### Objectives

- [ ] CLI completa com todos os comandos básicos
- [ ] Criptografia AES-GCM 256-bit client-side
- [ ] Integração com Supabase para storage
- [ ] Autenticação BetterAuth
- [ ] Sync básico entre devices
- [ ] GitHub repository público

### Deliverables

#### CLI Commands (MVP Set)

```bash
criptenv init          # Inicializar projeto local
criptenv login         # Login via BetterAuth
criptenv set KEY=value # Adicionar secret
criptenv get KEY       # Obter secret
criptenv list          # Listar secrets
criptenv delete KEY    # Deletar secret
criptenv push          # Enviar para cloud
criptenv pull          # Puxar da cloud
criptenv env list      # Listar environments
criptenv env create   # Criar environment
criptenv doctor       # Diagnosticar problemas
criptenv import .env   # Importar arquivo
criptenv export        # Exportar para .env
```

#### Technical Deliverables

| Deliverable | Description |
|-------------|-------------|
| **Encryption Module** | AES-GCM 256-bit com PBKDF2 key derivation |
| **Local Vault** | SQLite local (~/.criptenv/vault.db) |
| **Supabase Backend** | Tables, RLS policies, storage bucket |
| **BetterAuth Setup** | Email/password + GitHub OAuth |
| **CLI Binary** | Binários para Mac, Linux, Windows |

### Milestones

| Milestone | Week | Criteria |
|-----------|------|----------|
| **M1.1**: CLI skeleton | 2 | All commands return proper output |
| **M1.2**: Encryption working | 4 | Round-trip encrypt/decrypt verified |
| **M1.3**: Supabase integration | 6 | CRUD on remote vault |
| **M1.4**: Auth flow complete | 8 | Signup, login, session management |
| **M1.5**: Team sync | 10 | Multiple users, push/pull |
| **M1.6**: Beta release | 12 | 50 beta users, feedback collected |

### Success Metrics (Phase 1)

```
- CLI installed: 500+
- GitHub stars: 100+
- Beta users: 50+
- NPS: > 40
- Secrets managed: 10,000+
- Zero security incidents
```

---

## Phase 2: Web UI & BetterAuth Integration

**Timeline**: 3 months (Q3 2024)  
**Goal**: Dashboard web completo

### Objectives

- [ ] Next.js frontend com Vinext + TailwindCSS + Pug
- [ ] BetterAuth integrado (email/password + OAuth)
- [ ] CRUD completo de projects/environments/secrets
- [ ] Audit logs visual
- [ ] Team management (invites, roles)
- [ ] Landing page + documentation

### Deliverables

#### Web Screens

| Screen | Priority | Description |
|--------|----------|-------------|
| **Landing Page** | P0 | Marketing page, pricing, docs link |
| **Auth Pages** | P0 | Login, signup, forgot password |
| **Dashboard** | P0 | Overview do usuário |
| **Project List** | P0 | Grid de projetos |
| **Project Detail** | P0 | Environments + secrets |
| **Secrets Browser** | P0 | CRUD de secrets (masked) |
| **Audit Log** | P1 | Timeline de eventos |
| **Team Settings** | P1 | Members, roles |
| **Account Settings** | P1 | Profile, security, API keys |
| **Billing** | P2 | Usage, upgrade CTA |

#### Technical Deliverables

| Deliverable | Description |
|-------------|-------------|
| **Next.js App** | Full-stack com Vinext |
| **BetterAuth Web** | Session management |
| **Supabase Realtime** | Live updates no dashboard |
| **SSO Providers** | GitHub, Google, GitLab |
| **2FA** | TOTP support |

### Milestones

| Milestone | Week | Criteria |
|-----------|------|----------|
| **M2.1**: Project scaffold | 2 | Next.js + Vinext + Tailwind |
| **M2.2**: Auth complete | 4 | Login/signup + OAuth |
| **M2.3**: Secrets CRUD | 6 | Full CRUD no dashboard |
| **M2.4**: Team features | 8 | Invite flow, RBAC |
| **M2.5**: Audit logs | 10 | Event timeline |
| **M2.6**: Public launch | 12 | v1.0 release |

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

| Integration | Type | Priority |
|-------------|------|----------|
| **@criptenv/action** | GitHub Actions | P0 |
| **Vercel** | Native API | P0 |
| **Railway** | Native API | P1 |
| **Render** | Native API | P1 |
| **Docker** | Compose plugin | P1 |
| **Kubernetes** | Operator | P2 |
| **Terraform** | Provider | P2 |

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

| Milestone | Week | Criteria |
|-----------|------|----------|
| **M3.1**: GitHub Action | 4 | Official action published |
| **M3.2**: Cloud integrations | 6 | Vercel + Railway working |
| **M3.3**: CI tokens | 8 | Token-based auth for CI |
| **M3.4**: Public API | 10 | REST API documented |
| **M3.5**: Secret alerts | 12 | Expiration notifications |

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

| Feature | Description |
|---------|-------------|
| **SAML SSO** | Okta, Azure AD, Google Workspace |
| **SCIM** | Automated user provisioning |
| **SIEM Export** | Splunk, Datadog, Elastic |
| **Self-Hosted** | Docker compose / Kubernetes |
| **Secret Policies** | Enforce rotation, naming conventions |
| **Audit Archive** | Long-term storage + search |

---

## Resource Allocation

### Team (Assumed)

| Role | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| **Backend (FastAPI)** | 50% | 30% | 30% |
| **Frontend (Next.js)** | 20% | 50% | 30% |
| **DevOps/Infra** | 20% | 10% | 20% |
| **Security** | 10% | 10% | 20% |

### Infrastructure Cost (Monthly)

| Service | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| **Supabase** | $0 (free) | $25 (pro) | $75 (team) |
| **Vercel** | $0 (free) | $20 (pro) | $20 |
| **Domain** | $12 | $12 | $12 |
| **Monitoring** | $0 | $0 | $50 |
| **Total** | ~$12/mo | ~$57/mo | ~$157/mo |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Encryption vulnerability** | Low | Critical | Audit by 3rd party |
| **Supabase pricing change** | Medium | Medium | Migration path documented |
| **Low adoption** | Medium | High | Early community building |
| **Competitor feature drop** | High | Medium | Differentiate on UX + ZK |
| **Key derivation too slow** | Low | Medium | Web Workers, progress indicator |

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
