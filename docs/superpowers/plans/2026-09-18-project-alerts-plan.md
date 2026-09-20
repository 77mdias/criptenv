# Project Alert Settings Implementation Plan

> **Historical execution snapshot:** This plan records the implementation sequence and is superseded by `docs/tasks/current-task.md` for current status. Tasks 1-7 are implemented locally. Release validation remains incomplete because the Alembic migration was not applied against a confirmed disposable database and Cypress alert assertions are blocked by the Resend `example.com` fixture. The unchecked boxes below are historical plan checkboxes, not a claim that the implementation is pending.

**Goal:** Deliver project-level expiration alert configuration and reliable owner/admin notifications through in-app, email and webhook channels.

**Architecture:** Store non-secret alert preferences in `projects.settings.alerts`, store the webhook URL as an encrypted server-side envelope, and expose a dedicated owner/admin alert-settings API. Add an `alert_deliveries` table as the idempotency and retry source of truth, then make the scheduler fan out one canonical, secret-free event to eligible owners/admins and the configured channels.

**Tech Stack:** FastAPI, Pydantic, async SQLAlchemy/Alembic, PostgreSQL JSONB, AES-256-GCM envelope encryption, APScheduler, Resend, httpx, React/Vinext, Zustand/API client, Jest and Cypress.

**Spec:** `docs/superpowers/specs/2026-09-18-project-alerts-design.md`

**Historical progress note:** The original pause occurred after Tasks 1 and 2. Subsequent work implemented Tasks 3-7 locally without a commit. See `docs/tasks/current-task.md` for the verified implementation scope, incomplete release gates and blockers.

---

## File Map

### Backend

- Create `apps/api/app/schemas/alert_settings.py` for typed settings, update and safe response models.
- Create `apps/api/app/models/alert_delivery.py` for delivery state, claim token, retry metadata and unique delivery identity.
- Create `apps/api/migrations/versions/20260918_0010_create_alert_deliveries.py` for the delivery table, indexes and notification delivery identity constraint.
- Create `apps/api/app/routers/alert_settings.py` for GET/PATCH/test-webhook endpoints.
- Create `apps/api/app/services/alert_settings_service.py` for settings merge, webhook envelope encryption/decryption, URL preview and validation.
- Create `apps/api/app/services/alert_delivery_service.py` for recipient resolution, delivery row creation/claiming, channel fan-out and retry state.
- Create `apps/api/app/services/alert_payload.py` for the shared `ExpirationAlert` payload builder/schema.
- Create `apps/api/app/services/email_alert_service.py` for async/offloaded expiration email delivery.
- Modify `apps/api/app/schemas/secret_expiration.py` to define the canonical serialized alert payload fields.
- Modify `apps/api/app/schemas/project.py` to omit `settings.alerts` from general project responses.
- Modify `apps/api/app/services/project_service.py` only if a settings merge helper is needed; preserve `settings.vault`.
- Modify `apps/api/app/routers/projects.py` only if response sanitization requires route-level coverage.
- Modify `apps/api/app/routers/__init__.py` and `apps/api/main.py` to register the new router.
- Modify `apps/api/app/jobs/expiration_check.py` to delegate to the delivery service and remove the webhook-only placeholder path.
- Modify `apps/api/app/services/rotation_service.py` and `apps/api/app/schemas/secret_expiration.py` so omitted `notify_days_before` is resolved from the project default and pending queries use each record's own lead time.
- Modify `apps/api/app/services/webhook_service.py` or add a dedicated safe transport helper for no-redirect, DNS-pinned, sanitized delivery with one attempt per delivery claim.
- Modify `apps/api/app/models/__init__.py` and any model export registration required by Alembic.
- Modify `apps/api/app/models/notification.py` to add nullable `delivery_id` with a unique constraint for alert-generated in-app notifications.

### Frontend

- Create `apps/web/src/lib/api/alert-settings.ts` for typed GET/PATCH/test-webhook calls.
- Create `apps/web/src/components/shared/project-alert-settings.tsx` for the responsive settings card.
- Modify `apps/web/src/app/(dashboard)/projects/[id]/settings/page.tsx` to render the card in the existing owner/admin settings flow.
- Add component tests under `apps/web/src/components/shared/__tests__/project-alert-settings.test.tsx`.
- Add or extend Cypress coverage under `apps/web/cypress/e2e/` for owner/admin permissions and 320/375/390/430px layouts.

