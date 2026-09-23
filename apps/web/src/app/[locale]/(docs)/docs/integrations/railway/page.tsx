'use client';

import { Breadcrumb, Callout } from '@/components/docs';

export default function RailwayIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Integrações', href: '/docs/integrations' },
          { label: 'Railway', href: '/docs/integrations/railway' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        Integração com Railway
      </h1>

      <Callout type="info">
        A integração com Railway está em desenvolvimento e será disponibilizada em breve.
        Atualmente, o CriptEnv suporta integrações com{' '}
        <a href="/docs/integrations/vercel" className="underline">Vercel</a> e{' '}
        <a href="/docs/integrations/render" className="underline">Render</a>.
      </Callout>

      <p className="text-muted-foreground mt-6">
        Quando lançada, a integração com Railway permitirá sincronizar suas
        variáveis de ambiente criptografadas com os serviços do Railway de forma
        automática e segura.
      </p>
    </div>
  );
}
