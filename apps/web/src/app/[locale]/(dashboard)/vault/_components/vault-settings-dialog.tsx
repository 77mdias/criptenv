"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ApiError } from "@/lib/api/client"
import { CryptoError } from "@/lib/crypto"
import { getPersonalVaultConfig, updatePersonalVaultConfig, type PersonalVaultConfig } from "@/lib/api/personal-vault"
import {
  rewrapExtra,
  rewrapMaster,
  unlockProtectedKey,
  unlockVault,
  type PersonalVaultConfigInput,
} from "@/lib/personal-vault/crypto"
import { MIN_EXTRA_LENGTH, MIN_MASTER_LENGTH } from "./password-fields"

interface Props {
  open: boolean
  config: PersonalVaultConfig
  vaultKey: CryptoKey
  onClose: () => void
  onConfigChange: (config: PersonalVaultConfig) => void
  siteIcons: boolean
  onSiteIconsChange: (on: boolean) => void
}

export function VaultSettingsDialog({ open, onClose, siteIcons, onSiteIconsChange, ...rest }: Props) {
  const t = useTranslations("vault")
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>
        {open && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <Checkbox checked={siteIcons} onChange={(event) => onSiteIconsChange(event.target.checked)}>
                {t("settings.siteIcons")}
              </Checkbox>
              <p className="text-xs text-(--text-muted)">{t("settings.siteIconsHint")}</p>
            </div>
            <Separator />
            <PasswordChangeForm kind="master" {...rest} />
            <Separator />
            <PasswordChangeForm kind="extra" {...rest} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const LABELS = {
  master: { current: "settings.currentMaster", next: "settings.newMaster", confirm: "settings.confirmMaster", submit: "settings.submitMaster", short: "passwords.errors.masterShort" },
  extra: { current: "settings.currentExtra", next: "settings.newExtra", confirm: "settings.confirmExtra", submit: "settings.submitExtra", short: "passwords.errors.extraShort" },
} as const

function PasswordChangeForm({
  kind,
  config,
  vaultKey,
  onConfigChange,
}: Omit<Props, "open" | "onClose" | "siteIcons" | "onSiteIconsChange"> & { kind: "master" | "extra" }) {
  const t = useTranslations("vault")
  const labels = LABELS[kind]
  const [values, setValues] = useState({ current: "", next: "", confirm: "" })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setDone(false)
    if (values.next.length < (kind === "master" ? MIN_MASTER_LENGTH : MIN_EXTRA_LENGTH)) return setError(t(labels.short))
    if (values.next !== values.confirm) return setError(t("settings.mismatch"))
    setBusy(true)
    setError(null)
    try {
      // The other password is unknown here, so test it cryptographically: if the new one
      // opens the other key, the two passwords are equal and the second layer would be gone.
      if (await opensOtherKey(values.next)) {
        setError(t("passwords.errors.extraSameAsMaster"))
        return
      }
      const next: PersonalVaultConfigInput =
        kind === "master"
          ? await rewrapMaster(config, values.current, values.next)
          : await rewrapExtra(config, vaultKey, values.current, values.next)
      onConfigChange(await updatePersonalVaultConfig(next, config.version))
      setValues({ current: "", next: "", confirm: "" })
      setDone(true)
    } catch (err) {
      if (err instanceof CryptoError && err.code === "WRONG_PASSWORD") setError(t("settings.wrongCurrent"))
      else if (err instanceof ApiError && err.status === 409) {
        // Another tab saved first: pick up its version so the next try can succeed.
        const fresh = await getPersonalVaultConfig().catch(() => null)
        if (fresh) onConfigChange(fresh)
        setError(t("errors.conflict"))
      }
      else setError(t("errors.save"))
    } finally {
      setBusy(false)
    }
  }

  async function opensOtherKey(candidate: string): Promise<boolean> {
    try {
      if (kind === "master") await unlockProtectedKey(config, vaultKey, candidate)
      else await unlockVault(config, candidate)
      return true
    } catch {
      return false
    }
  }

  const field = (key: keyof typeof values, autoComplete: string) => ({
    type: "password",
    autoComplete,
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: event.target.value })),
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <Input label={t(labels.current)} {...field("current", "current-password")} />
      <Input label={t(labels.next)} {...field("next", "new-password")} />
      <Input label={t(labels.confirm)} {...field("confirm", "new-password")} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {done && <p role="status" className="text-sm text-green-700">{t("settings.saved")}</p>}
      <Button type="submit" variant="secondary" loading={busy} disabled={!values.current || !values.next}>
        {t(labels.submit)}
      </Button>
    </form>
  )
}
