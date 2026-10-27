"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import {
  KeyRound,
  LayoutGrid,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"
import { canManageProject, type ProjectRole } from "@/lib/project-permissions"
import { cn } from "@/lib/utils"

type ProjectNavKey = "overview" | "secrets" | "members" | "audit" | "settings"

interface ProjectNavDefinition {
  key: ProjectNavKey
  icon: LucideIcon
  segment: string | null
}

export interface ProjectNavigationItem extends ProjectNavDefinition {
  href: string
}

const projectNavDefinitions: ProjectNavDefinition[] = [
  {
    key: "overview",
    icon: LayoutGrid,
    segment: null,
  },
  {
    key: "secrets",
    icon: KeyRound,
    segment: "secrets",
  },
  {
    key: "members",
    icon: Users,
    segment: "members",
  },
  {
    key: "audit",
    icon: ScrollText,
    segment: "audit",
  },
  {
    key: "settings",
    icon: Settings,
    segment: "settings",
  },
]

export function getProjectNavigationItems(
  projectId: string,
  currentUserRole?: ProjectRole | null
): ProjectNavigationItem[] {
  return projectNavDefinitions
    .filter((item) => item.key !== "settings" || canManageProject(currentUserRole))
    .map((item) => ({
      ...item,
      href: item.segment ? `/projects/${projectId}/${item.segment}` : `/projects/${projectId}`,
    }))
}

function isProjectNavItemActive(pathname: string, item: ProjectNavigationItem) {
  if (item.key === "overview") {
    return pathname === item.href
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function ProjectTabs({
  projectId,
  currentUserRole,
}: {
  projectId: string
  currentUserRole?: ProjectRole | null
}) {
  const t = useTranslations("dashboard.projectNav")
  const pathname = usePathname()
  const items = getProjectNavigationItems(projectId, currentUserRole)

  return (
    <div className="relative -mx-1">
      {/* Fade indicators for scroll hint */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-[var(--background)] to-transparent md:hidden" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-[var(--background)] to-transparent md:hidden" />

      <div className="overflow-x-auto px-1 pb-1 scrollbar-hide">
        <nav
          aria-label={t("ariaLabel")}
          className="flex min-w-max items-center gap-1 sm:gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1 sm:p-1.5"
        >
          {items.map((item) => {
            const isActive = isProjectNavItemActive(pathname, item)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--text-tertiary)] hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)]"
                )}
              >
                <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span>{t(`sections.${item.key}.label`)}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
