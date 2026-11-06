"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { CryptoError } from "@/lib/crypto"
import type { PersonalVaultConfig } from "@/lib/api/personal-vault"
import { decryptItem, unlockProtectedKey, type PersonalVaultItemPlain } from "@/lib/personal-vault/crypto"
import type { DecryptedEntry } from "./vault-items"

interface Props {
  entry: DecryptedEntry | null
  config: PersonalVaultConfig
  vaultKey: CryptoKey
  onClose: () => void
}

/**
 * Shows an item's secret fields. Protected items ask for the extra password on
 * every open; the protected key lives only inside the unlock handler, and the
 * decrypted fields are dropped when the dialog closes (the body unmounts).
 */
export function ProtectedRevealDialog({ entry, config, vaultKey, onClose }: Props) {
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {entry && <RevealBody key={entry.item.id} entry={entry} config={config} vaultKey={vaultKey} />}
      </DialogContent>
    </Dialog>
  )
}

function RevealBody({ entry, config, vaultKey }: { entry: DecryptedEntry; config: PersonalVaultConfig; vaultKey: CryptoKey }) {
  const t = useTranslations("vault")
  const [plain, setPlain] = useState<PersonalVaultItemPlain | null>(null)
  const [extra, setExtra] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (entry.item.protected) return
    let cancelled = false
    decryptItem(entry.item, vaultKey, vaultKey)
      .then((value) => {
        if (!cancelled) setPlain(value)
      })
      .catch(() => {
        if (!cancelled) setError(t("errors.load"))
      })
    return () => {
      cancelled = true
    }
  }, [entry, vaultKey, t])

  async function handleUnlock(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const protectedKey = await unlockProtectedKey(config, vaultKey, extra)
      setPlain(await decryptItem(entry.item, vaultKey, protectedKey))
    } catch (err) {
      setError(err instanceof CryptoError && err.code === "WRONG_PASSWORD" ? t("reveal.wrongExtra") : t("errors.load"))
    } finally {
      setExtra("")
      setBusy(false)
    }
  }

  const fields: [string, string][] = !plain
    ? []
    : plain.type === "login"
      ? [
          [t("itemDialog.username"), plain.username],
          [t("itemDialog.password"), plain.password],
          [t("itemDialog.url"), plain.url],
          [t("itemDialog.notes"), plain.notes],
        ]
      : [[t("itemDialog.content"), plain.content]]

  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry.summary.title}</DialogTitle>
        {entry.item.protected && !plain && <DialogDescription>{t("reveal.unlockDescription")}</DialogDescription>}
      </DialogHeader>
      {entry.item.protected && !plain ? (
        <form onSubmit={handleUnlock} className="space-y-4" noValidate>
          <Input
            label={t("passwords.extra")}
            type="password"
            autoComplete="off"
            autoFocus
            value={extra}
            error={error ?? undefined}
            onChange={(event) => setExtra(event.target.value)}
          />
          <Button type="submit" loading={busy} disabled={!extra}>
            {t("reveal.unlock")}
          </Button>
        </form>
      ) : (
        <dl className="space-y-3">
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {fields
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">{label}</dt>
                  <dd className="mt-0.5 font-mono text-sm break-all whitespace-pre-wrap">{value}</dd>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t("reveal.copy", { field: label })}
                  onClick={() => void navigator.clipboard?.writeText(value)}
                >
                  <Copy aria-hidden className="h-4 w-4" />
                </Button>
              </div>
            ))}
        </dl>
      )}
    </>
  )
}
