"use client";

import Link from "next/link";
import { Menu, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { NotificationBell } from "./notification-bell";

interface Breadcrumb {
  label: string;
  href: string;
}

interface TopNavProps {
  breadcrumbs?: Breadcrumb[];
  className?: string;
}

function TopNav({ breadcrumbs = [], className }: TopNavProps) {
  const {
    desktopSidebarOpen,
    toggleSidebar,
    toggleSidebarMobile,
    setCommandPaletteOpen,
  } = useUIStore();
  const authUser = useAuthStore((state) => state.user);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex items-center h-16 bg-(--background)/90 backdrop-blur-sm border-b border-(--border) px-3 sm:px-4 lg:px-6",
        className,
      )}
    >
      {/* Left: Hamburger + Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
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

        {/* Desktop sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex"
          onClick={toggleSidebar}
          aria-label={desktopSidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <Brand href="/dashboard" compact className="shrink-0 -ml-1 sm:ml-0" />

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm font-mono">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 text-(--text-muted)" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-(--text-primary) font-medium">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-(--text-muted) hover:text-(--text-primary) transition-colors"
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
      <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-10 sm:w-10"
          aria-label="Search"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-4 w-4 text-(--text-muted)" />
        </Button>
        <NotificationBell />
        <div className="scale-90 sm:scale-100">
          <ThemeSwitch />
        </div>
        <div className="ml-0.5 sm:ml-2 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-(--accent) text-(--accent-foreground) text-[10px] sm:text-xs font-bold overflow-hidden">
          {authUser?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={authUser.avatar_url}
              alt={authUser.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{authUser?.name?.charAt(0).toUpperCase() || "U"}</span>
          )}
        </div>
      </div>
    </header>
  );
}

export { TopNav };
