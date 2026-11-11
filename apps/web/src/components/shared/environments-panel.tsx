"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Layers, Lock } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { PlanUsage, isPlanFull } from "@/components/shared/plan-usage"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { environmentsApi, projectsApi } from "@/lib/api"
import type { Environment } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import type { Plan } from "@/lib/api/me"

// The environments every project is born with: the API never lets them be restricted.
const SEEDED = new Set(["production", "staging", "development"])
// The same pattern the API enforces.
const NAME = /^[a-z0-9-]+$/

type Pending = { action: "restrict" | "archive"; environment: Environment }

/**
 * Project settings: create, restrict and archive environments. A restricted environment is reached
 * only by the project's owner and admins; everybody else does not even see it listed.
 */
export function EnvironmentsPanel({ projectId }: { projectId: string }) {
  const t = useTranslations("settings.environments")
  const [environments, setEnvironments] = useState<Environment[] | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [name, setName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [restricted, setRestricted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)

  // Bumped after every change, so the list and the usage are read again.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [list, ownerPlan] = await Promise.all([
        environmentsApi.list(projectId).catch(() => null),
        // The usage line is a convenience: without it the API still enforces the limit.
        projectsApi.plan(projectId).catch(() => null),
      ])
      if (!active) return
      if (list) setEnvironments(list.environments)
      else setError(t("errors.load"))
      setPlan(ownerPlan)
    })()
    return () => {
      active = false
    }
  }, [projectId, t, version])

  function explain(cause: unknown): string {
    const status = cause instanceof ApiError ? cause.status : 0
    if (status === 402) return t("errors.limit")
    if (status === 409) return t("errors.conflict")
    if (status === 422) return t("errors.invalid")
    return t("errors.generic")
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      setVersion((current) => current + 1)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 402) setLimitHit(true)
      setError(explain(cause))
    } finally {
      setBusy(false)
    }
  }

  function create(event: FormEvent) {
    event.preventDefault()
    if (!NAME.test(name)) {
      setError(t("errors.name"))
      return
    }
    void run(async () => {
      await environmentsApi.create(projectId, {
        name,
        ...(displayName.trim() ? { display_name: displayName.trim() } : {}),
        restricted,
      })
      setName("")
      setDisplayName("")
      setRestricted(false)
    })
  }

  function confirm() {
    if (!pending) return
    const { action, environment } = pending
    setPending(null)
    void run(() =>
      action === "archive"
        ? environmentsApi.delete(projectId, environment.id)
        : environmentsApi.update(projectId, environment.id, { restricted: true }),
    )
  }

  const full = isPlanFull(plan, "environments_per_project") || limitHit

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--border-subtle) bg-(--background-subtle) text-(--text-secondary)">
          <Layers className="h-[18px] w-[18px]" />
        </div>
        <div>
          <h2 className="font-semibold leading-tight text-(--text-primary)">{t("title")}</h2>
          <p className="mt-0.5 text-sm text-(--text-secondary)">{t("description")}</p>
        </div>
      </div>

      <div className="mb-4">
        <PlanUsage plan={plan} limitKey="environments_per_project" limitHit={limitHit} />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-(--text-primary)">
          {error}
        </p>
      )}

      <ul className="mb-6 divide-y divide-(--border) rounded-lg border border-(--border)">
        {(environments ?? []).map((environment) => {
          const extra = !SEEDED.has(environment.name) && !environment.is_default
          return (
            <li
              key={environment.id}
              aria-label={environment.name}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-(--text-primary)">{environment.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-(--text-secondary)">
                  {environment.display_name && <span>{environment.display_name}</span>}
                  {environment.is_default && <span>{t("default")}</span>}
                  {environment.restricted && (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" aria-hidden />
                      {t("restricted")}
                    </span>
                  )}
                </p>
              </div>
              {extra && (
                <div className="flex gap-2">
                  {environment.restricted ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => environmentsApi.update(projectId, environment.id, { restricted: false }))}
                    >
                      {t("open")}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setPending({ action: "restrict", environment })}
                    >
                      {t("restrict")}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => setPending({ action: "archive", environment })}
                  >
                    {t("archive")}
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <form onSubmit={create} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            helperText={t("nameHint")}
            maxLength={255}
            required
          />
          <Input
            label={t("displayName")}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={255}
          />
        </div>
        <div className="space-y-1">
          <Checkbox checked={restricted} onChange={(event) => setRestricted(event.target.checked)}>
            {t("restricted")}
          </Checkbox>
          <p className="text-xs text-(--text-muted)">{t("restrictedHint")}</p>
        </div>
        <Button type="submit" loading={busy} disabled={full}>
          {t("create")}
        </Button>
      </form>

      <ConfirmActionDialog
        open={pending !== null}
        title={
          pending?.action === "archive"
            ? t("archiveTitle", { name: pending.environment.name })
            : t("restrictTitle", { name: pending?.environment.name ?? "" })
        }
        description={pending?.action === "archive" ? t("archiveBody") : t("restrictBody")}
        confirmLabel={pending?.action === "archive" ? t("archive") : t("restrict")}
        destructive={pending?.action === "archive"}
        loading={busy}
        onConfirm={confirm}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      />
    </Card>
  )
}
