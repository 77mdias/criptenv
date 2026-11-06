"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CryptoError } from "@/lib/crypto"
import { ApiError } from "@/lib/api/client"
import { getPersonalVaultConfig, updatePersonalVaultConfig, type PersonalVaultConfig } from "@/lib/api/personal-vault"
import { recoverVault } from "@/lib/personal-vault/crypto"
import { emptyPasswords, validateVaultPasswords, VaultPasswordFields, type VaultPasswordError } from "./password-fields"
import { RecoveryKeySheet } from "./recovery-key-sheet"

interface Props {
  config: PersonalVaultConfig
  onCancel: () => void
  onRecovered: (config: PersonalVaultConfig, vaultKey: CryptoKey) => void
  onConfigChange: (config: PersonalVaultConfig) => void
}

type Sealed = Awaited<ReturnType<typeof recoverVault>>

export function VaultRecovery({ config, onCancel, onRecovered, onConfigChange }: Props) {
  const t = useTranslations("vault")
  const [recoveryKey, setRecoveryKey] = useState("")
  const [passwords, setPasswords] = useState(emptyPasswords)
  const [passwordError, setPasswordError] = useState<VaultPasswordError | null>(null)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [sealed, setSealed] = useState<Sealed | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const invalid = validateVaultPasswords(passwords)
    setPasswordError(invalid)
    setKeyError(null)
    setError(null)
    if (invalid) return
    setBusy(true)
    try {
      setSealed(await recoverVault(config, recoveryKey, passwords.master, passwords.extra))
      setPasswords(emptyPasswords)
      setRecoveryKey("")
    } catch (err) {
      const code = err instanceof CryptoError ? err.code : null
      setKeyError(
        code === "INVALID_RECOVERY_KEY"
          ? t("recovery.invalidKey")
          : code === "WRONG_RECOVERY_KEY"
            ? t("recovery.wrongKey")
            : t("errors.save"),
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!sealed) return
    setBusy(true)
    setError(null)
    try {
      onRecovered(await updatePersonalVaultConfig(sealed.config, config.version), sealed.vaultKey)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // The key on screen was sealed against a stale config and was never saved: drop it.
        setSealed(null)
        const fresh = await getPersonalVaultConfig().catch(() => null)
        if (fresh) onConfigChange(fresh)
        setError(t("recovery.conflict"))
      } else {
        setError(t("errors.save"))
      }
      setBusy(false)
    }
  }

  if (sealed) {
    return <RecoveryKeySheet recoveryKey={sealed.recoveryKey} onConfirm={handleConfirm} busy={busy} error={error} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold">{t("recovery.title")}</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">{t("recovery.description")}</p>
      </div>
      <Input
        label={t("recovery.key")}
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        value={recoveryKey}
        error={keyError ?? undefined}
        disabled={busy}
        onChange={(event) => setRecoveryKey(event.target.value)}
      />
      <VaultPasswordFields value={passwords} onChange={setPasswords} error={passwordError} disabled={busy} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={!recoveryKey}>
          {t("recovery.submit")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          {t("recovery.cancel")}
        </Button>
      </div>
    </form>
  )
}
