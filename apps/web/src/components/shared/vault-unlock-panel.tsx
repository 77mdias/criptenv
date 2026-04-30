"use client"

import { FormEvent, useState } from "react"
import { KeyRound, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { deriveSessionKeyFromBase64Salt } from "@/lib/crypto"

interface VaultUnlockPanelProps {
  kdfSalt?: string
  onUnlock: (key: CryptoKey) => void
}

export function VaultUnlockPanel({ kdfSalt, onUnlock }: VaultUnlockPanelProps) {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || !kdfSalt) return

    setLoading(true)
    setError(null)
    try {
      const key = await deriveSessionKeyFromBase64Salt(password, kdfSalt)
      setPassword("")
      onUnlock(key)
    } catch {
      setError("Não foi possível desbloquear o vault com essa senha.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--background-muted)]">
          <Lock className="h-5 w-5 text-[var(--text-tertiary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Desbloquear vault
          </h2>
          <p className="font-mono text-xs text-[var(--text-muted)]">
            A senha mestra fica apenas no browser e a chave some ao recarregar.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Senha mestra"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={error ?? undefined}
          icon={KeyRound}
        />
        {!kdfSalt && (
          <p className="font-mono text-xs text-red-600">
            Sua sessão não tem kdf_salt. Faça login novamente para renovar o contrato de criptografia.
          </p>
        )}
        <Button type="submit" loading={loading} disabled={!password || !kdfSalt} fullWidth>
          Desbloquear
        </Button>
      </form>
    </Card>
  )
}
