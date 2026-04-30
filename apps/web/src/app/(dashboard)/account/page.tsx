"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User, Monitor, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { authApi } from "@/lib/api"
import type { User as UserType } from "@/lib/api"

interface SessionResponse {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [sessions, setSessions] = useState<SessionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const userData = await authApi.session()
        setUser(userData)
        const sessionsData = await authApi.getSessions()
        setSessions(sessionsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

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
              {user?.name || "Usuário"}
            </h2>
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              {user?.email}
            </p>
            <div className="flex gap-2 pt-2">
              {user?.email_verified ? (
                <Badge variant="success">Email verificado</Badge>
              ) : (
                <Badge variant="warning">Email não verificado</Badge>
              )}
              {user?.two_factor_enabled && <Badge>2FA ativo</Badge>}
            </div>
          </div>
        </div>
      </Card>

      {/* Sessions */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Sessões ativas</h3>
          <Button variant="danger" size="sm" onClick={handleSignOutAll}>
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
