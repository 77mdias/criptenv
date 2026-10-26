"use client"

import { useLocale } from "next-intl"
import { Badge } from "@/components/ui/badge"
import type { AuditLog } from "@/lib/api"
import { useAuditDescriber } from "@/lib/audit/describe"

interface AuditEntryProps {
  log: AuditLog
}

export function AuditEntry({ log }: AuditEntryProps) {
  const locale = useLocale()
  const entry = useAuditDescriber()(log)
  const Icon = entry.icon
  const metadata = log.meta ?? log.metadata ?? {}

  return (
    <div className="relative grid grid-cols-[32px_1fr] gap-4 px-4 py-4 md:px-6">
      <div className="relative flex justify-center">
        <div className="absolute top-8 h-full w-px bg-[var(--border)]" />
        <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {entry.title}
          </span>
          <Badge variant={entry.tone}>{log.resource_type}</Badge>
        </div>
        <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
          <span>{log.action}</span>
          {" · "}
          <time dateTime={log.created_at} title={new Date(log.created_at).toLocaleString(locale)}>
            {entry.time}
          </time>
        </p>
        {Object.keys(metadata).length > 0 && (
          <pre className="mt-3 max-h-28 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] p-3 font-mono text-[11px] text-[var(--text-secondary)]">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
