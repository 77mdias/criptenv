"use client"

import { useEffect, useState } from "react"
import { FolderOpen, Key, Clock } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { projectsApi, auditApi } from "@/lib/api"
import { formatRelativeTime } from "@/lib/utils"
import type { Project, AuditLog } from "@/lib/api"

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)
        const projectData = await projectsApi.list()
        setProjects(projectData.projects)

        // Fetch audit logs for the first project if available
        if (projectData.projects.length > 0) {
          const logData = await auditApi.getLogs(projectData.projects[0].id, { per_page: 5 })
          setAuditLogs(logData.logs)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-red-600 text-sm font-mono mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            Bem-vindo de volta. Aqui está o overview dos seus projetos.
          </p>
        </div>
        <StatusBadge status="synced" label="Tudo sincronizado" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <>
            <Card>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-8" />
                </div>
              </div>
              <Skeleton className="mt-2 h-3 w-24" />
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-8" />
                </div>
              </div>
              <Skeleton className="mt-2 h-3 w-24" />
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-8" />
                </div>
              </div>
              <Skeleton className="mt-2 h-3 w-24" />
            </Card>
          </>
        ) : (
          <>
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
                  <FolderOpen className="h-5 w-5 text-[var(--text-tertiary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">
                    Projects
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {projects.length}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono">
                {projects.length === 0 ? "Nenhum projeto ainda" : `${projects.length} ativos`}
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
                  <Key className="h-5 w-5 text-[var(--text-tertiary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">
                    Secrets
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {auditLogs.length > 0 ? auditLogs.length : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono">
                {auditLogs.length > 0 ? "Atividade recente" : "Sem dados ainda"}
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
                  <Clock className="h-5 w-5 text-[var(--text-tertiary)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">
                    Last Sync
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {auditLogs.length > 0 && auditLogs[0].created_at
                      ? formatRelativeTime(auditLogs[0].created_at)
                      : "—"}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)] font-mono">
                Última atividade
              </p>
            </Card>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>Últimas operações nos seus projetos</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--border)] last:border-0">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </>
          ) : auditLogs.length > 0 ? (
            auditLogs.map((log) => {
              const metadata = log.meta ?? log.metadata ?? {}
              const description =
                typeof metadata.description === "string"
                  ? metadata.description
                  : log.resource_type

              return (
                <div key={log.id} className="flex items-center gap-4 py-3 border-b border-[var(--border)] last:border-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--background-muted)]">
                    <Key className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">{log.action}</span>
                      {" · "}
                      <span className="font-mono text-[var(--text-secondary)]">{log.resource_type}</span>
                    </p>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      {description}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] font-mono whitespace-nowrap">
                    {log.created_at ? formatRelativeTime(log.created_at) : "—"}
                  </span>
                </div>
              )
            })
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-muted)] font-mono">
                Nenhuma atividade recente
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
