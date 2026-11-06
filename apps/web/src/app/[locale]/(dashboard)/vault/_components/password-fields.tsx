"use client"

import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"

// Also lets scripts/audit-i18n-keys.mjs expand `passwords.errors.${error}`.
export const PASSWORD_ERRORS = ["masterShort", "masterMismatch", "extraShort", "extraMismatch", "extraSameAsMaster"] as const
export type VaultPasswordError = (typeof PASSWORD_ERRORS)[number]

export interface VaultPasswords {
  master: string
  masterConfirm: string
  extra: string
  extraConfirm: string
}

export const emptyPasswords: VaultPasswords = { master: "", masterConfirm: "", extra: "", extraConfirm: "" }

export const MIN_MASTER_LENGTH = 12
export const MIN_EXTRA_LENGTH = 8

export function validateVaultPasswords(p: VaultPasswords): VaultPasswordError | null {
  if (p.master.length < MIN_MASTER_LENGTH) return "masterShort"
  if (p.master !== p.masterConfirm) return "masterMismatch"
  if (p.extra.length < MIN_EXTRA_LENGTH) return "extraShort"
  if (p.extra !== p.extraConfirm) return "extraMismatch"
  if (p.extra === p.master) return "extraSameAsMaster"
  return null
}

interface Props {
  value: VaultPasswords
  onChange: (value: VaultPasswords) => void
  error: VaultPasswordError | null
  disabled?: boolean
}

/** Master + extra password inputs shared by vault setup and recovery. */
export function VaultPasswordFields({ value, onChange, error, disabled }: Props) {
  const t = useTranslations("vault")
  const field = (key: keyof VaultPasswords) => ({
    type: "password",
    autoComplete: "new-password",
    value: value[key],
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: event.target.value }),
  })
  const errorText = error ? t(`passwords.errors.${error}`) : undefined
  const masterError = error?.startsWith("master") ? errorText : undefined
  const extraError = error?.startsWith("extra") ? errorText : undefined

  return (
    <div className="space-y-4">
      <Input label={t("passwords.master")} helperText={t("passwords.masterHelp")} error={masterError} {...field("master")} />
      <Input label={t("passwords.masterConfirm")} {...field("masterConfirm")} />
      <Input label={t("passwords.extra")} helperText={t("passwords.extraHelp")} error={extraError} {...field("extra")} />
      <Input label={t("passwords.extraConfirm")} {...field("extraConfirm")} />
    </div>
  )
}
