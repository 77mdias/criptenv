import type { AuditLog } from "@/lib/api"
import type { AuditOrigin, MyAuditQuery } from "@/lib/api/me"

export const ACTIVITY_ORIGINS = ["session", "ci_session", "api_key"] as const
export const ACTIVITY_PERIODS = [7, 30, 90] as const
export const ACTIVITY_PAGE_SIZE = 50

export interface ActivityFilters {
  project: string
  origin: AuditOrigin | ""
  /** null = the whole history the plan keeps */
  days: (typeof ACTIVITY_PERIODS)[number] | null
  action: string
}

/** Filters from the page URL (so a filtered view can be shared); unknown values are dropped. */
export function readActivityFilters(params: URLSearchParams): ActivityFilters {
  const origin = params.get("origin") ?? ""
  const days = Number(params.get("days"))
  return {
    project: params.get("project") ?? "",
    origin: (ACTIVITY_ORIGINS as readonly string[]).includes(origin) ? (origin as AuditOrigin) : "",
    days: (ACTIVITY_PERIODS as readonly number[]).includes(days) ? (days as ActivityFilters["days"]) : null,
    action: params.get("action") ?? "",
  }
}

export function activityQuery(filters: ActivityFilters, page: number, now = new Date()): MyAuditQuery {
  const query: MyAuditQuery = { page, per_page: ACTIVITY_PAGE_SIZE }
  if (filters.project) query.project_id = filters.project
  if (filters.origin) query.auth_type = filters.origin
  if (filters.action) query.action = filters.action
  if (filters.days) query.from = new Date(now.getTime() - filters.days * 86_400_000).toISOString()
  return query
}

function localDay(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Events (newest first) split by the viewer's local day. */
export function groupByDay(logs: AuditLog[]): { day: string; logs: AuditLog[] }[] {
  const groups: { day: string; logs: AuditLog[] }[] = []
  for (const log of logs) {
    const day = localDay(log.created_at)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.logs.push(log)
    else groups.push({ day, logs: [log] })
  }
  return groups
}
