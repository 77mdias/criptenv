"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authApi, ApiError } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"

export default function TwoFactorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setUser = useAuthStore((state) => state.setUser)
  const [code, setCode] = useState("")
  const [rememberDevice, setRememberDevice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const next = searchParams.get("next") || "/dashboard"

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const normalizedCode = code.trim().replace(/\s+/g, "")
    if (normalizedCode.length < 6) {
      setError("Informe o código do autenticador ou um código de backup.")
      return
    }

    try {
      setIsSubmitting(true)
      const result = await authApi.verify2FAChallenge({
        code: normalizedCode,
        remember_device: rememberDevice,
      })
      setUser(result.user)
      router.push(next)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Código inválido ou desafio expirado. Faça login novamente se necessário.")
        return
      }
      setError(err instanceof Error ? err.message : "Não foi possível validar o 2FA.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Verificação em duas etapas</h1>
          <p className="text-sm leading-6 text-[var(--text-tertiary)]">
            Digite o código do app autenticador ou um código de backup para concluir o acesso.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Código 2FA"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          icon={KeyRound}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />

        <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
          />
          <span>Lembrar este dispositivo por 30 dias</span>
        </label>

        <Button type="submit" fullWidth loading={isSubmitting}>
          Verificar e continuar
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--text-tertiary)]">
        Precisa trocar de conta?{" "}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  )
}
