'use client';

import { useTranslations } from 'next-intl';
import { Breadcrumb, DocCard, CardGrid } from '@/components/docs';
import { Cloud, GitBranch, Server, Triangle, TrainFront } from 'lucide-react';

export default function IntegrationsPage() {
  const t = useTranslations('docs.integrations.overview');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: t('title'), href: '/docs/integrations' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <CardGrid>
        <DocCard
          title="GitHub Action"
          description={t('cards.githubAction')}
          href="/docs/integrations/github-action"
          icon={GitBranch}
        />
        <DocCard
          title="Vercel"
          description={t('cards.vercel')}
          href="/docs/integrations/vercel"
          icon={Triangle}
        />
        <DocCard
          title="Cloudflare Workers"
          description={t('cards.cloudflare')}
          href="/docs/integrations/cloudflare"
          icon={Cloud}
        />
        <DocCard
          title="Railway"
          description={t('cards.railway')}
          href="/docs/integrations/railway"
          icon={TrainFront}
        />
        <DocCard
          title="Render"
          description={t('cards.render')}
          href="/docs/integrations/render"
          icon={Server}
        />
      </CardGrid>
    </div>
  );
}
