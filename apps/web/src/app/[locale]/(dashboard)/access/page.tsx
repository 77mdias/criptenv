"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Filter, KeySquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { apiKeysApi, ciTokensApi, meApi } from "@/lib/api"
import type { Credential } from "@/lib/api/me"
import {
  CREDENTIAL_KINDS,
  CREDENTIAL_STATUSES,
  filterCredentials,
  needsAttention,
  type CredentialFilters,
} from "@/lib/access/credentials"
import { formatRelativeTime } from "@/lib/utils"

const selectClass =
  "h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-primary)"

const STATUS_TONE = { active: "success", expired: "warning", revoked: "outline" } as const

export default function AccessPage() {
  const t = useTranslations("dashboard.accessPage")
  const locale = useLocale()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CredentialFilters>({ kind: "", status: "active", project: "" })
  const [revoking, setRevoking] = useState<Credential | null>(null)
  const [revokeBusy, setRevokeBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setCredentials((await meApi.credentials()).credentials)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const projects = useMemo(
    () => [...new Map(credentials.map((c) => [c.project_id, c.project_name])).entries()],
    [credentials]
  )
  const visible = filterCredentials(credentials, filters)

  const kindLabels = { ci_token: t("kinds.ci_token"), api_key: t("kinds.api_key") }
  const statusLabels = {
    active: t("statuses.active"),
    expired: t("statuses.expired"),
    revoked: t("statuses.revoked"),
  }

  const revoke = async () => {
    if (!revoking) return
    setRevokeBusy(true)
    try {
      if (revoking.kind === "ci_token") await ciTokensApi.revoke(revoking.project_id, revoking.id)
      else await apiKeysApi.revoke(revoking.project_id, revoking.id)
      setRevoking(null)
      await load()
    } catch (err) {
      setRevoking(null)
      setError(err instanceof Error ? err.message : t("revokeError"))
    } finally {
      setRevokeBusy(false)
    }
  }

  const setFilter = (key: keyof CredentialFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-(--text-tertiary)">{t("subtitle")}</p>
      </div>

      {credentials.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
            <Filter className="h-3.5 w-3.5" />
            {t("filters.title")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="block font-mono text-xs text-(--text-muted)">{t("filters.kind")}</span>
              <select className={selectClass} value={filters.kind} onChange={(e) => setFilter("kind", e.target.value)}>
                <option value="">{t("filters.allKinds")}</option>
                {CREDENTIAL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="block font-mono text-xs text-(--text-muted)">{t("filters.status")}</span>
              <select className={selectClass} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                <option value="">{t("filters.allStatuses")}</option>
                {CREDENTIAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="block font-mono text-xs text-(--text-muted)">{t("filters.project")}</span>
              <select className={selectClass} value={filters.project} onChange={(e) => setFilter("project", e.target.value)}>
                <option value="">{t("filters.allProjects")}</option>
                {projects.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-red-500/50 p-4">
          <p role="alert" className="font-mono text-sm text-red-600">
            {error}
          </p>
        </Card>
      )}

      {loading ? (
        <Card className="space-y-4 p-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
          ))}
        </Card>
      ) : credentials.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon={KeySquare} title={t("empty.title")} description={t("empty.description")} />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon={KeySquare} title={t("empty.filteredTitle")} />
        </Card>
      ) : (
        <Card className="divide-y divide-(--border) overflow-hidden p-0">
          {visible.map((credential) => (
            <article
              key={`${credential.kind}-${credential.id}`}
              aria-label={credential.name}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-(--text-primary)">{credential.name}</span>
                  <Badge variant="outline">{kindLabels[credential.kind]}</Badge>
                  <Badge variant={STATUS_TONE[credential.status]}>{statusLabels[credential.status]}</Badge>
                  {credential.no_expiry && <Badge variant="warning">{t("flags.noExpiry")}</Badge>}
                  {credential.unused && <Badge variant="warning">{t("flags.unused")}</Badge>}
                </div>
                <p className="font-mono text-xs text-(--text-muted)">
                  {credential.project_name}
                  {" · "}
                  {credential.environment_scope ?? t("allEnvironments")}
                  {" · "}
                  {credential.scopes.join(", ")}
                </p>
                <p className="text-xs text-(--text-tertiary)">
                  {credential.last_used_at
                    ? t("lastUsed", { when: formatRelativeTime(credential.last_used_at, locale) })
                    : t("neverUsed")}
                  {" · "}
                  {credential.expires_at
                    ? t("expires", { when: new Date(credential.expires_at).toLocaleDateString(locale) })
                    : t("noExpiry")}
                </p>
              </div>
              {credential.status === "active" && (
                <Button
                  variant={needsAttention(credential) ? "danger" : "secondary"}
                  size="sm"
                  onClick={() => setRevoking(credential)}
                  aria-label={t("revokeLabel", { name: credential.name })}
                >
                  {t("revoke")}
                </Button>
              )}
            </article>
          ))}
        </Card>
      )}

      <ConfirmActionDialog
        open={revoking !== null}
        title={t("confirm.title", { name: revoking?.name ?? "" })}
        description={t("confirm.description", { project: revoking?.project_name ?? "" })}
        confirmLabel={t("revoke")}
        destructive
        loading={revokeBusy}
        onConfirm={revoke}
        onOpenChange={(open) => !open && setRevoking(null)}
      />
    </div>
  )
}
