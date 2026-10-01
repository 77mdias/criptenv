"use client"

import { useEffect, useState, useCallback, type ElementType, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Monitor, KeyRound, Trash2, AlertTriangle, Shield, Edit2, X, Check, Link2, Unlink, Mail,
  LogOut, CheckCircle2, AlertCircle, ShieldOff, Smartphone,
} from "lucide-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGithubAlt, faGoogle, faDiscord } from "@fortawesome/free-brands-svg-icons"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { OAuthButton, type OAuthProvider } from "@/components/ui/oauth-button"
import { authApi, peekCached } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import type { SessionResponse, User as UserType } from "@/lib/api"
import { parseUserAgent } from "@/lib/device-info"
import { cn } from "@/lib/utils"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { AvatarUpload } from "@/components/shared/avatar-upload"

// ─── Local helpers ────────────────────────────────────────────────────────────

const PROVIDER_META = {
  github: { label: "GitHub", icon: faGithubAlt, chip: "bg-[#24292e]" },
  google: { label: "Google", icon: faGoogle, chip: "bg-[#4285F4]" },
  discord: { label: "Discord", icon: faDiscord, chip: "bg-[#5865F2]" },
} as const

type ProviderKey = keyof typeof PROVIDER_META

function formatRelative(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  if (Number.isNaN(diffMs)) return ""
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "agora mesmo"
  if (minutes < 60) return `${minutes} min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h atrás`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d atrás`
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

// Shared section header: icon chip + title + description, optional action slot.
function SectionHeader({
  icon: Icon,
  tone = "default",
  title,
  description,
  action,
}: {
  icon: ElementType
  tone?: "default" | "danger"
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border",
            tone === "danger"
              ? "bg-red-500/10 border-red-500/30 text-red-500"
              : "bg-[var(--background-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] leading-tight">{title}</h3>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// Icon chip used by list rows inside sections.
function RowIcon({ icon: Icon, tone = "default" }: { icon: ElementType; tone?: "default" | "danger" }) {
  return (
    <div
      className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
        tone === "danger"
          ? "bg-red-500/10 border-red-500/20 text-red-500"
          : "bg-[var(--background-muted)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const authUser = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const cachedSessions = peekCached<SessionResponse[]>("/api/auth/sessions")
  const [user, setUser] = useState<UserType | null>(null)
  const [sessions, setSessions] = useState<SessionResponse[]>(cachedSessions ?? [])
  const [loading, setLoading] = useState(!authUser && !cachedSessions)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")

  // Change password
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // 2FA
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [twoFASecretUri, setTwoFASecretUri] = useState("")
  const [twoFABackupCodes, setTwoFABackupCodes] = useState<string[]>([])
  const [twoFACode, setTwoFACode] = useState("")

  // OAuth accounts
  const [oauthAccounts, setOauthAccounts] = useState<{ provider: string; provider_email: string }[]>([])
  const [loadingOAuth, setLoadingOAuth] = useState(false)
  const [unlinkProvider, setUnlinkProvider] = useState<string | null>(null)
  const [isUnlinking, setIsUnlinking] = useState(false)

  // Sessions
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
  const [isRevokingAll, setIsRevokingAll] = useState(false)

  // Available OAuth providers
  const availableProviders: ProviderKey[] = ["github", "google", "discord"]
  const unlinkedProviders = availableProviders.filter(
    (p) => !oauthAccounts.some((a) => a.provider === p)
  )

  const showMessage = useCallback((msg: string, isError = false) => {
    if (isError) {
      setError(msg)
      setSuccess(null)
    } else {
      setSuccess(msg)
      setError(null)
    }
    setTimeout(() => {
      setError(null)
      setSuccess(null)
    }, 5000)
  }, [])

  useEffect(() => {
    const oauthLinked = searchParams?.get("oauth_linked")
    const oauthError = searchParams?.get("oauth_error")

    if (oauthLinked || oauthError) {
      // Use a small timeout to avoid calling setState synchronously in effect
      const timer = setTimeout(() => {
        if (oauthLinked) {
          showMessage(`Conta ${oauthLinked} vinculada com sucesso.`)
        } else if (oauthError) {
          showMessage(decodeURIComponent(oauthError), true)
        }
        router.replace("/account")
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [searchParams, router, showMessage])

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await authApi.getSessions())
    } catch {
      // Keep the current list on failure; the error banner handles messaging.
    }
  }, [])

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

  useEffect(() => {
    let cancelled = false
    async function loadOAuth() {
      try {
        setLoadingOAuth(true)
        const accounts = await authApi.listOAuthAccounts()
        if (!cancelled) setOauthAccounts(accounts)
      } catch {
        if (!cancelled) setOauthAccounts([])
      } finally {
        if (!cancelled) setLoadingOAuth(false)
      }
    }
    void loadOAuth()
    return () => { cancelled = true }
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(async () => {
    try {
      await authApi.signout()
    } finally {
      clearAuth()
      router.push("/login")
    }
  }, [clearAuth, router])

  const handleRevokeSession = async (session: SessionResponse) => {
    // The current session goes through the signout flow so the cookie is
    // cleared server-side; other sessions are revoked by id.
    if (session.current) {
      await handleSignOut()
      return
    }
    setRevokingSessionId(session.id)
    try {
      await authApi.revokeSession(session.id)
      showMessage("Sessão encerrada.")
      await refreshSessions()
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao encerrar sessão", true)
    } finally {
      setRevokingSessionId(null)
    }
  }

  const handleRevokeAll = async () => {
    setIsRevokingAll(true)
    try {
      const result = await authApi.revokeAllSessions()
      showMessage(
        result.revoked > 0
          ? `${result.revoked} sessão(ões) encerrada(s). As outras conexões serão desconectadas.`
          : "Nenhuma outra sessão ativa para encerrar."
      )
      await refreshSessions()
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao encerrar sessões", true)
    } finally {
      setIsRevokingAll(false)
    }
  }

  const handleUpdateProfile = async () => {
    try {
      const updated = await authApi.updateProfile({ name: editName, email: editEmail })
      setUser(updated)
      setEditingProfile(false)
      showMessage("Perfil atualizado com sucesso.")
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao atualizar perfil", true)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showMessage("As senhas não conferem.", true)
      return
    }
    if (newPassword.length < 8) {
      showMessage("A nova senha deve ter pelo menos 8 caracteres.", true)
      return
    }
    try {
      await authApi.changePassword({ current_password: currentPassword, new_password: newPassword })
      setShowChangePassword(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      showMessage("Senha alterada. Faça login novamente.")
      setTimeout(() => {
        clearAuth()
        router.push("/login")
      }, 2000)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao alterar senha", true)
    }
  }

  const handleSetup2FA = async () => {
    try {
      const data = await authApi.setup2FA()
      setTwoFASecretUri(data.secret_uri)
      setTwoFABackupCodes(data.backup_codes)
      setShow2FASetup(true)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao configurar 2FA", true)
    }
  }

  const handleVerify2FA = async () => {
    try {
      await authApi.verify2FA({ code: twoFACode })
      setShow2FASetup(false)
      setTwoFACode("")
      setTwoFASecretUri("")
      setTwoFABackupCodes([])
      showMessage("2FA ativado com sucesso.")
      // Refresh user data
      const updated = await authApi.session()
      setUser(updated)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Código inválido", true)
    }
  }

  const handleDisable2FA = async () => {
    const pwd = window.prompt("Digite sua senha para desativar o 2FA:")
    if (!pwd) return
    try {
      await authApi.disable2FA({ password: pwd })
      showMessage("2FA desativado com sucesso.")
      const updated = await authApi.session()
      setUser(updated)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao desativar 2FA", true)
    }
  }

  const handleUnlinkOAuth = async () => {
    if (!unlinkProvider) return
    setIsUnlinking(true)
    try {
      await authApi.unlinkOAuthAccount(unlinkProvider)
      setOauthAccounts(oauthAccounts.filter((a) => a.provider !== unlinkProvider))
      showMessage(`Conta ${unlinkProvider} desvinculada.`)
      setUnlinkProvider(null)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao desvincular", true)
    } finally {
      setIsUnlinking(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETAR") {
      showMessage('Digite "DELETAR" para confirmar.', true)
      return
    }
    try {
      await authApi.deleteAccount()
      clearAuth()
      router.push("/")
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao deletar conta", true)
    }
  }

  const handleResendVerification = async () => {
    if (!currentUser?.email) return
    try {
      await authApi.sendVerification({ email: currentUser.email })
      showMessage("Email de verificação reenviado. Verifique sua caixa de entrada.")
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao reenviar verificação", true)
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
            <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
              Gerencie suas informações e sessões
            </p>
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </Card>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
    )
  }

  const otherSessionsCount = sessions.filter((s) => !s.current).length

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            Gerencie suas informações e sessões
          </p>
        </div>
        <Button variant="secondary" size="sm" className="shrink-0" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> Sair da conta
        </Button>
      </div>

      {/* Feedback */}
      {error && (
        <Card className="p-4 border-red-500/50 bg-red-500/5 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-500 text-sm font-mono">{error}</p>
        </Card>
      )}

      {success && (
        <Card className="p-4 border-green-500/50 bg-green-500/5 flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
          <p className="text-green-500 text-sm font-mono">{success}</p>
        </Card>
      )}

      {/* Profile */}
      <Card>
        <SectionHeader
          icon={Edit2}
          title="Perfil"
          description="Suas informações públicas"
        />
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <AvatarUpload
            currentAvatarUrl={currentUser?.avatar_url || null}
            userName={currentUser?.name || "Usuário"}
            onAvatarChange={(url) => {
              setUser((prev) => (prev ? { ...prev, avatar_url: url } : prev))
              // Also update auth store if user is cached there
              const authStoreUser = useAuthStore.getState().user
              if (authStoreUser) {
                useAuthStore.getState().setUser({ ...authStoreUser, avatar_url: url })
              }
            }}
          />
          <div className="flex-1 space-y-1 w-full">
            {editingProfile ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">
                    Nome
                  </label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleUpdateProfile}>
                    <Check className="h-4 w-4 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingProfile(false)}>
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-[var(--text-primary)] truncate">
                      {currentUser?.name || "Usuário"}
                    </h2>
                    <p className="text-sm text-[var(--text-tertiary)] font-mono truncate">
                      {currentUser?.email}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" className="shrink-0" onClick={() => {
                    setEditName(currentUser?.name || "")
                    setEditEmail(currentUser?.email || "")
                    setEditingProfile(true)
                  }}>
                    <Edit2 className="h-4 w-4 mr-1" /> Editar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {currentUser?.email_verified ? (
                    <Badge variant="success">Email verificado</Badge>
                  ) : (
                    <>
                      <Badge variant="warning">Email não verificado</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        onClick={handleResendVerification}
                      >
                        <Mail className="h-3 w-3 mr-1" /> Reenviar
                      </Button>
                    </>
                  )}
                  {currentUser?.two_factor_enabled && <Badge>2FA ativo</Badge>}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card>
        <SectionHeader
          icon={Shield}
          title="Segurança"
          description="Proteja o acesso à sua conta"
        />
        <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {/* Password row */}
          <div className="py-4">
            {showChangePassword ? (
              <div className="space-y-3 rounded-xl bg-[var(--background-subtle)] border border-[var(--border-subtle)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">Alterar senha</p>
                <Input
                  type="password"
                  placeholder="Senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="font-mono"
                />
                <Input
                  type="password"
                  placeholder="Nova senha (mín. 8 caracteres)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="font-mono"
                />
                <Input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="font-mono"
                />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleChangePassword}>
                    <KeyRound className="h-4 w-4 mr-1" /> Confirmar nova senha
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowChangePassword(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <RowIcon icon={KeyRound} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">Senha</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      Use pelo menos 8 caracteres
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setShowChangePassword(true)}>
                  Alterar
                </Button>
              </div>
            )}
          </div>

          {/* 2FA row */}
          <div className="py-4">
            {show2FASetup ? (
              <div className="space-y-3 rounded-xl bg-[var(--background-subtle)] border border-[var(--border-subtle)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">Ativar 2FA</p>
                <p className="text-sm text-[var(--text-tertiary)] font-mono">
                  Escaneie o QR code com seu app autenticador e digite o código de 6 dígitos.
                </p>
                {twoFASecretUri && (
                  <div className="p-4 bg-white rounded-lg inline-block">
                    <QRCodeSVG value={twoFASecretUri} size={180} level="M" includeMargin />
                    <p className="text-xs text-black font-mono mt-2 break-all">{twoFASecretUri}</p>
                  </div>
                )}
                {twoFABackupCodes.length > 0 && (
                  <div className="p-3 bg-[var(--background-muted)] rounded-lg border border-[var(--border-subtle)]">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-2">
                      Códigos de backup (salve em local seguro)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {twoFABackupCodes.map((code, i) => (
                        <span key={i} className="text-sm font-mono text-[var(--text-primary)]">{code}</span>
                      ))}
                    </div>
                  </div>
                )}
                <Input
                  placeholder="Código de 6 dígitos"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value)}
                  className="font-mono"
                  maxLength={6}
                />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleVerify2FA}>
                    <Check className="h-4 w-4 mr-1" /> Ativar 2FA
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShow2FASetup(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <RowIcon icon={currentUser?.two_factor_enabled ? Shield : ShieldOff} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      Autenticação de dois fatores
                    </p>
                    <p className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-2 min-w-0">
                      <span className="truncate">Camada extra de proteção no login</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 shrink-0",
                          currentUser?.two_factor_enabled ? "text-emerald-500" : "text-red-400"
                        )}
                        title={currentUser?.two_factor_enabled ? "2FA ativo nesta conta" : "2FA não configurado"}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            currentUser?.two_factor_enabled ? "bg-emerald-500" : "bg-red-400"
                          )}
                          aria-hidden
                        />
                        {currentUser?.two_factor_enabled ? "Ativa" : "Inativa"}
                      </span>
                    </p>
                  </div>
                </div>
                {currentUser?.two_factor_enabled ? (
                  <Button size="sm" variant="secondary" className="shrink-0 text-red-600 hover:bg-red-500/10" onClick={handleDisable2FA}>
                    Desativar
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" className="shrink-0" onClick={handleSetup2FA}>
                    Ativar
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Linked accounts */}
      <Card>
        <SectionHeader
          icon={Link2}
          title="Contas vinculadas"
          description="Faça login com provedores externos"
        />
        <div className="space-y-2">
          {loadingOAuth ? (
            <Skeleton className="h-14 w-full rounded-xl" />
          ) : oauthAccounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center">
              <p className="text-sm text-[var(--text-muted)] font-mono">
                Nenhuma conta OAuth vinculada.
              </p>
            </div>
          ) : (
            oauthAccounts.map((account) => {
              const meta = PROVIDER_META[account.provider as ProviderKey]
              return (
                <div
                  key={account.provider}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--background-subtle)]"
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                    <div
                      className={cn(
                        "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center",
                        meta?.chip ?? "bg-[var(--background-muted)] text-[var(--text-primary)]",
                        meta && "text-white"
                      )}
                    >
                      {meta ? (
                        <FontAwesomeIcon icon={meta.icon} className="h-4 w-4" />
                      ) : (
                        <span className="text-xs font-bold uppercase">{account.provider[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {meta?.label ?? account.provider}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] font-mono truncate">
                        {account.provider_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <Badge variant="success">Conectada</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-500/10"
                      onClick={() => setUnlinkProvider(account.provider)}
                    >
                      <Unlink className="h-4 w-4 mr-1" /> Desvincular
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {unlinkedProviders.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-3">
              Vincular nova conta
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              {unlinkedProviders.map((provider) => (
                <OAuthButton key={provider} provider={provider as OAuthProvider} action="link" className="w-full sm:w-auto" />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Sessions */}
      <Card>
        <SectionHeader
          icon={Monitor}
          title="Sessões ativas"
          description={
            sessions.length === 0
              ? "Nenhum dispositivo conectado"
              : `${sessions.length} dispositivo(s) conectado(s)`
          }
          action={
            otherSessionsCount > 0 ? (
              <Button variant="secondary" size="sm" loading={isRevokingAll} onClick={handleRevokeAll} className="text-red-600 hover:bg-red-500/10 shrink-0">
                {isRevokingAll ? null : <LogOut className="h-4 w-4" />} Encerrar outras
              </Button>
            ) : undefined
          }
        />

        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-8 text-center">
            <Monitor className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)] font-mono">
              Nenhuma sessão ativa
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const device = parseUserAgent(session.user_agent)
              const isCurrent = !!session.current
              const isMobile = /Mobi|Android|iPhone|iPad/i.test(session.user_agent ?? "")
              const isRevoking = revokingSessionId === session.id
              return (
                <div
                  key={session.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border",
                    isCurrent
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-[var(--border-subtle)] bg-[var(--background-subtle)]"
                  )}
                >
                  <RowIcon icon={isMobile ? Smartphone : Monitor} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {device.browser}
                      {device.os && <span className="text-[var(--text-muted)] font-normal"> · {device.os}</span>}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-2 min-w-0">
                      <span className="truncate">
                        {session.ip_address || "IP desconhecido"}
                        {" · "}
                        {session.last_accessed_at
                          ? `ativa ${formatRelative(session.last_accessed_at)}`
                          : `criada em ${formatDate(session.created_at)}`}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-500 shrink-0" title="Sessão atual deste dispositivo">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                          Esta sessão
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={isRevoking}
                    onClick={() => handleRevokeSession(session)}
                    className={cn(
                      "shrink-0 self-start sm:self-auto",
                      isCurrent ? "text-red-600 hover:bg-red-500/10" : "text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-600"
                    )}
                  >
                    {isCurrent ? (
                      <>
                        <LogOut className="h-4 w-4" /> Sair
                      </>
                    ) : (
                      "Encerrar"
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Danger zone */}
      <Card className="border-red-500/30 bg-red-500/5">
        <SectionHeader
          icon={AlertTriangle}
          tone="danger"
          title="Zona de perigo"
          description="Ações irreversíveis nesta conta"
        />

        {showDeleteConfirm ? (
          <div className="space-y-3 rounded-xl border border-red-500/30 bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              Esta ação não pode ser desfeita. Todos os seus dados serão permanentemente removidos.
              Digite <span className="font-bold text-red-500">DELETAR</span> para confirmar.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETAR"
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={handleDeleteAccount}>
                <Trash2 className="h-4 w-4 mr-1" /> Deletar permanentemente
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-[var(--surface)] p-4">
            <div className="flex items-center gap-3 min-w-0">
              <RowIcon icon={Trash2} tone="danger" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">Excluir conta</p>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  Remove permanentemente seus projetos, segredos e sessões
                </p>
              </div>
            </div>
            <Button size="sm" variant="danger" className="shrink-0 self-start sm:self-auto" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir conta
            </Button>
          </div>
        )}
      </Card>

      <ConfirmActionDialog
        open={!!unlinkProvider}
        onOpenChange={(open) => !open && setUnlinkProvider(null)}
        title="Desvincular conta?"
        description={`Tem certeza que deseja desvincular sua conta ${unlinkProvider}? Você não poderá mais usá-la para fazer login.`}
        confirmLabel="Desvincular"
        destructive
        loading={isUnlinking}
        onConfirm={handleUnlinkOAuth}
      />
    </div>
  )
}
