"use client"

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

function formatEnv(secrets: DecryptedSecret[]) {
  return secrets.map((secret) => `${secret.key}=${secret.value}`).join("\n")
}

export function ExportModal({ open, secrets, onOpenChange }: ExportModalProps) {
  // Security (audit P0-2): the plaintext .env is only materialized in memory
  // at download time — it is never rendered on screen. No textarea preview.
  const download = () => {
    const blob = new Blob([formatEnv(secrets)], { type: "text/plain;charset=utf-8" })
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
          <DialogTitle>Exportar .env</DialogTitle>
          <DialogDescription>
            {secrets.length}{" "}
            {secrets.length === 1 ? "segredo será exportado" : "segredos serão exportados"}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background-subtle)] px-3 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning, #f59e0b)]" />
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            O arquivo é descriptografado localmente no momento do download e contém
            todos os segredos em texto plano. Guarde-o em local seguro e evite
            versioná-lo. Nenhum preview é exibido nesta tela para evitar exposição
            acidental.
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button icon={Download} onClick={download} disabled={secrets.length === 0}>
            Baixar .env
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
