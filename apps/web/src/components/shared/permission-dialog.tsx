"use client"

import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PermissionDialogProps {
  open: boolean
  title?: string
  description?: string
  actionLabel?: string
  onOpenChange: (open: boolean) => void
  onAction?: () => void
}

export function PermissionDialog({
  open,
  title = "Permissão necessária",
  description = "Você não tem a permissão necessária para realizar esta ação neste projeto.",
  actionLabel = "Entendi",
  onOpenChange,
  onAction,
}: PermissionDialogProps) {
  if (!open) return null

  const handleAction = () => {
    onAction?.()
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar aviso de permissão"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-dialog-title"
        className="relative z-[81] w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--background-muted)] text-[var(--text-primary)]">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="permission-dialog-title" className="text-lg font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            <p className="mt-2 font-mono text-sm leading-relaxed text-[var(--text-tertiary)]">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleAction}>{actionLabel}</Button>
        </div>
      </div>
    </div>
  )
}
