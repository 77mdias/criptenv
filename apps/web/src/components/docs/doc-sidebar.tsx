"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
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
  title: string
  href?: string
  icon?: LucideIcon
  items?: SidebarItem[]
}

const sidebarNav: SidebarItem[] = [
  {
    title: "Início",
    icon: Compass,
    items: [
      { title: "Bem-vindo", href: "/docs" },
      { title: "Guia Rápido", href: "/docs/getting-started/quickstart" },
      { title: "Instalação", href: "/docs/getting-started/installation" },
      { title: "Conceitos", href: "/docs/getting-started/concepts" },
    ],
  },
  {
    title: "CLI",
    icon: Terminal,
    items: [
      { title: "Visão Geral", href: "/docs/cli" },
      { title: "Referência de Comandos", href: "/docs/cli/commands" },
      { title: "Configuração", href: "/docs/cli/configuration" },
    ],
  },
  {
    title: "API Reference",
    icon: Code2,
    items: [
      { title: "Introdução", href: "/docs/api" },
      { title: "Autenticação", href: "/docs/api/authentication" },
      { title: "Projetos", href: "/docs/api/projects" },
      { title: "Ambientes", href: "/docs/api/environments" },
      { title: "Vault", href: "/docs/api/vault" },
      { title: "Membros", href: "/docs/api/members" },
      { title: "Convites", href: "/docs/api/invites" },
      { title: "Auditoria", href: "/docs/api/audit" },
      { title: "Rotação", href: "/docs/api/rotation" },
      { title: "Integrações", href: "/docs/api/integrations" },
      { title: "CI Tokens", href: "/docs/api/ci-tokens" },
      { title: "Health", href: "/docs/api/health" },
    ],
  },
  {
    title: "Segurança",
    icon: Shield,
    items: [
      { title: "Visão Geral", href: "/docs/security" },
      { title: "Protocolo de Criptografia", href: "/docs/security/encryption" },
      { title: "Zero-Knowledge", href: "/docs/security/zero-knowledge" },
      { title: "Modelo de Ameaças", href: "/docs/security/threat-model" },
    ],
  },
  {
    title: "Integrações",
    icon: Puzzle,
    items: [
      { title: "Visão Geral", href: "/docs/integrations" },
      { title: "GitHub Action", href: "/docs/integrations/github-action" },
      { title: "Vercel", href: "/docs/integrations/vercel" },
      { title: "Railway", href: "/docs/integrations/railway" },
      { title: "Render", href: "/docs/integrations/render" },
    ],
  },
  {
    title: "SDKs",
    icon: Package,
    items: [
      { title: "Visão Geral", href: "/docs/sdks" },
      { title: "JavaScript / TypeScript", href: "/docs/sdks/javascript" },
      { title: "Python", href: "/docs/sdks/python" },
    ],
  },
  {
    title: "Guias",
    icon: BookOpen,
    items: [
      { title: "Seu Primeiro Projeto", href: "/docs/guides/first-project" },
      { title: "Configurar Time", href: "/docs/guides/team-setup" },
      { title: "CI/CD com CriptEnv", href: "/docs/guides/cicd-setup" },
      { title: "Rotação de Secrets", href: "/docs/guides/secret-rotation" },
      { title: "Migrando do .env", href: "/docs/guides/migration" },
    ],
  },
]

function SidebarGroup({ item }: { item: SidebarItem }) {
  const pathname = usePathname()
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
          {item.title}
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
      {item.title}
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
          <SidebarGroup key={group.title} item={group} />
        ))}
      </nav>
    </aside>
  )
}

/* Mobile sidebar drawer */
function MobileDocSidebar({ className }: DocSidebarProps) {
  const [open, setOpen] = React.useState(false)

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
        Navegação
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[var(--background)] border-r border-[var(--border)] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Documentação</span>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-1">
              {sidebarNav.map((group) => (
                <SidebarGroup key={group.title} item={group} />
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  )
}

export { DocSidebar, MobileDocSidebar, sidebarNav }
