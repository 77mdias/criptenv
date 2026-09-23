"use client";

import {
  CircleHelp,
  ExternalLink,
  FileText,
  MessageCircle,
  Shield,
} from "lucide-react";
import { Card } from "@/components/ui/card";

export default function HelpPage() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajuda</h1>
        <p className="text-(--text-tertiary) text-sm font-mono mt-1">
          Encontre recursos e suporte para usar o CriptEnv
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <a href="/docs" target="_blank" rel="noopener noreferrer">
          <Card className="p-4 md:p-6 hover:shadow-lg transition-all cursor-pointer h-full">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent)/10">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-(--accent)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-(--text-primary)">
                    Documentação
                  </h3>
                  <ExternalLink className="h-3 w-3 text-(--text-muted) shrink-0" />
                </div>
                <p className="text-sm text-(--text-muted) font-mono mt-1">
                  Guias completos e referências da API
                </p>
              </div>
            </div>
          </Card>
        </a>

        <a
          href="https://github.com/77mdias/criptenv/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Card className="p-4 md:p-6 hover:shadow-lg transition-all cursor-pointer h-full">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent)/10">
                <MessageCircle className="h-4 w-4 md:h-5 md:w-5 text-(--accent)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-(--text-primary)">
                    Suporte
                  </h3>
                  <ExternalLink className="h-3 w-3 text-(--text-muted) shrink-0" />
                </div>
                <p className="text-sm text-(--text-muted) font-mono mt-1">
                  Abra issues e peça ajuda na comunidade
                </p>
              </div>
            </div>
          </Card>
        </a>
      </div>

      {/* FAQ */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <CircleHelp className="h-5 w-5 text-(--accent) shrink-0" />
          <h2 className="text-lg font-semibold">Perguntas Frequentes</h2>
        </div>

        <div className="space-y-5 md:space-y-6">
          <div>
            <h3 className="font-medium text-(--text-primary) mb-2">
              Como adicionar secrets em um projeto?
            </h3>
            <p className="text-sm text-(--text-muted) font-mono">
              Acesse o projeto desejado, vá para a aba &quot;Secrets&quot; e
              clique em &quot;Novo Secret&quot;. Insira a chave e o valor. Seus
              secrets são criptografados localmente antes de serem enviados.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-(--text-primary) mb-2">
              Como funciona a criptografia?
            </h3>
            <p className="text-sm text-(--text-muted) font-mono">
              O CriptEnv usa criptografia Zero-Knowledge. Suas chaves são
              derivadas localmente usando PBKDF2 e os dados são criptografados
              com AES-256-GCM antes de sair do seu dispositivo.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-(--text-primary) mb-2">
              Posso usar em ambientes CI/CD?
            </h3>
            <p className="text-sm text-(--text-muted) font-mono">
              Sim! Gere tokens de API na aba de configurações do projeto e use
              em seus pipelines de CI/CD para acessar secrets de forma segura.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-(--text-primary) mb-2">
              Como funciona o sistema de convites?
            </h3>
            <p className="text-sm text-(--text-muted) font-mono">
              Na aba &quot;Team&quot; do projeto, você pode invitar membros com
              diferentes permissões: Owner, Admin, Developer ou Viewer. Convites
              expiram automaticamente após 7 dias.
            </p>
          </div>
        </div>
      </Card>

      {/* Security Notice */}
      <Card className="p-4 md:p-6 border-(--accent)/50">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent)/10">
            <Shield className="h-4 w-4 md:h-5 md:w-5 text-(--accent)" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-(--text-primary)">
              Segurança em primeiro lugar
            </h3>
            <p className="text-sm text-(--text-muted) font-mono mt-1">
              Nunca compartilhe suas chaves de criptografia ou tokens de API. O
              CriptEnv nunca solicita sua senha ou chaves por email ou chat.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
