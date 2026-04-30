# FRONTEND-MAP.md — CriptEnv

> Maps User Stories to physical screens. Relates PRD requirements to interface modules.

---

## 1. Mapa de Telas (Screen Inventory)

### 1.1 Rotas e Prioridades

| # | Rota | Screen | Prioridade | Phase | User Stories |
|---|------|--------|------------|-------|-------------|
| 1 | `/` | Landing Page | P0 | 2 | Marketing, Onboarding |
| 2 | `/login` | Login | P0 | 2 | US-001, US-013 |
| 3 | `/signup` | Cadastro | P0 | 2 | US-001 |
| 4 | `/forgot-password` | Recuperação de Senha | P1 | 2 | — |
| 5 | `/dashboard` | Dashboard Overview | P0 | 2 | — |
| 6 | `/projects` | Projects List | P0 | 2 | — |
| 7 | `/projects/[id]` | Project Detail | P0 | 2 | US-004 |
| 8 | `/projects/[id]/secrets` | Secrets Browser | P0 | 2 | US-002, US-003, US-005 |
| 9 | `/projects/[id]/audit` | Audit Log | P1 | 2 | US-009 |
| 10 | `/projects/[id]/members` | Team Settings | P1 | 2 | US-007, US-008 |
| 11 | `/projects/[id]/settings` | Project Settings | P1 | 2 | US-004 |
| 12 | `/account` | Account Settings | P1 | 2 | US-013 |
| 13 | `/integrations` | Integrations | P2 | 3 | US-010, US-011 |

---

## 2. Fluxo de Navegação

```
Landing (/)
  ├── Login (/login)
  │     └── Dashboard (/dashboard)
  ├── Signup (/signup)
  │     └── Dashboard (/dashboard)
  └── Docs (external)

Dashboard (/dashboard)
  ├── Projects List (/projects)
  │     └── Project Detail (/projects/[id])
  │           ├── Secrets Browser (/projects/[id]/secrets)
  │           │     ├── Create Secret (modal)
  │           │     ├── Edit Secret (modal)
  │           │     └── Delete Secret (dialog)
  │           ├── Audit Log (/projects/[id]/audit)
  │           ├── Team Settings (/projects/[id]/members)
  │           │     ├── Invite Member (modal)
  │           │     └── Change Role (dropdown)
  │           └── Project Settings (/projects/[id]/settings)
  │                 ├── Environments (tab)
  │                 ├── Danger Zone (tab)
  │                 └── API Keys (tab)
  ├── Account (/account)
  │     ├── Profile (tab)
  │     ├── Security / 2FA (tab)
  │     └── API Tokens (tab)
  └── Integrations (/integrations)
        ├── GitHub (card)
        ├── Vercel (card)
        └── Railway (card)
```

---

## 3. User Stories → Telas

### Epic 1: Secret Management

| User Story | Telas | Componentes | Fluxo |
|-----------|-------|-------------|-------|
| **US-001**: First-Time Setup | `/signup` → `/dashboard` → `/projects` | SignupForm, OnboardingWizard | Cadastro → Criar projeto → Redirect para secrets |
| **US-002**: Import .env | `/projects/[id]/secrets` | ImportModal, FileDropzone | Botão "Import" → Upload → Preview → Confirm → Secrets list atualizada |
| **US-003**: Secure Team Sharing | `/projects/[id]/secrets` | SecretsTable, PushPullActions | Push/Pull via CLI, dashboard mostra status de sync |
| **US-004**: Environment Differentiation | `/projects/[id]`, `/projects/[id]/secrets` | EnvSelector (tabs), EnvDiffView | Tabs de environment → Filtra secrets → Diff view |
| **US-005**: Secret Retrieval | `/projects/[id]/secrets` | SecretRow, CopyButton, MaskedValue | Click "Copy" → Decrypt client-side → Clipboard → Toast feedback |
| **US-006**: Offline Access | (CLI only) | StatusIndicator | Dashboard mostra sync status com dot verde/amarelo/vermelho |

### Epic 2: Team Collaboration

| User Story | Telas | Componentes | Fluxo |
|-----------|-------|-------------|-------|
| **US-007**: Team Onboarding | `/projects/[id]/members` | InviteModal, MemberList | "Invite" → Email input + Role select → Send → Pending badge |
| **US-008**: RBAC | `/projects/[id]/members` | RoleSelector, PermissionMatrix | Dropdown de role → Confirm → Audit log entry |
| **US-009**: Audit Trail | `/projects/[id]/audit` | AuditTimeline, AuditFilter | Timeline com filtros (user, action, date) → Export JSON |

### Epic 3: CI/CD Integration

