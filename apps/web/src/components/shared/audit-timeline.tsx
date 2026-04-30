"use client"

import { Activity } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { AuditEntry } from "@/components/shared/audit-entry"
import type { AuditLog } from "@/lib/api"

interface AuditTimelineProps {
  logs: AuditLog[]
}

export function AuditTimeline({ logs }: AuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nenhum evento encontrado"
        description="As ações realizadas neste projeto aparecerão aqui."
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
