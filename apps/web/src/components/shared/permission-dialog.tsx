"use client"

import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const handleAction = () => {
    onAction?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showClose={false}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--background-muted)] text-[var(--text-primary)]">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <DialogHeader className="mb-0 pr-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-2">{description}</DialogDescription>
            </DialogHeader>
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button onClick={handleAction}>{actionLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
