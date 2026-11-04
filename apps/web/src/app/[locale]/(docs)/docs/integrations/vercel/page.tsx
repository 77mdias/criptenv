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
  const code = (chunks: React.ReactNode) => <code>{chunks}</code>;
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
            {t.rich('setup.step2.body', { strong, code })}
          </p>
          <CodeBlock language="bash" title={t('setup.step2.codeTitle')}>
{`criptenv integrations connect vercel \\
  --token <vercel-token> \\
  --project-id <project-id-or-name> \\
  --team-id <team-id>   # only for team projects`}
          </CodeBlock>
        </Step>

        <Step title={t('setup.step3.title')}>
          <p className="text-muted-foreground">
            {t('setup.step3.body')}
          </p>
          <CodeBlock language="bash">
{`criptenv integrations list          # shows the integration ID
criptenv integrations validate <integration-id>`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('targets.title')}</h2>
      <p className="text-muted-foreground mb-4">
        {t.rich('targets.body', { code })}
      </p>
      <CodeBlock language="text" title={t('targets.codeTitle')}>
{`CriptEnv --env   --target       Vercel
──────────────────────────────────────────
production       (default)      Production
staging          preview        Preview
development      (default)      Development`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('manual.title')}
      </h2>
      <p className="text-muted-foreground mb-4">
        {t('manual.body')}
      </p>
      <CodeBlock language="bash" title={t('manual.codeTitle')}>
{`# Push the production environment to Vercel Production
criptenv integrations sync --provider vercel --env production

# Push CriptEnv "staging" to Vercel Preview
criptenv integrations sync --provider vercel --env staging --target preview

# Import Vercel Production into CriptEnv (encrypted locally)
criptenv integrations sync --provider vercel --env production --direction pull`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('ci.title')}</h2>
      <p className="text-muted-foreground mb-4">
        {t('ci.body')}
      </p>
      <CodeBlock language="bash">
{`CRIPTENV_VAULT_PASSWORD="$VAULT_PASSWORD" \\
  criptenv ci deploy --env production --file .env.production --provider vercel`}
      </CodeBlock>

      <Callout variant="warning">
        {t('overwriteWarning')}
      </Callout>

      <Callout variant="info">
        {t('pullNote')}
      </Callout>
    </div>
  );
}
