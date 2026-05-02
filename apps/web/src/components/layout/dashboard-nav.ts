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
  label: string
  href: string
  matchMode?: MatchMode
}

interface DashboardNavGroups {
  mainNavItems: DashboardNavItem[]
  bottomNavItems: DashboardNavItem[]
}

export function getDashboardNavGroups(): DashboardNavGroups {
  const mainNavItems: DashboardNavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: FolderOpen, label: "Projects", href: "/projects", matchMode: "prefix" },
  ]

  const bottomNavItems: DashboardNavItem[] = [
    { icon: CircleHelp, label: "Help", href: "/help" },
    { icon: User, label: "Account", href: "/account" },
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