### Documentation

- Update `docs/project/decisions.md` with the accepted alert-settings/delivery decision.
- Update `docs/development/CHANGELOG.md` under `[Unreleased]`.
- Update `docs/project/current-state.md`, `docs/features/implemented.md` and `docs/features/in-progress.md` after implementation is verified.
- Update the web/API docs pages if endpoint examples or alert behavior are exposed to users.

---

## Task 1: Establish Typed Alert Settings and Safe Project Serialization

**Files:**
- Create: `apps/api/app/schemas/alert_settings.py`
- Create: `apps/api/app/services/alert_settings_service.py`
- Modify: `apps/api/app/schemas/project.py`
- Test: `apps/api/tests/test_alert_settings_service.py`
- Test: `apps/api/tests/test_project_response.py` or the existing project schema test file

- [ ] **Step 1: Write failing schema tests**
  - Cover channel object requiring `in_app`, `email`, `webhook` booleans.
  - Cover lead time range 1–365.
  - Cover PATCH omission versus explicit `webhook_url: null`.
  - Assert explicit `null` for `enabled`, `default_notify_days_before` and `channels` is rejected.

- [ ] **Step 2: Run focused tests and confirm the expected failure**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_alert_settings_service.py -q`

  Expected: FAIL because the alert settings schemas/service do not exist.

- [ ] **Step 3: Implement typed settings and merge behavior**
  - Define default settings: enabled, in-app on, email/webhook off, default lead time 7.
  - Merge only the `alerts` key and preserve all unrelated settings, especially `vault`.
  - Store the webhook URL in the existing `IntegrationConfigEncryption` envelope using `INTEGRATION_CONFIG_SECRET`.
  - Derive a safe URL preview from scheme/host and a masked path; never return the envelope.
  - Reject missing encryption secret or decryption failures with a safe configuration error.

- [ ] **Step 4: Sanitize general project responses**
  - Update `ProjectResponse.from_project()` to remove both `settings.vault` and `settings.alerts` from the general response.
  - Ensure API-key and session project reads cannot expose alert envelopes.

- [ ] **Step 5: Run focused tests and confirm green**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_alert_settings_service.py tests/test_project_response.py -q`

  Expected: PASS.

- [ ] **Step 6: Commit checkpoint**

  Suggested commit: `feat(api): add typed project alert settings`

## Task 2: Add Alert Settings API and Audit Coverage

**Files:**
- Create: `apps/api/app/routers/alert_settings.py`
- Modify: `apps/api/app/routers/__init__.py`
- Modify: `apps/api/main.py`
- Test: `apps/api/tests/test_alert_settings_routes.py`

- [ ] **Step 1: Write failing route tests**
  - Owner/admin can GET safe settings.
  - Developer/viewer receives the same permission denial used by project settings.
  - PATCH merges known fields and preserves vault settings.
  - Explicit `webhook_url: null` removes the webhook.
  - Invalid URL/private target/invalid lead time returns 422.
  - General project response does not contain `alerts` or the webhook envelope.
  - Test webhook uses stored configuration only, returns sanitized status, and does not modify expiration state.
  - Audit metadata excludes URL, query tokens and credentials.

- [ ] **Step 2: Run route tests to verify red**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_alert_settings_routes.py -q`

  Expected: FAIL because the router is not registered.

- [ ] **Step 3: Implement the dedicated router**
  - Use `get_current_user`, `ProjectService.check_user_access(..., "admin")` and the existing owner/admin semantics.
  - Register GET, PATCH and test-webhook routes under `/api/v1/projects/{project_id}/alert-settings`.
  - Make test delivery use the canonical payload with `test: true` and `payload_version: 1`.
  - Sanitize all errors before returning them.

- [ ] **Step 4: Register the router, persist audit events and validate OpenAPI paths**
  - Call `AuditService.log()` with `project.alert_settings_updated` and `resource_type="project"`.
  - Assert persisted audit metadata contains only changed non-secret fields and never the webhook URL/envelope.

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_alert_settings_routes.py tests/test_openapi_docs.py -q`

  Expected: PASS with the three new endpoints present.

