"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui"
import { getDashboardNavGroups, isDashboardNavItemActive } from "./dashboard-nav"

interface SidebarNavProps {
  className?: string
}

function SidebarNav({ className }: SidebarNavProps) {
  const pathname = usePathname()
  const { desktopSidebarOpen } = useUIStore()
  const { mainNavItems, bottomNavItems } = getDashboardNavGroups(pathname)

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 hidden h-screen w-60 flex-col border-r border-[var(--border)] bg-[var(--background)] transition-all duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none lg:flex",
        desktopSidebarOpen
          ? "translate-x-0 opacity-100"
          : "-translate-x-full opacity-0 pointer-events-none",
        className
      )}
    >
      {/* Main Nav */}
      <nav className="flex-1 flex flex-col gap-1 p-3 pt-6">
        {mainNavItems.map((item) => {
          const isActive = isDashboardNavItemActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--background-muted)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-subtle)]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px bg-[var(--border)]" />

      {/* Bottom Nav */}
      <nav className="flex flex-col gap-1 p-3">
        {bottomNavItems.map((item) => {
          const isActive = isDashboardNavItemActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--background-muted)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-subtle)]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Status */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-muted)] font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span>Online</span>
        </div>
      </div>
    </aside>
  )
}

export { SidebarNav }
