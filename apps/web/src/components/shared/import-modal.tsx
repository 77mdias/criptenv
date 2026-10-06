"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Upload } from "lucide-react"
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
import { createSecretSchema } from "@/lib/validators/schemas"

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (secrets: DecryptedSecret[]) => Promise<void> | void
}

function parseEnv(text: string): DecryptedSecret[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=")
      const key = line.slice(0, index).trim()
      const rawValue = line.slice(index + 1).trim()
      const value = rawValue.replace(/^(['"])(.*)\1$/, "$2")
      return { key, value }
    })
    .filter((secret) => createSecretSchema.safeParse(secret).success)
}

export function ImportModal({ open, onOpenChange, onImport }: ImportModalProps) {
  const t = useTranslations("secrets.import")
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const preview = useMemo(() => parseEnv(text), [text])

  if (!open) return null

  const submit = async () => {
    setLoading(true)
    try {
      await onImport(preview)
      setText("")
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <textarea
          className="min-h-64 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"DATABASE_URL=postgres://...\nAPI_KEY=sk_..."}
        />
        <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-[var(--text-muted)]">
            {t("validCount", { count: preview.length })}
          </p>
          <DialogFooter className="mt-0">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button icon={Upload} loading={loading} disabled={preview.length === 0} onClick={submit}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
