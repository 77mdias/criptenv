"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  ScrollText,
  Settings,
  CircleHelp,
  User,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui"

interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  badge?: number
}

const bottomNavItems: NavItem[] = [
  { icon: CircleHelp, label: "Help", href: "/help" },
  { icon: User, label: "Account", href: "/account" },
]

interface SidebarNavProps {
  className?: string
}

function SidebarNav({ className }: SidebarNavProps) {
  const pathname = usePathname()
  const { sidebarCollapsed } = useUIStore()

  // Extract project ID from the current URL
  const projectMatch = pathname.match(/\/projects\/([^/]+)/)
  const projectId = projectMatch ? projectMatch[1] : null

  // Build nav items with real project ID when available
  const mainNavItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: FolderOpen, label: "Projects", href: "/projects" },
    ...(projectId
      ? [
          { icon: Users, label: "Team", href: `/projects/${projectId}/members` },
          { icon: ScrollText, label: "Audit Log", href: `/projects/${projectId}/audit` },
          { icon: Settings, label: "Settings", href: `/projects/${projectId}/settings` },
        ]
      : []),
  ]

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-[var(--background)] border-r border-[var(--border)] z-30 transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-60",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-[var(--border)]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-sm">
            C
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              CriptEnv
            </span>
          )}
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 flex flex-col gap-1 p-3">
        {mainNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && item.href !== "/projects" || (item.href === "/projects" && pathname === "/projects")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--background-muted)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-subtle)]",
                sidebarCollapsed && "justify-center px-0"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {item.badge && item.badge > 0 && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
              {/* Tooltip when collapsed */}
              {sidebarCollapsed && (
                <div className="absolute left-14 bg-[var(--text-primary)] text-[var(--background)] text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-mono z-50">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px bg-[var(--border)]" />

      {/* Bottom Nav */}
      <nav className="flex flex-col gap-1 p-3">
        {bottomNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--background-muted)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-subtle)]",
                sidebarCollapsed && "justify-center px-0"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {sidebarCollapsed && (
                <div className="absolute left-14 bg-[var(--text-primary)] text-[var(--background)] text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-mono z-50">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Status */}
      <div className="p-3 border-t border-[var(--border)]">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-muted)] font-mono",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          {!sidebarCollapsed && <span>Online</span>}
        </div>
      </div>
    </aside>
  )
}

export { SidebarNav }
