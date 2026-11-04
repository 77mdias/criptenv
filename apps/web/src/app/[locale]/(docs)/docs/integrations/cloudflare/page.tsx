'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function CloudflareIntegrationPage() {
  const t = useTranslations('docs.integrations.cloudflare');
  const tRoot = useTranslations('docs');
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  const code = (chunks: React.ReactNode) => <code>{chunks}</code>;
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('integrations.overview.title'), href: '/docs/integrations' },
          { label: 'Cloudflare Workers', href: '/docs/integrations/cloudflare' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <Callout variant="info">
        {t('pushOnly')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('setup.title')}</h2>

      <Steps>
        <Step title={t('setup.step1.title')}>
          <p className="text-muted-foreground">
            {t.rich('setup.step1.body', {
              strong,
              link: (chunks) => (
                <a href="https://dash.cloudflare.com/profile/api-tokens" className="underline" target="_blank" rel="noopener noreferrer">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </Step>

        <Step title={t('setup.step2.title')}>
          <p className="text-muted-foreground">
            {t.rich('setup.step2.body', { strong, code })}
          </p>
          <CodeBlock language="bash">
{`criptenv integrations connect cloudflare \\
  --token <cloudflare-api-token> \\
  --account-id <account-id> \\
  --project-id <worker-script-name>`}
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

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('environments.title')}</h2>
      <p className="text-muted-foreground mb-4">
        {t.rich('environments.body', { code })}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('cli.title')}</h2>
      <CodeBlock language="bash" title={t('cli.codeTitle')}>
{`# Push the production environment to the Worker
criptenv integrations sync --provider cloudflare --env production

# Two Workers (my-app and my-app-staging): pick the integration explicitly
criptenv integrations sync --provider cloudflare --env staging --integration <integration-id>

# From CI, right after importing the env file
CRIPTENV_VAULT_PASSWORD="$VAULT_PASSWORD" \\
  criptenv ci deploy --env production --file .env.production --provider cloudflare`}
      </CodeBlock>

      <Callout variant="warning">
        {t('versionWarning')}
      </Callout>
    </div>
  );
}
