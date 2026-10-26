"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { FolderOpen, Key, Clock } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityChart } from "@/components/dashboard/activity-chart"
import { AttentionCard } from "@/components/dashboard/attention-card"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { ProjectGrid } from "@/components/dashboard/project-grid"
import { auditApi, meApi, peekCached } from "@/lib/api"
import { useAuditDescriber } from "@/lib/audit/describe"
import { buildAttentionItems } from "@/lib/dashboard/attention"
import { onboardingSteps } from "@/lib/dashboard/onboarding"
import { formatRelativeTime } from "@/lib/utils"
import type { ActivityDay, AuditLog, OverviewResponse } from "@/lib/api"

const ONBOARDING_DISMISSED_KEY = "criptenv-onboarding-dismissed"
const ONBOARDING_CLI_KEY = "criptenv-onboarding-cli"

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1")
  } catch {
    // storage blocked (private mode): the choice just isn't remembered
  }
}

function StatSkeleton() {
  return (
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
  )
}

export default function DashboardPage() {
  const t = useTranslations("dashboard.home")
  const locale = useLocale()
  const describe = useAuditDescriber()
  const [overview, setOverview] = useState<OverviewResponse | null>(
    () => peekCached<OverviewResponse>("/api/v1/me/overview") ?? null
  )
  const [days, setDays] = useState<ActivityDay[] | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Overview only exists client-side, so reading storage on first render can't cause a hydration mismatch
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    typeof window === "undefined" ? true : readFlag(ONBOARDING_DISMISSED_KEY)
  )
  const [cliDone, setCliDone] = useState(() =>
    typeof window === "undefined" ? false : readFlag(ONBOARDING_CLI_KEY)
  )

  useEffect(() => {
    let cancelled = false

    async function fetchDashboardData() {
      try {
        const [overviewData, stats] = await Promise.all([meApi.overview(), meApi.activityStats(30)])
        if (cancelled) return
        setOverview(overviewData)
        setDays(stats)

        // shortcut: fan-out over the 10 most active projects; replaced by GET /me/audit in UX.5a
        const recent = [...overviewData.projects]
          .sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""))
          .slice(0, 10)
        const logPages = await Promise.all(recent.map((project) => auditApi.getLogs(project.id, { per_page: 5 })))
        if (cancelled) return
        setAuditLogs(
          logPages
            .flatMap((page) => page.logs)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 8)
        )
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("loadError"))
      } finally {
        if (!cancelled) setActivityLoading(false)
      }
    }

    void fetchDashboardData()
    return () => {
      cancelled = true
    }
  }, [t])

  const attentionItems = useMemo(() => (overview ? buildAttentionItems(overview) : []), [overview])
  const attentionByProject = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of attentionItems) counts.set(item.projectId, (counts.get(item.projectId) ?? 0) + 1)
    return counts
  }, [attentionItems])
  const projectNames = useMemo(
    () => new Map((overview?.projects ?? []).map((project) => [project.id, project.name])),
    [overview]
  )
  const latestProject = useMemo(
    () =>
      [...(overview?.projects ?? [])]
        .filter((project) => project.last_activity_at)
        .sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""))[0],
    [overview]
  )

  const steps = overview ? onboardingSteps(overview, cliDone) : []
  const showOnboarding = overview !== null && !onboardingDismissed && steps.some((step) => !step.done)

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
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">{t("welcome")}</p>
        </div>
        {overview && (
          <StatusBadge
            status={attentionItems.length > 0 ? "pending" : "synced"}
            label={attentionItems.length > 0 ? t("attentionBadge", { count: attentionItems.length }) : t("synced")}
          />
        )}
      </div>

      {showOnboarding && (
        <OnboardingChecklist
          steps={steps}
          projectId={overview.projects[0]?.id ?? null}
          onCliDone={() => {
            writeFlag(ONBOARDING_CLI_KEY)
            setCliDone(true)
          }}
          onDismiss={() => {
            writeFlag(ONBOARDING_DISMISSED_KEY)
            setOnboardingDismissed(true)
          }}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!overview ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
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
                  <p className="text-2xl font-semibold tracking-tight">{overview.totals.projects}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono truncate">
                {overview.totals.projects === 0
                  ? t("stats.projectsNone")
                  : t("stats.projectsActive", { count: overview.totals.projects })}
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
                  <p className="text-2xl font-semibold tracking-tight">{overview.totals.secrets}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono truncate">
                {overview.totals.secrets === 0
                  ? t("stats.secretsNone")
                  : t("stats.secretsTotal", { count: overview.totals.secrets })}
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
                    {latestProject?.last_activity_at ? formatRelativeTime(latestProject.last_activity_at, locale) : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono truncate">
                {latestProject
                  ? t("stats.lastActivityIn", { project: latestProject.name })
                  : t("stats.lastActivity")}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Attention + activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {overview ? <AttentionCard items={attentionItems} /> : <Skeleton className="h-64 rounded-2xl" />}
        {days ? <ActivityChart days={days} /> : <Skeleton className="h-64 rounded-2xl" />}
      </div>

      {overview && overview.projects.length > 0 && (
        <ProjectGrid projects={overview.projects} attentionCount={attentionByProject} />
      )}

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
                    {projectName && (
                      <Link
                        href={`/projects/${log.project_id}`}
                        className="text-xs text-[var(--text-muted)] font-mono truncate hover:text-[var(--text-secondary)]"
                      >
                        {projectName}
                      </Link>
                    )}
                  </div>
                  <time
                    dateTime={log.created_at}
                    title={new Date(log.created_at).toLocaleString(locale)}
                    className="text-xs text-[var(--text-muted)] font-mono whitespace-nowrap"
                  >
                    {entry.time}
                  </time>
                </div>
              )
            })
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-muted)] font-mono">{t("activity.empty")}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
