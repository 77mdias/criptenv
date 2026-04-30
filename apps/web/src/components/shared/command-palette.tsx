"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  Plus,
  ScrollText,
  Search,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/stores/ui"
import { cn } from "@/lib/utils"

interface CommandItem {
  label: string
  hint: string
  icon: LucideIcon
  run: () => void
}

export function CommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()
  const [query, setQuery] = useState("")

  const projectId = pathname.match(/\/projects\/([^/]+)/)?.[1]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandPaletteOpen(true)
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [setCommandPaletteOpen])

  const close = useCallback(() => {
    setQuery("")
    setCommandPaletteOpen(false)
  }, [setCommandPaletteOpen])

  const commands = useMemo<CommandItem[]>(() => {
    const runRoute = (href: string) => () => {
      router.push(href)
      close()
    }

    const runEvent = (name: string, fallback: string) => () => {
      if (pathname === fallback || pathname.startsWith(`${fallback}?`)) {
        window.dispatchEvent(new CustomEvent(name))
      } else {
        router.push(fallback)
        window.setTimeout(() => window.dispatchEvent(new CustomEvent(name)), 100)
      }
      close()
    }

    return [
      { label: "Dashboard", hint: "/dashboard", icon: LayoutDashboard, run: runRoute("/dashboard") },
      { label: "Projects", hint: "/projects", icon: FolderOpen, run: runRoute("/projects") },
      { label: "Novo projeto", hint: "Criar projeto", icon: Plus, run: runEvent("criptenv:new-project", "/projects") },
      ...(projectId
        ? [
            {
              label: "Secrets",
              hint: `/projects/${projectId}/secrets`,
              icon: KeyRound,
              run: runRoute(`/projects/${projectId}/secrets`),
            },
            {
              label: "Novo secret",
              hint: "Criar secret no projeto atual",
              icon: Plus,
              run: runEvent("criptenv:new-secret", `/projects/${projectId}/secrets`),
            },
            {
              label: "Team",
              hint: `/projects/${projectId}/members`,
              icon: Users,
              run: runRoute(`/projects/${projectId}/members`),
            },
            {
              label: "Convidar membro",
              hint: "Enviar convite",
              icon: Plus,
              run: runEvent("criptenv:invite-member", `/projects/${projectId}/members`),
            },
            {
              label: "Audit Log",
              hint: `/projects/${projectId}/audit`,
              icon: ScrollText,
              run: runRoute(`/projects/${projectId}/audit`),
            },
            {
              label: "Settings",
              hint: `/projects/${projectId}/settings`,
              icon: Settings,
              run: runRoute(`/projects/${projectId}/settings`),
            },
          ]
        : []),
    ]
  }, [close, pathname, projectId, router])

  const filtered = commands.filter((command) => {
    const haystack = `${command.label} ${command.hint}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  if (!commandPaletteOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-24">
      <button
        type="button"
        aria-label="Fechar command palette"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
      />
      <div className="relative z-[71] w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--text-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar comandos..."
            className="h-9 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-96 overflow-auto p-2">
          {filtered.map((command) => (
            <button
              type="button"
              key={`${command.label}-${command.hint}`}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                "hover:bg-[var(--background-subtle)] focus:bg-[var(--background-subtle)] focus:outline-none"
              )}
              onClick={command.run}
            >
              <command.icon className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="flex-1">
                <span className="block text-sm font-medium text-[var(--text-primary)]">
                  {command.label}
                </span>
                <span className="block font-mono text-xs text-[var(--text-muted)]">
                  {command.hint}
                </span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center font-mono text-sm text-[var(--text-muted)]">
              Nenhum comando encontrado.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