- [ ] **Step 5: Commit checkpoint**

  Suggested commit: `feat(api): expose project alert settings endpoints`

## Task 3: Add Delivery Persistence and Idempotent Claiming

**Files:**
- Create: `apps/api/app/models/alert_delivery.py`
- Create: `apps/api/migrations/versions/20260918_0010_create_alert_deliveries.py`
- Modify: `apps/api/app/models/__init__.py`
- Create: `apps/api/app/services/alert_delivery_service.py`
- Modify: `apps/api/app/models/notification.py`
- Test: `apps/api/tests/test_alert_delivery_service.py`
- Test: `apps/api/tests/test_alert_delivery_model.py`

- [ ] **Step 1: Write failing model/service tests**
  - Unique `(expiration_id, event, channel, recipient_key)` prevents duplicate rows.
  - Claim increments attempts atomically and creates a random claim token/15-minute lease.
  - Pending, retryable failed and expired processing rows claim only when `attempts < 3`.
  - A row at attempt 3 becomes terminal failed and cannot be reclaimed.
  - State updates with an old claim token affect zero rows.
  - In-app delivery metadata/delivery ID is unique.

- [ ] **Step 2: Run focused tests to verify red**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_alert_delivery_service.py tests/test_alert_delivery_model.py -q`

  Expected: FAIL because the model, migration and service do not exist.

- [ ] **Step 3: Implement the model and migration**
  - Use UUID primary key, project/expiration foreign keys, channel/event/recipient identity, status, attempts, retry/lease timestamps, claim token and sanitized error.
  - Add indexes for claim queries and a unique constraint for delivery identity.
  - Set migration `down_revision` to the current Alembic head discovered before implementation.

- [ ] **Step 4: Implement claim/finalize/retry transitions**
  - Use conditional SQL updates with claim token fencing.
  - Ensure failed rows with attempts below three receive `retry_after` and become claimable.
  - Ensure terminal failures have no retry timestamp.
  - Keep `last_notified_at` out of pending/claim decisions.
  - Create in-app notifications and mark the claimed delivery `delivered` in one transaction, using `Notification.delivery_id` as the unique delivery identity.

- [ ] **Step 5: Run tests and migration checks**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_alert_delivery_service.py tests/test_alert_delivery_model.py -q && .venv/bin/alembic -c alembic.ini heads && .venv/bin/alembic -c alembic.ini history`

  Expected: PASS; migration is visible and `alembic heads` reports exactly one head.

- [ ] **Step 6: Commit checkpoint**

  Suggested commit: `feat(api): add idempotent alert delivery records`

## Task 4: Implement Canonical Payload, Recipients and Channels

**Files:**
- Create: `apps/api/app/services/alert_payload.py`
- Create: `apps/api/app/services/email_alert_service.py`
- Modify: `apps/api/app/services/webhook_service.py`
- Modify: `apps/api/app/services/alert_delivery_service.py`
- Test: `apps/api/tests/test_alert_payload.py`
- Test: `apps/api/tests/test_alert_channels.py`

- [ ] **Step 1: Write failing channel tests**
  - Payload includes project/environment names, identifiers, action URL, `payload_version: 1` and `test` state.
  - Payload never includes secret values/ciphertext/crypto fields.
  - Recipient resolution includes the owner even when owner membership `accepted_at` is null.
  - Non-owner recipients require accepted owner/admin membership and are deduplicated.
  - Email only selects `email_verified` users.
  - In-app, email and webhook failures are isolated from one another.
  - Missing Resend configuration is a failed/disabled delivery, not a production success.

