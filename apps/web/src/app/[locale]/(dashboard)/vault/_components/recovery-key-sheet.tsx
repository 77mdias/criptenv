"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Printer, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

interface Props {
  recoveryKey: string
  onConfirm: () => void
  busy?: boolean
  error?: string | null
}

/** Shows a freshly generated recovery key once; nothing is saved until confirmed. */
export function RecoveryKeySheet({ recoveryKey, onConfirm, busy, error }: Props) {
  const t = useTranslations("vault")
  const [saved, setSaved] = useState(false)

  return (
    <div className="recovery-sheet space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{t("recoverySheet.title")}</h2>
        <p className="mt-1 text-sm text-(--text-secondary)">{t("recoverySheet.description")}</p>
      </div>
      <p
        className="rounded-lg border border-(--border) bg-(--background-subtle) p-4 text-center font-mono text-base tracking-wider break-all select-all"
        aria-label={t("recoverySheet.title")}
      >
        {recoveryKey}
      </p>
      <p className="flex gap-2 text-sm text-(--text-secondary)">
        <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-(--accent)" />
        <span>{t("recoverySheet.warning")}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button type="button" variant="secondary" icon={Printer} onClick={() => window.print()}>
          {t("recoverySheet.print")}
        </Button>
      </div>
      <div className="print:hidden">
        <Checkbox checked={saved} onChange={(event) => setSaved(event.target.checked)}>
          {t("recoverySheet.confirm")}
        </Checkbox>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 print:hidden">{error}</p>}
      <Button type="button" className="print:hidden" disabled={!saved} loading={busy} onClick={onConfirm}>
        {t("recoverySheet.finish")}
      </Button>
    </div>
  )
}
