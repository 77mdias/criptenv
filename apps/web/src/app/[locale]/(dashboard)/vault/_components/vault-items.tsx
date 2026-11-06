"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { KeyRound, Lock, StickyNote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { listPersonalVaultItems, type PersonalVaultItem } from "@/lib/api/personal-vault"
import { decryptSummary, type ItemSummary } from "@/lib/personal-vault/crypto"
import { usePersonalVaultSession } from "./vault-session"

export interface DecryptedEntry {
  item: PersonalVaultItem
  summary: ItemSummary
}

interface Props {
  vaultKey: CryptoKey
}

export function VaultItems({ vaultKey }: Props) {
  const t = useTranslations("vault")
  const { lock } = usePersonalVaultSession()
  const [entries, setEntries] = useState<DecryptedEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listPersonalVaultItems()
      .then((items) => Promise.all(items.map(async (item) => ({ item, summary: await decryptSummary(item.summary, vaultKey) }))))
      .then((decrypted) => {
        if (!cancelled) setEntries(decrypted)
      })
      .catch(() => {
        if (!cancelled) setError(t("errors.load"))
      })
    return () => {
      cancelled = true
    }
  }, [vaultKey, t])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="secondary" icon={Lock} onClick={lock}>
          {t("items.lock")}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!entries && !error && <Skeleton className="h-24 w-full" />}
      {entries?.length === 0 && <EmptyState icon={KeyRound} title={t("items.empty")} description={t("items.emptyDescription")} />}
      {entries && entries.length > 0 && (
        <ul className="divide-y divide-(--border) rounded-lg border border-(--border)">
          {entries.map(({ item, summary }) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              {summary.type === "login" ? (
                <KeyRound aria-hidden className="h-4 w-4 shrink-0 text-(--text-muted)" />
              ) : (
                <StickyNote aria-hidden className="h-4 w-4 shrink-0 text-(--text-muted)" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{summary.title}</p>
                {summary.username && <p className="truncate text-xs text-(--text-muted)">{summary.username}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
