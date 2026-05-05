"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Search, FileText, ArrowRight } from "lucide-react"
import { sidebarNav } from "./doc-sidebar"

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

// Build flat search index from sidebar nav
function buildSearchIndex(): SearchResult[] {
  const results: SearchResult[] = []

  for (const group of sidebarNav) {
    if (group.items) {
      for (const item of group.items) {
        if (item.href) {
          results.push({
            title: item.title,
            href: item.href,
            section: group.title,
          })
        }
      }
    }
  }

  // Add extra searchable entries
  const extras: SearchResult[] = [
    { title: "criptenv init", href: "/docs/cli/commands", section: "CLI", description: "Inicializar diretório e vault" },
    { title: "criptenv login", href: "/docs/cli/commands", section: "CLI", description: "Autenticar com conta CriptEnv" },
    { title: "criptenv set", href: "/docs/cli/commands", section: "CLI", description: "Definir um secret" },
    { title: "criptenv get", href: "/docs/cli/commands", section: "CLI", description: "Obter um secret" },
    { title: "criptenv list", href: "/docs/cli/commands", section: "CLI", description: "Listar secrets" },
    { title: "criptenv push", href: "/docs/cli/commands", section: "CLI", description: "Sincronizar secrets com cloud" },
    { title: "criptenv pull", href: "/docs/cli/commands", section: "CLI", description: "Baixar secrets da cloud" },
    { title: "criptenv doctor", href: "/docs/cli/commands", section: "CLI", description: "Verificar configuração" },
    { title: "criptenv import", href: "/docs/cli/commands", section: "CLI", description: "Importar de arquivo .env" },
    { title: "criptenv export", href: "/docs/cli/commands", section: "CLI", description: "Exportar secrets" },
    { title: "criptenv rotate", href: "/docs/cli/commands", section: "CLI", description: "Rotacionar um secret" },
    { title: "criptenv ci login", href: "/docs/cli/commands", section: "CLI", description: "Login com token CI" },
    { title: "criptenv ci deploy", href: "/docs/cli/commands", section: "CLI", description: "Deploy via CI/CD" },
    { title: "AES-256-GCM", href: "/docs/security/encryption", section: "Segurança", description: "Algoritmo de criptografia" },
    { title: "PBKDF2", href: "/docs/security/encryption", section: "Segurança", description: "Derivação de chave mestra" },
    { title: "HKDF", href: "/docs/security/encryption", section: "Segurança", description: "Derivação por ambiente" },
    { title: "Zero-Knowledge", href: "/docs/security/zero-knowledge", section: "Segurança", description: "Arquitetura zero-knowledge" },
    { title: "GitHub Action", href: "/docs/integrations/github-action", section: "Integrações", description: "@criptenv/action para CI/CD" },
    { title: "Vercel", href: "/docs/integrations/vercel", section: "Integrações", description: "Sincronizar com Vercel" },
    { title: "Railway", href: "/docs/integrations/railway", section: "Integrações", description: "Sincronizar com Railway" },
    { title: "Render", href: "/docs/integrations/render", section: "Integrações", description: "Sincronizar com Render" },
    { title: "API Key", href: "/docs/api/authentication", section: "API", description: "Tokens cek_ para API" },
    { title: "CI Token", href: "/docs/api/ci-tokens", section: "API", description: "Tokens ci_ para CI/CD" },
    { title: "Session Token", href: "/docs/api/authentication", section: "API", description: "Cookie de sessão HTTP-only" },
    { title: "OAuth", href: "/docs/api/authentication", section: "API", description: "GitHub, Google, Discord" },
    { title: "Vault", href: "/docs/api/vault", section: "API", description: "Push/pull de secrets criptografados" },
    { title: "Rotação de secrets", href: "/docs/api/rotation", section: "API", description: "Políticas manual, notify, auto" },
    { title: "Auditoria", href: "/docs/api/audit", section: "API", description: "Logs de todas as operações" },
    { title: "Membros", href: "/docs/api/members", section: "API", description: "Gestão de time e roles" },
    { title: "Convites", href: "/docs/api/invites", section: "API", description: "Sistema de convites por email" },
  ]

  return [...results, ...extras]
}

function SearchModal() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const router = useRouter()
  const index = React.useMemo(() => buildSearchIndex(), [])

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
              placeholder="Buscar na documentação..."
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
                Nenhum resultado encontrado para &ldquo;{query}&rdquo;
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
