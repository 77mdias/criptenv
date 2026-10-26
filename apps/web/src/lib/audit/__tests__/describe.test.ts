import en from "../../../../messages/en/audit.json"
import es from "../../../../messages/es/audit.json"
import ptBR from "../../../../messages/pt-BR/audit.json"
import type { AuditLog } from "@/lib/api"
import {
  AUDIT_ACTIONS,
  auditActorKind,
  auditMessageKey,
  auditMessageValues,
} from "../describe"

// Every action the API emits (grep -rhoE 'action=f?"[a-z_.{}]+"' apps/api/app)
const API_ACTIONS = [
  "alert_settings.test_webhook", "api_key.created", "api_key.revoked", "api_key.updated",
  "avatar.deleted", "avatar.updated", "environment.archived", "environment.created",
  "environment.updated", "expiration.deleted", "expiration.set", "integration.created",
  "integration.deleted", "integration.synced.push", "integration.synced.pull",
  "invite.accepted", "invite.created", "invite.deleted", "invite.revoked", "member.added",
  "member.removed", "member.role_changed", "project.alert_settings_updated", "project.created",
  "project.deleted", "project.updated", "project.vault_rekeyed", "secret.rotated",
  "token.created", "token.deleted", "token.revoked", "vault.pushed",
]

function log(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "log_1",
    project_id: "prj_1",
    user_id: "usr_1",
    action: "project.created",
    resource_type: "project",
    resource_id: null,
    meta: {},
    created_at: "2026-10-26T12:00:00Z",
    actor: { id: "usr_1", name: "Ana", email: "ana@example.com", avatar_url: null },
    auth_type: "session",
    ...overrides,
  }
}

describe("auditMessageKey", () => {
  it("maps every API action to a dedicated message", () => {
    for (const action of API_ACTIONS) {
      expect(auditMessageKey(action)).not.toBe("unknown")
    }
  })

  it("collapses integration sync directions and falls back for unknown actions", () => {
    expect(auditMessageKey("integration.synced.push")).toBe("integration_synced")
    expect(auditMessageKey("something.new")).toBe("unknown")
  })
})

describe("translations", () => {
  const keys = [...new Set(API_ACTIONS.map(auditMessageKey)), "unknown"]

  it.each([["pt-BR", ptBR], ["en", en], ["es", es]])("%s has every action and actor", (_locale, messages) => {
    const catalog = messages as { actions: Record<string, string>; actors: Record<string, string> }
    for (const key of keys) expect(catalog.actions[key]).toBeTruthy()
    for (const actor of ["you", "user", "ci", "api", "system"]) expect(catalog.actors[actor]).toBeTruthy()
  })

  it("has an icon config for every mapped action", () => {
    for (const key of keys.filter((k) => k !== "unknown")) expect(AUDIT_ACTIONS[key]).toBeDefined()
  })
})

describe("auditActorKind", () => {
  it("distinguishes you, other users, CI, API keys and system", () => {
    expect(auditActorKind(log(), "usr_1")).toBe("you")
    expect(auditActorKind(log(), "usr_2")).toBe("user")
    expect(auditActorKind(log({ user_id: null, actor: null, auth_type: "ci_session" }), "usr_1")).toBe("ci")
    expect(auditActorKind(log({ auth_type: "api_key" }), "usr_2")).toBe("api")
    expect(auditActorKind(log({ user_id: null, actor: null }), "usr_1")).toBe("system")
  })
})

describe("auditMessageValues", () => {
  it("extracts the details each message needs, with safe defaults", () => {
    expect(auditMessageValues(log({ action: "vault.pushed", meta: { blob_count: 3 } }))).toMatchObject({ count: 3 })
    expect(auditMessageValues(log({ action: "secret.rotated", meta: { secret_key: "API_KEY" } }))).toMatchObject({ key: "API_KEY" })
    expect(auditMessageValues(log({ action: "invite.created", meta: { email: "bo@x.com", role: "viewer" } })))
      .toMatchObject({ email: "bo@x.com", role: "viewer" })
    expect(auditMessageValues(log({ action: "integration.synced.pull" }))).toMatchObject({ direction: "pull" })
    // Missing metadata never leaves an ICU placeholder unfilled
    expect(auditMessageValues(log({ action: "vault.pushed", meta: null }))).toMatchObject({ count: 0, key: "", name: "" })
  })
})
