"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { FolderOpen, Key, Clock } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { peekCached, projectsApi, auditApi, environmentsApi, vaultApi } from "@/lib/api"
import { useAuditDescriber } from "@/lib/audit/describe"
import type { Project, AuditLog, ProjectListResponse } from "@/lib/api"

export default function DashboardPage() {
  const t = useTranslations("dashboard.home")
  const locale = useLocale()
  const describe = useAuditDescriber()
  const cachedProjects = peekCached<ProjectListResponse>("/api/v1/projects")
  const [projects, setProjects] = useState<Project[]>(cachedProjects?.projects ?? [])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [totalSecrets, setTotalSecrets] = useState(0)
  const [loading, setLoading] = useState(!cachedProjects)
  const [activityLoading, setActivityLoading] = useState(!cachedProjects)
  const [error, setError] = useState<string | null>(null)
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  )

  useEffect(() => {
    let cancelled = false

    async function fetchDashboardData() {
      try {
        const projectData = await projectsApi.list()
        if (cancelled) return
        setProjects(projectData.projects)

        const environmentResponses = await Promise.all(
          projectData.projects.map((project) => environmentsApi.list(project.id))
        )
        if (cancelled) return

        const vaultMetadata = await Promise.all(
          environmentResponses.flatMap((response) =>
            response.environments.map((environment) =>
              vaultApi.getVersion(environment.project_id, environment.id)
            )
          )
        )
        if (cancelled) return

        const secretsSum = vaultMetadata.reduce(
          (sum, metadata) => sum + metadata.blob_count,
          0
        )

        setTotalSecrets(secretsSum)
        setLoading(false)

        if (projectData.projects.length > 0) {
          setActivityLoading(true)
          // shortcut: fan-out over the first 10 projects; replaced by GET /me/overview in UX.2
          const logPages = await Promise.all(
            projectData.projects.slice(0, 10).map((project) =>
              auditApi.getLogs(project.id, { per_page: 5 })
            )
          )
          if (cancelled) return
          setAuditLogs(
            logPages
              .flatMap((page) => page.logs)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 8)
          )
        } else {
          setAuditLogs([])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("loadError"))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setActivityLoading(false)
        }
      }
    }

    void fetchDashboardData()

    return () => {
      cancelled = true
    }
  }, [t])

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-red-600 text-sm font-mono mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            {t("welcome")}
          </p>
        </div>
        <StatusBadge status="synced" label={t("synced")} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <>
            <Card>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-8" />
                </div>
              </div>
              <Skeleton className="mt-2 h-3 w-24" />
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-8" />
                </div>
              </div>
              <Skeleton className="mt-2 h-3 w-24" />
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-8" />
                </div>
              </div>
              <Skeleton className="mt-2 h-3 w-24" />
            </Card>
          </>
        ) : (
          <>
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
                  <FolderOpen className="h-5 w-5 text-[var(--text-tertiary)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
                    {t("stats.projects")}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {projects.length}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono truncate">
                {projects.length === 0 ? t("stats.projectsNone") : t("stats.projectsActive", { count: projects.length })}
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
                  <Key className="h-5 w-5 text-[var(--text-tertiary)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
                    {t("stats.secrets")}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {totalSecrets}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono truncate">
                {totalSecrets === 0 ? t("stats.secretsNone") : t("stats.secretsTotal", { count: totalSecrets })}
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
                  <Clock className="h-5 w-5 text-[var(--text-tertiary)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider truncate">
                    {t("stats.lastSync")}
                  </p>
                  <p className="text-lg sm:text-2xl font-semibold tracking-tight truncate">
                    {auditLogs.length > 0 ? describe(auditLogs[0]).time : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono truncate">
                {auditLogs.length > 0 && projectNames.get(auditLogs[0].project_id)
                  ? t("stats.lastActivityIn", { project: projectNames.get(auditLogs[0].project_id) ?? "" })
                  : t("stats.lastActivity")}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("activity.title")}</CardTitle>
          <CardDescription>{t("activity.description")}</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          {activityLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--border)] last:border-0">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </>
          ) : auditLogs.length > 0 ? (
            auditLogs.map((log) => {
              const entry = describe(log)
              const Icon = entry.icon
              const projectName = projectNames.get(log.project_id)

              return (
                <div key={log.id} className="flex items-center gap-4 py-3 border-b border-[var(--border)] last:border-0">
                  {log.actor?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={log.actor.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--background-muted)]">
                      <Icon className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm text-[var(--text-primary)] line-clamp-2">{entry.title}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono truncate">
                      {projectName && (
                        <Link
                          href={`/projects/${log.project_id}`}
                          className="hover:text-[var(--text-secondary)]"
                        >
                          {projectName}
                        </Link>
                      )}
                      {/* on mobile the time column moves under the title */}
                      <span className="sm:hidden">
                        {projectName ? " · " : ""}
                        {entry.time}
                      </span>
                    </p>
                  </div>
                  <time
                    dateTime={log.created_at}
                    title={new Date(log.created_at).toLocaleString(locale)}
                    className="hidden sm:block text-xs text-[var(--text-muted)] font-mono whitespace-nowrap"
                  >
                    {entry.time}
                  </time>
                </div>
              )
            })
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-muted)] font-mono">
                {t("activity.empty")}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
