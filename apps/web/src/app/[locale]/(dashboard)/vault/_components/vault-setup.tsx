"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { createPersonalVaultConfig, type PersonalVaultConfig } from "@/lib/api/personal-vault"
import { createPersonalVault } from "@/lib/personal-vault/crypto"
import { emptyPasswords, validateVaultPasswords, VaultPasswordFields, type VaultPasswordError } from "./password-fields"
import { RecoveryKeySheet } from "./recovery-key-sheet"

interface Props {
  onCreated: (config: PersonalVaultConfig, vaultKey: CryptoKey) => void
}

type Sealed = Awaited<ReturnType<typeof createPersonalVault>>

export function VaultSetup({ onCreated }: Props) {
  const t = useTranslations("vault")
  const [passwords, setPasswords] = useState(emptyPasswords)
  const [passwordError, setPasswordError] = useState<VaultPasswordError | null>(null)
  const [sealed, setSealed] = useState<Sealed | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const invalid = validateVaultPasswords(passwords)
    setPasswordError(invalid)
    if (invalid) return
    setBusy(true)
    try {
      // Keys are generated locally; nothing reaches the server until the recovery key is confirmed.
      setSealed(await createPersonalVault(passwords.master, passwords.extra))
      setPasswords(emptyPasswords)
    } catch {
      setError(t("errors.save"))
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirm() {
    if (!sealed) return
    setBusy(true)
    setError(null)
    try {
      onCreated(await createPersonalVaultConfig(sealed.config), sealed.vaultKey)
    } catch {
      setError(t("errors.save"))
      setBusy(false)
    }
  }

  if (sealed) {
    return <RecoveryKeySheet recoveryKey={sealed.recoveryKey} onConfirm={handleConfirm} busy={busy} error={error} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold">{t("setup.title")}</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">{t("setup.description")}</p>
      </div>
      <VaultPasswordFields value={passwords} onChange={setPasswords} error={passwordError} disabled={busy} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={busy}>
        {t("setup.submit")}
      </Button>
    </form>
  )
}
