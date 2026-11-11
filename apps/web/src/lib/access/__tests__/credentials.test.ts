import { filterCredentials, needsAttention } from "../credentials"
import type { Credential } from "@/lib/api/me"

const credential = (overrides: Partial<Credential>): Credential => ({
  kind: "ci_token",
  id: "c1",
  project_id: "p1",
  project_name: "api",
  name: "deploy",
  scopes: ["read:secrets"],
  environment_scope: null,
  last_used_at: null,
  expires_at: null,
  revoked_at: null,
  created_at: null,
  status: "active",
  no_expiry: false,
  unused: false,
  ...overrides,
})

const list = [
  credential({ id: "a" }),
  credential({ id: "b", kind: "api_key", project_id: "p2" }),
  credential({ id: "c", status: "revoked" }),
]

describe("filterCredentials", () => {
  it("returns everything with no filter", () => {
    expect(filterCredentials(list, { kind: "", status: "", project: "" }).map((c) => c.id)).toEqual(["a", "b", "c"])
  })

  it("filters by kind, status and project together", () => {
    expect(filterCredentials(list, { kind: "ci_token", status: "", project: "" }).map((c) => c.id)).toEqual(["a", "c"])
    expect(filterCredentials(list, { kind: "", status: "active", project: "p1" }).map((c) => c.id)).toEqual(["a"])
  })
})

describe("needsAttention", () => {
  it("flags a working credential with no expiry or no recent use", () => {
    expect(needsAttention(credential({ no_expiry: true }))).toBe(true)
    expect(needsAttention(credential({ unused: true }))).toBe(true)
    expect(needsAttention(credential({}))).toBe(false)
  })
})
