"use client"

import { useTranslations } from "next-intl"
import { Activity } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { AuditEntry } from "@/components/shared/audit-entry"
import type { AuditLog } from "@/lib/api"

interface AuditTimelineProps {
  logs: AuditLog[]
}

export function AuditTimeline({ logs }: AuditTimelineProps) {
  const t = useTranslations("audit.empty")

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={t("title")}
        description={t("description")}
      />
    )
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {logs.map((log) => (
        <AuditEntry key={log.id} log={log} />
      ))}
    </div>
  )
}
