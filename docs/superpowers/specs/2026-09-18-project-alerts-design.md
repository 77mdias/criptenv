# Project Alert Settings Design

**Date:** 2026-09-18
**Status:** Approved; implementation locally verified; release validation incomplete
**Scope:** Project-level web alert configuration and expiration notification delivery

Current tracking is maintained in `docs/tasks/current-task.md`. Acceptance-criteria
checkboxes below are retained as release traceability; an unchecked box does not mean
the corresponding implementation is absent. Local
API, unit and build checks passed; release validation remains incomplete because the
Alembic upgrade was not applied against a confirmed disposable database and Cypress
alert assertions are blocked by the Resend `example.com` fixture.

## Goal

Allow project owners and admins to configure expiration alerts from the web dashboard, with independent in-app, email and webhook channels, while preserving the zero-knowledge boundary and existing per-secret expiration controls.

## Context

The API already stores per-secret expiration records and exposes rotation/expiration endpoints. The dashboard already renders expiration badges and supports per-secret expiration policies. The notification bell and email service already exist, and the webhook service can deliver a payload without secret values.

At design time, the missing capability was project-level channel configuration and delivery orchestration. The then-current `ExpirationChecker._get_webhook_url()` placeholder returned `None`, so a future webhook setting would have required scheduler integration before the feature could be considered complete. The then-current `last_notified_at` field was not sufficient for three channels and multiple owner/admin recipients, so delivery idempotency needed its own record. These are historical design-time constraints; the approved settings, delivery table, scheduler integration and web UI are implemented locally, while release validation remains incomplete as stated above.

## User Stories

### US-1 — Configure channels

As a project owner or admin, I want to enable or disable in-app, email and webhook alerts so that expiration events reach the operational channels I choose.

### US-2 — Configure webhook delivery

As a project owner or admin, I want to add, validate, test and remove a webhook URL without exposing its value in API responses, logs or UI after save.

### US-3 — Receive actionable alerts

As a project owner or admin, I want to receive an alert when a project secret approaches expiration or expires, with the project, environment, secret key, expiration date and action link, but never the secret value or ciphertext.

### US-4 — Preserve per-secret control

As a project admin, I want the existing per-secret expiration and `notify_days_before` settings to remain authoritative, while the project setting supplies a default when a new expiration configuration omits that field.

### US-5 — Observe configuration changes

As a project owner or admin, I want alert configuration changes to appear in the project audit log.

## Chosen Architecture

Persist alert preferences in the existing `projects.settings` JSONB object. Add a dedicated alert-settings API rather than overloading the general project update endpoint. This keeps preferences small, validates the nested shape centrally, and leaves member/environment targeting out of the MVP. Add a separate delivery table only for channel/recipient idempotency; it is not the settings store.

### Project settings shape

```json
{
  "alerts": {
    "enabled": true,
    "default_notify_days_before": 7,
    "channels": {
      "in_app": true,
      "email": false,
      "webhook": false
    },
    "webhook": null
  }
}
```

When configured, `webhook` is a single encrypted envelope containing the webhook URL. No signing secret is supported in this MVP. The API response must replace the envelope with safe metadata such as `webhook_configured: true` and `webhook_url_preview`, or omit the credential fields entirely.

The vault settings remain reserved under `settings.vault` and must never be overwritten when alert settings are updated.

## API Contract

### `GET /api/v1/projects/{project_id}/alert-settings`

- Authentication: human session only.
- Authorization: project `owner` or `admin`.
- Returns channel state, enabled state, default lead time, whether a webhook is configured, and a safe URL preview.
- Never returns the webhook credential in full.
- Never includes `settings.alerts` in the general `ProjectResponse`, including API-key responses.

Example response:

```json
{
  "enabled": true,
  "default_notify_days_before": 7,
  "channels": {
    "in_app": true,
    "email": false,
    "webhook": false
  },
  "webhook_configured": false,
  "webhook_url_preview": null
}
```

### `PATCH /api/v1/projects/{project_id}/alert-settings`

- Authentication: human session only.
- Authorization: project `owner` or `admin`.
- Validates `default_notify_days_before` between 1 and 365.
- Validates webhook URL when provided and requires an HTTPS URL in production; localhost HTTP may be allowed in development/tests. Save-time validation rejects obvious private/reserved targets, and delivery-time validation repeats DNS/IP checks.
- Supports explicit removal of the webhook configuration.
- Preserves unrelated project settings and vault metadata.
- Writes an audit event without recording the URL or secret.
- Typed request semantics: omitted `enabled` and `default_notify_days_before` retain stored values; `channels` is replaced atomically when supplied; omitted `webhook_url` retains the stored envelope; explicit `webhook_url: null` removes it. Pydantic field-set detection distinguishes omission from null.

The request schema is:

```json
{
  "enabled": true,
  "default_notify_days_before": 7,
  "channels": {
    "in_app": true,
    "email": false,
    "webhook": false
  },
  "webhook_url": "https://alerts.example.test/criptenv"
}
```

All fields are optional. `channels`, when present, must contain all three booleans and replaces the complete channel object; `webhook_url` accepts a URL string or explicit `null`.

