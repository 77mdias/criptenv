"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { authApi, peekCached } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import type { SessionResponse, User as UserType } from "@/lib/api"

export default function AccountPage() {
  const router = useRouter()
  const authUser = useAuthStore((state) => state.user)
  const cachedSessions = peekCached<SessionResponse[]>("/api/auth/sessions")
  const [user, setUser] = useState<UserType | null>(null)
  const [sessions, setSessions] = useState<SessionResponse[]>(cachedSessions ?? [])
  const [loading, setLoading] = useState(!authUser && !cachedSessions)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        const userPromise = authUser ? Promise.resolve(null) : authApi.session()
        const [userData, sessionsData] = await Promise.all([userPromise, authApi.getSessions()])
        if (cancelled) return
        if (userData) {
          setUser(userData)
        }
        setSessions(sessionsData)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar dados")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchData()

    return () => {
      cancelled = true
    }
  }, [authUser])

  const currentUser = user ?? authUser

  const handleSignOutAll = async () => {
    try {
      await authApi.signout()
      router.push("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer signout")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            Gerencie suas informações e sessões
          </p>
        </div>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
        <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
          Gerencie suas informações e sessões
        </p>
      </div>

      {error && (
        <Card className="p-4 border-red-500/50">
          <p className="text-red-500 text-sm font-mono">{error}</p>
        </Card>
      )}

      {/* User Info */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10">
            <User className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="font-semibold text-[var(--text-primary)]">
              {currentUser?.name || "Usuário"}
            </h2>
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              {currentUser?.email}
            </p>
            <div className="flex gap-2 pt-2">
              {currentUser?.email_verified ? (
                <Badge variant="success">Email verificado</Badge>
              ) : (
                <Badge variant="warning">Email não verificado</Badge>
              )}
              {currentUser?.two_factor_enabled && <Badge>2FA ativo</Badge>}
            </div>
          </div>
        </div>
      </Card>

      {/* Sessions */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Sessões ativas</h3>
          <Button variant="danger" size="sm" onClick={handleSignOutAll} className="self-start sm:self-auto">
            Sair de todas
          </Button>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] font-mono">
            Nenhuma sessão ativa
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-[var(--background-subtle)]"
              >
                <Monitor className="h-4 w-4 text-[var(--text-muted)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate font-mono">
                    {session.user_agent || "Navegador desconhecido"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] font-mono">
                    {session.ip_address || "IP desconhecido"} ·{" "}
                    {new Date(session.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="success">Ativa</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
