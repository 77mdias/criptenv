"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Users, Plus, Shield, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { membersApi } from "@/lib/api"
import type { Member, Invite } from "@/lib/api"

export default function MembersPage() {
  const params = useParams()
  const projectId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    try {
      setLoading(true)
      const [membersData, invitesData] = await Promise.all([
        membersApi.list(projectId),
        membersApi.listInvites(projectId),
      ])
      setMembers(membersData.members)
      setInvites(invitesData.invites)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar membros")
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    try {
      setInviting(true)
      await membersApi.inviteMember(projectId, { email: inviteEmail, role: inviteRole })
      setInviteOpen(false)
      setInviteEmail("")
      setInviteRole("member")
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar convite")
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (memberId: string) => {
    try {
      await membersApi.remove(projectId, memberId)
      setMembers(members.filter((m) => m.id !== memberId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover membro")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membros</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            Gerencie os membros do projeto
          </p>
        </div>
        <Card className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membros</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            {members.length} membros · {invites.length} convites pendentes
          </p>
        </div>
        <Button icon={Plus} onClick={() => setInviteOpen(true)}>
          Convidar
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-red-500/50">
          <p className="text-red-500 text-sm font-mono">{error}</p>
        </Card>
      )}

      {/* Invite Form */}
      {inviteOpen && (
        <Card>
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-[var(--text-primary)]">
              Convidar novo membro
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                  Email
                </label>
                <input
                  type="email"
                  className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                  Função
                </label>
                <select
                  className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setInviteOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" loading={inviting} onClick={handleInvite} disabled={!inviteEmail.trim()}>
                Enviar convite
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Members List */}
      {members.length === 0 && invites.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro ainda"
          description="Convidé membros para este projeto."
          action={{
            label: "Convidar membro",
            onClick: () => setInviteOpen(true),
            icon: Plus,
          }}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--background-subtle)] transition-colors group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/10">
                  <Users className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--text-primary)] font-mono truncate">
                    {member.user_id}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] font-mono">
                    Entrou em {new Date(member.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant={member.role === "admin" ? "warning" : "outline"}>
                  <Shield className="h-3 w-3 mr-1" />
                  {member.role}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 opacity-0 group-hover:opacity-100"
                  onClick={() => handleRemove(member.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Pending Invites */}
            {invites
              .filter((i) => i.status === "pending")
              .map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--background-subtle)] transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--text-muted)]/10">
                    <Users className="h-5 w-5 text-[var(--text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-muted)] font-mono truncate">
                      {invite.email}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      Convite pendente · Enviado em{" "}
                      {new Date(invite.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="warning">Pendente</Badge>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}
