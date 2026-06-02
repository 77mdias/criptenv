"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Clock, Plus, Trash2, UserMinus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PermissionDialog } from "@/components/shared/permission-dialog";
import { RolePicker } from "@/components/shared/role-picker";
import { membersApi, peekCached } from "@/lib/api";
import {
  canInviteProjectMembers,
  canManageProject,
  getInviteRoleOptions,
} from "@/lib/project-permissions";
import { inviteMemberSchema } from "@/lib/validators/schemas";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import type {
  Invite,
  InviteListResponse,
  Member,
  MemberListResponse,
} from "@/lib/api";

const roles = ["viewer", "developer", "admin"] as const;

function inviteState(invite: Invite) {
  if (invite.revoked_at) return "revoked";
  if (invite.accepted_at) return "accepted";
  if (new Date(invite.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return "?";
  const parts = nameOrEmail.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function UserAvatar({
  url,
  fallback,
  alt,
  size = "md",
  className,
}: {
  url?: string | null;
  fallback: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-(--background-muted) ring-1 ring-(--border)",
        sizeClasses[size],
        className
      )}
      title={alt}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      <span className={cn("font-semibold text-(--text-secondary)", url ? "sr-only" : "")}>
        {getInitials(fallback)}
      </span>
    </div>
  );
}

function InviteStatusBadge({ state }: { state: ReturnType<typeof inviteState> }) {
  const config = {
    pending: {
      icon: Clock,
      label: "Pendente",
      className:
        "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20",
    },
    accepted: {
      icon: Check,
      label: "Aceito",
      className:
        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20",
    },
    revoked: {
      icon: UserMinus,
      label: "Revogado",
      className:
        "bg-red-500/10 text-red-500 border-red-500/20 dark:bg-red-400/10 dark:text-red-400 dark:border-red-400/20",
    },
    expired: {
      icon: Clock,
      label: "Expirado",
      className:
        "bg-neutral-500/10 text-neutral-500 border-neutral-500/20 dark:bg-neutral-400/10 dark:text-neutral-400 dark:border-neutral-400/20",
    },
  };

  const { icon: Icon, label, className } = config[state];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium w-[92px]",
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

export default function MembersPage() {
  const params = useParams();
  const projectId = params.id as string;
  const user = useAuthStore((state) => state.user);
  const cachedMembers = peekCached<MemberListResponse>(
    `/api/v1/projects/${projectId}/members`,
  );
  const cachedInvites = peekCached<InviteListResponse>(
    `/api/v1/projects/${projectId}/invites`,
  );

  const [members, setMembers] = useState<Member[]>(
    cachedMembers?.members ?? [],
  );
  const [invites, setInvites] = useState<Invite[]>(
    cachedInvites?.invites ?? [],
  );
  const [loading, setLoading] = useState(!cachedMembers || !cachedInvites);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<(typeof roles)[number]>("developer");
  const [inviting, setInviting] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);

  const currentMember = useMemo(
    () => members.find((member) => member.user_id === user?.id) ?? null,
    [members, user?.id],
  );
  const currentRole = currentMember?.role ?? null;
  const canManageMembers = canManageProject(currentRole);
  const canInviteMembers = canInviteProjectMembers(currentRole);
  const inviteRoleOptions = getInviteRoleOptions(currentRole);

  const openInviteDialog = useCallback(() => {
    if (!canInviteMembers) {
      setPermissionOpen(true);
      return;
    }
    setInviteOpen(true);
  }, [canInviteMembers]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([membersApi.list(projectId), membersApi.listInvites(projectId)])
      .then(([membersData, invitesData]) => {
        if (cancelled) return;
        setMembers(membersData.members);
        setInvites(invitesData.invites);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar membros",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const openInvite = () => openInviteDialog();
    window.addEventListener("criptenv:invite-member", openInvite);
    return () =>
      window.removeEventListener("criptenv:invite-member", openInvite);
  }, [openInviteDialog]);

  const refreshData = useCallback(async () => {
    const [membersData, invitesData] = await Promise.all([
      membersApi.list(projectId),
      membersApi.listInvites(projectId),
    ]);
    setMembers(membersData.members);
    setInvites(invitesData.invites);
  }, [projectId]);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => inviteState(invite) === "pending"),
    [invites],
  );

  const handleInvite = async () => {
    const parsed = inviteMemberSchema.safeParse({
      email: inviteEmail,
      role: inviteRole,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Convite inválido");
      return;
    }

    setInviting(true);
    setError(null);
    setNotice(null);
    try {
      await membersApi.inviteMember(projectId, parsed.data);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("developer");
      await refreshData();
      setNotice(`Convite enviado para ${parsed.data.email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: Member, role: string) => {
    if (!canManageMembers) {
      setPermissionOpen(true);
      return;
    }
    setBusyId(member.id);
    setError(null);
    try {
      const updated = await membersApi.updateRole(projectId, member.id, {
        role,
      });
      setMembers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice("Role atualizada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar role");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (member: Member) => {
    if (!canManageMembers) {
      setPermissionOpen(true);
      return;
    }
    const displayName = member.name || member.email || member.user_id;
    if (!window.confirm(`Remover ${displayName} do projeto?`)) return;
    setBusyId(member.id);
    setError(null);
    try {
      await membersApi.remove(projectId, member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setNotice("Membro removido");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover membro");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeInvite = async (invite: Invite) => {
    const canRevoke =
      canManageMembers ||
      (currentRole === "developer" && invite.invited_by === user?.id);
    if (!canRevoke) {
      setPermissionOpen(true);
      return;
    }

    setBusyId(invite.id);
    setError(null);
    try {
      await membersApi.revokeInvite(projectId, invite.id);
      setInvites((current) => current.filter((item) => item.id !== invite.id));
      setNotice("Convite revogado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao revogar convite");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membros</h1>
          <p className="mt-1 font-mono text-sm text-(--text-tertiary)">
            Gerencie os membros do projeto
          </p>
        </div>
        <Card className="space-y-4 p-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membros</h1>
          <p className="mt-1 font-mono text-sm text-(--text-tertiary)">
            {members.length} membros · {pendingInvites.length} convites
            pendentes
          </p>
        </div>
        <Button icon={Plus} onClick={openInviteDialog}>
          Convidar
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/50 p-4">
          <p className="font-mono text-sm text-red-600">{error}</p>
        </Card>
      )}
      {notice && (
        <Card className="border-green-500/50 p-4">
          <p className="font-mono text-sm text-green-700">{notice}</p>
        </Card>
      )}

      {inviteOpen && (
        <Card>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-(--text-primary)">
                Convidar novo membro
              </h2>
              <p className="font-mono text-xs text-(--text-muted)">
                Convites expiram em 7 dias.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setInviteOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="block font-mono text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                Email
              </span>
              <input
                type="email"
                className="h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-primary)"
                placeholder="alice@example.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="block font-mono text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                Role
              </span>
              <RolePicker
                value={inviteRole}
                options={inviteRoleOptions}
                onChange={(role) => setInviteRole(role as (typeof roles)[number])}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancelar
            </Button>
            <Button loading={inviting} onClick={handleInvite}>
              Enviar convite
            </Button>
          </div>
        </Card>
      )}

      {members.length === 0 && invites.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro ainda"
          description="Convide membros para este projeto."
          action={{
            label: "Convidar membro",
            onClick: openInviteDialog,
            icon: Plus,
          }}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-(--border)">
            {members.map((member) => {
              const displayName = member.name || member.email || member.user_id;
              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-(--background-subtle) sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
                >
                  {/* Left: avatar + info */}
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      url={member.avatar_url}
                      fallback={displayName}
                      alt={displayName}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-(--text-primary)">
                        {displayName}
                      </p>
                      <p className="truncate font-mono text-xs text-(--text-muted)">
                        {member.email && member.name
                          ? member.email
                          : member.email || member.user_id}
                        {" · "}
                        Entrou em{" "}
                        {new Date(member.created_at).toLocaleDateString(
                          "pt-BR",
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: role + actions */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {member.role === "owner" ? (
                      <Badge variant="outline">owner</Badge>
                    ) : canManageMembers ? (
                      <RolePicker
                        value={member.role}
                        options={roles as unknown as string[]}
                        disabled={busyId === member.id}
                        onChange={(role) => handleRoleChange(member, role)}
                      />
                    ) : (
                      <Badge variant="outline">{member.role}</Badge>
                    )}
                    {canManageMembers && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-600"
                        disabled={
                          member.role === "owner" || busyId === member.id
                        }
                        onClick={() => handleRemove(member)}
                        aria-label="Remover membro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {invites.map((invite) => {
              const state = inviteState(invite);
              const displayName =
                invite.invitee_name || invite.email;
              return (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-(--background-subtle) sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
                >
                  {/* Left: avatar + info */}
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      url={invite.invitee_avatar_url}
                      fallback={displayName}
                      alt={displayName}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-(--text-primary)">
                        {displayName}
                      </p>
                      <p className="font-mono text-xs text-(--text-muted)">
                        Convite · Expira em{" "}
                        {new Date(invite.expires_at).toLocaleDateString(
                          "pt-BR",
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: status + role + actions */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <InviteStatusBadge state={state} />
                    <Badge variant="outline">{invite.role}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-600"
                      disabled={
                        state !== "pending" ||
                        busyId === invite.id ||
                        (!canManageMembers &&
                          !(
                            currentRole === "developer" &&
                            invite.invited_by === user?.id
                          ))
                      }
                      onClick={() => handleRevokeInvite(invite)}
                      aria-label="Revogar convite"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <PermissionDialog open={permissionOpen} onOpenChange={setPermissionOpen} />
    </div>
  );
}
