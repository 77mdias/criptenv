"use client"

import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import type { AutoSyncResult } from "@/lib/auto-sync"

interface AutoSyncNoticeProps {
  /** One entry per hosting connection the save was sent to; null or empty renders nothing. */
  results: AutoSyncResult[] | null
  /** Sends the environment again to the bound connections, with the removals a failed send still owes. */
  onResend: () => void
  onDismiss: () => void
}

/** What happened to the automatic send after a save. A failure here never undoes the save. */
export function AutoSyncNotice({ results, onResend, onDismiss }: AutoSyncNoticeProps) {
  const t = useTranslations("secrets.autoSync")
  if (!results || results.length === 0) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-(--border) bg-(--background-muted) p-3 text-sm">
      <div className="flex-1 space-y-2">
        {results.map(({ integration, target, ok, message, deployScheduled, deleteKeys }) =>
          ok ? (
            <p key={integration.id} role="status" className="text-(--text-secondary)">
              {t("sent", { name: integration.name, target })}
              {deployScheduled && ` ${t("deploy")}`}
            </p>
          ) : (
            <div key={integration.id} role="alert" className="space-y-1.5">
              <p className="text-red-600">{t("failed", { name: integration.name, target })}</p>
              {deleteKeys.length > 0 && (
                <p className="break-words text-(--text-secondary)">{t("notRemoved", { keys: deleteKeys.join(", ") })}</p>
              )}
              {message && <p className="break-words font-mono text-xs text-(--text-tertiary)">{message}</p>}
              <Button type="button" size="sm" variant="secondary" onClick={onResend}>
                {t("resend")}
              </Button>
            </div>
          ),
        )}
      </div>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={onDismiss}
        className="rounded p-1 text-(--text-tertiary) hover:text-(--text-primary) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}
