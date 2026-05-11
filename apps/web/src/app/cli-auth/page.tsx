"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Terminal, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OAuthButtonGroup } from "@/components/ui/oauth-button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { authApi } from "@/lib/api/auth"
import { useAuth } from "@/hooks/use-auth"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginInput } from "@/lib/validators/schemas"

function CLIAuthContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, login, isLoading: authLoading } = useAuth()

  const state = searchParams.get("state")
  const callback = searchParams.get("callback")
  const deviceCode = searchParams.get("device_code")

  const [step, setStep] = useState<"checking" | "login" | "confirm" | "authorizing" | "success" | "error">("checking")
  const [error, setError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  useEffect(() => {
    // Validate params
    if (!state && !deviceCode) {
      setError("Parâmetros inválidos. Inicie o login a partir da CLI.")
      setStep("error")
      return
    }

    // Check if already authenticated
    if (!authLoading) {
      if (user) {
        setStep("confirm")
      } else {
        setStep("login")
      }
    }
  }, [user, authLoading, state, deviceCode])

  const onLoginSubmit = async (data: LoginInput) => {
    setLoginError(null)
    try {
      await login(data.email, data.password)
      setStep("confirm")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Email ou senha inválidos"
      setLoginError(message)
    }
  }

  const handleAuthorize = async () => {
    setStep("authorizing")
    try {
      if (state) {
        // Browser redirect flow
        const res = await fetch("/api/auth/cli/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ state }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || "Falha ao autorizar CLI")
        }

        const data = await res.json()
        const authCode = data.auth_code

        // Redirect back to CLI localhost callback
        if (callback) {
          const callbackUrl = new URL(callback)
          callbackUrl.searchParams.set("code", authCode)
          window.location.href = callbackUrl.toString()
        } else {
          setStep("success")
        }
      } else if (deviceCode) {
        // Device flow
        const res = await fetch("/api/auth/cli/device/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ device_code: deviceCode }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || "Falha ao autorizar dispositivo")
        }

        setStep("success")
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido"
      setError(message)
      setStep("error")
    }
  }

  if (step === "checking") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--text-tertiary)]">Verificando sessão...</p>
      </div>
    )
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 max-w-md mx-auto">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Erro na autorização</h2>
        <p className="text-sm text-[var(--text-tertiary)] text-center">{error}</p>
        <Link href="/login">
          <Button variant="outline">Voltar para login</Button>
        </Link>
      </div>
    )
  }

  if (step === "login") {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
            <Terminal className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Autorizar CLI</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            Faça login para autorizar o acesso do CriptEnv CLI ao sua conta.
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
            label="Email"
            type="email"
            placeholder="voce@email.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
          <Button type="submit" fullWidth loading={isSubmitting}>
            Entrar e autorizar
          </Button>
        </form>

        <div className="relative">
          <Separator className="my-4" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--background)] px-2 text-xs text-[var(--text-tertiary)]">
            ou continue com
          </span>
        </div>

        <OAuthButtonGroup />
      </div>
    )
  }

  if (step === "confirm") {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
            <Terminal className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Autorizar CLI</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            Você está autorizando o <strong>CriptEnv CLI</strong> a acessar sua conta.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] text-sm font-medium">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{user?.name || user?.email}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{user?.email}</p>
            </div>
          </div>
        </div>

        <Button onClick={handleAuthorize} fullWidth>
          Confirmar autorização
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <p className="text-center text-xs text-[var(--text-tertiary)]">
          Você pode revogar o acesso do CLI a qualquer momento nas configurações da conta.
        </p>
      </div>
    )
  }

  if (step === "authorizing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Autorizando...</h2>
          <p className="text-sm text-[var(--text-tertiary)]">Redirecionando de volta para o terminal</p>
        </div>
      </div>
    )
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600">
          <CheckCircle className="h-6 w-6" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">CLI autorizado!</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            {deviceCode
              ? "Você pode fechar esta janela e voltar ao terminal."
              : "Redirecionando de volta para o CLI..."}
          </p>
        </div>
        {deviceCode && (
          <Link href="/dashboard">
            <Button variant="outline">Ir para Dashboard</Button>
          </Link>
        )}
      </div>
    )
  }

  return null
}

export default function CLIAuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-tertiary)]">Carregando...</p>
          </div>
        }
      >
        <CLIAuthContent />
      </Suspense>
    </div>
  )
}
