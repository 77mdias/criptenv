"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { OAuthButtonGroup } from "@/components/ui/oauth-button"
import { Mail, Lock, User, AlertCircle } from "lucide-react"
import { createSignupSchema, type SignupInput } from "@/lib/validators/schemas"
import { useAuth } from "@/hooks/use-auth"

export default function SignupPage() {
  const t = useTranslations("auth.signup")
  const tAuth = useTranslations("auth")
  // Built per locale: Zod bakes messages in at construction time.
  const signupSchema = useMemo(() => createSignupSchema(tAuth), [tAuth])
  const router = useRouter()
  const { signup } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupInput) => {
    setError(null)
    try {
      await signup(data.email, data.password, data.name)
      router.push("/verify-email/sent")
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("errors.createFailed")
      setError(message)
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

      <div className="space-y-4">
        <OAuthButtonGroup />
        <p className="text-center text-xs leading-5 text-[var(--text-muted)]">
          {t.rich("oauthConsent", {
            terms: (chunks) => (
              <Link href="/termos-de-uso" target="_blank" className="text-[var(--accent)] hover:underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/politica-de-privacidade" target="_blank" className="text-[var(--accent)] hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
        <div className="relative">
          <Separator className="my-2" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-tertiary)]">
            {t("orEmail")}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label={t("nameLabel")}
          type="text"
          placeholder={t("namePlaceholder")}
          icon={User}
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label={t("emailLabel")}
          type="email"
          placeholder={t("emailPlaceholder")}
          icon={Mail}
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label={t("passwordLabel")}
          type="password"
          placeholder="••••••••"
          icon={Lock}
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label={t("confirmPasswordLabel")}
          type="password"
          placeholder="••••••••"
          icon={Lock}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Checkbox
          id="accept-terms"
          error={errors.acceptTerms?.message}
          {...register("acceptTerms")}
        >
          {t.rich("acceptTerms", {
            terms: (chunks) => (
              <Link href="/termos-de-uso" target="_blank" className="font-medium text-[var(--accent)] hover:underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/politica-de-privacidade" target="_blank" className="font-medium text-[var(--accent)] hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </Checkbox>
        <Button type="submit" fullWidth loading={isSubmitting}>
          {t("submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--text-tertiary)]">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
          {t("signIn")}
        </Link>
      </p>
    </div>
  )
}
