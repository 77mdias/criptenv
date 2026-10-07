"use client"

import * as React from "react"
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils"
import { Search, FileText, ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { sidebarNav } from "./doc-sidebar"

/**
 * Extra searchable entries. Titles/descriptions resolve from the
 * `docs.searchIndex` catalogue; `sectionKey` points at a sidebar group label.
 */
const searchExtras: { key: string; href: string; sectionKey: string }[] = [
  { key: "cliInit", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliLogin", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliSet", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliGet", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliList", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliPush", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliPull", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliDoctor", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliImport", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliExport", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "cliRotate", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "ciLogin", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "ciDeploy", href: "/docs/cli/commands", sectionKey: "cli" },
  { key: "aes", href: "/docs/security/encryption", sectionKey: "security" },
  { key: "pbkdf2", href: "/docs/security/encryption", sectionKey: "security" },
  { key: "hkdf", href: "/docs/security/encryption", sectionKey: "security" },
  { key: "zeroKnowledge", href: "/docs/security/zero-knowledge", sectionKey: "security" },
  { key: "githubAction", href: "/docs/integrations/github-action", sectionKey: "integrations" },
  { key: "vercel", href: "/docs/integrations/vercel", sectionKey: "integrations" },
  { key: "railway", href: "/docs/integrations/railway", sectionKey: "integrations" },
  { key: "render", href: "/docs/integrations/render", sectionKey: "integrations" },
  { key: "apiKey", href: "/docs/api/authentication", sectionKey: "api" },
  { key: "ciToken", href: "/docs/api/ci-tokens", sectionKey: "api" },
  { key: "sessionToken", href: "/docs/api/authentication", sectionKey: "api" },
  { key: "oauth", href: "/docs/api/authentication", sectionKey: "api" },
  { key: "vault", href: "/docs/api/vault", sectionKey: "api" },
  { key: "rotation", href: "/docs/api/rotation", sectionKey: "api" },
  { key: "audit", href: "/docs/api/audit", sectionKey: "api" },
  { key: "members", href: "/docs/api/members", sectionKey: "api" },
  { key: "invites", href: "/docs/api/invites", sectionKey: "api" },
]

const DOC_SEARCH_OPEN_EVENT = "criptenv:open-doc-search"

function openDocSearch() {
  window.dispatchEvent(new Event(DOC_SEARCH_OPEN_EVENT))
}

interface SearchResult {
  title: string
  href: string
  section: string
  description?: string
}

function SearchModal() {
  const t = useTranslations("docs")
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()
  // Search index resolved from the sidebar nav + extras via the catalogue.
  const index = React.useMemo<SearchResult[]>(() => {
    const fromNav: SearchResult[] = []
    for (const group of sidebarNav) {
      for (const item of group.items ?? []) {
        if (item.href) {
          fromNav.push({
            title: t(`sidebar.${item.titleKey}`),
            href: item.href,
            section: t(`sidebar.${group.groupKey}.label`),
          })
        }
      }
    }
    const extras = searchExtras.map((e) => ({
      title: t(`searchIndex.${e.key}.title`),
      href: e.href,
      section: t(`sidebar.${e.sectionKey}.label`),
      description: t(`searchIndex.${e.key}.description`),
    }))
    return [...fromNav, ...extras]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpen = React.useCallback(() => {
    setQuery("")
    setSelectedIndex(0)
    setOpen(true)
  }, [])

  // Keyboard shortcut
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => {
          if (!prev) {
            setQuery("")
            setSelectedIndex(0)
          }
          return !prev
        })
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  React.useEffect(() => {
    window.addEventListener(DOC_SEARCH_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(DOC_SEARCH_OPEN_EVENT, handleOpen)
  }, [handleOpen])

  // Focus input when modal opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Filter results
  const results = React.useMemo(() => {
    if (!query.trim()) return index.slice(0, 8)
    const q = query.toLowerCase()
    return index.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
    ).slice(0, 12)
  }, [query, index])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault()
      router.push(results[selectedIndex].href)
      setOpen(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[101] w-full max-w-[560px] px-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <Search className="h-5 w-5 text-[var(--text-muted)] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder={t("search.placeholder")}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--background-muted)] rounded border border-[var(--border)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto py-2">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                {t("search.noResults", { query })}
              </div>
            ) : (
              results.map((result, index) => (
                <button
                  key={`${result.href}-${result.title}`}
                  onClick={() => {
                    router.push(result.href)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors",
                    selectedIndex === index
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "text-[var(--text-secondary)] hover:bg-[var(--background-muted)]"
                  )}
                >
                  <FileText className={cn(
                    "h-4 w-4 flex-shrink-0",
                    selectedIndex === index ? "text-emerald-500" : "text-[var(--text-muted)]"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      selectedIndex === index ? "text-emerald-500" : "text-[var(--text-primary)]"
                    )}>
                      {result.title}
                    </p>
                    {result.description && (
                      <p className="text-xs text-[var(--text-tertiary)] truncate">
                        {result.description}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--background-muted)] px-1.5 py-0.5 rounded flex-shrink-0">
                    {result.section}
                  </span>
                  {selectedIndex === index && (
                    <ArrowRight className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] bg-[var(--background-muted)]">
            <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-[var(--background)] rounded border border-[var(--border)]">↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-[var(--background)] rounded border border-[var(--border)]">↵</kbd>
                selecionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-[var(--background)] rounded border border-[var(--border)]">esc</kbd>
                fechar
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              {results.length} resultado{results.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

export { SearchModal, openDocSearch }
