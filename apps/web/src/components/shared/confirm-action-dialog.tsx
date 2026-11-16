"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { twoFactorRefusal } from "@/lib/api/client"
import { useAuthStore } from "@/stores/auth"

interface ConfirmActionDialogProps {
  open: boolean
  title: string
  /** Leave out when the title already says it all. */
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  /**
   * The API guards this action with 2FA (deleting a secret). An account with
   * 2FA on is asked for the code, which `onConfirm` receives; `onConfirm` must
   * reject with the API's refusal so a missing or wrong code is shown here.
   */
  secondFactor?: boolean
  onConfirm: (twoFactorCode?: string) => void | Promise<void>
  onOpenChange: (open: boolean) => void
}

export function ConfirmActionDialog({ open, onOpenChange, description, ...rest }: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix warns about a dialog with no description unless aria-describedby is cleared. */}
      <DialogContent className="max-w-md" showClose={false} {...(description ? {} : { "aria-describedby": undefined })}>
        {/* Mounted only while open, so the typed code and its error never outlive the dialog. */}
        <ConfirmBody description={description} onOpenChange={onOpenChange} {...rest} />
      </DialogContent>
    </Dialog>
  )
}

// Authenticator codes have 6 digits; backup codes are longer.
const MIN_CODE_LENGTH = 6

function ConfirmBody({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  secondFactor = false,
  onConfirm,
  onOpenChange,
}: Omit<ConfirmActionDialogProps, "open">) {
  // Label defaults resolve per locale; callers may still pass their own.
  const t = useTranslations("account")
  const hasTwoFactor = useAuthStore((state) => state.user?.two_factor_enabled === true)
  // The API asked for a code this page did not expect (2FA turned on in another tab).
  const [asked, setAsked] = useState(false)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const needsCode = secondFactor && (hasTwoFactor || asked)
  const ready = !needsCode || code.trim().length >= MIN_CODE_LENGTH

  async function confirm() {
    if (!ready || loading) return
    setCodeError(null)
    try {
      await onConfirm(needsCode ? code.trim() : undefined)
    } catch (err) {
      const refusal = secondFactor ? twoFactorRefusal(err) : null
      if (!refusal) throw err
      if (refusal === "required") setAsked(true)
      setCode("")
      // Back to the field: the click left the focus on the confirm button.
      codeInput.current?.focus()
      setCodeError(
        refusal === "required"
          ? t("dialog.twoFactorRequired")
          : refusal === "invalid"
            ? t("dialog.twoFactorInvalid")
            : t("dialog.twoFactorLocked"),
      )
    }
  }

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--background-muted)] text-[var(--text-primary)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <DialogHeader className="mb-0 pr-0">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription className="mt-2">{description}</DialogDescription>}
          </DialogHeader>
        </div>
      </div>
      {needsCode && (
        <div className="mt-5">
          <Input
            ref={codeInput}
            label={t("dialog.twoFactorLabel")}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void confirm()
            }}
            autoComplete="one-time-code"
            autoFocus
            maxLength={16}
            disabled={loading}
            error={codeError ?? undefined}
            helperText={t("dialog.twoFactorHelp")}
          />
        </div>
      )}
      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          {cancelLabel ?? t("dialog.cancel")}
        </Button>
        <Button variant={destructive ? "danger" : "primary"} loading={loading} disabled={!ready} onClick={() => void confirm()}>
          {confirmLabel ?? t("dialog.confirm")}
        </Button>
      </DialogFooter>
    </>
  )
}
