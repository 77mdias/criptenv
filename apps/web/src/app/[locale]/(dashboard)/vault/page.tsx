"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useRouter } from "@/i18n/navigation"
import { authApi } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/client"
import { getPersonalVaultConfig, type PersonalVaultConfig } from "@/lib/api/personal-vault"
import { useAuthStore } from "@/stores/auth"
import { PersonalVaultSessionProvider, usePersonalVaultSession } from "./_components/vault-session"
import { VaultItems } from "./_components/vault-items"
import { VaultRecovery } from "./_components/vault-recovery"
import { VaultSetup } from "./_components/vault-setup"
import { VaultUnlock } from "./_components/vault-unlock"

export default function PersonalVaultPage() {
  return (
    <PersonalVaultSessionProvider>
      <VaultScreen />
    </PersonalVaultSessionProvider>
  )
}

function VaultScreen() {
  const t = useTranslations("vault")
  const { vaultKey, unlock } = usePersonalVaultSession()
  // undefined = loading, null = not set up yet
  const [config, setConfig] = useState<PersonalVaultConfig | null | undefined>(undefined)
  const [recovering, setRecovering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 403 = valid session that is not a dashboard login (pre-migration or CLI): only a new sign-in helps.
  const [needsReauth, setNeedsReauth] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPersonalVaultConfig()
      .then((data) => {
        if (!cancelled) setConfig(data)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) setNeedsReauth(true)
        else setError(t("errors.load"))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  function opened(next: PersonalVaultConfig, key: CryptoKey) {
    setConfig(next)
    setRecovering(false)
    unlock(key)
  }

  let content
  if (needsReauth) content = <ReauthNotice />
  else if (error) content = <p role="alert" className="text-sm text-red-600">{error}</p>
  else if (config === undefined) content = <Skeleton className="h-40 w-full" aria-label={t("loading")} />
  else if (config === null) content = <VaultSetup onCreated={opened} />
  else if (vaultKey) content = <VaultItems vaultKey={vaultKey} config={config} onConfigChange={setConfig} />
  else if (recovering) content = <VaultRecovery config={config} onCancel={() => setRecovering(false)} onRecovered={opened} onConfigChange={setConfig} />
  else content = <VaultUnlock config={config} onForgot={() => setRecovering(true)} />

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-(--text-tertiary)">{t("subtitle")}</p>
      </header>
      <Card className="p-6">{content}</Card>
    </div>
  )
}

function ReauthNotice() {
  const t = useTranslations("vault")
  const router = useRouter()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [busy, setBusy] = useState(false)

  async function signInAgain() {
    setBusy(true)
    await authApi.signout().catch(() => undefined)
    clearAuth()
    router.push(`/login?redirect=${encodeURIComponent("/vault")}`)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--text-secondary)">{t("errors.reauth")}</p>
      <Button type="button" loading={busy} onClick={() => void signInAgain()}>
        {t("errors.reauthAction")}
      </Button>
    </div>
  )
}
