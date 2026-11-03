'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function VercelIntegrationPage() {
  const t = useTranslations('docs.integrations.vercel');
  const tRoot = useTranslations('docs');
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('integrations.overview.title'), href: '/docs/integrations' },
          { label: 'Vercel', href: '/docs/integrations/vercel' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <Callout variant="info">
        {t('infoCallout')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('setup.title')}</h2>

      <Steps>
        <Step title={t('setup.step1.title')}>
          <p className="text-muted-foreground">
            {t.rich('setup.step1.body', {
              link: (chunks) => (
                <a href="https://vercel.com/account/tokens" className="underline" target="_blank" rel="noopener noreferrer">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </Step>

        <Step title={t('setup.step2.title')}>
          <p className="text-muted-foreground">
            {t.rich('setup.step2.body', { strong })}
          </p>
        </Step>

        <Step title={t('setup.step3.title')}>
          <p className="text-muted-foreground">
            {t('setup.step3.body')}
          </p>
          <CodeBlock language="text" title={t('setup.step3.codeTitle')}>
{`CriptEnv         →  Vercel
─────────────────────────────
production       →  Production
staging          →  Preview
development      →  Development`}
          </CodeBlock>
        </Step>

        <Step title={t('setup.step4.title')}>
          <p className="text-muted-foreground">
            {t('setup.step4.body')}
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('manual.title')}
      </h2>
      <p className="text-muted-foreground mb-4">
        {t('manual.body')}
      </p>
      <CodeBlock language="bash" title={t('manual.codeTitle')}>
{`# Sync the production environment (default)
criptenv integrations sync --provider vercel --project <project-id>

# Sync a specific environment
criptenv integrations sync --provider vercel --env staging --project <project-id>`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('example.title')}
      </h2>
      <CodeBlock language="json" title="vercel.json">
{`{
  "framework": "nextjs",
  "env": {
    "DATABASE_URL": "@criptenv/database-url",
    "API_SECRET": "@criptenv/api-secret"
  }
}`}
      </CodeBlock>

      <Callout variant="warning">
        {t('overwriteWarning')}
      </Callout>
    </div>
  );
}
