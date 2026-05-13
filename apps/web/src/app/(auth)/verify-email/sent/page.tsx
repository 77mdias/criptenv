"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/api"
import { CheckCircle2, Mail, AlertCircle, Loader2 } from "lucide-react"

export default function VerificationSentPage() {
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
      await authApi.sendVerification({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar email")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Email enviado</h1>
          <p className="text-sm leading-6 text-[var(--text-tertiary)]">
            Enviamos um novo link de verificação para{" "}
            <span className="font-semibold text-[var(--text-primary)]">{email}</span>.
          </p>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            Verifique sua caixa de spam se não receber em alguns minutos. O link expira em 24 horas.
          </p>
        </div>
        <div className="space-y-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setSent(false)
              setEmail("")
            }}
          >
            Enviar para outro email
          </Button>
          <Button asChild variant="ghost" fullWidth>
            <Link href="/login">Voltar para login</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
          <Mail className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Verifique seu email</h1>
        <p className="text-sm leading-6 text-[var(--text-tertiary)]">
          Enviamos um link de verificação para o seu email. Clique no link para ativar sua conta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={Mail}
          required
        />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} fullWidth>
          Reenviar link de verificação
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--text-tertiary)]">
        Já verificou?{" "}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Fazer login
        </Link>
      </p>
    </div>
  )
}
