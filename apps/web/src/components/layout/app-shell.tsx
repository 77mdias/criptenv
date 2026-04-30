"use client"

import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui"
import { SidebarNav } from "./sidebar-nav"
import { TopNav } from "./top-nav"
import { CommandPalette } from "@/components/shared/command-palette"
import { DashboardFloatingBar } from "./dashboard-floating-bar"

interface AppShellProps {
  children: React.ReactNode
  breadcrumbs?: { label: string; href: string }[]
}

function AppShell({ children, breadcrumbs }: AppShellProps) {
  const { desktopSidebarOpen, sidebarMobileOpen, setSidebarMobileOpen } = useUIStore()

  return (
    <div className="min-h-screen bg-[var(--background-subtle)]">
      {/* Sidebar */}
      <SidebarNav />
      <DashboardFloatingBar />

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
          "transition-[margin] duration-300 ease-out motion-reduce:transition-none",
          desktopSidebarOpen ? "lg:ml-60" : "lg:ml-0"
        )}
      >
        <TopNav breadcrumbs={breadcrumbs} />
        <main className={cn("p-6", !desktopSidebarOpen && "lg:pl-24")}>
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}

export { AppShell }