### `POST /api/v1/projects/{project_id}/alert-settings/test-webhook`

- Authentication: human session only.
- Authorization: project `owner` or `admin`.
- Sends a synthetic event with no secret value and a clearly marked test event.
- Uses only the stored webhook configuration; unsaved URLs are not sent by the API.
- Returns delivery status and sanitized error information.
- Must not update `last_notified_at` for any secret.

The synthetic payload includes `payload_version: 1` and `test: true`; scheduler-generated payloads always set `test: false`.

## Notification Semantics

### Recipients

Recipient lookup starts with the project owner (`Project.owner_id`) and accepted `ProjectMember` rows for the same project whose role is `owner` or `admin` and whose `user_id` is not already included. The owner is included even if the legacy owner membership has `accepted_at` unset. Non-owner memberships require `accepted_at IS NOT NULL`. Deduplicate by `user_id`. In-app notifications are created for the resulting owner/admin set; email delivery applies the additional `User.email_verified IS TRUE` predicate. Developers and viewers do not receive expiration alerts through this feature.

### Channels

- **In-app:** enabled by default; creates a user-scoped notification with type `secret_expiration`, a project secrets action URL, and metadata containing identifiers only.
- **Email:** disabled by default; targets users with `email_verified=true`, uses the existing Resend integration through `await asyncio.to_thread(...)` for each delivery attempt and a dedicated escaped expiration template. Each attempt updates its `alert_deliveries` row; delivery is best-effort and must not block webhook or in-app delivery.
- **Webhook:** disabled until configured; posts the documented expiration payload through the existing retrying `WebhookService`.

### Idempotency and failures

The scheduler must evaluate each pending expiration once per event (`secret.expiring` or `secret.expired`). `alert_deliveries` is the source of truth for pending work; `last_notified_at` must not suppress or create pending work and is updated only as compatibility metadata after the aggregate cycle succeeds. A notification cycle is successful only when every enabled channel completes successfully for all intended recipients, or when a channel has no eligible recipient. Failed deliveries must be logged with sanitized errors and remain eligible for retry. The implementation must avoid marking an expiration as notified merely because one channel succeeded.

Add an `alert_deliveries` table with one row per intended delivery. It should contain `expiration_id`, `project_id`, event, channel, recipient key, status (`pending`, `processing`, `delivered`, `failed`), attempts, `retry_after`, `locked_until`, `claim_token`, delivered timestamp, sanitized error, and timestamps. `recipient_key` contains only a user UUID for in-app/email or a stable project/webhook key; it never contains a URL, credential or secret value. Add a unique constraint over `(expiration_id, event, channel, recipient_key)`. `attempts` is the single shared budget for the delivery row, capped at three total channel sends. Claim work with an atomic conditional update from `pending`, retryable `failed` rows whose `retry_after <= now`, or expired `processing` rows **only when `attempts < 3`**, incrementing `attempts`, setting a fresh random `claim_token` and `locked_until` (15-minute lease). Apply the `attempts < 3` predicate to every reclaim path. If any row reaches attempt 3 without success, atomically transition it to terminal `failed` with no future `retry_after`; expired processing rows at the limit are terminalized rather than reclaimed. Every state update must include the claim token; a worker that loses its lease cannot update the row. The outer delivery manager owns exponential backoff and invokes `WebhookService` with `max_retries=1` per claim, so the existing service cannot multiply the shared budget. Email attempts use the same manager budget. A crashed process leaves an expired claim that can be retried while the attempt limit allows. External webhook/email delivery is at-least-once after crashes because no remote provider can guarantee an atomic send-and-database-commit; webhook requests include a stable `Idempotency-Key` derived from the delivery row. In-app delivery is transactionally idempotent: insert the notification and mark the claimed delivery `delivered` in the same database transaction, guarded by a unique `(delivery_id)` or equivalent notification metadata key; a rollback leaves the delivery claim retryable without a duplicate notification.

If alerts are globally disabled or no channel is active, the checker should return a non-delivery result and must not advance `last_notified_at` or create delivery rows.

### Payload safety

Payloads and emails may include:

- Project identifier/name.
- Environment identifier/name.
- Secret key identifier.
- Expiration timestamp.
- Days remaining.
- Link to the project secrets page.
- `payload_version: 1`.
- `test: true` only for synthetic webhook tests; normal scheduler events always send `test: false`.

Payloads and emails must never include plaintext, encrypted value, IV, auth tag, vault password, webhook URL, webhook secret or API credentials. Define one canonical `ExpirationAlert`/builder contract used by both scheduler and test delivery; extend it with `payload_version: 1` and `test: false|true` rather than maintaining separate payload shapes.

## Web UI

Add an **Alertas de expiração** card to the existing project Settings page, after API Keys and before general project information.

The card contains:

1. Global enable/disable switch.
2. Channel toggles for in-app, email and webhook.
3. Default lead-time select with 1, 3, 7, 14 and 30 days.
4. Webhook URL field shown when webhook is enabled/configured.
5. Save button with loading, success and sanitized error states.
6. Test webhook action when a webhook is configured.
7. Clear explanation that per-secret expiration settings remain managed from the Secrets page.

