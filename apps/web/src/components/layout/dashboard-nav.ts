import {
  CircleHelp,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"

type MatchMode = "exact" | "prefix"

interface DashboardNavItem {
  icon: LucideIcon
  label: string
  href: string
  matchMode?: MatchMode
}

interface DashboardNavGroups {
  mainNavItems: DashboardNavItem[]
  bottomNavItems: DashboardNavItem[]
  projectId: string | null
}

function getProjectIdFromPathname(pathname: string): string | null {
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  return projectMatch ? projectMatch[1] : null
}

export function getDashboardNavGroups(pathname: string): DashboardNavGroups {
  const projectId = getProjectIdFromPathname(pathname)

  const mainNavItems: DashboardNavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: FolderOpen, label: "Projects", href: "/projects" },
    ...(projectId
      ? [
          {
            icon: KeyRound,
            label: "Secrets",
            href: `/projects/${projectId}/secrets`,
          },
          {
            icon: Users,
            label: "Team",
            href: `/projects/${projectId}/members`,
          },
          {
            icon: ScrollText,
            label: "Audit Log",
            href: `/projects/${projectId}/audit`,
          },
          {
            icon: Settings,
            label: "Settings",
            href: `/projects/${projectId}/settings`,
          },
        ]
      : []),
  ]

  const bottomNavItems: DashboardNavItem[] = [
    { icon: CircleHelp, label: "Help", href: "/help" },
    { icon: User, label: "Account", href: "/account" },
  ]

  return {
    mainNavItems,
    bottomNavItems,
    projectId,
  }
}

export function isDashboardNavItemActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.matchMode === "prefix") {
    return pathname.startsWith(item.href)
  }

  if (item.href === "/projects") {
    return pathname === "/projects"
  }

  return pathname === item.href
}

export type { DashboardNavItem, DashboardNavGroups }
