"use client"

import { FormEvent, useState } from "react"
import { KeyRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createSecretSchema } from "@/lib/validators/schemas"

export interface SecretFormValue {
  key: string
  value: string
}

interface SecretFormProps {
  open: boolean
  title: string
  initialValue?: SecretFormValue | null
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
  const [keyName, setKeyName] = useState(initialValue?.key ?? "")
  const [value, setValue] = useState(initialValue?.value ?? "")
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = createSecretSchema.safeParse({ key: keyName, value })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Secret inválido")
      return
    }

    setError(null)
    await onSubmit(parsed.data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>
            <p className="font-mono text-xs text-[var(--text-muted)]">
              O valor será cifrado no browser antes do envio.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Chave"
            placeholder="DATABASE_URL"
            value={keyName}
            onChange={(event) => setKeyName(event.target.value.toUpperCase())}
            disabled={Boolean(initialValue)}
            icon={KeyRound}
          />
          <Input
            label="Valor"
            placeholder="Valor secreto"
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {error && <p className="font-mono text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
