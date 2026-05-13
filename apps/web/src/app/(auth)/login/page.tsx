"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { OAuthButtonGroup } from "@/components/ui/oauth-button"
import { Mail, Lock, AlertCircle } from "lucide-react"
import { loginSchema, type LoginInput } from "@/lib/validators/schemas"
import { useAuth } from "@/hooks/use-auth"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setError(null)
    try {
      await login(data.email, data.password)
      router.push("/dashboard")
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Email ou senha inválidos"
      setError(message)
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
        <p className="text-sm leading-6 text-[var(--text-tertiary)]">
          Entre para acessar seus projetos, vaults e auditoria de secrets.
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
        <div className="relative">
          <Separator className="my-2" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface-elevated)] px-3 text-xs text-[var(--text-tertiary)]">
            ou entre com email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="voce@email.com"
          icon={Mail}
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="space-y-1">
          <Input
            label="Senha"
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
              Esqueci minha senha
            </Link>
          </div>
        </div>
        <Button type="submit" fullWidth loading={isSubmitting}>
          Entrar
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--text-tertiary)]">
        Não tem conta?{" "}
        <Link href="/signup" className="text-[var(--accent)] hover:underline font-medium">
          Cadastre-se
        </Link>
      </p>
    </div>
  )
}
