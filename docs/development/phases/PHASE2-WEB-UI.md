# Plan: CriptEnv Phase 2 — Web UI Completion

## Context

The user wants to skip Phase 1 (CLI MVP) and focus on completing the full roadmap starting from Phase 2 (Web UI). After reviewing all documentation and codebase, the backend API is structurally complete but the frontend has significant gaps between what's specced in `docs/frontend/UI-SPEC-COMPONENTS.md` and what's actually implemented. The landing page redesign plan exists and is largely implemented.

**Goal:** Build a complete, functional Web UI dashboard that covers all Phase 2 deliverables.

---

## Phase 2 Scope (from roadmap/README.md)

| Deliverable | Status | Implementation |
|-------------|--------|----------------|
| Frontend + TailwindCSS + Radix UI | ✅ Done | Vinext runtime + React 19 + TailwindCSS v4 + Radix UI para Cloudflare Pages + Workers |
| Auth pages (login, signup, forgot-password) | ✅ Done | `apps/web/src/app/(auth)/` |
| Dashboard overview | ✅ Done | `apps/web/src/app/(dashboard)/dashboard/` |
| Project List | ✅ Done | `apps/web/src/app/(dashboard)/projects/` |
| Project Detail (Environments + Secrets) | ✅ Done | `apps/web/src/app/(dashboard)/projects/[id]/` |
| Secrets Browser (CRUD, masked) | ✅ Done | `apps/web/src/components/shared/secret-row.tsx`, `secrets-table.tsx`, etc. |
| Audit Log timeline | ✅ Done | `apps/web/src/components/shared/audit-timeline.tsx` |
| Team Settings (members, roles) | ✅ Done | `apps/web/src/app/(dashboard)/projects/[id]/members/` |
| Account Settings | ✅ Done | `apps/web/src/app/(dashboard)/account/` |
| Integrations page | ✅ Done | `apps/web/src/app/(dashboard)/integrations/` |
| Landing page | ✅ Done | `apps/web/src/app/(marketing)/` with marketing-sidebar, glassmorphism |

## Implementation Complete: 2026-04-30

### Files Created/Modified

