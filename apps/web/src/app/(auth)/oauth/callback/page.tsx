"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authApi } from "@/lib/api/auth"

export default function OAuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check for error in URL first
        const errorParam = searchParams.get("error")
        if (errorParam) {
          setError(errorParam)
          setIsChecking(false)
          setTimeout(() => {
            router.push("/login?error=oauth_failed")
          }, 2000)
          return
        }
        
        // Use the project's API client to check session with credentials
        const user = await authApi.session()
        
        if (user) {
          // Session is valid, redirect to dashboard
          router.push("/dashboard")
        } else {
          // Session invalid
          setError("Falha ao autenticar com OAuth. Por favor, tente novamente.")
          setIsChecking(false)
          setTimeout(() => {
            router.push("/login?error=oauth_failed")
          }, 2000)
        }
      } catch (err) {
        setError("Erro de conexão. Por favor, tente novamente.")
        setIsChecking(false)
        setTimeout(() => {
          router.push("/login?error=network_error")
        }, 2000)
      }
    }

    checkSession()
  }, [router, searchParams])

  const errorParam = searchParams.get("error")
  
  if (error || errorParam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600">
            <span className="text-2xl">✕</span>
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Falha na autenticação OAuth
          </h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            {error || errorParam || "Ocorreu um erro durante o processo de autenticação."}
          </p>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">
          Redirecionando para login...
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Autenticando...
        </h2>
        <p className="text-sm text-[var(--text-tertiary)]">
          Processando login com OAuth
        </p>
      </div>
    </div>
  )
}
