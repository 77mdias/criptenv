"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui"
import { getDashboardNavGroups, isDashboardNavItemActive, type DashboardNavItem } from "./dashboard-nav"

function NavIconLink({ item, pathname }: { item: DashboardNavItem; pathname: string }) {
  const isActive = isDashboardNavItemActive(pathname, item)

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative grid h-10 w-10 place-items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
        isActive
          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "text-[var(--text-tertiary)] hover:bg-[var(--background-subtle)] hover:text-[var(--text-primary)]",
      )}
    >
      <item.icon className="h-4 w-4" />
      <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded-md bg-[var(--text-primary)] px-2 py-1 text-xs text-[var(--background)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
        {item.label}
      </span>
    </Link>
  )
}

function DashboardFloatingBar() {
  const pathname = usePathname()
  const { desktopSidebarOpen } = useUIStore()
  const { mainNavItems, bottomNavItems } = getDashboardNavGroups(pathname)

  return (
    <aside className="fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 lg:block">
      <div
        className={cn(
          "transition-all duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none",
          desktopSidebarOpen
            ? "-translate-x-4 scale-95 opacity-0 pointer-events-none"
            : "translate-x-0 scale-100 opacity-100",
        )}
      >
        <nav className="flex flex-col items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-lg backdrop-blur-sm">
          {mainNavItems.map((item) => (
            <NavIconLink key={item.href} item={item} pathname={pathname} />
          ))}

          <div className="my-1 h-px w-6 bg-[var(--border)]" />

          {bottomNavItems.map((item) => (
            <NavIconLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
      </div>
    </aside>
  )
}

export { DashboardFloatingBar }
