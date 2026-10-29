import type { OverviewResponse } from "@/lib/api"
import { buildAttentionItems } from "../attention"
import { onboardingSteps } from "../onboarding"

function overview(overrides: Partial<OverviewResponse["attention"]> = {}, totals = { projects: 1, secrets: 2, members: 1 }): OverviewResponse {
  return {
    projects: [{
      id: "p1", name: "api", slug: "api", role: "owner", member_count: totals.members,
      last_activity_at: null, environments: [],
    }],
    attention: {
      expired: [], expiring: [], pending_invites: [], stale_credentials: [], failing_integrations: [],
      ...overrides,
    },
    totals,
  }
}

const exp = (key: string) => ({
  project_id: "p1", environment_id: "e1", environment_name: "production", secret_key: key,
  expires_at: "2026-10-30T00:00:00Z",
})

describe("buildAttentionItems", () => {
  it("orders by severity and links each item to its fix", () => {
    const items = buildAttentionItems(overview({
      pending_invites: [{ project_id: "p1", id: "i1", email: "bo@x.com", role: "viewer", expires_at: "2026-11-01T00:00:00Z" }],
      stale_credentials: [{ project_id: "p1", id: "c1", kind: "ci_token", name: "deploy", reason: "no_expiry", last_used_at: null, expires_at: null }],
      expiring: [exp("DB_URL")],
      failing_integrations: [{ project_id: "p1", id: "g1", provider: "vercel", name: "vercel-prod", last_error: "401" }],
      expired: [exp("API_KEY")],
    }))

    expect(items.map((i) => i.kind)).toEqual(["expired", "integration", "expiring", "credential", "invite"])
    expect(items.map((i) => i.severity)).toEqual(["high", "high", "medium", "medium", "low"])
    expect(items[0]).toMatchObject({
      href: "/projects/p1/secrets?key=API_KEY&env=e1",
      values: { key: "API_KEY", environment: "production", project: "api" },
    })
    expect(items[1].href).toBe("/integrations")
    expect(items[3]).toMatchObject({ href: "/projects/p1/settings", messageKey: "credential_no_expiry" })
    expect(items[4].href).toBe("/projects/p1/members")
  })

  it("is empty when nothing needs attention", () => {
    expect(buildAttentionItems(overview())).toEqual([])
  })
})

describe("onboardingSteps", () => {
  it("derives progress from the overview and the CLI flag", () => {
    const fresh = onboardingSteps(overview({}, { projects: 0, secrets: 0, members: 0 }), false)
    expect(fresh.map((s) => [s.id, s.done])).toEqual([
      ["createProject", false], ["addSecret", false], ["installCli", false], ["inviteTeammate", false],
    ])

    const busy = onboardingSteps(overview({}, { projects: 1, secrets: 3, members: 2 }), true)
    expect(busy.every((s) => s.done)).toBe(true)
  })

  it("counts a teammate only when a project has more than one member", () => {
    const solo = onboardingSteps(overview({}, { projects: 1, secrets: 1, members: 1 }), true)
    expect(solo.find((s) => s.id === "inviteTeammate")?.done).toBe(false)
  })
})
