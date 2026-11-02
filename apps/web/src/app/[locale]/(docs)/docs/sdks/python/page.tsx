'use client';

import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation"
import { Breadcrumb, Callout } from '@/components/docs';

export default function PythonSDKPage() {
  const t = useTranslations('docs.sdks.python');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'SDKs', href: '/docs/sdks' },
          { label: 'Python', href: '/docs/sdks/python' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>

      <Callout variant="info">
        {t.rich('inDevelopment', {
          repo: (chunks) => (
            <a href="https://github.com/77mdias/criptenv" className="underline" target="_blank" rel="noopener noreferrer">
              {chunks}
            </a>
          ),
        })}
      </Callout>

      <p className="text-muted-foreground mt-6">
        {t.rich('meanwhile', {
          cli: (chunks) => <Link href="/docs/cli" className="underline">{chunks}</Link>,
          api: (chunks) => <Link href="/docs/api" className="underline">{chunks}</Link>,
        })}
      </p>
    </div>
  );
}