The section is not rendered for developers/viewers because the Settings route already enforces owner/admin access. Direct API access must enforce the same rule independently.

The layout must remain usable at 320px, 375px, 390px and 430px widths. It must not introduce additional horizontal overflow to the existing project navigation. The UI must use the established dashboard tokens and existing button/input/switch primitives. Add a Cypress viewport test for these widths; Jest covers state, permissions and API interactions.

When creating a new per-secret expiration, the API resolves an omitted `notify_days_before` from `settings.alerts.default_notify_days_before`; an explicitly supplied value always wins. Existing expiration records are not rewritten when the project default changes. The Pydantic request field must default to `None` so omission remains detectable, and the scheduler query must compare each record using its own `notify_days_before`.

## Data Flow

```text
Owner/admin opens Settings
        |
        v
GET alert-settings <---- project.settings.alerts (webhook envelope decrypted server-side)
        |
        v
PATCH alert-settings ----> validate + encrypt webhook + merge settings + audit
        |
        v
Scheduler -> pending SecretExpiration records
        |
        +-> owner/admin in-app notifications
        +-> verified owner/admin email via async Resend adapter
        +-> configured webhook via WebhookService
```

## Security and Privacy

- Reuse the existing `INTEGRATION_CONFIG_SECRET` envelope mechanism for the webhook URL, or extract a shared project-settings secret helper without duplicating cryptography. If the secret is absent or decryption fails, fail closed with a configuration error and do not send.
- Never log full URLs if they contain query-string tokens; previews should expose only scheme/host and a masked path. Sanitize `httpx` exception text before returning or logging it.
- Webhook delivery must disable redirects, resolve DNS at delivery time, reject loopback/private/link-local/multicast/reserved IPs including IPv4-mapped IPv6, reject embedded credentials and unsupported ports, and pin the HTTP connection to the validated IP while preserving the original Host header. Re-resolve and revalidate on retries; reject every redirect rather than following it. Localhost/private targets are allowed only in development/tests.
- Restrict settings reads/writes and test delivery to owner/admin roles.
- Escape user-controlled project and secret identifiers in HTML email templates.
- Keep email and webhook delivery server-side; no channel credential reaches the browser after save.
- Preserve the existing zero-knowledge guarantee: the alert system receives identifiers and expiration metadata, not secret material.

## Acceptance Criteria

- [ ] Owner/admin can load alert settings from project Settings.
- [ ] Developer/viewer cannot load or mutate alert settings.
- [ ] Settings persist without removing vault metadata or unrelated project settings.
- [ ] Webhook URL is encrypted at rest and never returned in full.
- [ ] Webhook test sends a synthetic, secret-free event and does not affect expiration state.
- [ ] Scheduler reads the stored configuration instead of the current placeholder and filters each expiration using its own `notify_days_before`.
- [ ] `last_notified_at` is compatibility metadata only and cannot suppress pending delivery work.
- [ ] Delivery claims use a fencing token and conditional updates so expired workers cannot overwrite a newer claim.
- [ ] In-app notifications reach every eligible owner/admin exactly once per event and recipient key, even after scheduler retries.
- [ ] Verified owner/admin recipients receive expiration email when enabled.
- [ ] Webhook delivery uses existing retry behavior and sanitized failure handling; no signing secret is part of this MVP.
- [ ] External email/webhook delivery is documented and tested as at-least-once across crash recovery; in-app persistence is idempotent.
- [ ] Disabled channels do not deliver; disabled alerts do not mark records notified.
- [ ] Omitted `notify_days_before` uses the project default; explicit values remain intact and changing the default does not rewrite existing records.
- [ ] The API distinguishes omitted and explicit `notify_days_before` values when creating an expiration.
- [ ] Explicit `null` for `enabled`, `default_notify_days_before` or `channels` is rejected; only `webhook_url: null` means remove the stored webhook.
- [ ] Scheduler and test-webhook use the same payload builder/schema with `test: false` and `test: true` respectively.
- [ ] Missing/disabled Resend configuration, provider exceptions and non-success responses produce failed delivery records with sanitized errors; development mock email responses cannot count as production delivery success.
- [ ] Settings changes create audit records without credentials.
- [ ] API, delivery-idempotency, scheduler, email, crypto and web UI tests cover success, permission, validation, failure and mobile layout cases.

## Out of Scope

- Slack-specific formatting or OAuth integration.
- Auto-rotation of secret values.
- Alert rules per individual member.
- Alert rules per environment.
- Changing the existing per-secret rotation modal beyond using the project default for new records.
- Notification delivery for developers/viewers.

## Open Implementation Questions

1. Whether email delivery should require `email_verified` or also allow verified OAuth identities; recommended: use the existing `email_verified` flag.
2. Whether to store a masked URL preview or derive it on each response; recommended: derive it, avoiding redundant persisted metadata.
3. Whether an alert delivery table should retain failure payloads; recommended: retain only sanitized error category/message, never provider response bodies that may echo URLs.
