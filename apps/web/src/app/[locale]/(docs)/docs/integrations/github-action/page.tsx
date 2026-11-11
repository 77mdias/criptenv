'use client';

import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation"
import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
  ParamTable,
} from '@/components/docs';

export default function GitHubActionPage() {
  const t = useTranslations('docs.integrations.githubAction');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <code>{chunks}</code>;
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('integrations.overview.title'), href: '/docs/integrations' },
          { label: 'GitHub Action', href: '/docs/integrations/github-action' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">GitHub Action</h1>
      <p className="text-muted-foreground mb-8">
        {t.rich('description', { code })}
      </p>

      <Callout variant="info">
        {t.rich('tokenCallout', {
          code,
          link: (chunks) => (
            <Link href="/dashboard/tokens" className="underline">
              {chunks}
            </Link>
          ),
        })}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('setup.title')}</h2>

      <Steps>
        <Step title={t('setup.step1.title')}>
          <p className="text-muted-foreground">
            {t.rich('setup.step1.body', { code, strong })}
          </p>
          <CodeBlock language="bash" title={t('setup.step1.codeTitle')}>
{`Settings → Secrets and variables → Actions → New repository secret
Name: CRIPTENV_TOKEN            Value: ci_...
Name: CRIPTENV_VAULT_PASSWORD   Value: <project vault password>`}
          </CodeBlock>
        </Step>

        <Step title={t('setup.step2.title')}>
          <p className="text-muted-foreground">
            {t('setup.step2.body')}
          </p>
        </Step>

        <Step title={t('setup.step3.title')}>
          <p className="text-muted-foreground">
            {t('setup.step3.body')}
          </p>
          <CodeBlock language="yaml" title=".github/workflows/deploy.yml">
{`name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Load environment variables
        uses: 77mdias/criptenv/packages/github-action@github-action-v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          vault-password: \${{ secrets.CRIPTENV_VAULT_PASSWORD }}
          project: 'your-project-id'

      - name: Build
        run: npm run build

      - name: Deploy
        run: npm run deploy`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('inputs.title')}
      </h2>
      <p className="text-muted-foreground mb-4">
        {t('inputs.body')}
      </p>

      <ParamTable
        params={[
          {
            name: 'token',
            type: 'string',
            required: true,
            description: t('inputs.token'),
          },
          {
            name: 'project',
            type: 'string',
            required: true,
            description: t('inputs.project'),
          },
          {
            name: 'vault-password',
            type: 'string',
            required: false,
            description: t('inputs.vaultPassword'),
          },
          {
            name: 'environment',
            type: 'string',
            required: false,
            description: t('inputs.environment'),
          },
          {
            name: 'api-url',
            type: 'string',
            required: false,
            description: t('inputs.apiUrl'),
          },
          {
            name: 'prefix',
            type: 'string',
            required: false,
            description: t('inputs.prefix'),
          },
        ]}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('fullExample.title')}</h2>
      <CodeBlock language="yaml" title={t('fullExample.codeTitle')}>
{`name: CI/CD

on:
  push:
    branches: [main, staging]

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: 77mdias/criptenv/packages/github-action@github-action-v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          vault-password: \${{ secrets.CRIPTENV_VAULT_PASSWORD }}
          project: 'your-project-id'
          environment: staging

      - run: npm run build
      - run: npm run deploy:staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: 77mdias/criptenv/packages/github-action@github-action-v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          vault-password: \${{ secrets.CRIPTENV_VAULT_PASSWORD }}
          project: 'your-project-id'
          environment: production

      - run: npm run build
      - run: npm run deploy:production`}
      </CodeBlock>

      <Callout variant="warning">
        {t('tokenWarning')}
      </Callout>
    </div>
  );
}
