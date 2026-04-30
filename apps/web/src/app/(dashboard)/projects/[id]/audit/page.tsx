"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Activity } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { auditApi } from "@/lib/api"
import type { AuditLog } from "@/lib/api"

export default function AuditPage() {
  const params = useParams()
  const projectId = params.id as string

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true)
        const data = await auditApi.getLogs(projectId)
        setLogs(data.logs)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar logs")
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [projectId])

  const getActionColor = (action: string) => {
    if (action.includes("create")) return "success"
    if (action.includes("delete") || action.includes("remove")) return "danger"
    if (action.includes("update") || action.includes("edit")) return "warning"
    return "outline"
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            Historico de ações do projeto
          </p>
        </div>
        <Card className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
          {logs.length} eventos · Historico de ações do projeto
        </p>
      </div>

      {error && (
        <Card className="p-4 border-red-500/50">
          <p className="text-red-500 text-sm font-mono">{error}</p>
        </Card>
      )}

      {logs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhum evento registrado"
          description="As ações realizadas neste projeto aparecerão aqui."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--background-subtle)] transition-colors"
              >
                <Activity className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)] font-mono">
                      {log.action}
                    </span>
                    <Badge variant={getActionColor(log.action) as "success" | "warning" | "danger" | "outline"}>
                      {log.action}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                    {log.user_id ? `Usuário: ${log.user_id}` : "Sistema"} ·{" "}
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
