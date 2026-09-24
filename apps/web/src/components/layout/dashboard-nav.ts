import {
  CircleHelp,
  FolderOpen,
  LayoutDashboard,
  User,
  type LucideIcon,
} from "lucide-react"

type MatchMode = "exact" | "prefix"

interface DashboardNavItem {
  icon: LucideIcon
  /** translation key under the `dashboard.nav` namespace */
  labelKey: string
  href: string
  matchMode?: MatchMode
}

interface DashboardNavGroups {
  mainNavItems: DashboardNavItem[]
  bottomNavItems: DashboardNavItem[]
}

export function getDashboardNavGroups(): DashboardNavGroups {
  const mainNavItems: DashboardNavItem[] = [
    { icon: LayoutDashboard, labelKey: "dashboard", href: "/dashboard" },
    { icon: FolderOpen, labelKey: "projects", href: "/projects", matchMode: "prefix" },
  ]

  const bottomNavItems: DashboardNavItem[] = [
    { icon: CircleHelp, labelKey: "help", href: "/help" },
    { icon: User, labelKey: "account", href: "/account" },
  ]

  return {
    mainNavItems,
    bottomNavItems,
  }
}

export function isDashboardNavItemActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.matchMode === "prefix") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  if (item.href === "/projects") {
    return pathname === "/projects" || pathname.startsWith("/projects/")
  }

  return pathname === item.href
}

export type { DashboardNavItem, DashboardNavGroups }
