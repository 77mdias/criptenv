# Task Management — CriptEnv

## Overview

This document defines how tasks are created, tracked, and completed in the CriptEnv project.

---

## Task Template

Use this template for all new tasks:

```markdown
# TASK-XXX — [Task Title]

## Context

[Explain why this task exists. What problem does it solve?]

## Objective

[Explain the expected outcome. What does "done" look like?]

## Scope

### Included
- [ ] Item
- [ ] Item

### Out of Scope
- [ ] Item (explanation why)

## Files Likely Affected

- `path/to/file1`
- `path/to/file2`

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Execution Plan

1. **Step 1**: [Description]
2. **Step 2**: [Description]
3. **Step 3**: [Description]

## Validation

- [ ] How to verify the task is complete
- [ ] Tests that should pass

## Status

- [ ] Not Started
- [x] In Progress
- [ ] Blocked
- [ ] Completed

## Notes

[Any important information, blockers, or context.]

---

## Task Naming Convention

- Format: `TASK-XXX — [Descriptive Title]`
- XXX = Sequential number (TASK-001, TASK-002, etc.)
- Use imperative mood: "Add", "Fix", "Implement", "Create"
- Be specific: "Add rotate command to secrets.py" not "Add command"

---

## Priority Levels

| Priority | Description | When to Address |
|----------|-------------|-----------------|
| **P0** | Critical | Immediately |
| **P1** | High | Within current sprint |
| **P2** | Medium | After P1 items |
| **P3** | Low | When capacity allows |

---

## Status Definitions

| Status | Meaning | Action |
|--------|---------|--------|
| **Not Started** | Task created but work hasn't begun | Prioritize and start |
| **In Progress** | Work actively happening | Continue focused work |
| **Blocked** | Cannot proceed due to dependency | Resolve blocker |
| **Completed** | All acceptance criteria met | Validate and document |

---

## Task Workflow

### 1. Creation

1. Identify the need (feature, bug, improvement)
2. Fill out task template
3. Assign priority
4. Add to `docs/tasks/next-tasks.md`

### 2. Execution

1. Read task completely
2. Review related files
3. Execute plan step by step
4. Run tests frequently
5. Update status as you progress

### 3. Completion

1. Verify all acceptance criteria
2. Run full test suite
3. Update documentation
4. Move task to history

---

## Tracking Tasks

### Active Task

Current task is documented in `docs/tasks/current-task.md`.

### Next Tasks

Prioritized list in `docs/tasks/next-tasks.md`.

### Task History

Completed tasks in `docs/tasks/task-history.md`.

---

## Breaking Down Large Tasks

For complex features, break into subtasks:

```markdown
# TASK-050 — Large Feature Implementation

## Parent Task
TASK-050

## Subtasks
- [ ] TASK-050-1: Design the approach
- [ ] TASK-050-2: Implement core logic
- [ ] TASK-050-3: Add API endpoints
- [ ] TASK-050-4: Write tests
- [ ] TASK-050-5: Update documentation
```

### Guidelines for Breaking Down

1. Each subtask should be completable in 1-4 hours
2. Subtasks should be independently testable
3. Order should reflect dependencies
4. Document dependencies between subtasks

---

## Example Tasks

### Feature Implementation

```markdown
# TASK-042 — Add Vercel Integration Provider

## Context
Phase 3 requires cloud integrations. Vercel is the first provider to implement.

## Objective
Create `VercelProvider` class that implements `IntegrationProvider` interface.

## Scope

### Included
- VercelProvider class in `apps/api/app/strategies/integrations/`
- push_secrets method
- pull_secrets method
- validate_connection method

### Out of Scope
- Vercel dashboard UI (separate task)
- Vercel SDK integration (manual HTTP calls)

## Files Likely Affected

- `apps/api/app/strategies/integrations/base.py` (interface)
- `apps/api/app/strategies/integrations/vercel.py` (new file)
- `apps/api/app/services/integration_service.py` (select provider)

## Acceptance Criteria

- [ ] VercelProvider implements IntegrationProvider
- [ ] push_secrets sends correct format to Vercel API
- [ ] pull_secrets retrieves secrets from Vercel
- [ ] validate_connection returns true for valid token
- [ ] Tests exist for all methods

## Execution Plan

1. Read existing IntegrationProvider interface
2. Review Vercel API documentation
3. Implement VercelProvider class
4. Write unit tests
5. Test with mock Vercel API

## Status

- [ ] Not Started

## Notes

Vercel API docs: https://vercel.com/docs/rest/api
```

### Bug Fix

```markdown
# TASK-043 — Fix session token exposure in response body

## Context
CR-01 from Phase 2 Review: Session token is being returned in response body 
which exposes it to XSS attacks.

## Objective
Remove session token from response body. Token should only be in HTTP-only cookie.

## Scope

### Included
- Auth router signup response
- Auth router signin response
- Any other endpoint exposing token

### Out of Scope
- Auth middleware changes
- Cookie configuration changes

## Files Likely Affected

- `apps/api/app/routers/auth.py`

## Acceptance Criteria

- [ ] signup response doesn't include token
- [ ] signin response doesn't include token
- [ ] Existing tests still pass
- [ ] Cookie still set correctly

## Execution Plan

1. Identify all responses with token field
2. Remove token from response schemas
3. Verify cookie is still set
4. Run tests

## Status

- [ ] Not Started

## Notes

Priority P0 - security issue.
```

---

## Task Management Locations

| Document | Purpose |
|----------|---------|
| `docs/tasks/current-task.md` | What to work on now |
| `docs/tasks/next-tasks.md` | Prioritized upcoming tasks |
| `docs/tasks/task-history.md` | Completed task log |
| `docs/features/backlog.md` | Future feature ideas |

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-01