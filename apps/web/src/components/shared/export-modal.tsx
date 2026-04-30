"use client"

import { Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { type DecryptedSecret } from "@/components/shared/secret-row"

interface ExportModalProps {
  open: boolean
  secrets: DecryptedSecret[]
  onOpenChange: (open: boolean) => void
}

function formatEnv(secrets: DecryptedSecret[]) {
  return secrets.map((secret) => `${secret.key}=${secret.value}`).join("\n")
}

export function ExportModal({ open, secrets, onOpenChange }: ExportModalProps) {
  if (!open) return null

  const text = formatEnv(secrets)

  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = ".env"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <Card className="relative z-50 w-full max-w-2xl shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Exportar .env
            </h2>
            <p className="font-mono text-xs text-[var(--text-muted)]">
              O conteúdo abaixo é descriptografado localmente.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <textarea
          readOnly
          className="min-h-64 w-full rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
          value={text}
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button icon={Download} onClick={download} disabled={secrets.length === 0}>
            Baixar .env
          </Button>
        </div>
      </Card>
    </div>
  )
}
