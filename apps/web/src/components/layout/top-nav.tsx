"use client"

import Link from "next/link"
import { Menu, Search, Bell, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/stores/ui"
import { Button } from "@/components/ui/button"
import { ThemeSwitch } from "@/components/ui/theme-switch"

interface Breadcrumb {
  label: string
  href: string
}

interface TopNavProps {
  breadcrumbs?: Breadcrumb[]
  className?: string
}

function TopNav({ breadcrumbs = [], className }: TopNavProps) {
  const { toggleSidebar, toggleSidebarMobile, setCommandPaletteOpen } = useUIStore()

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex items-center h-16 bg-[var(--background)]/90 backdrop-blur-sm border-b border-[var(--border)] px-6",
        className
      )}
    >
      {/* Left: Hamburger + Breadcrumbs */}
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={toggleSidebarMobile}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop collapse toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm font-mono">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3 text-[var(--text-muted)]" />}
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-[var(--text-primary)] font-medium">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-4 w-4 text-[var(--text-muted)]" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4 text-[var(--text-muted)]" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>
        <ThemeSwitch />
        <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-bold">
          U
        </div>
      </div>
    </header>
  )
}

export { TopNav }
