# Agent Workflow — CriptEnv

> Rules and guidelines for AI agents working on this project.

---

## Purpose

This document ensures continuity when multiple agents work on CriptEnv. By following these rules, agents can understand the project state and continue work without losing context.

---

## Mandatory Checklist Before Coding

**Before writing any code, you MUST:**

- [ ] Read `README.md` for project overview
- [ ] Read `docs/index.md` (this documentation structure)
- [ ] Read `docs/project/current-state.md` to understand what's implemented
- [ ] Read `docs/tasks/current-task.md` to know the current focus
- [ ] Understand the tech stack from `docs/project/tech-stack.md`
- [ ] Understand the feature or fix requested
- [ ] Check related files in the codebase before modifying

---

## Core Rules

### 1. Always Read Current State First

Before starting any task:
1. Read [`docs/project/current-state.md`](./project/current-state.md)
2. Read [`docs/tasks/current-task.md`](../tasks/current-task.md)
3. Check [`docs/features/in-progress.md`](../features/in-progress.md) for active work

### 2. Never Break Existing Tests

- Run tests before and after changes
- CLI: `cd apps/cli && python -m pytest`
- API: `cd apps/api && python -m pytest`

### 3. Document All Decisions

When making architectural decisions:
1. Create an entry in [`docs/project/decisions.md`](./project/decisions.md)
2. Use the format: `## DEC-XXX — [Title]`
3. Include date, context, decision, rationale, consequences

### 4. Update Documentation When Changing Code

After significant code changes:
1. Update `docs/development/CHANGELOG.md`
2. Update relevant feature document in `docs/features/`
3. Update `docs/tasks/task-history.md` if completing a task

### 5. Don't Duplicate Files

Before creating new files:
1. Check if similar file already exists
2. Look in `docs/` for existing documentation patterns
3. Use existing structures before creating new ones

### 6. Stay on Task

- Only work on the current task
- Don't refactor unrelated code
- Don't implement features outside the current scope
- If you discover something important, document it but finish current work first

### 7. Mark Inferred Information Clearly

When documenting something inferred from code (not from explicit comments):
- Use phrase: "(inferred)" or "(inferred from code)"
- Don't present as confirmed fact if not explicitly stated

### 8. Report What You Did

At the end of every session:
1. Summarize changes made
2. Note any issues found
3. State what needs to be done next
4. Update `docs/tasks/current-task.md` if status changed

---

## Project Structure Understanding

### Where to Find Things

| What | Where |
|------|-------|
| CLI commands | `apps/cli/src/criptenv/commands/` |
| CLI crypto | `apps/cli/src/criptenv/crypto/` |
| CLI vault | `apps/cli/src/criptenv/vault/` |
| API routers | `apps/api/app/routers/` |
| API services | `apps/api/app/services/` |
| API models | `apps/api/app/models/` |
| API strategies | `apps/api/app/strategies/` |
| Frontend pages | `apps/web/src/app/` |
| Frontend components | `apps/web/src/components/` |
| Frontend stores | `apps/web/src/stores/` |

### Key Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview (start here) |
| `CLAUDE.md` | AI agent guidance |
| `docs/index.md` | Documentation index |
| `docs/project/current-state.md` | What's implemented |
| `docs/tasks/current-task.md` | Current focus |
| `roadmap/README.md` | Phase plan |
| `plans/phase3-cicd-integrations.md` | Phase 3 details |

---

## Workflow Steps

### Step 1: Understand the Request

1. Read the user's request carefully
2. Identify what needs to be done
3. Check if there's a related task in `docs/tasks/`

### Step 2: Research Context

1. Read `docs/project/current-state.md`
2. Check existing implementation in relevant files
3. Look at tests for patterns
4. Check `docs/project/decisions.md` for related decisions

### Step 3: Plan the Work

1. Break into small, testable steps
2. Identify files to modify
3. Consider test impact
4. Plan documentation updates

### Step 4: Execute

1. Make small, focused changes
2. Run tests frequently
3. Don't leave code in broken state

### Step 5: Validate

1. Run all relevant tests
2. Check linting
3. Verify documentation is updated

### Step 6: Report

1. Summarize changes
2. Note next steps
3. Update current task status

---

## Common Patterns

### Adding a New CLI Command

1. Create command file in `apps/cli/src/criptenv/commands/`
2. Import in `apps/cli/src/criptenv/cli.py`
3. Add to `__all__` in commands `__init__.py`
4. Write tests in `apps/cli/tests/`
5. Update `docs/features/in-progress.md`

### Adding a New API Endpoint

1. Add to router in `apps/api/app/routers/`
2. Add service method in `apps/api/app/services/`
3. Add schema in `apps/api/app/schemas/`
4. Write tests in `apps/api/tests/`
5. Update `docs/technical/api.md`

### Adding a New Frontend Page

1. Create in `apps/web/src/app/(dashboard)/` or appropriate route group
2. Add navigation link in sidebar/top-nav
3. Add any needed API calls in `apps/web/src/lib/api/`
4. Update `docs/technical/frontend.md`

---

## Phase Context

### Phase 1 (CLI MVP) — ✅ COMPLETE

Focus was on:
- CLI commands implementation
- Encryption module
- Local vault
- 93+ tests passing

### Phase 2 (Web UI) — ✅ COMPLETE

Focus was on:
- Vinext/Next.js frontend
- Auth system
- CRUD operations
- Dashboard pages

### Phase 3 (CI/CD) — 🔄 IN PROGRESS

Current focus:
- GitHub Action (implemented)
- Secret rotation (implemented API, CLI in progress)
- Cloud integrations (Vercel, Railway — pending)
- Public API with versioning (pending)

**Important**: Security issues from Phase 2 review (CR-01, CR-02) should be addressed before Phase 3 public API work.

---

## Handling Uncertainty

### If Unclear What to Do

1. Check `docs/tasks/current-task.md` for explicit instructions
2. Look at `plans/` for implementation plans
3. Check `specs/` for technical specifications
4. Ask clarifying question if still unclear

### If Code Seems Wrong

1. Don't modify unless it's clearly a bug
2. Document the issue in your report
3. Note it as a potential issue for human review

### If Request Seems Out of Scope

1. Acknowledge the request
2. Explain why it's outside current scope
3. Suggest it be added to `docs/features/backlog.md`
4. Focus on current task

---

## Documentation Update Rules

### When to Update

- After completing any task
- After discovering important information about the project
- When current state changes
- When a decision is made

### What to Update

| Change | Update |
|--------|--------|
| New feature implemented | `docs/features/implemented.md` |
| Feature in development | `docs/features/in-progress.md` |
| New decision made | `docs/project/decisions.md` |
| Task completed | `docs/tasks/task-history.md` |
| Version change | `docs/development/CHANGELOG.md` |
| Current work focus | `docs/tasks/current-task.md` |

---

## Exit Report Format

When finishing a session, provide:

```markdown
## Agent Session Report

### Changes Made
- [file]: [description]

### Tests Run
- [result]

### Issues Found
- [description]

### Next Steps
1. [action]
2. [action]

### Notes for Next Agent
- [important context]
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01