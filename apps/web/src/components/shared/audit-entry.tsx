"use client"

import {
  Download,
  Eye,
  FolderPlus,
  Pencil,
  PlusCircle,
  RefreshCw,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime } from "@/lib/utils"
import type { AuditLog } from "@/lib/api"

const actionConfig: Record<string, { icon: LucideIcon; variant: "success" | "info" | "warning" | "danger" | "outline" }> = {
  "secret.created": { icon: PlusCircle, variant: "success" },
  "secret.updated": { icon: Pencil, variant: "info" },
  "secret.deleted": { icon: Trash2, variant: "danger" },
  "secret.viewed": { icon: Eye, variant: "outline" },
  "secret.exported": { icon: Download, variant: "warning" },
  "env.created": { icon: FolderPlus, variant: "success" },
  "member.joined": { icon: UserPlus, variant: "success" },
  "member.added": { icon: UserPlus, variant: "success" },
  "member.removed": { icon: UserMinus, variant: "danger" },
  "member.role_changed": { icon: RefreshCw, variant: "warning" },
  "invite.created": { icon: UserPlus, variant: "success" },
  "invite.revoked": { icon: UserMinus, variant: "danger" },
  "vault.pushed": { icon: Upload, variant: "info" },
  "key.rotated": { icon: RefreshCw, variant: "warning" },
}

interface AuditEntryProps {
  log: AuditLog
}

export function AuditEntry({ log }: AuditEntryProps) {
  const config = actionConfig[log.action] ?? { icon: RefreshCw, variant: "outline" as const }
  const Icon = config.icon
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
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {log.action}
          </span>
          <Badge variant={config.variant}>{log.resource_type}</Badge>
        </div>
        <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
          {log.user_id ? `Usuário ${log.user_id}` : "Sistema"} · {formatRelativeTime(log.created_at)}
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
