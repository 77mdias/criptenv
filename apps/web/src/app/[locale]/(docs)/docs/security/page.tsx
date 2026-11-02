'use client';

import {
  Breadcrumb,
  Callout,
  CardGrid,
  DocCard,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function SecurityOverviewPage() {
  const t = useTranslations('docs.security.overview');
  const tRoot = useTranslations('docs');
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: t('title'), href: '/docs/security' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>

      <p className="text-muted-foreground mb-6">
        {t.rich('description', { strong })}
      </p>

      <Callout variant="info">
        {t('passwordCallout')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('principles.title')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">🔒 {t('principles.confidentiality.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('principles.confidentiality.body')}
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">🛡️ {t('principles.integrity.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('principles.integrity.body')}
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">🧩 {t('principles.isolation.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('principles.isolation.body')}
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">💪 {t('principles.bruteForce.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('principles.bruteForce.body')}
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('hierarchy.title')}</h2>

      <p className="text-muted-foreground mb-4">
        {t('hierarchy.body')}
      </p>

      <div className="bg-muted rounded-lg p-4 font-mono text-sm mb-8">
        <p>Vault Password</p>
        <p className="ml-4">↓ PBKDF2-HMAC-SHA256 ({t('hierarchy.iterations')})</p>
        <p className="ml-4">{t('hierarchy.vaultKey')}</p>
        <p className="ml-8">↓ HKDF-SHA256 (salt=env_id)</p>
        <p className="ml-8">{t('hierarchy.envKey')}</p>
        <p className="ml-12">↓ AES-256-GCM</p>
        <p className="ml-12">{t('hierarchy.encrypted')}</p>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('docs.title')}</h2>

      <CardGrid>
        <DocCard
          title={t('docs.encryption.title')}
          description={t('docs.encryption.description')}
          href="/docs/security/encryption"
        />
        <DocCard
          title={t('docs.zeroKnowledge.title')}
          description={t('docs.zeroKnowledge.description')}
          href="/docs/security/zero-knowledge"
        />
        <DocCard
          title={t('docs.threatModel.title')}
          description={t('docs.threatModel.description')}
          href="/docs/security/threat-model"
        />
      </CardGrid>
    </div>
  );
}
