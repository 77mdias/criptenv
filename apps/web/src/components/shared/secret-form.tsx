"use client"

import { FormEvent, useState } from "react"
import { KeyRound } from "lucide-react"
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            O valor será cifrado no browser antes do envio.
          </DialogDescription>
        </DialogHeader>

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
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
