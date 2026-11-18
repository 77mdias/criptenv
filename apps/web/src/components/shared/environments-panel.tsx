"use client"

import { useEffect, useState, type FormEvent } from "react"
import { GitBranch, Layers, Lock, Timer } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { PlanUsage, isPlanFull } from "@/components/shared/plan-usage"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { environmentsApi, projectsApi } from "@/lib/api"
import type { Environment } from "@/lib/api"
import { ApiError } from "@/lib/api/client"
import type { Plan } from "@/lib/api/me"

// The environments every project is born with: the API never lets them be restricted.
const SEEDED = new Set(["production", "staging", "development"])
// The same pattern the API enforces; "/" separates a child from its parent by convention (dev/wt-x).
const NAME = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/
// TTL choices for an ephemeral child, in seconds ("" = never expires).
const TTLS = ["", String(86400), String(7 * 86400), String(30 * 86400)]

// Each of these changes who reaches the environment or whether it exists: all of them ask first.
// "delete": a child is deleted for good (its overrides only; the parent is untouched).
type Pending = { action: "restrict" | "open" | "archive" | "delete"; environment: Environment }

/**
 * Project settings: create, restrict and archive environments. A restricted environment is reached
 * only by the project's owner and admins; everybody else does not even see it listed.
 */
export function EnvironmentsPanel({ projectId }: { projectId: string }) {
  const t = useTranslations("settings.environments")
  const locale = useLocale()
  const [environments, setEnvironments] = useState<Environment[] | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [name, setName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [restricted, setRestricted] = useState(false)
  const [parentId, setParentId] = useState("")
  const [ttl, setTtl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)

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
    if (status === 409) return pending?.action === "delete" || pending?.action === "archive"
      ? t("errors.hasChildren")
      : t("errors.conflict")
    if (status === 422) return parentId ? t("errors.inheritance") : t("errors.invalid")
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
        ...(parentId ? { parent_id: parentId } : {}),
        ...(parentId && ttl ? { ttl_seconds: Number(ttl) } : {}),
      })
      setName("")
      setDisplayName("")
      setRestricted(false)
      setParentId("")
      setTtl("")
    })
  }

  function confirm() {
    if (!pending) return
    const { action, environment } = pending
    void run(() =>
      action === "archive" || action === "delete"
        ? environmentsApi.delete(projectId, environment.id)
        : environmentsApi.update(projectId, environment.id, { restricted: action === "restrict" }),
    ).finally(() => setPending(null))
  }

  function rename(event: FormEvent) {
    event.preventDefault()
    if (!renaming) return
    const { id, value } = renaming
    setRenaming(null)
    void run(() => environmentsApi.update(projectId, id, { display_name: value.trim() }))
  }

  // An ephemeral child (with a TTL) does not count against the plan: it can be created on a full plan.
  const full = (isPlanFull(plan, "environments_per_project") || limitHit) && !(parentId && ttl)
  const names = new Map((environments ?? []).map((environment) => [environment.id, environment.name]))
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))

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
                  {environment.parent_id && (
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="h-3 w-3" aria-hidden />
                      {t("inherits", { parent: names.get(environment.parent_id) ?? "—" })}
                    </span>
                  )}
                  {environment.expires_at && (
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-3 w-3" aria-hidden />
                      {t("expires", { date: formatDate(environment.expires_at) })}
                    </span>
                  )}
                </p>
              </div>
              {renaming?.id === environment.id ? (
                <form onSubmit={rename} className="flex items-center gap-2">
                  <input
                    aria-label={t("renameLabel", { name: environment.name })}
                    value={renaming.value}
                    onChange={(event) => setRenaming({ id: environment.id, value: event.target.value })}
                    maxLength={255}
                    autoFocus
                    className="h-8 rounded-lg border border-(--border) bg-(--surface) px-2 text-sm text-(--text-primary)"
                  />
                  <Button type="submit" size="sm" disabled={busy}>
                    {t("save")}
                  </Button>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRenaming({ id: environment.id, value: environment.display_name ?? "" })}
                  >
                    {t("rename")}
                  </Button>
                  {extra && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setPending({ action: environment.restricted ? "open" : "restrict", environment })
                        }
                      >
                        {environment.restricted ? t("open") : t("restrict")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setPending({ action: environment.parent_id ? "delete" : "archive", environment })
                        }
                      >
                        {environment.parent_id ? t("delete") : t("archive")}
                      </Button>
                    </>
                  )}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="environment-parent" className="text-sm font-medium text-(--text-primary)">
              {t("parent")}
            </label>
            <Select
              id="environment-parent"
              value={parentId}
              onValueChange={(value) => {
                setParentId(value)
                if (!value) setTtl("")
              }}
              options={[
                { value: "", label: t("parentNone") },
                ...(environments ?? []).map((environment) => ({ value: environment.id, label: environment.name })),
              ]}
            />
            <p className="text-xs text-(--text-muted)">{t("parentHint")}</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="environment-ttl" className="text-sm font-medium text-(--text-primary)">
              {t("ttl")}
            </label>
            <Select
              id="environment-ttl"
              value={ttl}
              onValueChange={setTtl}
              disabled={!parentId}
              options={TTLS.map((value) => ({ value, label: t(`ttlOptions.${value || "none"}`) }))}
            />
            <p className="text-xs text-(--text-muted)">{t("ttlHint")}</p>
          </div>
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
            : pending?.action === "delete"
              ? t("deleteTitle", { name: pending.environment.name })
              : pending?.action === "open"
              ? t("openTitle", { name: pending.environment.name })
              : t("restrictTitle", { name: pending?.environment.name ?? "" })
        }
        description={
          pending?.action === "archive"
            ? t("archiveBody")
            : pending?.action === "delete"
              ? t("deleteBody")
              : pending?.action === "open"
              ? t("openBody")
              : t("restrictBody")
        }
        confirmLabel={
          pending?.action === "archive"
            ? t("archive")
            : pending?.action === "delete"
              ? t("delete")
              : pending?.action === "open"
                ? t("open")
                : t("restrict")
        }
        destructive={pending?.action === "archive" || pending?.action === "delete"}
        loading={busy}
        onConfirm={confirm}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      />
    </Card>
  )
}
