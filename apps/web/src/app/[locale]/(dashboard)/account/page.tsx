"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  KeyRound, Trash2, AlertTriangle, Shield, Edit2, X, Check, Mail,
  LogOut, CheckCircle2, AlertCircle, ShieldOff,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { authApi, peekCached } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import type { SessionResponse, User as UserType } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { AvatarUpload } from "@/components/shared/avatar-upload"
import { RowIcon, SectionHeader, formatDate } from "./_components/account-ui"
import { LinkedAccountsCard, type ProviderKey } from "./_components/linked-accounts-card"
import { SessionsCard } from "./_components/sessions-card"

// ─── Local helpers ────────────────────────────────────────────────────────────


// ─── Sidebar cards ────────────────────────────────────────────────────────────

// Compact account summary for the right-hand sidebar.
function AccountSummaryCard({
  user,
  sessionsCount,
  linkedCount,
}: {
  /** Minimal shape satisfied by both the API `User` and the store `AuthUser`. */
  user: {
    name: string
    email: string
    avatar_url: string | null
    created_at?: string
  } | null
  sessionsCount: number
  linkedCount: number
}) {
  const t = useTranslations("account")
  const stats = [
    { label: t("summary.memberSince"), value: user?.created_at ? formatDate(user.created_at) : "—" },
    { label: t("summary.activeSessions"), value: String(sessionsCount) },
    { label: t("summary.linkedAccounts"), value: String(linkedCount) },
  ]
  return (
    <Card>
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center text-sm font-bold overflow-hidden">
          {user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <span>{user?.name?.charAt(0).toUpperCase() || "U"}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)] truncate">
            {user?.name || "Usuário"}
          </p>
          <p className="text-xs text-[var(--text-muted)] font-mono truncate">{user?.email}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <span className="text-xs text-[var(--text-muted)] font-mono">{stat.label}</span>
            <span className="text-xs text-[var(--text-primary)] font-mono">{stat.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Security checklist mirroring the dot indicator language used across the page.
function SecuritySummaryCard({
  emailVerified,
  twoFactorEnabled,
  onEnable2FA,
}: {
  emailVerified: boolean
  twoFactorEnabled: boolean
  onEnable2FA: () => void
}) {
  const t = useTranslations("account")
  const checks = [
    { label: t("profile.emailVerified"), ok: emailVerified, pendingLabel: t("security.pending") },
    { label: t("security.twoFactor"), ok: twoFactorEnabled, pendingLabel: t("security.inactive") },
  ]
  return (
    <Card>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{t("securityCard.title")}</h3>
      <div className="space-y-2.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--text-secondary)] font-mono">{check.label}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-mono shrink-0",
                check.ok ? "text-emerald-500" : "text-red-400"
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full shrink-0", check.ok ? "bg-emerald-500" : "bg-red-400")}
                aria-hidden
              />
              {check.ok ? t("security.active") : check.pendingLabel}
            </span>
          </div>
        ))}
      </div>
      {!twoFactorEnabled && (
        <>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-4 leading-relaxed">
            {t("securityCard.addLayer")}
          </p>
          <Button size="sm" variant="secondary" fullWidth className="mt-3" onClick={onEnable2FA}>
            <Shield className="h-4 w-4" /> Ativar 2FA
          </Button>
        </>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
          showMessage(t("messages.oauthLinked", { provider: oauthLinked }))
        } else if (oauthError) {
          showMessage(decodeURIComponent(oauthError), true)
        }
        router.replace("/account")
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [t, searchParams, router, showMessage])

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
      showMessage(t("messages.sessionRevoked"))
      await refreshSessions()
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.sessionRevokeError"), true)
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
          ? t("messages.sessionsRevoked", { count: result.revoked })
          : t("messages.noOtherSessions")
      )
      await refreshSessions()
    } catch (err) {
      showMessage(err instanceof Error ? err.message : t("messages.sessionsRevokeError"), true)
    } finally {
      setIsRevokingAll(false)
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

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
              {t("subtitle")}
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


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
            {t("subtitle")}
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

      {/* Two-column layout: settings (left) + account summary (right) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-6 min-w-0">

      {/* Profile */}
      <Card>
        <SectionHeader
          icon={Edit2}
          title={t("profile.title")}
          description={t("profile.publicInfo")}
        />
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
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-mono",
                      currentUser?.email_verified ? "text-emerald-500" : "text-red-400"
                    )}
                    title={currentUser?.email_verified ? t("profile.emailVerified") : t("profile.verifyEmailTitle")}
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full shrink-0", currentUser?.email_verified ? "bg-emerald-500" : "bg-red-400")}
                      aria-hidden
                    />
                    {currentUser?.email_verified ? t("profile.emailVerified") : t("profile.emailNotVerified")}
                  </span>
                  {!currentUser?.email_verified && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                      onClick={handleResendVerification}
                    >
                      <Mail className="h-3 w-3 mr-1" /> {t("profile.resend")}
                    </Button>
                  )}
                  {currentUser?.two_factor_enabled && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-500" title={t("profile.twoFAActiveTitle")}>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" aria-hidden />
                      2FA ativo
                    </span>
                  )}
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
          title={t("security.title")}
          description={t("security.description")}
        />
        <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {/* Password row */}
          <div className="py-4">
            {showChangePassword ? (
              <div className="space-y-3 rounded-xl bg-[var(--background-subtle)] border border-[var(--border-subtle)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">{t("security.changePassword")}</p>
                <Input
                  type="password"
                  placeholder={t("security.currentPassword")}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="font-mono"
                />
                <Input
                  type="password"
                  placeholder={t("security.newPasswordPlaceholder")}
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
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleChangePassword}>
                    <KeyRound className="h-4 w-4 mr-1" /> {t("security.confirmNewPasswordButton")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowChangePassword(false)}>
                    {t("security.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <RowIcon icon={KeyRound} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{t("security.passwordLabel")}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono">
                      {t("security.passwordHint")}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setShowChangePassword(true)}>
                  {t("security.change")}
                </Button>
              </div>
            )}
          </div>

          {/* 2FA row */}
          <div className="py-4">
            {show2FASetup ? (
              <div className="space-y-3 rounded-xl bg-[var(--background-subtle)] border border-[var(--border-subtle)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">{t("security.enable2FA")}</p>
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
                  placeholder={t("security.twoFACodePlaceholder")}
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value)}
                  className="font-mono"
                  maxLength={6}
                />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleVerify2FA}>
                    <Check className="h-4 w-4 mr-1" /> {t("security.enable2FA")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShow2FASetup(false)}>
                    {t("security.cancel")}
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
                      <span className="truncate">{t("security.extraLayerLogin")}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 shrink-0",
                          currentUser?.two_factor_enabled ? "text-emerald-500" : "text-red-400"
                        )}
                        title={currentUser?.two_factor_enabled ? t("profile.twoFAActiveTitle") : t("security.twoFANotConfigured")}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            currentUser?.two_factor_enabled ? "bg-emerald-500" : "bg-red-400"
                          )}
                          aria-hidden
                        />
                        {currentUser?.two_factor_enabled ? t("security.active") : t("security.inactive")}
                      </span>
                    </p>
                  </div>
                </div>
                {currentUser?.two_factor_enabled ? (
                  <Button size="sm" variant="secondary" className="shrink-0 text-red-600 hover:bg-red-500/10" onClick={handleDisable2FA}>
                    {t("security.deactivate")}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" className="shrink-0" onClick={handleSetup2FA}>
                    {t("security.activate")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <LinkedAccountsCard
        accounts={oauthAccounts}
        loading={loadingOAuth}
        unlinkedProviders={unlinkedProviders}
        onUnlink={setUnlinkProvider}
      />

      <SessionsCard
        sessions={sessions}
        revokingSessionId={revokingSessionId}
        isRevokingAll={isRevokingAll}
        onRevoke={handleRevokeSession}
        onRevokeAll={handleRevokeAll}
      />

      {/* Danger zone */}
      <Card className="border-red-500/30 bg-red-500/5">
        <SectionHeader
          icon={AlertTriangle}
          tone="danger"
          title={t("dangerZone.title")}
          description={t("dangerZone.description")}
        />

        {showDeleteConfirm ? (
          <div className="space-y-3 rounded-xl border border-red-500/30 bg-[var(--surface)] p-4">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-[var(--surface)] p-4">
            <div className="flex items-center gap-3 min-w-0">
              <RowIcon icon={Trash2} tone="danger" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">{t("dangerZone.deleteAccount")}</p>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  Remove permanentemente seus projetos, segredos e sessões
                </p>
              </div>
            </div>
            <Button size="sm" variant="danger" className="shrink-0 self-start sm:self-auto" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> {t("dangerZone.deleteAccount")}
            </Button>
          </div>
        )}
      </Card>

        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-6">
          <AccountSummaryCard
            user={currentUser}
            sessionsCount={sessions.length}
            linkedCount={oauthAccounts.length}
          />
          <SecuritySummaryCard
            emailVerified={!!currentUser?.email_verified}
            twoFactorEnabled={!!currentUser?.two_factor_enabled}
            onEnable2FA={handleSetup2FA}
          />
        </aside>
      </div>

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
