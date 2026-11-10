"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Checkbox } from "@/components/ui/checkbox"
import { integrationsApi } from "@/lib/api"
import type { Environment, Integration, UpdateIntegrationRequest } from "@/lib/api"

// Targets each provider accepts (the API's get_environments). Unknown providers fall back to production.
const PROVIDER_TARGETS: Record<string, readonly string[]> = {
  vercel: ["production", "preview", "development"],
  render: ["production"],
  cloudflare: ["production"],
}
// Cloudflare publishes a new Worker version on every send, so there is no deploy to ask for.
const DEPLOYS_ITSELF = new Set(["cloudflare"])

const selectClass =
  "h-9 w-full rounded-lg border border-(--border) bg-(--surface) px-2 font-mono text-xs text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-(--accent) disabled:cursor-not-allowed disabled:opacity-50"

interface AutoSyncSettingsProps {
  projectId: string
  integration: Integration
  /** The project's live environments. */
  environments: Environment[]
  /** Sync features of the plan of the project's owner. */
  features: string[]
  onSaved: (integration: Integration) => void
}

/**
 * Per connection: which CriptEnv environment feeds which provider target on save, and whether
 * a deploy follows. Shown to every plan; turning things on needs Max, turning them off never does.
 */
export function AutoSyncSettings({ projectId, integration, environments, features, onSaved }: AutoSyncSettingsProps) {
  const t = useTranslations("integrations.autoSync")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAutoSync = features.includes("auto_sync")
  const canRedeploy = features.includes("sync_redeploy")
  const targets = PROVIDER_TARGETS[integration.provider] ?? ["production"]
  const liveIds = new Set(environments.map((environment) => environment.id))

  const save = async (body: UpdateIntegrationRequest) => {
    setSaving(true)
    setError(null)
    try {
      onSaved(await integrationsApi.update(projectId, integration.id, body))
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const bind = (environmentId: string, target: string) => {
    // Bindings of environments that no longer exist are dropped here.
    const next = Object.fromEntries(
      Object.entries(integration.auto_sync_targets).filter(([id]) => liveIds.has(id) && id !== environmentId),
    )
    if (target) next[environmentId] = target
    void save({ auto_sync_targets: next })
  }

  return (
    <div className="mt-4 space-y-3 border-t border-(--border) pt-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-(--text-primary)">{t("title")}</h3>
        <p className="text-sm text-(--text-secondary)">{t("description")}</p>
        {(!canAutoSync || !canRedeploy) && (
          <p className="text-sm font-medium text-(--text-secondary)">{t("maxOnly")}</p>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {environments.map((environment) => {
          const current = integration.auto_sync_targets[environment.id] ?? ""
          // Without the feature a bound environment can still be unbound, nothing else.
          const options = canAutoSync ? targets : targets.filter((target) => target === current)
          return (
            <label key={environment.id} className="block space-y-1">
              <span className="font-mono text-xs text-(--text-secondary)">
                {environment.display_name || environment.name}
              </span>
              <select
                value={current}
                disabled={saving || (!canAutoSync && !current)}
                onChange={(event) => bind(environment.id, event.target.value)}
                className={selectClass}
              >
                <option value="">{t("none")}</option>
                {options.map((target) => (
                  <option key={target} value={target}>
                    {target}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      {DEPLOYS_ITSELF.has(integration.provider) ? (
        <p className="text-xs text-(--text-muted)">{t("cloudflareDeploys")}</p>
      ) : (
        <div className="space-y-1">
          <Checkbox
            checked={integration.redeploy}
            disabled={saving || (!canRedeploy && !integration.redeploy)}
            onChange={(event) => void save({ redeploy: event.target.checked })}
          >
            {t("redeploy")}
          </Checkbox>
          <p className="text-xs text-(--text-muted)">
            {t("redeployHint")}
            {integration.provider === "vercel" && ` ${t("vercelProductionOnly")}`}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="break-words font-mono text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