- [ ] **Step 2: Run channel tests to verify red**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_alert_payload.py tests/test_alert_channels.py -q`

  Expected: FAIL because the canonical builder and channel orchestration do not exist.

- [ ] **Step 3: Implement the canonical payload**
  - Modify `ExpirationAlert` and the shared builder to include project/environment names and identifiers, action URL, `payload_version: 1` and `test`.
  - Set `test=False` for scheduled alerts and `test=True` only for synthetic tests.
  - Include an action URL without secret material.

- [ ] **Step 4: Implement owner/admin recipient resolution**
  - Query `Project.owner_id` plus accepted owner/admin memberships.
  - Deduplicate by user UUID.
  - Apply `email_verified` only to email channel recipients.

- [ ] **Step 5: Implement email delivery**
  - Add an escaped HTML/plain-text expiration template.
  - Call synchronous Resend through `asyncio.to_thread` per attempt.
  - Treat missing production configuration, provider exceptions and non-success responses as failed delivery records.

- [ ] **Step 6: Harden webhook delivery**
  - Reject redirects and embedded credentials.
  - Resolve and validate IPs at delivery time, including IPv4-mapped IPv6 and reserved/private ranges.
  - Pin the request to the validated IP while preserving the original Host header.
  - Sanitize URL-bearing exception text.
  - Invoke `WebhookService` with one attempt per delivery claim so the shared three-attempt budget is not multiplied.
  - Add focused tests for redirects, DNS/private/mapped-IPv6 rejection, embedded credentials/unsupported ports, re-resolution on retries, Host preservation, `Idempotency-Key`, and sanitized errors.

- [ ] **Step 7: Run channel tests and commit**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_alert_payload.py tests/test_alert_channels.py -q`

  Expected: PASS.

  Suggested commit: `feat(api): add expiration alert channel delivery`

## Task 5: Integrate Scheduler and Per-Secret Defaults

**Files:**
- Modify: `apps/api/app/schemas/secret_expiration.py`
- Modify: `apps/api/app/routers/rotation.py`
- Modify: `apps/api/app/services/rotation_service.py`
- Modify: `apps/api/app/jobs/expiration_check.py`
- Test: `apps/api/tests/test_rotation_routes.py`
- Test: `apps/api/tests/test_expiration_check.py`
- Test: `apps/api/tests/test_alert_scheduler_concurrency.py`

- [ ] **Step 1: Write failing default and scheduler tests**
  - Omitted `notify_days_before` reads `settings.alerts.default_notify_days_before`.
  - Explicit `notify_days_before` remains unchanged.
  - Changing the project default does not rewrite existing expiration records.
  - Pending query uses each expiration's own lead time instead of one global seven-day cutoff.
  - Disabled/no-channel alert settings create no delivery rows and do not update `last_notified_at`.
  - Successful all-channel delivery updates compatibility metadata only after all intended deliveries succeed.
  - Two concurrent scheduler runs create one delivery row per event/channel/recipient, respect claim fencing, and update `last_notified_at` only after aggregate completion.

