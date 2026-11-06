"use client"

import { useRef, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CryptoError } from "@/lib/crypto"
import type { PersonalVaultConfig } from "@/lib/api/personal-vault"
import { unlockVault } from "@/lib/personal-vault/crypto"
import { usePersonalVaultSession } from "./vault-session"

interface Props {
  config: PersonalVaultConfig
  onForgot: () => void
}

export function VaultUnlock({ config, onForgot }: Props) {
  const t = useTranslations("vault")
  const { unlock } = usePersonalVaultSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      unlock(await unlockVault(config, password))
    } catch (err) {
      setError(err instanceof CryptoError && err.code === "WRONG_PASSWORD" ? t("unlock.wrong") : t("errors.load"))
      setPassword("")
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Lock aria-hidden className="h-4 w-4 text-(--accent)" />
          {t("unlock.title")}
        </h2>
        <p className="mt-1 text-sm text-(--text-secondary)">{t("unlock.description")}</p>
      </div>
      <Input
        ref={inputRef}
        label={t("passwords.master")}
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        error={error ?? undefined}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={!password}>
          {t("unlock.submit")}
        </Button>
        <Button type="button" variant="ghost" onClick={onForgot}>
          {t("unlock.forgot")}
        </Button>
      </div>
    </form>
  )
}
