"use client"

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  Activity,
  Copy,
  FolderOpen,
  GitCompareArrows,
  KeyRound,
  KeySquare,
  Layers,
  LayoutDashboard,
  Plug,
  Plus,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  User,
  Users,
  Vault,
  X,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/stores/ui"
import { peekCached } from "@/lib/api"
import { canInviteProjectMembers, canManageProject, canWriteProjectSecrets } from "@/lib/project-permissions"
import { cn } from "@/lib/utils"
import type { OverviewResponse, Project } from "@/lib/api"
import type { SecretMatrixResponse } from "@/lib/api/projects"

interface CommandItem {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  run: () => void
}

// A long secret list should not turn the palette into a scroll marathon: refine the search instead.
const MAX_RESULTS = 50

export function CommandPalette() {
  const t = useTranslations("dashboard.commandPalette")
  const tNav = useTranslations("dashboard.nav")
  const router = useRouter()
  const pathname = usePathname()
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)

  const projectId = pathname.match(/\/projects\/([^/?]+)/)?.[1]
  const cachedProject = projectId ? peekCached<Project>(`/api/v1/projects/${projectId}`) : null
  const projectRole = cachedProject?.current_user_role ?? null

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
    setActive(0)
    setCommandPaletteOpen(false)
  }, [setCommandPaletteOpen])

  const commands = useMemo<CommandItem[]>(() => {
    // Read when the palette opens; whatever the pages already loaded is enough to search.
    const overview = commandPaletteOpen ? peekCached<OverviewResponse>("/api/v1/me/overview") : null
    const matrix =
      commandPaletteOpen && projectId
        ? peekCached<SecretMatrixResponse>(`/api/v1/projects/${projectId}/secrets/matrix`)
        : null

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

    const runCopy = (text: string) => () => {
      void navigator.clipboard?.writeText(text)
      close()
    }

    const screen = (labelKey: string, href: string, icon: LucideIcon): CommandItem => ({
      id: `screen:${href}`,
      label: tNav(labelKey),
      hint: href,
      icon,
      run: runRoute(href),
    })

    const current = overview?.projects.find((project) => project.id === projectId)
    const cliEnv =
      current?.environments.find((env) => env.is_default)?.name ?? current?.environments[0]?.name ?? null

    return [
      screen("dashboard", "/dashboard", LayoutDashboard),
      screen("projects", "/projects", FolderOpen),
      screen("activity", "/activity", Activity),
      screen("vault", "/vault", Vault),
      screen("integrations", "/integrations", Plug),
      screen("access", "/access", KeySquare),
      screen("security", "/security", ShieldCheck),
      screen("account", "/account", User),
      {
        id: "new-project",
        label: t("newProject"),
        hint: t("newProjectHint"),
        icon: Plus,
        run: runEvent("criptenv:new-project", "/projects"),
      },
      ...(projectId
        ? [
            {
              id: "project:secrets",
              label: t("secrets"),
              hint: `/projects/${projectId}/secrets`,
              icon: KeyRound,
              run: runRoute(`/projects/${projectId}/secrets`),
            },
            ...(canWriteProjectSecrets(projectRole)
              ? [
                  {
                    id: "project:new-secret",
                    label: t("newSecret"),
                    hint: t("newSecretHint"),
                    icon: Plus,
                    run: runEvent("criptenv:new-secret", `/projects/${projectId}/secrets`),
                  },
                ]
              : []),
            {
              id: "project:compare",
              label: t("compare"),
              hint: `/projects/${projectId}/compare`,
              icon: GitCompareArrows,
              run: runRoute(`/projects/${projectId}/compare`),
            },
            {
              id: "project:team",
              label: t("team"),
              hint: `/projects/${projectId}/members`,
              icon: Users,
              run: runRoute(`/projects/${projectId}/members`),
            },
            ...(canInviteProjectMembers(projectRole)
              ? [
                  {
                    id: "project:invite",
                    label: t("inviteMember"),
                    hint: t("inviteMemberHint"),
                    icon: Plus,
                    run: runEvent("criptenv:invite-member", `/projects/${projectId}/members`),
                  },
                ]
              : []),
            {
              id: "project:audit",
              label: t("audit"),
              hint: `/projects/${projectId}/audit`,
              icon: ScrollText,
              run: runRoute(`/projects/${projectId}/audit`),
            },
            ...(canManageProject(projectRole)
              ? [
                  {
                    id: "project:settings",
                    label: t("settings"),
                    hint: `/projects/${projectId}/settings`,
                    icon: Settings,
                    run: runRoute(`/projects/${projectId}/settings`),
                  },
                ]
              : []),
            ...(cliEnv
              ? [
                  {
                    id: "copy:list",
                    label: t("copyList"),
                    hint: `criptenv list -p ${projectId} -e ${cliEnv}`,
                    icon: Copy,
                    run: runCopy(`criptenv list -p ${projectId} -e ${cliEnv}`),
                  },
                  {
                    id: "copy:run",
                    label: t("copyRun"),
                    hint: `criptenv run -p ${projectId} -e ${cliEnv} -- ${t("commandPlaceholder")}`,
                    icon: Copy,
                    run: runCopy(`criptenv run -p ${projectId} -e ${cliEnv} -- `),
                  },
                ]
              : []),
          ]
        : []),
      ...(overview?.projects ?? []).flatMap((project) => [
        {
          id: `project:${project.id}`,
          label: project.name,
          hint: t("projectHint"),
          icon: FolderOpen,
          run: runRoute(`/projects/${project.id}`),
        },
        ...project.environments.map((env) => ({
          id: `env:${env.id}`,
          label: `${project.name} · ${env.name}`,
          hint: t("environmentHint"),
          icon: Layers,
          run: runRoute(`/projects/${project.id}/secrets?env=${env.id}`),
        })),
      ]),
      ...(projectId && matrix
        ? matrix.keys.map((key) => ({
            id: `secret:${key.key_id}`,
            label: key.key_id,
            hint: t("secretHint", { project: current?.name ?? "" }),
            icon: KeyRound,
            run: runRoute(`/projects/${projectId}/secrets?key=${encodeURIComponent(key.key_id)}`),
          }))
        : []),
    ]
  }, [close, commandPaletteOpen, pathname, projectId, projectRole, router, t, tNav])

  const needle = query.trim().toLowerCase()
  const filtered = commands
    .filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(needle))
    .slice(0, MAX_RESULTS)
  const activeIndex = Math.min(active, Math.max(filtered.length - 1, 0))
  const optionId = (index: number) => `command-palette-option-${index}`

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((activeIndex + 1) % Math.max(filtered.length, 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((activeIndex - 1 + filtered.length) % Math.max(filtered.length, 1))
    } else if (event.key === "Enter") {
      event.preventDefault()
      filtered[activeIndex]?.run()
    }
  }

  if (!commandPaletteOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-24">
      <button
        type="button"
        aria-label={t("close")}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="relative z-[71] w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-autocomplete="list"
            aria-label={t("searchPlaceholder")}
            aria-activedescendant={filtered.length > 0 ? optionId(activeIndex) : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onInputKeyDown}
            placeholder={t("searchPlaceholder")}
            className="h-9 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close} aria-label={t("close")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div id="command-palette-results" role="listbox" aria-label={t("results")} className="max-h-96 overflow-auto p-2">
          {filtered.map((command, index) => (
            <div
              key={command.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                index === activeIndex ? "bg-[var(--background-subtle)]" : "hover:bg-[var(--background-subtle)]"
              )}
              onMouseMove={() => setActive(index)}
              onClick={command.run}
            >
              <command.icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                  {command.label}
                </span>
                <span className="block truncate font-mono text-xs text-[var(--text-muted)]">
                  {command.hint}
                </span>
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center font-mono text-sm text-[var(--text-muted)]">
              {t("empty")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