- [ ] **Step 2: Run focused tests to verify red**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_rotation_routes.py tests/test_expiration_check.py tests/test_alert_scheduler_concurrency.py -q`

  Expected: FAIL against the current hard-coded/default and webhook-only behavior.

- [ ] **Step 3: Make omission detectable and resolve defaults**
  - Change request schema default to `None` for detection.
  - Resolve the project default in the service/router only when the field was omitted.
  - Preserve explicit values.

- [ ] **Step 4: Replace webhook-only scheduler flow**
  - Load project alert settings and pending expirations.
  - Materialize intended deliveries with unique insert/on-conflict operations for each `(expiration,event,channel,recipient)`.
  - Claim rows with fencing tokens, dispatch channels and finalize each row conditionally.
  - Aggregate an event only after all enabled channel/recipient rows are delivered; materialize `secret.expiring` and `secret.expired` independently without duplicate rows under concurrent scheduler workers.
  - Use `alert_deliveries` rather than `last_notified_at` for pending decisions.

- [ ] **Step 5: Run focused and full API tests**

  Run: `cd apps/api && .venv/bin/python -m pytest tests/test_rotation_routes.py tests/test_expiration_check.py tests/test_alert_scheduler_concurrency.py -q` and `make api-test`

  Expected: focused tests and the full API suite pass.

- [ ] **Step 6: Commit checkpoint**

  Suggested commit: `feat(api): integrate expiration alert scheduler`

## Task 6: Build the Web Settings UI

**Files:**
- Create: `apps/web/src/lib/api/alert-settings.ts`
- Create: `apps/web/src/components/shared/project-alert-settings.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/[id]/settings/page.tsx`
- Test: `apps/web/src/components/shared/__tests__/project-alert-settings.test.tsx`
- Test: `apps/web/cypress/e2e/alerts.cy.ts` or the existing settings E2E spec

- [ ] **Step 1: Write failing component tests**
  - Renders current channel/default state.
  - Shows webhook URL input only when needed and never renders a saved full URL.
  - Sends typed PATCH payload and handles success/error/loading states.
  - Test webhook action is available only when configured.
  - Developers/viewers do not render the settings card.
  - Explicitly disabling all channels explains that no alerts will be delivered.

- [ ] **Step 2: Run focused web tests to verify red**

  Run: `cd apps/web && npm run test:unit -- --runInBand src/components/shared/__tests__/project-alert-settings.test.tsx`

  Expected: FAIL because the API client and component do not exist.

- [ ] **Step 3: Implement the typed API client**
  - Add GET/PATCH/test-webhook methods.
  - Represent `webhook_url` as write-only/nullable in request types and safe metadata in response types.

- [ ] **Step 4: Implement the responsive alert card**
  - Use existing Card/Button/Input/Switch primitives and dashboard tokens.
  - Keep owner/admin gating aligned with `canManageProject`.
  - Preserve mobile layout and avoid widening the existing project navigation.
  - Keep per-secret expiration timing explanation visible.

- [ ] **Step 5: Add viewport and interaction coverage**
  - Add Cypress checks at 320, 375, 390 and 430px.
  - Assert no horizontal document overflow from the new card.
  - Cover owner/admin save/test and developer/viewer denial.

- [ ] **Step 6: Run web tests and commit**

  Run: `cd apps/web && npm run test:unit -- --runInBand` and `npm run lint`

  Expected: all unit tests pass and lint has no new warnings/errors.

  Suggested commit: `feat(web): add project expiration alert settings`

## Task 7: Documentation and End-to-End Verification

**Files:**
- Modify: `docs/project/decisions.md`
- Modify: `docs/development/CHANGELOG.md`
- Modify: `docs/project/current-state.md`
- Modify: `docs/features/implemented.md`
- Modify: `docs/features/in-progress.md`
- Modify: `apps/web/src/app/(docs)/docs/api/rotation/page.tsx`
- Modify: `docs/technical/api.md`

- [ ] **Step 1: Document the accepted decision**
  - Record settings storage, encrypted webhook envelope, owner/admin recipients, delivery idempotency and at-least-once external semantics.

- [ ] **Step 2: Update user/API documentation**
  - Document alert settings endpoints, channels, payload version, test events, retry semantics and zero-knowledge limitations.
  - State that per-secret `notify_days_before` overrides the project default.

- [ ] **Step 3: Update project status/changelog**
  - Record web alert configuration as locally implemented, while keeping incomplete release validation explicit.
  - Record remaining infrastructure limitations such as the unapplied migration, Resend fixture and production webhook allowlisting.

- [ ] **Step 4: Run migrations and complete validation**

  Run each command from the repository root:

  ```bash
  make db-history
  (cd apps/api && .venv/bin/alembic -c alembic.ini heads && .venv/bin/alembic -c alembic.ini upgrade head)
  make api-test
  make cli-test
  (cd apps/web && npm run test:unit -- --runInBand && npm run lint && npm run check:vinext && npm run build && npm run test:e2e)
  git diff --check
  ```

  Expected: one Alembic head, API/CLI/web tests pass, Vinext check is compatible, build succeeds, and no whitespace errors exist.

- [ ] **Step 5: Manual Playwright verification**
  - Start with `make api-dev` and `make web-dev`.
  - Log in with the documented local Playwright user.
  - Open a project as owner, save each alert channel, test webhook, inspect masked state and verify no secret values appear in network/UI output.
  - Resize to 320/375/390/430px and verify no horizontal overflow.

- [ ] **Step 6: Final review checkpoint**
  - Review `git diff`, `git status`, test output and migration head.
  - Keep unrelated/generated tooling changes out of the feature diff.
