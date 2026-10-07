"use client"

import * as React from "react"
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import {
  BookOpen,
  Terminal,
  Code2,
  Shield,
  Puzzle,
  Package,
  Compass,
  ChevronDown,
  type LucideIcon,
} from "lucide-react"

interface SidebarItem {
  /** Key under the `docs.sidebar` namespace (e.g. "home.welcome"). */
  titleKey: string
  /** Group identifier (e.g. "home") — used to resolve the group label key. */
  groupKey?: string
  href?: string
  icon?: LucideIcon
  items?: SidebarItem[]
}

const sidebarNav: SidebarItem[] = [
  {
    titleKey: "home.label",
    groupKey: "home",
    icon: Compass,
    items: [
      { titleKey: "home.welcome", href: "/docs" },
      { titleKey: "home.quickstart", href: "/docs/getting-started/quickstart" },
      { titleKey: "home.installation", href: "/docs/getting-started/installation" },
      { titleKey: "home.concepts", href: "/docs/getting-started/concepts" },
    ],
  },
  {
    titleKey: "cli.label",
    groupKey: "cli",
    icon: Terminal,
    items: [
      { titleKey: "cli.overview", href: "/docs/cli" },
      { titleKey: "cli.commands", href: "/docs/cli/commands" },
      { titleKey: "cli.configuration", href: "/docs/cli/configuration" },
    ],
  },
  {
    titleKey: "api.label",
    groupKey: "api",
    icon: Code2,
    items: [
      { titleKey: "api.overview", href: "/docs/api" },
      { titleKey: "api.authentication", href: "/docs/api/authentication" },
      { titleKey: "api.projects", href: "/docs/api/projects" },
      { titleKey: "api.environments", href: "/docs/api/environments" },
      { titleKey: "api.vault", href: "/docs/api/vault" },
      { titleKey: "api.members", href: "/docs/api/members" },
      { titleKey: "api.invites", href: "/docs/api/invites" },
      { titleKey: "api.audit", href: "/docs/api/audit" },
      { titleKey: "api.rotation", href: "/docs/api/rotation" },
      { titleKey: "api.integrations", href: "/docs/api/integrations" },
      { titleKey: "api.ciTokens", href: "/docs/api/ci-tokens" },
      { titleKey: "api.health", href: "/docs/api/health" },
    ],
  },
  {
    titleKey: "security.label",
    groupKey: "security",
    icon: Shield,
    items: [
      { titleKey: "security.overview", href: "/docs/security" },
      { titleKey: "security.encryption", href: "/docs/security/encryption" },
      { titleKey: "security.zeroKnowledge", href: "/docs/security/zero-knowledge" },
      { titleKey: "security.threatModel", href: "/docs/security/threat-model" },
    ],
  },
  {
    titleKey: "integrations.label",
    groupKey: "integrations",
    icon: Puzzle,
    items: [
      { titleKey: "integrations.overview", href: "/docs/integrations" },
      { titleKey: "integrations.githubAction", href: "/docs/integrations/github-action" },
      { titleKey: "integrations.vercel", href: "/docs/integrations/vercel" },
      { titleKey: "integrations.railway", href: "/docs/integrations/railway" },
      { titleKey: "integrations.render", href: "/docs/integrations/render" },
    ],
  },
  {
    titleKey: "sdks.label",
    groupKey: "sdks",
    icon: Package,
    items: [
      { titleKey: "sdks.overview", href: "/docs/sdks" },
      { titleKey: "sdks.javascript", href: "/docs/sdks/javascript" },
      { titleKey: "sdks.python", href: "/docs/sdks/python" },
    ],
  },
  {
    titleKey: "guides.label",
    groupKey: "guides",
    icon: BookOpen,
    items: [
      { titleKey: "guides.firstProject", href: "/docs/guides/first-project" },
      { titleKey: "guides.teamSetup", href: "/docs/guides/team-setup" },
      { titleKey: "guides.cicd", href: "/docs/guides/cicd-setup" },
      { titleKey: "guides.secretRotation", href: "/docs/guides/secret-rotation" },
      { titleKey: "guides.migration", href: "/docs/guides/migration" },
    ],
  },
]

function SidebarGroup({ item }: { item: SidebarItem }) {
  const pathname = usePathname()
  const t = useTranslations("docs.sidebar")
  const isActive = item.items?.some((sub) => sub.href === pathname)
  const [open, setOpen] = React.useState(isActive ?? true)

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
          "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-muted)]"
        )}
      >
        <span className="flex items-center gap-2">
          {item.icon && <item.icon className="h-4 w-4" />}
          {t(item.titleKey)}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--text-muted)] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && item.items && (
        <div className="ml-4 mt-0.5 border-l border-[var(--border)] pl-3 space-y-0.5">
          {item.items.map((sub) => (
            <SidebarLink key={sub.href} item={sub} />
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarLink({ item }: { item: SidebarItem }) {
  const pathname = usePathname()
  const t = useTranslations("docs.sidebar")
  const isActive = pathname === item.href

  if (!item.href) return null

  return (
    <Link
      href={item.href}
      className={cn(
        "block px-3 py-1.5 text-sm rounded-md transition-colors",
        isActive
          ? "text-emerald-500 bg-emerald-500/10 font-medium"
          : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-muted)]"
      )}
    >
      {t(item.titleKey)}
    </Link>
  )
}

interface DocSidebarProps {
  className?: string
}

function DocSidebar({ className }: DocSidebarProps) {
  return (
    <aside
      className={cn(
        "w-[260px] flex-shrink-0",
        "hidden lg:block",
        "fixed left-[max(0px,calc(50%-700px))] top-[7rem] h-[calc(100vh-7rem)]",
        "py-6 pr-4 overflow-y-auto",
        className
      )}
    >
      <nav className="space-y-1 pb-16">
        {sidebarNav.map((group) => (
          <SidebarGroup key={group.titleKey} item={group} />
        ))}
      </nav>
    </aside>
  )
}

/* Mobile sidebar drawer */
function MobileDocSidebar({ className }: DocSidebarProps) {
  const [open, setOpen] = React.useState(false)
  const tDocs = useTranslations("docs")

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "lg:hidden flex items-center gap-2 px-3 py-2 text-sm rounded-md",
          "text-[var(--text-secondary)] border border-[var(--border)]",
          "hover:bg-[var(--background-muted)] transition-colors",
          className
        )}
      >
        <BookOpen className="h-4 w-4" />
        {tDocs("nav.navigation")}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[var(--background)] border-r border-[var(--border)] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{tDocs("nav.documentation")}</span>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-1">
              {sidebarNav.map((group) => (
                <SidebarGroup key={group.titleKey} item={group} />
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  )
}

export { DocSidebar, MobileDocSidebar, sidebarNav }
