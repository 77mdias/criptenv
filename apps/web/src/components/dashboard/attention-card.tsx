"use client"

import {
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Link2Off,
  Timer,
  TimerOff,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AttentionItem, AttentionKind, AttentionSeverity } from "@/lib/dashboard/attention"
import { cn, formatRelativeTime } from "@/lib/utils"

// Literal list so scripts/audit-i18n-keys.mjs can resolve `attention.items.${...}`
export const ATTENTION_MESSAGE_KEYS = [
  "expired", "integration", "expiring", "credential_no_expiry", "credential_unused", "invite",
] as const
export const ATTENTION_SEVERITIES = ["high", "medium", "low"] as const

const ICONS: Record<AttentionKind, LucideIcon> = {
  expired: TimerOff,
  integration: Link2Off,
  expiring: Timer,
  credential: KeyRound,
  invite: UserPlus,
}

const TONES: Record<AttentionSeverity, string> = {
  high: "bg-red-500/10 text-red-500",
  medium: "bg-amber-500/10 text-amber-500",
  low: "bg-[var(--background-muted)] text-[var(--text-tertiary)]",
}

const MAX_VISIBLE = 6

export function AttentionCard({ items }: { items: AttentionItem[] }) {
  const t = useTranslations("dashboard.home.attention")
  const locale = useLocale()
  const visible = items.slice(0, MAX_VISIBLE)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {items.length > 0 ? t("description", { count: items.length }) : t("emptyDescription")}
        </CardDescription>
      </CardHeader>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" aria-hidden />
          <p className="text-sm text-[var(--text-secondary)]">{t("empty")}</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {visible.map((item) => {
            const Icon = ICONS[item.kind]
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONES[item.severity])}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="sr-only">{t(`severity.${item.severity}`)}: </span>
                    <span className="line-clamp-2 text-sm text-[var(--text-primary)]">
                      {t(`items.${item.messageKey}`, item.values)}
                    </span>
                    <span className="block truncate font-mono text-xs text-[var(--text-muted)]">
                      {item.values.project}
                      {item.date ? ` · ${formatRelativeTime(item.date, locale)}` : ""}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {items.length > MAX_VISIBLE && (
        <p className="mt-3 font-mono text-xs text-[var(--text-muted)]">
          {t("more", { count: items.length - MAX_VISIBLE })}
        </p>
      )}
    </Card>
  )
}
