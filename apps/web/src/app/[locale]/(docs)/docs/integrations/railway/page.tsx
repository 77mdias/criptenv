'use client';

import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation"
import { Breadcrumb, Callout } from '@/components/docs';

export default function RailwayIntegrationPage() {
  const t = useTranslations('docs.integrations.railway');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('integrations.overview.title'), href: '/docs/integrations' },
          { label: 'Railway', href: '/docs/integrations/railway' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        {t('title')}
      </h1>

      <Callout variant="info">
        {t.rich('comingSoon', {
          vercel: (chunks) => <Link href="/docs/integrations/vercel" className="underline">{chunks}</Link>,
          render: (chunks) => <Link href="/docs/integrations/render" className="underline">{chunks}</Link>,
        })}
      </Callout>

      <p className="text-muted-foreground mt-6">
        {t('whenLaunched')}
      </p>
    </div>
  );
}
