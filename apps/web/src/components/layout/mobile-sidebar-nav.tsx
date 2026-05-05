"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui"
import { getDashboardNavGroups, isDashboardNavItemActive } from "./dashboard-nav"
import { Button } from "@/components/ui/button"

interface MobileSidebarNavProps {
  className?: string
}

function MobileSidebarNav({ className }: MobileSidebarNavProps) {
  const pathname = usePathname()
  const { sidebarMobileOpen, setSidebarMobileOpen } = useUIStore()
  const { mainNavItems, bottomNavItems } = getDashboardNavGroups()

  return (
    <>
      {/* Mobile overlay */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-[280px] flex-col border-r border-[var(--border)] bg-[var(--background)] transition-transform duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none lg:hidden",
          sidebarMobileOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--border)]">
          <span className="font-semibold text-[var(--text-primary)]">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 flex flex-col gap-1 p-3 pt-4">
          {mainNavItems.map((item) => {
            const isActive = isDashboardNavItemActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarMobileOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--background-muted)] text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-subtle)]"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
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
                onClick={() => setSidebarMobileOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--background-muted)] text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-subtle)]"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
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
    </>
  )
}

export { MobileSidebarNav }
