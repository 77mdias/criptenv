"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DocSidebar, MobileDocSidebar } from "@/components/docs/doc-sidebar";
import { DocTOC } from "@/components/docs/doc-toc";
import { FloatingBar } from "@/components/floating-bar/floating-bar";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { SearchModal, openDocSearch } from "@/components/docs/search-modal";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

import "./docs.css";

const topNavTabs = [
  { href: "/docs", label: "Comece aqui", exact: true },
  { href: "/docs/guides", label: "Guias" },
  { href: "/docs/cli", label: "CLI" },
  { href: "/docs/api", label: "Referência" },
  { href: "/docs/sdks", label: "SDKs" },
  { href: "/docs/security", label: "Segurança" },
  { href: "/docs/integrations", label: "Integrações" },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] docs-root pt-[7.5rem]">
      <SearchModal />

      {/* Docs Navbar — AbacatePay style */}
      <header className="fixed top-0 left-0 right-0 z-40 w-full bg-[var(--background)]/90 backdrop-blur-xl">
        {/* Row 1: Brand | Search | External links */}
        <div className="max-w-[1400px] mx-auto flex items-center justify-between h-[4.5rem] px-4 lg:px-6 border-b border-[var(--border)]">
          {/* Left: Brand */}
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/"
              aria-label="CriptEnv landing page"
              className="flex items-center rounded-md text-[var(--text-primary)] transition-opacity hover:opacity-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logocriptenv.png"
                alt="CriptEnv"
                className="h-14 w-auto shrink-0 brightness-0 dark:invert"
              />
            </Link>
            <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--background-muted)] px-1.5 py-0.5 rounded border border-[var(--border)]">
              v2
            </span>
            <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
          </div>

          {/* Center: Search */}
          <button
            type="button"
            onClick={openDocSearch}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-tertiary)] border border-[var(--border)] rounded-lg bg-[var(--background)] hover:bg-[var(--background-muted)] transition-colors w-full max-w-md mx-4"
            aria-label="Buscar documentação"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left truncate">Buscar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--background-subtle)] rounded border border-[var(--border)]">
              Ctrl K
            </kbd>
          </button>

          {/* Right: External links */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Início
            </Link>
            <Link
              href="/llms.txt"
              className="hidden lg:flex items-center text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              llms.txt
            </Link>
            <a
              href="https://github.com/criptenv/criptenv"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <GithubIcon className="h-4 w-4" />
              Repositório
            </a>

            <ThemeSwitch />

            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
            >
              Dashboard
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Row 2: Doc tabs — separated by a visual line */}
        <div className="border-b border-[var(--border)]">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
            <nav className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-hide">
              {topNavTabs.map((tab) => (
                <DocTab key={tab.href} href={tab.href} exact={tab.exact}>
                  {tab.label}
                </DocTab>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <DocsMainContent>{children}</DocsMainContent>
    </div>
  );
}

/* Decide layout based on route: /docs is full-width welcome, others use sidebar + TOC */
function DocsMainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWelcome = pathname === "/docs";

  if (isWelcome) {
    return (
      <>
        <FloatingBar />
        <main className="docs-welcome max-w-[900px] mx-auto px-4 lg:px-6 py-8">
          {children}
        </main>
      </>
    );
  }

  return (
    <div className="docs-layout">
      {/* Left Sidebar */}
      <DocSidebar />

      {/* Center content */}
      <main className="docs-content docs-content-area flex-1 min-w-0">
        <MobileDocSidebar className="mb-4" />
        {children}
      </main>

      {/* Right TOC */}
      <DocTOC />
    </div>
  );
}

/* Doc tab link with underline active indicator */
function DocTab({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center h-12 px-3 text-sm font-medium whitespace-nowrap transition-colors",
        isActive
          ? "text-[var(--text-primary)]"
          : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
      )}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--text-primary)] rounded-t-full" />
      )}
    </Link>
  );
}
