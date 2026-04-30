"use client"

import { useMemo, useState } from "react"
import { Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
              Importar .env
            </h2>
            <p className="font-mono text-xs text-[var(--text-muted)]">
              Cole o conteúdo. Linhas inválidas serão ignoradas.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <textarea
          className="min-h-64 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"DATABASE_URL=postgres://...\nAPI_KEY=sk_..."}
        />
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="font-mono text-xs text-[var(--text-muted)]">
            {preview.length} secrets válidos detectados
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button icon={Upload} loading={loading} disabled={preview.length === 0} onClick={submit}>
              Importar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
