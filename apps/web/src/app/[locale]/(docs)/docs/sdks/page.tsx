'use client';

import { useTranslations } from 'next-intl';
import { Breadcrumb, DocCard, CardGrid } from '@/components/docs';
import { Braces, FileCode } from 'lucide-react';

export default function SDKsPage() {
  const t = useTranslations('docs.sdks.overview');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'SDKs', href: '/docs/sdks' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">SDKs</h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <CardGrid>
        <DocCard
          title="JavaScript / TypeScript"
          description={t('cards.javascript')}
          href="/docs/sdks/javascript"
          icon={Braces}
        />
        <DocCard
          title="Python"
          description={t('cards.python')}
          href="/docs/sdks/python"
          icon={FileCode}
        />
      </CardGrid>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('comparison.title')}</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">{t('comparison.feature')}</th>
              <th className="text-left p-3 font-medium">JavaScript</th>
              <th className="text-left p-3 font-medium">Python</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3">{t('comparison.decrypt')}</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">{t('comparison.manage')}</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">TypeScript types</td>
              <td className="p-3">✅</td>
              <td className="p-3">N/A</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Type hints</td>
              <td className="p-3">N/A</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Async/Await</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">{t('comparison.cache')}</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
