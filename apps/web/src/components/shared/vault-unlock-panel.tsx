"use client"

import { FormEvent, useState } from "react"
import { KeyRound, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { unlockProjectVault, type ProjectVaultConfig, type ProjectVaultMaterial } from "@/lib/crypto"

interface VaultUnlockPanelProps {
  vaultConfig?: ProjectVaultConfig | null
  onUnlock: (material: ProjectVaultMaterial) => void
}

export function VaultUnlockPanel({ vaultConfig, onUnlock }: VaultUnlockPanelProps) {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || !vaultConfig) return

    setLoading(true)
    setError(null)
    try {
      const material = await unlockProjectVault(password, vaultConfig)
      setPassword("")
      onUnlock(material)
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
            Use a senha do vault deste projeto. A chave fica apenas no browser e some ao recarregar.
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
        {!vaultConfig && (
          <p className="font-mono text-xs text-red-600">
            Este projeto ainda não tem configuração de vault por projeto.
          </p>
        )}
        <Button type="submit" loading={loading} disabled={!password || !vaultConfig} fullWidth>
          Desbloquear
        </Button>
      </form>
    </Card>
  )
}
