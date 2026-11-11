import { activityQuery, groupByDay, readActivityFilters } from "../activity"
import type { AuditLog } from "@/lib/api"

const log = (id: string, created_at: string): AuditLog => ({
  id,
  project_id: "p1",
  user_id: null,
  action: "vault.pushed",
  resource_type: "vault",
  resource_id: null,
  created_at,
})

describe("readActivityFilters", () => {
  it("reads known values and ignores anything else", () => {
    const params = new URLSearchParams("project=p1&origin=ci_session&days=30&action=vault.pushed")
    expect(readActivityFilters(params)).toEqual({
      project: "p1", origin: "ci_session", days: 30, action: "vault.pushed",
    })
    expect(readActivityFilters(new URLSearchParams("origin=root&days=5"))).toEqual({
      project: "", origin: "", days: null, action: "",
    })
  })
})

describe("activityQuery", () => {
  it("turns the filters into API params, the period into `from`", () => {
    const now = new Date("2026-11-11T12:00:00Z")
    expect(activityQuery({ project: "p1", origin: "session", days: 7, action: "" }, 2, now)).toEqual({
      page: 2,
      per_page: 50,
      project_id: "p1",
      auth_type: "session",
      from: "2026-11-04T12:00:00.000Z",
    })
    expect(activityQuery({ project: "", origin: "", days: null, action: "" }, 1, now)).toEqual({
      page: 1,
      per_page: 50,
    })
  })
})

describe("groupByDay", () => {
  it("groups consecutive events by their local day, keeping the order", () => {
    const groups = groupByDay([
      log("a", "2026-11-11T15:00:00"),
      log("b", "2026-11-11T09:00:00"),
      log("c", "2026-11-10T22:00:00"),
    ])
    expect(groups.map((g) => [g.day, g.logs.map((l) => l.id)])).toEqual([
      ["2026-11-11", ["a", "b"]],
      ["2026-11-10", ["c"]],
    ])
  })
})
