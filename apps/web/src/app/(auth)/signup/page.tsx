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
import { Mail, Lock, User, AlertCircle } from "lucide-react"
import { signupSchema, type SignupInput } from "@/lib/validators/schemas"
import { useAuth } from "@/hooks/use-auth"

export default function SignupPage() {
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
      router.push("/dashboard")
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao criar conta"
      setError(message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Criar Conta</h1>
        <p className="text-sm text-[var(--text-tertiary)] font-mono mt-1">
          Comece a gerenciar seus secrets
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Nome"
          type="text"
          placeholder="Seu nome"
          icon={User}
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label="Email"
          type="email"
          placeholder="voce@email.com"
          icon={Mail}
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Senha"
          type="password"
          placeholder="••••••••"
          icon={Lock}
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Confirmar Senha"
          type="password"
          placeholder="••••••••"
          icon={Lock}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" fullWidth loading={isSubmitting}>
          Criar Conta
        </Button>
      </form>

      <div className="relative">
        <Separator className="my-4" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--background)] px-2 text-xs text-[var(--text-tertiary)]">
          ou cadastre-se com
        </span>
      </div>

      <OAuthButtonGroup />

      <p className="text-center text-sm text-[var(--text-tertiary)]">
        Já tem conta?{" "}
        <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
          Entrar
        </Link>
      </p>
    </div>
  )
}
