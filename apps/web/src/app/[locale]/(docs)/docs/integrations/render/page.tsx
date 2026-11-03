'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function RenderIntegrationPage() {
  const t = useTranslations('docs.integrations.render');
  const tRoot = useTranslations('docs');
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('integrations.overview.title'), href: '/docs/integrations' },
          { label: 'Render', href: '/docs/integrations/render' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        {t('title')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('setup.title')}</h2>

      <Steps>
        <Step title={t('setup.step1.title')}>
          <p className="text-muted-foreground">
            {t.rich('setup.step1.body', { strong })}
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
        </Step>

        <Step title={t('setup.step4.title')}>
          <p className="text-muted-foreground">
            {t('setup.step4.body')}
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('cli.title')}
      </h2>
      <CodeBlock language="bash" title={t('cli.codeTitle')}>
{`# Sync with Render (production by default)
criptenv integrations sync --provider render --project <project-id>

# Sync a specific environment
criptenv integrations sync --provider render --env staging --project <project-id>`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('example.title')}
      </h2>
      <CodeBlock language="yaml" title="render.yaml (Blueprint)">
{`services:
  - type: web
    name: my-app
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - sync: false  # Variables managed by CriptEnv
    envVarGroups:
      - name: my-env-group`}
      </CodeBlock>

      <Callout variant="tip">
        {t('groupsTip')}
      </Callout>

      <Callout variant="warning">
        {t('apiKeyWarning')}
      </Callout>
    </div>
  );
}
