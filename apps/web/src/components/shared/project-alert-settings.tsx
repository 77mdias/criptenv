"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import * as Switch from "@radix-ui/react-switch"
import { AlertTriangle, BellRing, Check, Webhook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { alertSettingsApi, type AlertSettingsResponse, type AlertSettingsUpdate } from "@/lib/api/alert-settings"

interface ProjectAlertSettingsProps {
  projectId: string
}

// Numbers only — the copy lives in the catalogue.
const LEAD_TIME_OPTIONS = [1, 3, 7, 14, 30]

function SwitchField({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>
      </div>
      <Switch.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-[var(--background-muted)] outline-none transition-colors data-[state=checked]:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5" />
      </Switch.Root>
    </div>
  )
}

function ProjectAlertSettingsContent({ projectId }: ProjectAlertSettingsProps) {
  const t = useTranslations("settings.alerts")
  const [settings, setSettings] = useState<AlertSettingsResponse | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [leadTime, setLeadTime] = useState(7)
  const [channels, setChannels] = useState({ in_app: true, email: false, webhook: false })
  const [webhookUrl, setWebhookUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const mutationIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    void alertSettingsApi.get(projectId).then((data) => {
      if (cancelled) return
      setLoadError(false)
      setSettings(data)
      setEnabled(data.enabled)
      setLeadTime(data.default_notify_days_before)
      setChannels(data.channels)
    }).catch(() => {
      if (!cancelled) {
        setLoadError(true)
        setError(t("loadError"))
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [projectId, retryCount])

  const updateSettings = async (webhook_url?: string | null) => {
    const body: AlertSettingsUpdate = {
      enabled,
      default_notify_days_before: leadTime,
      channels,
    }
    if (webhook_url !== undefined) body.webhook_url = webhook_url

    return alertSettingsApi.update(projectId, body)
  }

  const applySettings = (data: AlertSettingsResponse) => {
    setSettings(data)
    setEnabled(data.enabled)
    setLeadTime(data.default_notify_days_before)
    setChannels(data.channels)
  }

  const handleSave = async () => {
    const mutationId = ++mutationIdRef.current
    if (channels.webhook && !settings?.webhook_configured && !webhookUrl.trim()) {
      setError(t("webhook.urlRequired"))
      setSuccess(null)
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      const data = await updateSettings(webhookUrl.trim() || undefined)
      if (mutationId !== mutationIdRef.current) return
      applySettings(data)
      setWebhookUrl("")
      setSuccess(t("saved"))
    } catch {
      if (mutationId === mutationIdRef.current) setError(t("saveError"))
    } finally {
      if (mutationId === mutationIdRef.current) setSaving(false)
    }
  }

  const handleRemoveWebhook = async () => {
    const mutationId = ++mutationIdRef.current
    try {
      setRemoving(true)
      setError(null)
      setSuccess(null)
      const data = await updateSettings(null)
      if (mutationId !== mutationIdRef.current) return
      applySettings(data)
      setWebhookUrl("")
      setSuccess(t("webhook.removed"))
    } catch {
      if (mutationId === mutationIdRef.current) setError(t("saveError"))
    } finally {
      if (mutationId === mutationIdRef.current) setRemoving(false)
    }
  }

  const handleTestWebhook = async () => {
    const mutationId = ++mutationIdRef.current
    try {
      setTesting(true)
      setError(null)
      setSuccess(null)
      await alertSettingsApi.testWebhook(projectId)
      if (mutationId !== mutationIdRef.current) return
      setSuccess(t("webhook.testSuccess"))
    } catch {
      if (mutationId === mutationIdRef.current) setError(t("webhook.testError"))
    } finally {
      if (mutationId === mutationIdRef.current) setTesting(false)
    }
  }

  if (loading) {
    return (
      <Card className="space-y-4 p-6" aria-label={t("loadingAria")}>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </Card>
    )
  }

  if (loadError || !settings) {
    return (
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)]">{t("title")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-red-600" role="alert">
            {t("loadErrorDetail")}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setLoading(true)
            setLoadError(false)
            setError(null)
            setRetryCount((current) => current + 1)
          }}
        >
          {t("retry")}
        </Button>
      </Card>
    )
  }

  const mutationActive = saving || removing || testing
  const allChannelsDisabled = !channels.in_app && !channels.email && !channels.webhook
  const showWebhookConfig = channels.webhook || Boolean(settings?.webhook_configured) || Boolean(webhookUrl)

  return (
    <Card className="space-y-5 p-4 sm:p-6" data-testid="project-alert-settings">
      <div className="flex min-w-0 items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0">
          <h2 className="font-semibold text-[var(--text-primary)]">{t("title")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            {t("description")}
          </p>
        </div>
      </div>

      <SwitchField
        label={t("enabled.label")}
        description={t("enabled.description")}
        checked={enabled}
        disabled={mutationActive}
        onCheckedChange={setEnabled}
      />

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t("channels.title")}</h3>
        <SwitchField label={t("channels.inApp.label")} description={t("channels.inApp.description")} checked={channels.in_app} disabled={mutationActive} onCheckedChange={(checked) => setChannels((current) => ({ ...current, in_app: checked }))} />
        <SwitchField label={t("channels.email.label")} description={t("channels.email.description")} checked={channels.email} disabled={mutationActive} onCheckedChange={(checked) => setChannels((current) => ({ ...current, email: checked }))} />
        <SwitchField label={t("channels.webhook.label")} description={t("channels.webhook.description")} checked={channels.webhook} disabled={mutationActive} onCheckedChange={(checked) => setChannels((current) => ({ ...current, webhook: checked }))} />
      </div>

      {allChannelsDisabled && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("allDisabled")}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="alert-lead-time" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t("leadTime.label")}</label>
        <select id="alert-lead-time" value={leadTime} disabled={mutationActive} onChange={(event) => setLeadTime(Number(event.target.value))} className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
          {LEAD_TIME_OPTIONS.map((days) => <option key={days} value={days}>{t("leadTime.option", { days })}</option>)}
        </select>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">{t("leadTime.hint")}</p>
      </div>

      {showWebhookConfig && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">{t("webhook.title")}</h3>
              {settings?.webhook_configured && <p className="mt-1 break-all text-xs text-[var(--text-muted)]">{t("webhook.configured", { url: settings.webhook_url_preview ?? "" })}</p>}
            </div>
          </div>
          <Input id="alert-webhook-url" label={settings?.webhook_configured ? t("webhook.urlLabelNew") : t("webhook.urlLabel")} type="url" value={webhookUrl} disabled={mutationActive} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://example.com/webhook" helperText={t("webhook.urlHelper")} />
          <div className="flex flex-wrap gap-2">
            {settings?.webhook_configured && <Button size="sm" variant="secondary" disabled={mutationActive} onClick={handleTestWebhook} loading={testing}>{t("webhook.test")}</Button>}
            {settings?.webhook_configured && <Button size="sm" variant="ghost" disabled={mutationActive} onClick={handleRemoveWebhook} loading={removing}>{t("webhook.remove")}</Button>}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {success && <p className="flex items-center gap-2 text-sm text-green-700" role="status"><Check className="h-4 w-4" />{success}</p>}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutationActive} loading={saving}>{t("save")}</Button>
      </div>
    </Card>
  )
}

export function ProjectAlertSettings({ projectId }: ProjectAlertSettingsProps) {
  return <ProjectAlertSettingsContent key={projectId} projectId={projectId} />
}
