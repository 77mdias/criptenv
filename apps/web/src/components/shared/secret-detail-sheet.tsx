"use client"

import { useEffect, useRef, useState } from "react"
import { Clipboard, Clock, Lock, RotateCcw } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ExpirationBadge } from "@/components/shared/expiration-badge"
import type { DecryptedSecret } from "@/components/shared/secret-row"
import { rotationApi } from "@/lib/api"
import type { Environment, RotationHistoryItem, SecretExpiration } from "@/lib/api"
import { formatRelativeTime } from "@/lib/utils"

interface SecretDetailSheetProps {
  projectId: string
  environment: Environment | null
  /** Open when set; `null` closes the sheet. */
  secretKey: string | null
  expiration?: SecretExpiration
  /** Decrypted secret — only present while the vault is unlocked. */
  secret?: DecryptedSecret
  canManageSecrets: boolean
  /** Bumps after a push/rotation so the history is refetched. */
  historyVersion: number
  copied: boolean
  onCopy: (secret: DecryptedSecret) => void
  onRotate: (secret: DecryptedSecret) => void
  onSetExpiration: (secret: DecryptedSecret) => void
  onClose: () => void
}

export function SecretDetailSheet({
  projectId,
  environment,
  secretKey,
  expiration,
  secret,
  canManageSecrets,
  historyVersion,
  copied,
  onCopy,
  onRotate,
  onSetExpiration,
  onClose,
}: SecretDetailSheetProps) {
  const t = useTranslations("secrets.detail")
  const tRow = useTranslations("secrets.row")
  const locale = useLocale()
  const environmentId = environment?.id
  // A result only counts for the request that produced it, so a stale one reads as "loading".
  const requestKey = `${environmentId}:${secretKey}:${historyVersion}`
  const [result, setResult] = useState<{ key: string; items?: RotationHistoryItem[]; error?: boolean } | null>(null)
  const current = result?.key === requestKey ? result : null
  const history = current?.items ?? null
  const historyError = Boolean(current?.error)
  // Opened without a Radix Trigger, so Radix has nowhere to return focus; restore it ourselves.
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!secretKey || !environmentId) return
    let cancelled = false
    rotationApi
      .getRotationHistory(projectId, environmentId, secretKey)
      .then((data) => !cancelled && setResult({ key: requestKey, items: data.items }))
      .catch(() => !cancelled && setResult({ key: requestKey, error: true }))
    return () => {
      cancelled = true
    }
  }, [projectId, environmentId, secretKey, requestKey])

  // Expiration does not need the vault: a key-only stand-in is enough for the modal.
  const expirationTarget: DecryptedSecret = secret ?? {
    key: secretKey ?? "",
    value: "",
    expiresAt: expiration?.expires_at ?? null,
  }

  return (
    <Dialog open={Boolean(secretKey)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement as HTMLElement | null
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef.current?.isConnected) {
            event.preventDefault()
            returnFocusRef.current.focus()
          }
        }}
        className="left-auto right-0 top-0 h-full max-h-none max-w-md translate-x-0 translate-y-0 rounded-none border-y-0 border-r-0 sm:rounded-l-xl">
        <DialogHeader>
          <DialogTitle className="break-all font-mono">{secretKey}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="px-2 py-0 text-[10px]">
                {environment?.display_name || environment?.name}
              </Badge>
              {secret?.updatedAt && <span>{t("updated", { when: formatRelativeTime(secret.updatedAt, locale) })}</span>}
            </div>
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 border-t border-[var(--border)] py-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("actions")}</h3>
          {secret ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => onCopy(secret)}>
                <Clipboard className="h-3.5 w-3.5" />
                {tRow("copy")}
              </Button>
              {canManageSecrets && (
                <Button variant="secondary" size="sm" onClick={() => onRotate(secret)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {tRow("rotate")}
                </Button>
              )}
              {copied && <span className="font-mono text-xs text-green-700">{tRow("copied")}</span>}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              {t("lockedHint")}
            </p>
          )}
        </section>

        <section className="space-y-3 border-t border-[var(--border)] py-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("expiration")}</h3>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {expiration ? (
              <ExpirationBadge
                daysUntilExpiration={expiration.days_until_expiration}
                isExpired={Boolean(expiration.is_expired)}
                expiresAt={expiration.expires_at}
              />
            ) : (
              <span className="text-sm text-[var(--text-tertiary)]">{t("noExpiration")}</span>
            )}
            {canManageSecrets && (
              <Button variant="ghost" size="sm" onClick={() => onSetExpiration(expirationTarget)}>
                <Clock className="h-3.5 w-3.5" />
                {tRow("setExpiration")}
              </Button>
            )}
          </div>
        </section>

        <section className="space-y-3 border-t border-[var(--border)] py-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("history")}</h3>
          {historyError ? (
            <p className="text-sm text-red-600">{t("historyError")}</p>
          ) : history === null ? (
            <p className="text-sm text-[var(--text-tertiary)]">{t("historyLoading")}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">{t("historyEmpty")}</p>
          ) : (
            <ol className="space-y-3 border-l border-[var(--border)] pl-4">
              {history.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-sm text-[var(--text-primary)]">
                      v{item.previous_version} → v{item.new_version}
                    </span>
                    <time
                      dateTime={item.rotated_at}
                      title={new Date(item.rotated_at).toLocaleString(locale)}
                      className="font-mono text-xs text-[var(--text-muted)]"
                    >
                      {formatRelativeTime(item.rotated_at, locale)}
                    </time>
                  </div>
                  {item.reason && <p className="text-xs text-[var(--text-tertiary)]">{item.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
