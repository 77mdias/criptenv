"use client";

import { useState, Suspense, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Loader2,
  Terminal,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OAuthButtonGroup } from "@/components/ui/oauth-button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLoginSchema, type LoginInput } from "@/lib/validators/schemas";
import { useTranslations } from "next-intl";

type Step =
  | "checking"
  | "login"
  | "confirm"
  | "authorizing"
  | "success"
  | "error";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * The API only ever registers a loopback callback for the CLI browser flow.
 * Re-validating it here prevents the browser from being redirected to a
 * third-party origin even if the authorization response were tampered with.
 */
function resolveLoopbackCallback(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:") return null;
    if (!LOOPBACK_HOSTS.has(parsed.hostname)) return null;
    if (!parsed.port) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function CLIAuthContent() {
  const searchParams = useSearchParams();
  const { user, login, isLoading: authLoading } = useAuth();
  const tAuth = useTranslations("auth");
  const t = useTranslations("auth.cliAuth");

  // Built per locale: Zod bakes messages in at construction time.
  const loginSchema = useMemo(() => createLoginSchema(tAuth), [tAuth]);

  const state = searchParams.get("state");
  const userCode = searchParams.get("user_code");

  const hasValidParams = Boolean(state || userCode);

  // Explicit mutable steps override the derived state
  const [explicitStep, setExplicitStep] = useState<Step | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    hasValidParams
      ? null
      : t("errors.invalidParams"),
  );
  const [loginError, setLoginError] = useState<string | null>(null);

  // Derive the current step from props and explicit overrides
  const step = useMemo<Step>(() => {
    if (explicitStep) return explicitStep;
    if (!hasValidParams) return "error";
    if (authLoading) return "checking";
    if (user) return "confirm";
    return "login";
  }, [explicitStep, hasValidParams, authLoading, user]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onLoginSubmit = useCallback(
    async (data: LoginInput) => {
      setLoginError(null);
      try {
        const result = await login(data.email, data.password);
        if ("requires_two_factor" in result) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.href = `/2fa?next=${encodeURIComponent(next)}`;
          return;
        }
        setExplicitStep("confirm");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t("errors.invalidCredentials");
        setLoginError(message);
      }
    },
    [login, t],
  );

  const handleAuthorize = useCallback(async () => {
    setExplicitStep("authorizing");
    try {
      if (state) {
        // Browser redirect flow
        const res = await fetch("/api/auth/cli/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ state }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || t("errors.authorizeFailed"));
        }

        const data = await res.json();
        const authCode = data.auth_code;

        // Redirect back to the CLI callback registered server-side at /initiate.
        // The `callback` query parameter is intentionally ignored: a crafted
        // link could point it at an attacker-controlled origin.
        const callbackUrl = resolveLoopbackCallback(data.callback_url);

        if (callbackUrl) {
          const target = new URL(callbackUrl);
          target.searchParams.set("code", authCode);
          // The CLI rejects callbacks whose state differs from the one it initiated.
          target.searchParams.set("state", state);
          window.location.href = target.toString();
        } else {
          setExplicitStep("success");
        }
      } else if (userCode) {
        // Device flow
        const res = await fetch("/api/auth/cli/device/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_code: userCode }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || t("errors.deviceFailed"));
        }

        setExplicitStep("success");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("errors.unknown");
      setErrorMsg(message);
      setExplicitStep("error");
    }
  }, [state, userCode, t]);

  if (step === "checking") {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-(--accent)" />
        <p className="text-sm text-(--text-tertiary)">{t("checkingSession")}</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 space-y-4 max-w-md mx-auto">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-(--text-primary)">
          {t("errorTitle")}
        </h2>
        <p className="text-sm text-(--text-tertiary) text-center">{errorMsg}</p>
        <Link href="/login">
          <Button variant="outline">{t("backToLogin")}</Button>
        </Link>
      </div>
    );
  }

  if (step === "login") {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-(--accent)/10 text-(--accent)">
            <Terminal className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-(--text-tertiary)">
            {t("loginSubtitle")}
          </p>
        </div>

        {loginError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loginError}
          </div>
        )}

        <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
          <Input
            label={t("emailLabel")}
            type="email"
            placeholder={t("emailPlaceholder")}
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label={t("passwordLabel")}
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
          <Button type="submit" fullWidth loading={isSubmitting}>
            {t("loginSubmit")}
          </Button>
        </form>

        <div className="relative">
          <Separator className="my-4" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-(--background) px-2 text-xs text-(--text-tertiary)">
            {t("orContinueWith")}
          </span>
        </div>

        <OAuthButtonGroup />
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-(--accent)/10 text-(--accent)">
            <Terminal className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-(--text-tertiary)">
            {t.rich("confirmSubtitle", { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>

        <div className="rounded-lg border border-(--border) bg-(--surface) p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-(--accent)/10 flex items-center justify-center text-(--accent) text-sm font-medium">
              {user?.name?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                "U"}
            </div>
            <div>
              <p className="text-sm font-medium text-(--text-primary)">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-(--text-tertiary)">{user?.email}</p>
            </div>
          </div>
        </div>

        <Button onClick={handleAuthorize} fullWidth>
          {t("confirm")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <p className="text-center text-xs text-(--text-tertiary)">
          {t("revokeHint")}
        </p>
      </div>
    );
  }

  if (step === "authorizing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-(--accent)" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {t("authorizing")}
          </h2>
          <p className="text-sm text-(--text-tertiary)">
            {t("redirectingTerminal")}
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600">
          <CheckCircle className="h-6 w-6" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-(--text-primary)">
            {t("successTitle")}
          </h2>
          <p className="text-sm text-(--text-tertiary)">
            {userCode
              ? t("successDevice")
              : t("successRedirect")}
          </p>
        </div>
        {userCode && (
          <Link href="/dashboard">
            <Button variant="outline">{t("goToDashboard")}</Button>
          </Link>
        )}
      </div>
    );
  }

  return null;
}

export default function CLIAuthPage() {
  const t = useTranslations("auth.cliAuth");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-(--accent)" />
            <p className="text-sm text-(--text-tertiary)">{t("loading")}</p>
          </div>
        }
      >
        <CLIAuthContent />
      </Suspense>
    </div>
  );
}
