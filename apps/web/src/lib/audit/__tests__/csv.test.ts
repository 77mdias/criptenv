import { toAuditCsv } from "../csv"
import type { AuditLog } from "@/lib/api"

const log = (overrides: Partial<AuditLog>): AuditLog => ({
  id: "1",
  project_id: "p1",
  user_id: "u1",
  action: "vault.pushed",
  resource_type: "vault",
  resource_id: "e1",
  created_at: "2026-11-11T10:00:00Z",
  ...overrides,
})

describe("toAuditCsv", () => {
  it("writes a header and one quoted row per event, with project name, origin and actor", () => {
    const csv = toAuditCsv(
      [
        log({ actor: { id: "u1", name: "Ana", email: "ana@x.com", avatar_url: null } }),
        log({ id: "2", user_id: null, auth_type: "ci_session", action: "secret.rotated", resource_id: null }),
      ],
      new Map([["p1", "api"]]),
    )
    expect(csv.split("\n")).toEqual([
      "timestamp,project,action,origin,actor,resource_type,resource_id",
      '"2026-11-11T10:00:00Z","api","vault.pushed","session","Ana","vault","e1"',
      '"2026-11-11T10:00:00Z","api","secret.rotated","ci_session","","vault",""',
    ])
  })

  it("escapes quotes and keeps a project name from running as a spreadsheet formula", () => {
    const csv = toAuditCsv([log({})], new Map([["p1", '=HYPERLINK("x")']]))
    expect(csv.split("\n")[1]).toContain('"\'=HYPERLINK(""x"")"')
  })

  it("also neutralises a leading tab or carriage return (OWASP CSV injection list)", () => {
    const row = (name: string) => toAuditCsv([log({})], new Map([["p1", name]])).split("\n")[1]
    expect(row("\t=1+1")).toContain('"\'\t=1+1"')
    expect(row("\r=1+1")).toContain('"\'\r=1+1"')
  })

  it("falls back to the project id when the name is unknown", () => {
    expect(toAuditCsv([log({ project_id: "p9" })], new Map()).split("\n")[1]).toContain('"p9"')
  })
})
