"use client"

import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui"
import { SidebarNav } from "./sidebar-nav"
import { TopNav } from "./top-nav"

interface AppShellProps {
  children: React.ReactNode
  breadcrumbs?: { label: string; href: string }[]
}

function AppShell({ children, breadcrumbs }: AppShellProps) {
  const { sidebarCollapsed, sidebarMobileOpen, setSidebarMobileOpen } = useUIStore()

  return (
    <div className="min-h-screen bg-[var(--background-subtle)]">
      {/* Sidebar */}
      <SidebarNav />

      {/* Mobile overlay */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div
        className={cn(
          "transition-all duration-200",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
        )}
      >
        <TopNav breadcrumbs={breadcrumbs} />
        <main className="p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

export { AppShell }
