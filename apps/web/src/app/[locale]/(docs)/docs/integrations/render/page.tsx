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
  const code = (chunks: React.ReactNode) => <code>{chunks}</code>;
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
            {t.rich('setup.step2.body', { strong, code })}
          </p>
          <CodeBlock language="bash">
{`criptenv integrations connect render \\
  --token <render-api-key> \\
  --project-id <srv-service-id>`}
          </CodeBlock>
        </Step>

        <Step title={t('setup.step3.title')}>
          <p className="text-muted-foreground">
            {t('setup.step3.body')}
          </p>
          <CodeBlock language="bash">
{`criptenv integrations validate <integration-id>`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('cli.title')}
      </h2>
      <CodeBlock language="bash" title={t('cli.codeTitle')}>
{`# Push a CriptEnv environment to the Render service
criptenv integrations sync --provider render --env production

# Import the service's variables into CriptEnv (encrypted locally)
criptenv integrations sync --provider render --env production --direction pull`}
      </CodeBlock>

      <Callout variant="tip">
        {t('scopeTip')}
      </Callout>

      <Callout variant="warning">
        {t('apiKeyWarning')}
      </Callout>
    </div>
  );
}
