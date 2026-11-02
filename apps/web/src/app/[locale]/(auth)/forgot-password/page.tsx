"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/api"
import { AlertCircle, CheckCircle2, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    try {
      setLoading(true)
      setError(null)
      await authApi.forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.sendFailed"))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t("sentTitle")}</h1>
          <p className="text-sm leading-6 text-[var(--text-tertiary)]">
            {t("sentTo")}{" "}
            <span className="font-semibold text-[var(--text-primary)]">{email}</span>.
          </p>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            {t("checkSpam")}
          </p>
        </div>
        <div className="space-y-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setSent(false)
              setEmail("")
            }}
          >
            {t("sendAgain")}
          </Button>
          <Button asChild variant="ghost" fullWidth>
            <Link href="/login">{t("backToLogin")}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm leading-6 text-[var(--text-tertiary)]">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label={t("emailLabel")}
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={Mail}
          required
        />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} fullWidth>
          {t("submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--text-tertiary)]">
        {t("rememberedPassword")}{" "}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  )
}
