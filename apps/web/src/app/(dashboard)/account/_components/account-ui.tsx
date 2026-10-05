"use client"

import { type ElementType, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Presentational helpers shared by the account page and its extracted cards.
 * Moved verbatim from `account/page.tsx` (Sprint 3 split, audit P2 #1).
 */

export function formatRelative(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  if (Number.isNaN(diffMs)) return ""
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "agora mesmo"
  if (minutes < 60) return `${minutes} min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h atrás`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d atrás`
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

// Shared section header: icon chip + title + description, optional action slot.
export function SectionHeader({
  icon: Icon,
  tone = "default",
  title,
  description,
  action,
}: {
  icon: ElementType
  tone?: "default" | "danger"
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border",
            tone === "danger"
              ? "bg-red-500/10 border-red-500/30 text-red-500"
              : "bg-[var(--background-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] leading-tight">{title}</h3>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// Icon chip used by list rows inside sections.
export function RowIcon({
  icon: Icon,
  tone = "default",
}: {
  icon: ElementType
  tone?: "default" | "danger"
}) {
  return (
    <div
      className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
        tone === "danger"
          ? "bg-red-500/10 border-red-500/20 text-red-500"
          : "bg-[var(--background-muted)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  )
}
