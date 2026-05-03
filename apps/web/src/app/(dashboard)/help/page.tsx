"use client"

import { CircleHelp, ExternalLink, FileText, MessageCircle, Shield } from "lucide-react"
import { Card } from "@/components/ui/card"

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajuda</h1>
        <p className="text-[var(--text-tertiary)] text-sm font-mono mt-1">
          Encontre recursos e suporte para usar o CriptEnv
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <a
          href="https://github.com/jeandias/criptenv/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Card className="p-6 hover:shadow-lg transition-all cursor-pointer h-full">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)]/10">
                <FileText className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">Documentação</h3>
                  <ExternalLink className="h-3 w-3 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm text-[var(--text-muted)] font-mono mt-1">
                  Guias completos e referências da API
                </p>
              </div>
            </div>
          </Card>
        </a>

        <a
          href="https://github.com/jeandias/criptenv/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Card className="p-6 hover:shadow-lg transition-all cursor-pointer h-full">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)]/10">
                <MessageCircle className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">Suporte</h3>
                  <ExternalLink className="h-3 w-3 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm text-[var(--text-muted)] font-mono mt-1">
                  Abra issues e peça ajuda na comunidade
                </p>
              </div>
            </div>
          </Card>
        </a>
      </div>

      {/* FAQ */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <CircleHelp className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Perguntas Frequentes</h2>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-[var(--text-primary)] mb-2">
              Como adicionar secrets em um projeto?
            </h3>
            <p className="text-sm text-[var(--text-muted)] font-mono">
              Acesse o projeto desejado, vá para a aba &quot;Secrets&quot; e clique em &quot;Novo Secret&quot;.
              Insira a chave e o valor. Seus secrets são criptografados localmente antes de serem enviados.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[var(--text-primary)] mb-2">
              Como funciona a criptografia?
            </h3>
            <p className="text-sm text-[var(--text-muted)] font-mono">
              O CriptEnv usa criptografia Zero-Knowledge. Suas chaves são derivadas localmente
              usando PBKDF2 e os dados são criptografados com AES-256-GCM antes de sair do seu dispositivo.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[var(--text-primary)] mb-2">
              Posso usar em ambientes CI/CD?
            </h3>
            <p className="text-sm text-[var(--text-muted)] font-mono">
              Sim! Gere tokens de API na aba de configurações do projeto e use em seus
              pipelines de CI/CD para acessar secrets de forma segura.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[var(--text-primary)] mb-2">
              Como funciona o sistema de convites?
            </h3>
            <p className="text-sm text-[var(--text-muted)] font-mono">
              Na aba &quot;Team&quot; do projeto, você pode invitar membros com diferentes permissões:
              Owner, Admin, Developer ou Viewer. Convites expiram automaticamente após 7 dias.
            </p>
          </div>
        </div>
      </Card>

      {/* Security Notice */}
      <Card className="p-6 border-[var(--accent)]/50">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent)]/10">
            <Shield className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">
              Segurança em primeiro lugar
            </h3>
            <p className="text-sm text-[var(--text-muted)] font-mono mt-1">
              Nunca compartilhe suas chaves de criptografia ou tokens de API.
              O CriptEnv nunca solicita sua senha ou chaves por email ou chat.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
