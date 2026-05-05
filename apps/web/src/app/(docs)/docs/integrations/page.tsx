'use client';

import { Breadcrumb, DocCard, CardGrid } from '@/components/docs';

export default function IntegrationsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Integrações', href: '/docs/integrations' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Integrações</h1>
      <p className="text-muted-foreground mb-8">
        O CriptEnv se integra com as principais plataformas de deploy e CI/CD do mercado.
        Configure a sincronização automática de variáveis de ambiente criptografadas
        diretamente no seu pipeline de deploy.
      </p>

      <CardGrid>
        <DocCard
          title="GitHub Action"
          description="Execute o CriptEnv diretamente nos seus workflows do GitHub Actions para injetar secrets de forma segura durante o build e deploy."
          href="/docs/integrations/github-action"
          icon="github"
        />
        <DocCard
          title="Vercel"
          description="Sincronize automaticamente suas variáveis de ambiente criptografadas com os Environment Variables do Vercel."
          href="/docs/integrations/vercel"
          icon="vercel"
        />
        <DocCard
          title="Railway"
          description="Integre o CriptEnv com o Railway para gerenciar variáveis de ambiente dos seus serviços de forma segura."
          href="/docs/integrations/railway"
          icon="railway"
        />
        <DocCard
          title="Render"
          description="Conecte o CriptEnv ao Render para sincronizar secrets com seus Environment Groups de forma automatizada."
          href="/docs/integrations/render"
          icon="render"
        />
      </CardGrid>
    </div>
  );
}
