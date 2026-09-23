"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { OAuthButtonGroup } from "@/components/ui/oauth-button"
import { Mail, Lock, AlertCircle } from "lucide-react"
import { createLoginSchema, type LoginInput } from "@/lib/validators/schemas"
import { useAuth } from "@/hooks/use-auth"
import { authApi, ApiError } from "@/lib/api"
import { safeRedirectPath } from "@/lib/safe-redirect"

export default function LoginPage() {
  const t = useTranslations("auth.login")
  const tAuth = useTranslations("auth")

  // Built per locale: Zod bakes messages in at construction time.
  const loginSchema = useMemo(() => createLoginSchema(tAuth), [tAuth])

  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setError(null)
    setUnverifiedEmail(null)
    setResent(false)
    try {
      const result = await login(data.email, data.password)
      const destination = safeRedirectPath(searchParams.get("redirect"))
      if ("requires_two_factor" in result) {
        router.push(`/2fa?next=${encodeURIComponent(destination)}`)
        return
      }
      router.push(destination)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setUnverifiedEmail(data.email)
        setError(err.message)
        return
      }
      const message =
        err instanceof Error ? err.message : t("invalidCredentials")
      setError(message)
    }
  }

  const handleResend = async () => {
    if (!unverifiedEmail) return
    try {
      setResending(true)
      await authApi.sendVerification({ email: unverifiedEmail })
      setResent(true)
    } catch {
      // ignore
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm leading-6 text-[var(--text-tertiary)]">
          {t("subtitle")}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {unverifiedEmail && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="text-amber-200 mb-2">
            {t("unverifiedNotice")}
          </p>
          {resent ? (
            <p className="text-emerald-300 text-xs">{t("resent")}</p>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 h-auto py-1 px-2 text-xs"
              onClick={handleResend}
              loading={resending}
            >
              {t("resend")}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4">
        <OAuthButtonGroup />
        <div className="relative">
          <Separator className="my-2" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-tertiary)]">
            {t("orEmail")}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label={t("emailLabel")}
          type="email"
          placeholder={t("emailPlaceholder")}
          icon={Mail}
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="space-y-1">
          <Input
            label={t("passwordLabel")}
            type="password"
            placeholder="••••••••"
            icon={Lock}
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--accent)] hover:underline font-medium"
            >
              {t("forgotPassword")}
            </Link>
          </div>
        </div>
        <Button type="submit" fullWidth loading={isSubmitting}>
          {t("submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--text-tertiary)]">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-[var(--accent)] hover:underline font-medium">
          {t("signUp")}
        </Link>
      </p>
    </div>
  )
}
