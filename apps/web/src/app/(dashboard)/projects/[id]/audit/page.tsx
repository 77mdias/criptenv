"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Download, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditTimeline } from "@/components/shared/audit-timeline"
import { auditApi, peekCached } from "@/lib/api"
import type { AuditLog, AuditLogListResponse } from "@/lib/api"

const actions = [
  "",
  "project.created",
  "project.updated",
  "vault.pushed",
  "invite.created",
  "invite.revoked",
  "member.added",
  "member.removed",
  "member.role_changed",
]

const resourceTypes = ["", "project", "vault", "invite", "member", "environment"]

export default function AuditPage() {
  const params = useParams()
  const projectId = params.id as string
  const [action, setAction] = useState("")
  const [resourceType, setResourceType] = useState("")
  const cachedInitialLogs = peekCached<AuditLogListResponse>(
    `/api/v1/projects/${projectId}/audit`,
    { page: 1, per_page: 20 }
  )
  const [logs, setLogs] = useState<AuditLog[]>(cachedInitialLogs?.logs ?? [])
  const [total, setTotal] = useState(cachedInitialLogs?.total ?? 0)
  const [page, setPage] = useState(cachedInitialLogs?.page ?? 1)
  const [loading, setLoading] = useState(!cachedInitialLogs)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = useCallback(
    async (nextPage: number, append = false, showLoading = true) => {
      if (append) {
        setLoadingMore(true)
      } else if (showLoading) {
        setLoading(true)
      }
      setError(null)

      try {
        const data = await auditApi.getLogs(projectId, {
          page: nextPage,
          per_page: 20,
          action: action || undefined,
          resource_type: resourceType || undefined,
        })
        setLogs((current) => (append ? [...current, ...data.logs] : data.logs))
        setTotal(data.total)
        setPage(data.page)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar logs")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [action, projectId, resourceType]
  )

  useEffect(() => {
    const hasDefaultFilters = action === "" && resourceType === ""
    const timeoutId = window.setTimeout(() => {
      void loadLogs(1, false, !(hasDefaultFilters && cachedInitialLogs))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [action, cachedInitialLogs, loadLogs, resourceType])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: "application/json;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `audit-${projectId}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportCsv = () => {
    const headers = ["timestamp", "action", "resource_type", "resource_id", "user_id", "metadata"]
    const rows = logs.map((log) => [
      log.created_at,
      log.action,
      log.resource_type,
      log.resource_id,
      log.user_id,
      JSON.stringify(log.metadata),
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `audit-${projectId}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="mt-1 font-mono text-sm text-[var(--text-tertiary)]">
            {total} eventos registrados para este projeto
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={logs.length === 0}>
            Export CSV
          </Button>
          <Button variant="secondary" size="sm" icon={Download} onClick={exportJson} disabled={logs.length === 0}>
            Export JSON
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block font-mono text-xs text-[var(--text-muted)]">Action</span>
            <select
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)]"
              value={action}
              onChange={(event) => {
                setLoading(true)
                setAction(event.target.value)
              }}
            >
              {actions.map((item) => (
                <option key={item || "all"} value={item}>
                  {item || "Todas"}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block font-mono text-xs text-[var(--text-muted)]">Resource</span>
            <select
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)]"
              value={resourceType}
              onChange={(event) => {
                setLoading(true)
                setResourceType(event.target.value)
              }}
            >
              {resourceTypes.map((item) => (
                <option key={item || "all"} value={item}>
                  {item || "Todos"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {error && (
        <Card className="border-red-500/50 p-4">
          <p className="font-mono text-sm text-red-600">{error}</p>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AuditTimeline logs={logs} />
        )}
      </Card>

      {logs.length < total && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            loading={loadingMore}
            onClick={() => loadLogs(page + 1, true)}
          >
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  )
}
