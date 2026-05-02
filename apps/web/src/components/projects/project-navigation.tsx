"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  KeyRound,
  LayoutGrid,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ProjectNavKey = "overview" | "secrets" | "members" | "audit" | "settings"

interface ProjectNavDefinition {
  key: ProjectNavKey
  icon: LucideIcon
  label: string
  description: string
  segment: string | null
}

export interface ProjectNavigationItem extends ProjectNavDefinition {
  href: string
}

const projectNavDefinitions: ProjectNavDefinition[] = [
  {
    key: "overview",
    icon: LayoutGrid,
    label: "Overview",
    description: "Resumo do projeto e atalhos principais.",
    segment: null,
  },
  {
    key: "secrets",
    icon: KeyRound,
    label: "Secrets",
    description: "Gerencie environments, vault e secrets criptografados.",
    segment: "secrets",
  },
  {
    key: "members",
    icon: Users,
    label: "Team",
    description: "Convide membros e ajuste permissões do projeto.",
    segment: "members",
  },
  {
    key: "audit",
    icon: ScrollText,
    label: "Audit Log",
    description: "Acompanhe eventos, mudanças e trilha de auditoria.",
    segment: "audit",
  },
  {
    key: "settings",
    icon: Settings,
    label: "Settings",
    description: "Configure dados do projeto, tokens de CI e zona de perigo.",
    segment: "settings",
  },
]

export function getProjectNavigationItems(projectId: string): ProjectNavigationItem[] {
  return projectNavDefinitions.map((item) => ({
    ...item,
    href: item.segment ? `/projects/${projectId}/${item.segment}` : `/projects/${projectId}`,
  }))
}

export function getProjectSectionItems(projectId: string): ProjectNavigationItem[] {
  return getProjectNavigationItems(projectId).filter((item) => item.key !== "overview")
}

function isProjectNavItemActive(pathname: string, item: ProjectNavigationItem) {
  if (item.key === "overview") {
    return pathname === item.href
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const items = getProjectNavigationItems(projectId)

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <nav
        aria-label="Project navigation"
        className="flex min-w-max items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5"
      >
        {items.map((item) => {
          const isActive = isProjectNavItemActive(pathname, item)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
                isActive
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function ProjectSectionCards({ projectId }: { projectId: string }) {
  const items = getProjectSectionItems(projectId)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="group block h-full">
          <Card className="flex h-full min-h-[168px] flex-col justify-between hover:shadow-xl">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--background-muted)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px]">
                  /{item.segment}
                </Badge>
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                  {item.label}
                </h2>
                <p className="mt-2 font-mono text-sm leading-relaxed text-[var(--text-tertiary)]">
                  {item.description}
                </p>
              </div>
            </div>
            <span className="mt-6 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-primary)]">
              Abrir seção
            </span>
          </Card>
        </Link>
      ))}
    </div>
  )
}