| Component | Files |
|-----------|-------|
| Secrets | `secret-row.tsx`, `secrets-table.tsx`, `secret-form.tsx`, `import-modal.tsx`, `export-modal.tsx` |
| Audit | `audit-timeline.tsx`, `audit-entry.tsx` |
| Team | `invite-modal.tsx`, `invite-card.tsx`, `member-list.tsx` |
| Environment | `env-selector.tsx`, `env-tab.tsx` |
| Layout | `marketing-sidebar.tsx`, `sidebar-nav.tsx`, `app-shell.tsx` |
| UI Primitives | `badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `separator.tsx`, `skeleton.tsx`, `status-badge.tsx`, `theme-switch.tsx` |
| Pages | All route groups in `apps/web/src/app/(dashboard)/` and `apps/web/src/app/(auth)/` |

---

## Priority 1: Secrets Browser (Critical Path)

**Why first:** Without secrets CRUD, the core value proposition fails.

**Specced in:** `docs/frontend/UI-SPEC-COMPONENTS.md` ( SecretRow, SecretForm, SecretsTable, ImportModal, ExportModal)

**Files to create/modify:**
- `apps/web/src/components/shared/secrets-table.tsx` (NEW)
- `apps/web/src/components/shared/secret-row.tsx` (NEW)
- `apps/web/src/components/shared/secret-form.tsx` (NEW)
- `apps/web/src/components/shared/import-modal.tsx` (NEW)
- `apps/web/src/components/shared/export-modal.tsx` (NEW)
- `apps/web/src/app/(dashboard)/projects/[id]/secrets/page.tsx` (MODIFY - connect to API)

**Backend dependency:** Vault router already exists at `/api/v1/projects/{p_id}/environments/{e_id}/vault` with push/pull endpoints.

**Verification:** Create a project → add environment → push secrets → pull and view masked secrets → edit → delete.

---

## Priority 2: Audit Log UI

**Specced in:** `docs/frontend/UI-SPEC-COMPONENTS.md` (AuditTimeline, AuditEntry components)

**Files to create/modify:**
- `apps/web/src/components/shared/audit-timeline.tsx` (NEW)
- `apps/web/src/components/shared/audit-entry.tsx` (NEW)
- `apps/web/src/app/(dashboard)/projects/[id]/audit/page.tsx` (MODIFY)

**Backend dependency:** Audit router exists at `/api/v1/projects/{id}/audit`.

**Verification:** Perform actions (create project, push secrets, invite member) → check audit timeline → verify all actions appear.

---

## Priority 3: Invite Flow UI

**Specced in:** `docs/frontend/UI-SPEC-COMPONENTS.md` (InviteModal, InviteCard components)

**Files to create/modify:**
- `apps/web/src/components/shared/invite-modal.tsx` (NEW)
- `apps/web/src/components/shared/invite-card.tsx` (NEW)
- `apps/web/src/app/(dashboard)/projects/[id]/members/page.tsx` (MODIFY)

**Backend dependency:** Invites router already exists with create/accept/revoke endpoints.

**Verification:** Invite a new user by email → receive invite → accept invite → verify member appears.

---

## Priority 4: Environment Tabs / EnvSelector

**Specced in:** `docs/frontend/UI-SPEC-COMPONENTS.md` (EnvSelector, EnvTab components)

**Files to create/modify:**
- `apps/web/src/components/shared/env-selector.tsx` (NEW)
- `apps/web/src/components/shared/env-tab.tsx` (NEW)
- `apps/web/src/app/(dashboard)/projects/[id]/page.tsx` (MODIFY - add tab navigation)

**Verification:** Navigate to project → see tabs for each environment → switch between environments → secrets update.

---

## Priority 5: Command Palette

**Specced in:** `docs/frontend/FRONTEND-MAP.md` (⌘K command palette)

**Files to create:**
- `apps/web/src/components/shared/command-palette.tsx` (NEW)
- Keyboard shortcut handler in root layout or providers

**Verification:** Press ⌘K → command palette opens → search commands → execute action.

---

## Priority 6: Landing Page Polish (Hermes Plan completion)

**From:** `.hermes/plans/2026-04-29_193600-landing-page-redesign.md`

**Most already implemented.** Verify and close gaps:
- Scroll-spy in marketing sidebar ✅
- Hero with master-keys image ✅
- Features 2x2 grid ✅
- How It Works (4 steps) ✅
- Security section ✅
- Pricing cards ✅
- CTA section ✅
- Glassmorphism effects ✅
- Float animation ✅

**Verification:** Visit `/(marketing)` page → verify all sections render → mobile responsive.

---

## Priority 7: State Management Integration

**Specced in:** `docs/frontend/FRONTEND-MAP.md` (Zustand stores + React Query + BetterAuth + Supabase client)

**Current state:** UI components exist but integration between stores not verified.

**Files to check:**
- `apps/web/src/stores/` (if exists)
- `apps/web/src/lib/` (API client setup)
- `apps/web/src/providers/` (if exists)

**Verification:** Perform full user flow: signup → login → create project → add secrets → verify state persists across page reload.

---

## Backend Verification (Prerequisite)

Before frontend work, verify backend works end-to-end.

**Tests to run:**
```bash
cd apps/api
python -m pytest tests/ -v
```

**Health checks:**
```bash
curl http://localhost:8000/health
curl http://localhost:8000/docs  # if DEBUG=true
```

**Key files already complete:**
- Routers: auth, projects, environments, vault, members, invites, tokens, audit
- Services: auth_service, project_service, vault_service, audit_service
- Strategies: access, invite_transitions, vault_push, audit_filters
- Models: user, project, environment, vault, member, audit

---

## Timeline Estimate

| Priority | Task | Est. Time |
|----------|------|-----------|
| 0 | Backend verification | 1-2h |
| 1 | Secrets Browser | 4-6h |
| 2 | Audit Log UI | 2-3h |
| 3 | Invite Flow UI | 2-3h |
| 4 | Environment Tabs | 1-2h |
| 5 | Command Palette | 2-3h |
| 6 | Landing Page Polish | 1-2h |
| 7 | State Management | 2-3h |
| **Total** | | **15-24h** |

---

## Critical Files Reference

| Purpose | Path |
|---------|------|
| Frontend component specs | `docs/frontend/UI-SPEC-COMPONENTS.md` |
| Frontend architecture | `docs/frontend/FRONTEND-MAP.md` |
| API implementation | `apps/api/app/routers/*.py` |
| Database models | `apps/api/app/models/*.py` |
| Frontend route groups | `apps/web/src/app/(dashboard)/` |
| UI primitives | `apps/web/src/components/ui/` |
| Layout components | `apps/web/src/components/layout/` |
| Landing page plan | `.hermes/plans/2026-04-29_193600-landing-page-redesign.md` |
| Root CLAUDE.md | `CLAUDE.md` |

---

## Verification Plan

1. **Backend:** Run `pytest tests/` → all pass
2. **Frontend build:** `cd apps/web && npm run build` → no errors
3. **Secrets flow:** Create project → environment → push secrets → pull secrets → display masked
4. **Invite flow:** Send invite → accept → new member appears with correct role
5. **Audit flow:** Perform actions → check audit timeline → verify chronological order
6. **Landing page:** Visit `/(marketing)` → all sections visible → responsive
7. **E2E (Playwright):** Login → create project → add secrets → logout → login → secrets still there
