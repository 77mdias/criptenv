import { evaluatePosture } from "../posture"
import type { Credential, OverviewProject, OverviewResponse } from "@/lib/api/me"

const project = (overrides: Partial<OverviewProject> = {}): OverviewProject => ({
  id: "p1",
  name: "api",
  slug: "api",
  role: "owner",
  member_count: 1,
  manager_count: 1,
  last_activity_at: null,
  environments: [
    { id: "e1", name: "production", is_default: true, secret_count: 3, stale_secret_count: 0, version: 1, updated_at: null },
  ],
  ...overrides,
})

const overview = (overrides: Partial<OverviewResponse["attention"]> = {}, projects = [project()]): OverviewResponse => ({
  projects,
  attention: {
    expired: [],
    expiring: [],
    pending_invites: [],
    stale_credentials: [],
    failing_integrations: [],
    ...overrides,
  },
  totals: { projects: projects.length, secrets: 3, members: 1 },
})

const credential = (overrides: Partial<Credential>): Credential => ({
  kind: "ci_token",
  id: "c1",
  project_id: "p1",
  project_name: "api",
  name: "deploy",
  scopes: [],
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

const clean = { overview: overview(), credentials: [], twoFactorEnabled: true }

function rules(input: Parameters<typeof evaluatePosture>[0]) {
  return evaluatePosture(input).findings.map((f) => [f.rule, f.severity, f.count])
}

describe("evaluatePosture", () => {
  it("gives 100 and no findings when everything is in order", () => {
    expect(evaluatePosture(clean)).toEqual({ score: 100, findings: [] })
  })

  it("flags 2FA off as high, pointing to the account", () => {
    const { findings, score } = evaluatePosture({ ...clean, twoFactorEnabled: false })
    expect(findings).toEqual([expect.objectContaining({ rule: "twoFactor", severity: "high", count: 1, href: "/account" })])
    expect(score).toBe(70)
  })

  it("flags working credentials with no expiry and unused ones as medium, pointing to /access", () => {
    const credentials = [
      credential({ no_expiry: true }),
      credential({ id: "c2", no_expiry: true, unused: true }),
      credential({ id: "c3", status: "revoked" }),
    ]
    expect(rules({ ...clean, credentials })).toEqual([
      ["credentialNoExpiry", "medium", 2],
      ["credentialUnused", "medium", 1],
    ])
    expect(evaluatePosture({ ...clean, credentials }).findings[0].href).toBe("/access")
  })

  it("counts secrets of environments with no push for 90 days, per project and environment", () => {
    const stale = project({
      environments: [
        { id: "e1", name: "production", is_default: true, secret_count: 3, stale_secret_count: 3, version: 1, updated_at: null },
        { id: "e2", name: "staging", is_default: false, secret_count: 2, stale_secret_count: 0, version: 1, updated_at: null },
      ],
    })
    const { findings } = evaluatePosture({ ...clean, overview: overview({}, [stale]) })
    expect(findings).toEqual([
      expect.objectContaining({
        rule: "notRotated",
        severity: "medium",
        count: 3,
        items: [{ label: "api · production", href: "/projects/p1/secrets?env=e1" }],
      }),
    ])
  })

  it("flags expired secrets as high with a link to each one", () => {
    const expired = [{ project_id: "p1", environment_id: "e1", environment_name: "production", secret_key: "API_KEY", expires_at: "" }]
    const { findings } = evaluatePosture({ ...clean, overview: overview({ expired }) })
    expect(findings[0]).toEqual(
      expect.objectContaining({
        rule: "expiredSecret",
        severity: "high",
        items: [{ label: "api · production · API_KEY", href: "/projects/p1/secrets?key=API_KEY&env=e1" }],
      }),
    )
  })

  it("flags more than two owners/admins in a project as low", () => {
    expect(rules({ ...clean, overview: overview({}, [project({ manager_count: 3 })]) })).toEqual([
      ["tooManyManagers", "low", 1],
    ])
    expect(rules({ ...clean, overview: overview({}, [project({ manager_count: 2 })]) })).toEqual([])
  })

  it("flags failing integrations as low", () => {
    const failing = [{ project_id: "p1", id: "i1", provider: "vercel", name: "web", last_error: null }]
    const { findings } = evaluatePosture({ ...clean, overview: overview({ failing_integrations: failing }) })
    expect(findings).toEqual([expect.objectContaining({ rule: "failingIntegration", severity: "low", count: 1, href: "/integrations" })])
  })

  it("orders findings by severity, weighs each rule once and never goes below 0", () => {
    const expired = [{ project_id: "p1", environment_id: "e1", environment_name: "production", secret_key: "A", expires_at: "" }]
    const failing = [{ project_id: "p1", id: "i1", provider: "vercel", name: "web", last_error: null }]
    const credentials = [credential({ no_expiry: true, unused: true }), credential({ id: "c2", no_expiry: true })]
    const result = evaluatePosture({
      twoFactorEnabled: false,
      credentials,
      overview: overview({ expired, failing_integrations: failing }, [
        project({
          manager_count: 4,
          environments: [
            { id: "e1", name: "production", is_default: true, secret_count: 1, stale_secret_count: 1, version: 1, updated_at: null },
          ],
        }),
      ]),
    })
    expect(result.findings.map((f) => f.severity)).toEqual(["high", "high", "medium", "medium", "medium", "low", "low"])
    // 30 + 30 + 15 + 15 + 15 + 5 + 5 = 115, two credentials with no expiry still count once
    expect(result.score).toBe(0)
  })
})
