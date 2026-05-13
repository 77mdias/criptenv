"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User, Monitor, KeyRound, Trash2, AlertTriangle, Shield, Edit2, X, Check, QrCode, Link2, Unlink, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { authApi, peekCached } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import type { SessionResponse, User as UserType } from "@/lib/api"

export default function AccountPage() {
  const router = useRouter()
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

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

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

  const showMessage = (msg: string, isError = false) => {
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
  }

  const handleSignOutAll = async () => {
    try {
      await authApi.signout()
      clearAuth()
      router.push("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer signout")
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

  const handleUnlinkOAuth = async (provider: string) => {
    if (!window.confirm(`Desvincular conta ${provider}?`)) return
    try {
      await authApi.unlinkOAuthAccount(provider)
      setOauthAccounts(oauthAccounts.filter((a) => a.provider !== provider))
      showMessage(`Conta ${provider} desvinculada.`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Erro ao desvincular", true)
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

      {success && (
        <Card className="p-4 border-green-500/50">
          <p className="text-green-500 text-sm font-mono">{success}</p>
        </Card>
      )}

      {/* User Info */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10">
            <User className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <div className="flex-1 space-y-1">
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
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-[var(--text-primary)]">
                      {currentUser?.name || "Usuário"}
                    </h2>
                    <p className="text-sm text-[var(--text-tertiary)] font-mono">
                      {currentUser?.email}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => {
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
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Shield className="h-5 w-5" /> Segurança
        </h3>

        {/* Change Password */}
        <div className="border-t border-[var(--border)] pt-4">
          {showChangePassword ? (
            <div className="space-y-3">
              <Input
                type="password"
                placeholder="Senha atual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="font-mono"
              />
              <Input
                type="password"
                placeholder="Nova senha"
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
              <div className="flex gap-2">
                <Button size="sm" onClick={handleChangePassword}>
                  <KeyRound className="h-4 w-4 mr-1" /> Alterar senha
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowChangePassword(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setShowChangePassword(true)}>
              <KeyRound className="h-4 w-4 mr-1" /> Alterar senha
            </Button>
          )}
        </div>

        {/* 2FA */}
        <div className="border-t border-[var(--border)] pt-4">
          {show2FASetup ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-tertiary)] font-mono">
                Escaneie o QR code com seu app autenticador e digite o código de 6 dígitos.
              </p>
              {twoFASecretUri && (
                <div className="p-4 bg-white rounded-lg inline-block">
                  <QrCode className="h-32 w-32 text-black" />
                  <p className="text-xs text-black font-mono mt-2 break-all">{twoFASecretUri}</p>
                </div>
              )}
              {twoFABackupCodes.length > 0 && (
                <div className="p-3 bg-[var(--background-subtle)] rounded-lg">
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
              <div className="flex gap-2">
                <Button size="sm" onClick={handleVerify2FA}>
                  <Check className="h-4 w-4 mr-1" /> Ativar 2FA
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShow2FASetup(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : currentUser?.two_factor_enabled ? (
            <Button size="sm" variant="danger" onClick={handleDisable2FA}>
              <Shield className="h-4 w-4 mr-1" /> Desativar 2FA
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={handleSetup2FA}>
              <Shield className="h-4 w-4 mr-1" /> Ativar 2FA
            </Button>
          )}
        </div>
      </Card>

      {/* OAuth Accounts */}
      <Card className="p-6">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <Link2 className="h-5 w-5" /> Contas vinculadas
        </h3>
        {loadingOAuth ? (
          <Skeleton className="h-12 w-full" />
        ) : oauthAccounts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] font-mono">Nenhuma conta OAuth vinculada.</p>
        ) : (
          <div className="space-y-2">
            {oauthAccounts.map((account) => (
              <div key={account.provider} className="flex items-center justify-between p-3 rounded-lg bg-[var(--background-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[var(--background-muted)] flex items-center justify-center">
                    <span className="text-xs font-bold uppercase">{account.provider[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] capitalize">{account.provider}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono">{account.provider_email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleUnlinkOAuth(account.provider)}>
                  <Unlink className="h-4 w-4 mr-1" /> Desvincular
                </Button>
              </div>
            ))}
          </div>
        )}
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

      {/* Delete Account */}
      <Card className="p-6 border-red-500/30">
        <h3 className="font-semibold text-red-500 flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5" /> Zona de perigo
        </h3>

        {showDeleteConfirm ? (
          <div className="space-y-3">
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
          <Button size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Deletar conta
          </Button>
        )}
      </Card>
    </div>
  )
}
