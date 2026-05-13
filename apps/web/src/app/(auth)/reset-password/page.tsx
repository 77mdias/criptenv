"use client"

import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/api"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError("Token inválido ou expirado.")
      return
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("As senhas não conferem.")
      return
    }

    try {
      setLoading(true)
      setError(null)
      await authApi.resetPassword({ token, new_password: password })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Card className="w-full max-w-md p-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Senha redefinida</h2>
            <p className="text-[var(--text-tertiary)] font-mono text-sm">
              Sua senha foi alterada com sucesso. Faça login com a nova senha.
            </p>
            <Button variant="secondary" className="w-full mt-4" onClick={() => router.push("/login")}>
              Ir para login
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Redefinir senha</h2>
            <p className="text-sm text-[var(--text-tertiary)] font-mono">Digite sua nova senha abaixo.</p>
          </div>

          {!token && (
            <p className="text-red-500 text-sm font-mono">Token inválido ou expirado. Solicite um novo link.</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                Nova senha
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                Confirmar nova senha
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm font-mono">{error}</p>}

            <Button type="submit" loading={loading} fullWidth disabled={!token}>
              Redefinir senha
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Card className="w-full max-w-md p-8">
          <p className="text-center text-[var(--text-tertiary)] font-mono">Carregando...</p>
        </Card>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
