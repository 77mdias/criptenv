"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { authApi } from "@/lib/api"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      window.setTimeout(() => {
        setStatus("error")
        setError("Token de verificação inválido ou ausente.")
      }, 0)
      return
    }

    let cancelled = false

    async function verify() {
      try {
        await authApi.verifyEmail({ token })
        if (!cancelled) {
          window.setTimeout(() => setStatus("success"), 0)
        }
      } catch (err) {
        if (!cancelled) {
          window.setTimeout(() => {
            setStatus("error")
            setError(err instanceof Error ? err.message : "Token inválido ou expirado.")
          }, 0)
        }
      }
    }

    verify()

    return () => {
      cancelled = true
    }
  }, [token])

  if (status === "verifying") {
    return (
      <div className="space-y-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Verificando email</h1>
          <p className="text-sm leading-6 text-[var(--text-tertiary)]">
            Aguarde enquanto confirmamos seu endereço de email...
          </p>
        </div>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="space-y-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Email verificado!</h1>
          <p className="text-sm leading-6 text-[var(--text-tertiary)]">
            Sua conta foi ativada com sucesso. Agora você pode fazer login e acessar o dashboard.
          </p>
        </div>
        <Button asChild fullWidth>
          <Link href="/login">Entrar na conta</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Verificação falhou</h1>
        <p className="text-sm leading-6 text-[var(--text-tertiary)]">
          {error || "O link de verificação é inválido ou expirou."}
        </p>
      </div>

      <div className="space-y-3">
        <Button asChild variant="secondary" fullWidth>
          <Link href="/login">Voltar para login</Link>
        </Button>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Carregando...</h1>
          </div>
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  )
}