| User Story | Telas | Componentes | Fluxo |
|-----------|-------|-------------|-------|
| **US-010**: GitHub Actions | `/integrations` | IntegrationCard, TokenGenerator | "Connect GitHub" → OAuth → Show CI token → Copy |
| **US-011**: PR Preview Secrets | `/projects/[id]/settings` | EnvTemplateCard | Create "preview" env → Template from production |

### Epic 4: Security & Compliance

| User Story | Telas | Componentes | Fluxo |
|-----------|-------|-------------|-------|
| **US-012**: Secret Expiration | `/projects/[id]/secrets` | ExpirationBadge, WarningBanner | Badge "90d stale" → Click "Rotate" → Modal |
| **US-013**: 2FA | `/account` (Security tab) | QRCode, TOTPInput, RecoveryCodes | "Enable 2FA" → Scan QR → Enter code → Show recovery codes |

---

## 4. Dashboard Overview — Detalhamento

### `/dashboard` — Tela Principal

**Objetivo**: Overview rápido de todos os projetos e atividade recente.

**Layout**: Shell (Sidebar + TopNav) + Content area

**Seções**:

1. **Welcome Header**
   - Saudação com nome do usuário
   - "Last synced: 5 min ago" com StatusBadge
   - Quick actions: "New Project", "Import .env"

2. **Stats Cards** (grid 4-col)
   - Total Projects (count)
   - Total Secrets (count)
   - Team Members (count)
   - Last Activity (timestamp)

3. **Recent Activity Feed** (últimos 5 audit events)
   - Cada evento: ícone + descrição + timestamp + user avatar
   - Link para Audit Log completo

4. **Projects Grid** (últimos 6 projetos)
   - ProjectCard com: nome, environments count, secrets count, team avatars, last modified
   - "View All Projects" link

---

## 5. PRD Requisitos → Módulos de Interface

| PRD Requisito | Módulo | Implementação |
|--------------|--------|---------------|
| Zero-Knowledge Encryption | `lib/crypto.ts` | Web Crypto API, client-side only |
| CLI-First Workflow | (out of scope — CLI separado) | Dashboard é complemento visual |
| Web Dashboard | `app/(dashboard)/` | Full CRUD via Server Actions |
| Audit Completo | `AuditTimeline` + `AuditFilter` | Supabase Realtime subscriptions |
| Team Management | `MemberList` + `InviteModal` + `RoleSelector` | RBAC via Supabase RLS |
| Environment Management | `EnvSelector` + `EnvTabs` | Tabs com diff view |
| 2FA | `AccountSettings` (Security tab) | TOTP via BetterAuth |
| Supabase Realtime | `hooks/useRealtime.ts` | Live updates no dashboard |
| Import/Export | `ImportModal` + `ExportModal` | File upload + format selection |
| Billing (future) | `/billing` | Usage dashboard, upgrade CTA |

---

## 6. State Management Map

| State Type | Solution | Example |
|-----------|----------|---------|
| Server Data (projects, secrets, audit) | React Query (TanStack) | `useQuery(['projects'], fetchProjects)` |
| Auth State | BetterAuth + cookies | `useSession()` |
| UI State (sidebar open, modal) | Zustand | `useUIStore()` |
| Form State | React Hook Form | `useForm<CreateSecretInput>()` |
| Encryption Keys | In-memory only (never persisted) | `useCryptoStore()` (Zustand, no persist) |
| Real-time Events | Supabase Realtime | `useRealtime('audit_events')` |

---

## 7. Data Flow — Secret Create

```
User fills form (key, value, environment)
        │
        ▼
React Hook Form validates (Zod schema)
        │
        ▼
Server Action: createSecret(key, encryptedValue, envId)
        │
        ├── Client: Encrypt value with AES-GCM-256
        │     └── Web Crypto API → ArrayBuffer → base64
        │
        ├── Server: Store encrypted blob in Supabase
        │     └── INSERT into secrets table (RLS enforced)
        │
        ├── Server: Create audit event
        │     └── INSERT into audit_events table
        │
        └── Supabase Realtime broadcasts
              └── Other clients receive update
              └── Dashboard re-fetches secrets list
```

---

## 8. Error Handling Map

| Cenário | UX | Componente |
|---------|----|-----------|
| Network offline | Banner "You're offline — changes will sync later" | OfflineBanner |
| Encryption failure | Toast error "Encryption failed. Try again." | Toast |
| Permission denied | Redirect + Toast "You don't have access" | Toast + redirect |
| Conflict (push/pull) | Modal com diff view + merge options | ConflictModal |
| Session expired | Redirect to `/login` | Middleware |
| Supabase error | Toast genérico + log para Sentry | Toast |
| Invalid input | Inline error message | FormErrorMessage |
