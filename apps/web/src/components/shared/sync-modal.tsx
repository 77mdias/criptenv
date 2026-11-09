"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { OneWaySyncNotice } from "@/components/shared/one-way-sync-notice"
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DecryptedSecret } from "@/components/shared/secret-row"
import { integrationsApi } from "@/lib/api"
import type { Integration } from "@/lib/api"

const VERCEL_TARGETS = ["production", "preview", "development"] as const
const DIRECTIONS = ["push", "pull"] as const
type Direction = (typeof DIRECTIONS)[number]

// Providers that never return secret values (see the API's supports_pull).
const PUSH_ONLY_PROVIDERS = new Set(["cloudflare"])

const selectClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"

interface SyncModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** Name of the CriptEnv environment being synced; the default Vercel target when it matches one. */
  environmentName: string
  /** Decrypted secrets of that environment. */
  secrets: DecryptedSecret[]
  /** Encrypts the given secrets into the environment; resolves false when the vault write failed. */
  onImport: (secrets: DecryptedSecret[]) => Promise<boolean>
  initialIntegrationId?: string | null
}

export function SyncModal(props: SyncModalProps) {
  // Mounting the body per opening gives every sync a fresh form and result.
  return props.open ? <SyncModalBody {...props} /> : null
}

function SyncModalBody({
  open,
  onOpenChange,
  projectId,
  environmentName,
  secrets,
  onImport,
  initialIntegrationId,
}: SyncModalProps) {
  const t = useTranslations("secrets.sync")
  const [integrations, setIntegrations] = useState<Integration[] | null>(null)
  const [integrationId, setIntegrationId] = useState("")
  const [direction, setDirection] = useState<Direction>("push")
  const [target, setTarget] = useState<string>(() =>
    (VERCEL_TARGETS as readonly string[]).includes(environmentName) ? environmentName : "production",
  )
  const [overwrite, setOverwrite] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    integrationsApi
      .list(projectId)
      .then((data) => {
        if (cancelled) return
        setIntegrations(data.integrations)
        const preselected = data.integrations.find((item) => item.id === initialIntegrationId)
        setIntegrationId((preselected ?? data.integrations[0])?.id ?? "")
      })
      .catch((err) => {
        if (cancelled) return
        setIntegrations([])
        setResult({ ok: false, message: err instanceof Error ? err.message : t("loadFailed") })
      })
    return () => {
      cancelled = true
    }
  }, [initialIntegrationId, projectId, t])

  const integration = integrations?.find((item) => item.id === integrationId) ?? null
  const pushOnly = integration ? PUSH_ONLY_PROVIDERS.has(integration.provider) : false
  const effectiveDirection: Direction = pushOnly ? "push" : direction
  const nothingToPush = effectiveDirection === "push" && secrets.length === 0

  const run = async () => {
    if (!integration) return
    setRunning(true)
    setResult(null)
    try {
      const response = await integrationsApi.sync(projectId, integration.id, {
        direction: effectiveDirection,
        environment: integration.provider === "vercel" ? target : "production",
        ...(effectiveDirection === "push"
          ? { secrets: secrets.map(({ key, value, kind }) => ({ key, value, ...(kind ? { kind } : {}) })) }
          : {}),
      })
      if (!response.success) {
        setResult({ ok: false, message: response.message || t("failed") })
        return
      }
      if (effectiveDirection === "push") {
        const pushed = t("pushed", { count: response.synced_count ?? secrets.length })
        const recreated = response.recreated?.length ? ` ${t("recreated", { keys: response.recreated.join(", ") })}` : ""
        setResult({ ok: true, message: pushed + recreated })
        return
      }

      const existing = new Set(secrets.map((secret) => secret.key))
      const pulled = response.secrets ?? []
      const toImport = overwrite ? pulled : pulled.filter((secret) => !existing.has(secret.key))
      const skipped = pulled.length - toImport.length
      if (toImport.length > 0 && !(await onImport(toImport))) {
        setResult({ ok: false, message: t("importFailed") })
        return
      }
      setResult({ ok: true, message: t("pulled", { imported: toImport.length, skipped }) })
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : t("failed") })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { environment: environmentName })}</DialogDescription>
        </DialogHeader>

        <OneWaySyncNotice />

        {integrations === null ? (
          <p className="font-mono text-sm text-[var(--text-muted)]">{t("loading")}</p>
        ) : integrations.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            {t.rich("empty", {
              link: (chunks) => (
                <Link href="/integrations" className="underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--text-secondary)]">{t("integration")}</span>
              <select
                value={integrationId}
                onChange={(event) => setIntegrationId(event.target.value)}
                className={selectClass}
              >
                {integrations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.provider})
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-[var(--text-secondary)]">{t("direction")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {DIRECTIONS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={effectiveDirection === value ? "primary" : "secondary"}
                    size="sm"
                    icon={value === "push" ? ArrowUpFromLine : ArrowDownToLine}
                    aria-pressed={effectiveDirection === value}
                    disabled={value === "pull" && pushOnly}
                    onClick={() => setDirection(value)}
                  >
                    {t(`directions.${value}`)}
                  </Button>
                ))}
              </div>
              {pushOnly && (
                <p className="font-mono text-xs text-[var(--text-muted)]">{t("pushOnly")}</p>
              )}
            </fieldset>

            {integration?.provider === "vercel" && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--text-secondary)]">{t("target")}</span>
                <select value={target} onChange={(event) => setTarget(event.target.value)} className={selectClass}>
                  {VERCEL_TARGETS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {effectiveDirection === "pull" && (
              <Checkbox checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)}>
                {t("overwrite")}
              </Checkbox>
            )}

            <p className="font-mono text-xs text-[var(--text-muted)]">
              {effectiveDirection === "push"
                ? t("pushSummary", { count: secrets.length })
                : t("pullSummary")}
            </p>
          </div>
        )}

        {result && (
          <p
            role={result.ok ? "status" : "alert"}
            className={`mt-4 break-words font-mono text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}
          >
            {result.message}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          <Button
            icon={effectiveDirection === "push" ? ArrowUpFromLine : ArrowDownToLine}
            loading={running}
            disabled={!integration || nothingToPush}
            onClick={run}
          >
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
