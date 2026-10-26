import type { OverviewResponse } from "@/lib/api"

export type AttentionSeverity = "high" | "medium" | "low"
export type AttentionKind = "expired" | "integration" | "expiring" | "credential" | "invite"

export interface AttentionItem {
  id: string
  projectId: string
  kind: AttentionKind
  severity: AttentionSeverity
  /** key under `dashboard.home.attention.items` */
  messageKey: string
  values: Record<string, string>
  href: string
  date: string | null
}

/** Flattens the overview attention lists into one list, most urgent first. */
export function buildAttentionItems(overview: OverviewResponse): AttentionItem[] {
  const projectName = new Map(overview.projects.map((p) => [p.id, p.name]))
  const project = (id: string) => projectName.get(id) ?? ""
  const { expired, expiring, failing_integrations, stale_credentials, pending_invites } = overview.attention

  return [
    ...expired.map((e): AttentionItem => ({
      id: `expired:${e.environment_id}:${e.secret_key}`, projectId: e.project_id, kind: "expired", severity: "high",
      messageKey: "expired", href: `/projects/${e.project_id}/secrets?key=${encodeURIComponent(e.secret_key)}`,
      values: { key: e.secret_key, environment: e.environment_name, project: project(e.project_id) },
      date: e.expires_at,
    })),
    ...failing_integrations.map((i): AttentionItem => ({
      id: `integration:${i.id}`, projectId: i.project_id, kind: "integration", severity: "high",
      messageKey: "integration", href: "/integrations",
      values: { name: i.name, provider: i.provider, project: project(i.project_id) },
      date: null,
    })),
    ...expiring.map((e): AttentionItem => ({
      id: `expiring:${e.environment_id}:${e.secret_key}`, projectId: e.project_id, kind: "expiring", severity: "medium",
      messageKey: "expiring", href: `/projects/${e.project_id}/secrets?key=${encodeURIComponent(e.secret_key)}`,
      values: { key: e.secret_key, environment: e.environment_name, project: project(e.project_id) },
      date: e.expires_at,
    })),
    ...stale_credentials.map((c): AttentionItem => ({
      id: `credential:${c.id}`, projectId: c.project_id, kind: "credential", severity: "medium",
      messageKey: `credential_${c.reason}`, href: `/projects/${c.project_id}/settings`,
      values: { name: c.name, project: project(c.project_id) },
      date: c.last_used_at,
    })),
    ...pending_invites.map((i): AttentionItem => ({
      id: `invite:${i.id}`, projectId: i.project_id, kind: "invite", severity: "low",
      messageKey: "invite", href: `/projects/${i.project_id}/members`,
      values: { email: i.email, role: i.role, project: project(i.project_id) },
      date: i.expires_at,
    })),
  ]
}
