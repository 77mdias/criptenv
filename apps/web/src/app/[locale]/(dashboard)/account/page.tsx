"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Monitor, KeyRound, Trash2, AlertTriangle, Shield, Edit2, X, Check, Link2, Unlink, Mail } from "lucide-react"
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
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { AvatarUpload } from "@/components/shared/avatar-upload"

export default function AccountPage() {
  const t = useTranslations("account")
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

  // Available OAuth providers
  const availableProviders = ["github", "google", "discord"]
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
          showMessage(t("messages.oauthLinked", { provider: oauthLinked }))
        } else if (oauthError) {
          showMessage(decodeURIComponent(oauthError), true)
        }
        router.replace("/account")
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [searchParams, router, showMessage, t])

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
          setError(err instanceof Error ? err.message : t("messages.loadError"))
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
  }, [authUser, t])

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

  const handleSignOutAll = async () => {
    try {
      await authApi.signout()
      clearAuth()
      router.push("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.signoutError"))
    }
  }

  const handleUpdateProfile = async () => {
    try {
      const updated = await authApi.updateProfile({ name: editName, email: editEmail })
      setUser(updated)
      setEditingProfile(false)
      showMessage(t("messages.profileUpdated"))
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.profileUpdateError"), true)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showMessage(t("messages.passwordMismatch"), true)
      return
    }
    if (newPassword.length < 8) {
      showMessage(t("messages.passwordTooShort"), true)
      return
    }
    try {
      await authApi.changePassword({ current_password: currentPassword, new_password: newPassword })
      setShowChangePassword(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      showMessage(t("messages.passwordChanged"))
      setTimeout(() => {
        clearAuth()
        router.push("/login")
      }, 2000)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.passwordChangeError"), true)
    }
  }

  const handleSetup2FA = async () => {
    try {
      const data = await authApi.setup2FA()
      setTwoFASecretUri(data.secret_uri)
      setTwoFABackupCodes(data.backup_codes)
      setShow2FASetup(true)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.twoFASetupError"), true)
    }
  }

  const handleVerify2FA = async () => {
    try {
      await authApi.verify2FA({ code: twoFACode })
      setShow2FASetup(false)
      setTwoFACode("")
      setTwoFASecretUri("")
      setTwoFABackupCodes([])
      showMessage(t("messages.twoFAEnabled"))
      // Refresh user data
      const updated = await authApi.session()
      setUser(updated)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.invalidCode"), true)
    }
  }

  const handleDisable2FA = async () => {
    const pwd = window.prompt(t("messages.disable2FAPrompt"))
    if (!pwd) return
    try {
      await authApi.disable2FA({ password: pwd })
      showMessage(t("messages.twoFADisabled"))
      const updated = await authApi.session()
      setUser(updated)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.twoFADisableError"), true)
    }
  }

  const handleUnlinkOAuth = async () => {
    if (!unlinkProvider) return
    setIsUnlinking(true)
    try {
      await authApi.unlinkOAuthAccount(unlinkProvider)
      setOauthAccounts(oauthAccounts.filter((a) => a.provider !== unlinkProvider))
      showMessage(t("messages.oauthUnlinked", { provider: unlinkProvider }))
      setUnlinkProvider(null)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.oauthUnlinkError"), true)
    } finally {
      setIsUnlinking(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETAR") {
      showMessage(t("messages.deleteConfirmationWord"), true)
      return
    }
    try {
      await authApi.deleteAccount()
      clearAuth()
      router.push("/")
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.deleteError"), true)
    }
  }

  const handleResendVerification = async () => {
    if (!currentUser?.email) return
    try {
      await authApi.sendVerification({ email: currentUser.email })
      showMessage(t("messages.verificationResent"))
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.verificationResendError"), true)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            {t("subtitle")}
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
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
          {t("subtitle")}
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
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <AvatarUpload
            currentAvatarUrl={currentUser?.avatar_url || null}
            userName={currentUser?.name || t("fallback.userName")}
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
                    {t("profile.name")}
                  </label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-1">
                    {t("profile.email")}
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
                    <Check className="h-4 w-4 mr-1" /> {t("profile.save")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingProfile(false)}>
                    <X className="h-4 w-4 mr-1" /> {t("profile.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-[var(--text-primary)] truncate">
                      {currentUser?.name || t("fallback.userName")}
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
                    <Edit2 className="h-4 w-4 mr-1" /> {t("profile.edit")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {currentUser?.email_verified ? (
                    <Badge variant="success">{t("profile.emailVerified")}</Badge>
                  ) : (
                    <>
                      <Badge variant="warning">{t("profile.emailNotVerified")}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        onClick={handleResendVerification}
                      >
                        <Mail className="h-3 w-3 mr-1" /> {t("profile.resend")}
                      </Button>
                    </>
                  )}
                  {currentUser?.two_factor_enabled && <Badge>{t("profile.twoFactorActive")}</Badge>}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Shield className="h-5 w-5" /> {t("security.title")}
        </h3>

        {/* Change Password */}
        <div className="border-t border-[var(--border)] pt-4">
          {showChangePassword ? (
            <div className="space-y-3">
              <Input
                type="password"
                placeholder={t("security.currentPassword")}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="font-mono"
              />
              <Input
                type="password"
                placeholder={t("security.newPassword")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="font-mono"
              />
              <Input
                type="password"
                placeholder={t("security.confirmNewPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="font-mono"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleChangePassword}>
                  <KeyRound className="h-4 w-4 mr-1" /> {t("security.changePassword")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowChangePassword(false)}>
                  {t("security.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" className="w-full sm:w-auto sm:min-w-[180px] justify-start" onClick={() => setShowChangePassword(true)}>
              <KeyRound className="h-4 w-4 shrink-0" /> {t("security.changePassword")}
            </Button>
          )}
        </div>

        {/* 2FA */}
        <div className="border-t border-[var(--border)] pt-4">
          {show2FASetup ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-tertiary)] font-mono">
                {t("security.twoFASetupInstructions")}
              </p>
              {twoFASecretUri && (
                <div className="p-4 bg-white rounded-lg inline-block">
                  <QRCodeSVG value={twoFASecretUri} size={180} level="M" includeMargin />
                  <p className="text-xs text-black font-mono mt-2 break-all">{twoFASecretUri}</p>
                </div>
              )}
              {twoFABackupCodes.length > 0 && (
                <div className="p-3 bg-[var(--background-subtle)] rounded-lg">
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono mb-2">
                    {t("security.backupCodes")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {twoFABackupCodes.map((code, i) => (
                      <span key={i} className="text-sm font-mono text-[var(--text-primary)]">{code}</span>
                    ))}
                  </div>
                </div>
              )}
              <Input
                placeholder={t("security.twoFACodePlaceholder")}
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value)}
                className="font-mono"
                maxLength={6}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleVerify2FA}>
                  <Check className="h-4 w-4 mr-1" /> {t("security.enable2FA")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShow2FASetup(false)}>
                  {t("security.cancel")}
                </Button>
              </div>
            </div>
          ) : currentUser?.two_factor_enabled ? (
            <Button size="sm" variant="danger" className="w-full sm:w-auto sm:min-w-[180px] justify-start" onClick={handleDisable2FA}>
              <Shield className="h-4 w-4 shrink-0" /> {t("security.disable2FA")}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="w-full sm:w-auto sm:min-w-[180px] justify-start" onClick={handleSetup2FA}>
              <Shield className="h-4 w-4 shrink-0" /> {t("security.enable2FA")}
            </Button>
          )}
        </div>
      </Card>

      {/* OAuth Accounts */}
      <Card className="p-6">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <Link2 className="h-5 w-5" /> {t("oauth.title")}
        </h3>
        {loadingOAuth ? (
          <Skeleton className="h-12 w-full" />
        ) : oauthAccounts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] font-mono">{t("oauth.empty")}</p>
        ) : (
          <div className="space-y-2">
            {oauthAccounts.map((account) => (
              <div key={account.provider} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-[var(--background-subtle)]">
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--background-muted)] flex items-center justify-center">
                    <span className="text-xs font-bold uppercase">{account.provider[0]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] capitalize">{account.provider}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono truncate">{account.provider_email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600 w-full sm:w-auto shrink-0 justify-start sm:justify-center" onClick={() => setUnlinkProvider(account.provider)}>
                  <Unlink className="h-4 w-4 mr-1" /> {t("oauth.unlink")}
                </Button>
              </div>
            ))}
          </div>
        )}

        {unlinkedProviders.length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">{t("oauth.linkNew")}</p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              {unlinkedProviders.map((provider) => (
                <OAuthButton key={provider} provider={provider as OAuthProvider} action="link" className="w-full sm:w-auto justify-start sm:justify-center" />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Sessions */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">{t("sessions.title")}</h3>
          <Button variant="danger" size="sm" onClick={handleSignOutAll} className="self-start sm:self-auto">
            {t("sessions.signOutAll")}
          </Button>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] font-mono">
            {t("sessions.empty")}
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
                    {session.user_agent || t("fallback.userAgent")}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] font-mono">
                    {session.ip_address || t("fallback.ipAddress")} ·{" "}
                    {new Date(session.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="success">{t("sessions.active")}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Delete Account */}
      <Card className="p-6 border-red-500/30">
        <h3 className="font-semibold text-red-500 flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5" /> {t("dangerZone.title")}
        </h3>

        {showDeleteConfirm ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              {t.rich("dangerZone.deleteWarning", {
                strong: (chunks) => <span className="font-bold text-red-500">{chunks}</span>,
              })}
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETAR"
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={handleDeleteAccount}>
                <Trash2 className="h-4 w-4 mr-1" /> {t("dangerZone.deletePermanently")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                {t("dangerZone.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> {t("dangerZone.delete")}
          </Button>
        )}
      </Card>

      <ConfirmActionDialog
        open={!!unlinkProvider}
        onOpenChange={(open) => !open && setUnlinkProvider(null)}
        title={t("oauth.unlinkTitle")}
        description={t("oauth.unlinkDescription", { provider: unlinkProvider ?? "" })}
        confirmLabel={t("oauth.unlink")}
        destructive
        loading={isUnlinking}
        onConfirm={handleUnlinkOAuth}
      />
    </div>
  )
}
