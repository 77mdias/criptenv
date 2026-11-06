"use client"

import { FormEvent, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Eye, EyeOff, KeyRound } from "lucide-react"
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
import type { SecretKind } from "@/lib/api"
import { createSecretSchema } from "@/lib/validators/schemas"

const KINDS: SecretKind[] = ["config", "secret"]

export interface SecretFormValue {
  key: string
  value: string
  kind: SecretKind
}

type SecretFormInitialValue = Omit<SecretFormValue, "kind"> & { kind?: SecretKind }

interface SecretFormProps {
  open: boolean
  title: string
  initialValue?: SecretFormInitialValue | null
  loading?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (value: SecretFormValue) => Promise<void> | void
}

export function SecretForm({
  open,
  title,
  initialValue,
  loading = false,
  onOpenChange,
  onSubmit,
}: SecretFormProps) {
  if (!open) return null

  return (
    <SecretFormDialog
      key={initialValue?.key ?? "new-secret"}
      title={title}
      initialValue={initialValue}
      loading={loading}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  )
}

function SecretFormDialog({
  title,
  initialValue,
  loading,
  onOpenChange,
  onSubmit,
}: Omit<SecretFormProps, "open">) {
  const t = useTranslations("secrets.form")
  const tKinds = useTranslations("secrets.kinds")
  const secretSchema = useMemo(() => createSecretSchema(t), [t])
  const [keyName, setKeyName] = useState(initialValue?.key ?? "")
  const [value, setValue] = useState(initialValue?.value ?? "")
  const [showValue, setShowValue] = useState(false)
  const [kind, setKind] = useState<SecretKind>(initialValue?.kind ?? "config")
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = secretSchema.safeParse({ key: keyName, value })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("invalid"))
      return
    }

    setError(null)
    await onSubmit({ ...parsed.data, kind })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("encryptNote")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Input
            label={t("keyLabel")}
            placeholder="DATABASE_URL"
            value={keyName}
            onChange={(event) => setKeyName(event.target.value.toUpperCase())}
            disabled={Boolean(initialValue)}
            icon={KeyRound}
          />
          <Input
            label={t("valueLabel")}
            placeholder={t("valuePlaceholder")}
            type={showValue ? "text" : "password"}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            suffix={
              <button
                type="button"
                onClick={() => setShowValue((shown) => !shown)}
                aria-label={showValue ? t("hideValue") : t("showValue")}
                className="flex text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <fieldset className="space-y-2">
            <legend className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
              {tKinds("label")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {KINDS.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2 has-[:checked]:border-[var(--accent)]"
                >
                  <input
                    type="radio"
                    name="secret-kind"
                    value={option}
                    checked={kind === option}
                    onChange={() => setKind(option)}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text-primary)]">{tKinds(option)}</span>
                    <span className="block font-mono text-xs text-[var(--text-muted)]">
                      {tKinds(option === "config" ? "configHint" : "secretHint")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="font-mono text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={loading}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
