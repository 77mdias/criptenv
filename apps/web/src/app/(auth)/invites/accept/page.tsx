"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Mail, Check, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function AcceptInviteForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteInfo, setInviteInfo] = useState<{ project_id: string; email: string; role: string } | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!token) {
        setLoading(false)
        setError("Link de convite inválido.")
        return
      }

      async function lookup() {
        try {
          // We use request directly since this endpoint isn't in authApi yet
          const { request } = await import("@/lib/api/client")
          const data = await request("GET", `/api/auth/invites/lookup?token=${encodeURIComponent(token)}`)
          setInviteInfo(data)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Convite inválido ou expirado.")
        } finally {
          setLoading(false)
        }
      }

      void lookup()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    try {
      setAccepting(true)
      setError(null)
      const { request } = await import("@/lib/api/client")
      await request("POST", `/api/auth/invites/accept?token=${encodeURIComponent(token)}`)
      setAccepted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aceitar convite.")
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Card className="w-full max-w-md p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--accent)]" />
          <p className="mt-4 text-[var(--text-tertiary)] font-mono">Verificando convite...</p>
        </Card>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Card className="w-full max-w-md p-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Convite aceito!</h2>
            <p className="text-[var(--text-tertiary)] font-mono text-sm">
              Você agora é membro do projeto.
            </p>
            <Button variant="secondary" className="w-full mt-4" onClick={() => router.push("/projects")}>
              Ver projetos
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <Card className="w-full max-w-md p-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Mail className="h-8 w-8 text-[var(--accent)]" />
          </div>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Convite para projeto</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg text-red-500 text-sm font-mono">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {inviteInfo && (
            <div className="text-left space-y-2 p-4 bg-[var(--background-subtle)] rounded-lg">
              <p className="text-sm text-[var(--text-tertiary)] font-mono">
                Email: <span className="text-[var(--text-primary)]">{inviteInfo.email}</span>
              </p>
              <p className="text-sm text-[var(--text-tertiary)] font-mono">
                Função: <span className="text-[var(--text-primary)] capitalize">{inviteInfo.role}</span>
              </p>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleAccept}
            loading={accepting}
            disabled={!inviteInfo || !!error}
          >
            Aceitar convite
          </Button>

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

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Card className="w-full max-w-md p-8">
          <p className="text-center text-[var(--text-tertiary)] font-mono">Carregando...</p>
        </Card>
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  )
}
