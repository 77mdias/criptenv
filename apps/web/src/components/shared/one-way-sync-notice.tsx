"use client"

import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"

/** Sync only goes CriptEnv → hosting. Shown to every plan wherever a hosting connection is set up or used. */
export function OneWaySyncNotice() {
  const t = useTranslations("integrations.oneWay")

  return (
    <div role="note" className="flex gap-3 rounded-lg border border-(--border) bg-(--background-muted) p-3 text-sm">
      <ArrowRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-(--text-tertiary)" />
      <div className="space-y-1">
        <p className="font-medium text-(--text-primary)">{t("title")}</p>
        <p className="text-(--text-secondary)">{t("body")}</p>
      </div>
    </div>
  )
}
