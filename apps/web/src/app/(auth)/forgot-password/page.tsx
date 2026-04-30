"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    try {
      setLoading(true)
      setError(null)
      // TODO: Implement API call when backend endpoint exists
      // await authApi.forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar email")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Card className="w-full max-w-md p-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              Email enviado
            </h2>
            <p className="text-[var(--text-tertiary)] font-mono text-sm">
              Enviamos um link de recuperação para{" "}
              <span className="text-[var(--text-primary)] font-semibold">{email}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Verifique sua caixa de spam se não receber em alguns minutos.
            </p>
            <Button
              variant="secondary"
              className="w-full mt-4"
              onClick={() => {
                setSent(false)
                setEmail("")
              }}
            >
              Enviar novamente
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
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              Esqueceu a senha?
            </h2>
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              Digite seu email para receber um link de recuperação.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                Email
              </label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm font-mono">{error}</p>
            )}

            <Button type="submit" loading={loading} fullWidth>
              Enviar link de recuperação
            </Button>
          </form>

          <div className="text-center">
            <a
              href="/login"
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] font-mono transition-colors"
            >
              Voltar para login
            </a>
          </div>
        </div>
      </Card>
    </div>
  )
}
