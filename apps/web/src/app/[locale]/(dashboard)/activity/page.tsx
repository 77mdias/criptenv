"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { Activity, Download, Filter } from "lucide-react"
import { usePathname, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditEntry } from "@/components/shared/audit-entry"
import { EmptyState } from "@/components/shared/empty-state"
import { meApi, peekCached } from "@/lib/api"
import type { AuditLog, OverviewResponse } from "@/lib/api"
import {
  ACTIVITY_ORIGINS,
  ACTIVITY_PERIODS,
  activityQuery,
  groupByDay,
  readActivityFilters,
  type ActivityFilters,
} from "@/lib/audit/activity"
import { toAuditCsv } from "@/lib/audit/csv"

// API action identifiers: shown as-is, like the project audit page.
const ACTIONS = [
  "vault.pushed",
  "secret.rotated",
  "environment.created",
  "environment.updated",
  "member.added",
  "member.removed",
  "member.role_changed",
  "invite.created",
  "token.created",
  "token.revoked",
  "api_key.created",
  "api_key.revoked",
  "integration.created",
  "project.created",
  "project.updated",
]

const selectClass =
  "h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-primary)"

export default function ActivityPage() {
  const t = useTranslations("dashboard.activityPage")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = useMemo(() => readActivityFilters(new URLSearchParams(searchParams?.toString())), [searchParams])

  const [projects, setProjects] = useState(
    () => peekCached<OverviewResponse>("/api/v1/me/overview")?.projects ?? []
  )
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const projectNames = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])

  useEffect(() => {
    meApi
      .overview()
      .then((overview) => setProjects(overview.projects))
      .catch(() => undefined) // names fall back to the project id
  }, [])

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      // Only the newest request may write: an older one for other filters can answer last.
      const request = ++requestRef.current
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        const data = await meApi.audit(activityQuery(filters, nextPage))
        if (request !== requestRef.current) return
        setLogs((current) => (append ? [...current, ...data.logs] : data.logs))
        setTotal(data.total)
        setPage(data.page)
      } catch (err) {
        if (request === requestRef.current) setError(err instanceof Error ? err.message : t("loadError"))
      } finally {
        if (request === requestRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [filters, t]
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(1, false), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const originLabels = {
    session: t("origins.session"),
    ci_session: t("origins.ci_session"),
    api_key: t("origins.api_key"),
  }

  const setFilter = (key: keyof ActivityFilters, value: string) => {
    const params = new URLSearchParams(searchParams?.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const exportCsv = () => {
    const blob = new Blob([toAuditCsv(logs, projectNames)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "criptenv-activity.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  const filtered = Boolean(filters.project || filters.origin || filters.days || filters.action)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 font-mono text-sm text-(--text-tertiary)">{t("subtitle", { total })}</p>
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={logs.length === 0}>
          {t("exportCsv")}
        </Button>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
          <Filter className="h-3.5 w-3.5" />
          {t("filters.title")}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="block font-mono text-xs text-(--text-muted)">{t("filters.project")}</span>
            <select className={selectClass} value={filters.project} onChange={(e) => setFilter("project", e.target.value)}>
              <option value="">{t("filters.allProjects")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block font-mono text-xs text-(--text-muted)">{t("filters.origin")}</span>
            <select className={selectClass} value={filters.origin} onChange={(e) => setFilter("origin", e.target.value)}>
              <option value="">{t("filters.allOrigins")}</option>
              {ACTIVITY_ORIGINS.map((origin) => (
                <option key={origin} value={origin}>
                  {originLabels[origin]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block font-mono text-xs text-(--text-muted)">{t("filters.period")}</span>
            <select
              className={selectClass}
              value={filters.days ?? ""}
              onChange={(e) => setFilter("days", e.target.value)}
            >
              <option value="">{t("filters.allTime")}</option>
              {ACTIVITY_PERIODS.map((days) => (
                <option key={days} value={days}>
                  {t("filters.lastDays", { days })}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block font-mono text-xs text-(--text-muted)">{t("filters.action")}</span>
            <select className={selectClass} value={filters.action} onChange={(e) => setFilter("action", e.target.value)}>
              <option value="">{t("filters.allActions")}</option>
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-(--text-tertiary)">{t("retention")}</p>
      </Card>

      {error && (
        <Card className="border-red-500/50 p-4">
          <p role="alert" className="font-mono text-sm text-red-600">
            {error}
          </p>
        </Card>
      )}

      {loading ? (
        <Card className="space-y-4 p-6">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ))}
        </Card>
      ) : logs.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={Activity}
            title={filtered ? t("empty.filteredTitle") : t("empty.title")}
            description={filtered ? t("empty.filteredDescription") : t("empty.description")}
          />
        </Card>
      ) : (
        groupByDay(logs).map((group) => (
          <section key={group.day} aria-label={formatDay(group.day, locale)} className="space-y-2">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
              {formatDay(group.day, locale)}
            </h2>
            <Card className="divide-y divide-(--border) overflow-hidden p-0">
              {group.logs.map((log) => (
                <div key={log.id}>
                  <p className="px-4 pt-3 font-mono text-[11px] text-(--text-tertiary) md:px-6">
                    {projectNames.get(log.project_id) ?? log.project_id}
                  </p>
                  <AuditEntry log={log} />
                </div>
              ))}
            </Card>
          </section>
        ))
      )}

      {!loading && logs.length < total && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loadingMore} onClick={() => load(page + 1, true)}>
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  )
}

function formatDay(day: string, locale: string): string {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(year, month - 1, date).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
