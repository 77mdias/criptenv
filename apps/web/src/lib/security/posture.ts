import type { Credential, OverviewResponse } from "@/lib/api/me"

export type Severity = "high" | "medium" | "low"

export type PostureRule =
  | "twoFactor"
  | "expiredSecret"
  | "credentialNoExpiry"
  | "credentialUnused"
  | "notRotated"
  | "tooManyManagers"
  | "failingIntegration"

/** Points taken off the score, once per rule that fails, whatever its count. */
export const SEVERITY_WEIGHT: Record<Severity, number> = { high: 30, medium: 15, low: 5 }

const RULE_SEVERITY: Record<PostureRule, Severity> = {
  twoFactor: "high",
  expiredSecret: "high",
  credentialNoExpiry: "medium",
  credentialUnused: "medium",
  notRotated: "medium",
  tooManyManagers: "low",
  failingIntegration: "low",
}

export interface PostureItem {
  label: string
  href: string
}

export interface PostureFinding {
  rule: PostureRule
  severity: Severity
  count: number
  /** Where the fix happens. */
  href: string
  /** One entry per thing to fix, when they live in different places. */
  items?: PostureItem[]
}

export interface PostureInput {
  overview: OverviewResponse
  /** From GET /me/credentials: only projects the user manages. */
  credentials: Credential[]
  twoFactorEnabled: boolean
}

export function evaluatePosture({ overview, credentials, twoFactorEnabled }: PostureInput) {
  const names = new Map(overview.projects.map((p) => [p.id, p.name]))
  const findings: PostureFinding[] = []
  const add = (rule: PostureRule, count: number, href: string, items?: PostureItem[]) => {
    if (count > 0) findings.push({ rule, severity: RULE_SEVERITY[rule], count, href, ...(items ? { items } : {}) })
  }

  add("twoFactor", twoFactorEnabled ? 0 : 1, "/account")

  const expired = overview.attention.expired
  add(
    "expiredSecret",
    expired.length,
    "/dashboard",
    expired.map((e) => ({
      label: `${names.get(e.project_id) ?? e.project_id} · ${e.environment_name} · ${e.secret_key}`,
      href: `/projects/${e.project_id}/secrets?key=${encodeURIComponent(e.secret_key)}&env=${e.environment_id}`,
    }))
  )

  const working = credentials.filter((c) => c.status === "active")
  add("credentialNoExpiry", working.filter((c) => c.no_expiry).length, "/access")
  add("credentialUnused", working.filter((c) => c.unused).length, "/access")

  const staleEnvs = overview.projects.flatMap((p) =>
    p.environments.filter((e) => e.stale_secret_count > 0).map((e) => ({ project: p, env: e }))
  )
  add(
    "notRotated",
    staleEnvs.reduce((sum, { env }) => sum + env.stale_secret_count, 0),
    "/projects",
    staleEnvs.map(({ project, env }) => ({
      label: `${project.name} · ${env.name}`,
      href: `/projects/${project.id}/secrets?env=${env.id}`,
    }))
  )

  const crowded = overview.projects.filter((p) => p.manager_count > 2)
  add(
    "tooManyManagers",
    crowded.length,
    "/projects",
    crowded.map((p) => ({ label: p.name, href: `/projects/${p.id}/members` }))
  )

  add("failingIntegration", overview.attention.failing_integrations.length, "/integrations")

  const order: Severity[] = ["high", "medium", "low"]
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
  const lost = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0)
  return { score: Math.max(0, 100 - lost), findings }
}
