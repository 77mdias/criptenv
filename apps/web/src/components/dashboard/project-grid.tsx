"use client"

import { FolderOpen, KeyRound, Users } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { OverviewProject } from "@/lib/api"
import { cn, formatRelativeTime } from "@/lib/utils"

const MAX_PROJECTS = 6

interface ProjectGridProps {
  projects: OverviewProject[]
  /** number of attention items per project id */
  attentionCount: Map<string, number>
}

export function ProjectGrid({ projects, attentionCount }: ProjectGridProps) {
  const t = useTranslations("dashboard.home.projectGrid")
  const locale = useLocale()
  const sorted = [...projects]
    .sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""))
    .slice(0, MAX_PROJECTS)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <Link href="/projects" className="shrink-0 text-sm font-medium text-[var(--accent)] hover:underline">
          {t("viewAll")}
        </Link>
      </CardHeader>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((project) => {
          const secrets = project.environments.reduce((sum, env) => sum + env.secret_count, 0)
          const issues = attentionCount.get(project.id) ?? 0
          return (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex h-full flex-col gap-3 rounded-xl border border-[var(--border)] p-4 transition-colors hover:border-[var(--text-muted)] hover:bg-[var(--background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FolderOpen className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
                    <span className="truncate font-medium">{project.name}</span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px]",
                      issues > 0 ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", issues > 0 ? "bg-amber-500" : "bg-green-500")} aria-hidden />
                    {issues > 0 ? t("issues", { count: issues }) : t("healthy")}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {project.environments.map((env) => (
                    <span
                      key={env.id}
                      className="rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]"
                    >
                      {env.name} · {env.secret_count}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" aria-hidden />
                    {t("secrets", { count: secrets })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {t("members", { count: project.member_count })}
                  </span>
                  <span className="ml-auto truncate">
                    {project.last_activity_at ? formatRelativeTime(project.last_activity_at, locale) : t("noActivity")}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
