"use client"

import { useTranslations } from "next-intl"
import { Download, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type DecryptedSecret } from "@/components/shared/secret-row"

interface ExportModalProps {
  open: boolean
  secrets: DecryptedSecret[]
  onOpenChange: (open: boolean) => void
}

function formatEnv(secrets: DecryptedSecret[]): string {
  return secrets.map((secret) => `${secret.key}=${secret.value}`).join("\n")
}

export function ExportModal({ open, secrets, onOpenChange }: ExportModalProps) {
  const t = useTranslations("secrets.export")

  // Security (audit P0-2): the plaintext .env is only materialized in memory
  // at download time — it is never rendered on screen. No textarea preview.
  const download = () => {
    const blob = new Blob([formatEnv(secrets)], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = ".env"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("count", { count: secrets.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] px-3 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning, #f59e0b)]" />
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            {t("warning")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          <Button icon={Download} onClick={download} disabled={secrets.length === 0}>
            {t("download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
