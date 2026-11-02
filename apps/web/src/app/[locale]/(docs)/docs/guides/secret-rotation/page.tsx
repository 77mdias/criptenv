'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function SecretRotationPage() {
  const t = useTranslations('docs.guides.secretRotation');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('guides.overview.title'), href: '/docs/guides' },
          { label: t('title'), href: '/docs/guides/secret-rotation' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        {t('title')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <Callout variant="info">
        {t('infoCallout')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('why.title')}
      </h2>
      <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6">
        <li>{t('why.leaks')}</li>
        <li>{t('why.compliance')}</li>
        <li>{t('why.offboarding')}</li>
        <li>{t('why.hygiene')}</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('manual.title')}
      </h2>

      <Steps>
        <Step title={t('manual.step1.title')}>
          <p className="text-muted-foreground">
            {t('manual.step1.body')}
          </p>
        </Step>

        <Step title={t('manual.step2.title')}>
          <p className="text-muted-foreground">
            {t('manual.step2.body')}
          </p>
          <CodeBlock language="bash" title={t('manual.step2.codeTitle')}>
{`# Set a specific new value
criptenv rotate API_KEY -v "new-secure-value" -p <project-id>

# Rotate with an auto-generated value
criptenv rotate API_KEY -p <project-id>`}
          </CodeBlock>
        </Step>

        <Step title={t('manual.step3.title')}>
          <p className="text-muted-foreground">
            {t('manual.step3.body')}
          </p>
          <CodeBlock language="bash" title={t('manual.step3.codeTitle')}>
{`# Sync with Vercel
criptenv integrations sync --provider vercel --project <project-id>

# Sync with Render
criptenv integrations sync --provider render --project <project-id>`}
          </CodeBlock>
        </Step>

        <Step title={t('manual.step4.title')}>
          <p className="text-muted-foreground">
            {t('manual.step4.body')}
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('automated.title')}
      </h2>
      <p className="text-muted-foreground mb-4">
        {t('automated.body')}
      </p>

      <CodeBlock language="yaml" title={t('automated.codeTitle')}>
{`name: Secret Rotation

on:
  schedule:
    # Runs on the 1st of every month at 03:00 UTC
    - cron: '0 3 1 * *'
  workflow_dispatch:  # Allows manual runs

jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate new secret
        id: generate
        run: |
          NEW_SECRET=$(openssl rand -hex 32)
          echo "secret=$NEW_SECRET" >> $GITHUB_OUTPUT

      - name: Update in CriptEnv
        env:
          CRIPTENV_TOKEN: \${{ secrets.CRIPTENV_TOKEN }}
          # rotate re-encrypts the value, so it needs the project vault password
          CRIPTENV_VAULT_PASSWORD: \${{ secrets.CRIPTENV_VAULT_PASSWORD }}
        run: |
          pip install criptenv
          criptenv ci login --token $CRIPTENV_TOKEN
          criptenv rotate API_KEY -v "\${{ steps.generate.outputs.secret }}" -p <project-id>

      - name: Sync with Vercel
        run: |
          criptenv integrations sync --provider vercel --project <project-id>

      - name: Notify the team
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {"text": "✅ API key rotated successfully"}
        env:
          SLACK_WEBHOOK_URL: \${{ secrets.SLACK_WEBHOOK }}`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('policies.title')}
      </h2>
      <p className="text-muted-foreground mb-4">
        {t('policies.body')}
      </p>

      <div className="border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">{t('policies.type')}</th>
              <th className="text-left p-3 font-medium">{t('policies.frequency')}</th>
              <th className="text-left p-3 font-medium">{t('policies.priority')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3">API Keys</td>
              <td className="p-3">{t('policies.every30')}</td>
              <td className="p-3">{t('policies.high')}</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Database credentials</td>
              <td className="p-3">{t('policies.every90')}</td>
              <td className="p-3">{t('policies.high')}</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">JWT secrets</td>
              <td className="p-3">{t('policies.every30')}</td>
              <td className="p-3">{t('policies.high')}</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Third-party tokens</td>
              <td className="p-3">{t('policies.every90')}</td>
              <td className="p-3">{t('policies.medium')}</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Encryption keys</td>
              <td className="p-3">{t('policies.every180')}</td>
              <td className="p-3">{t('policies.critical')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('expiry.title')}
      </h2>
      <p className="text-muted-foreground mb-4">
        {t('expiry.body')}
      </p>

      <CodeBlock language="bash" title={t('expiry.codeTitle')}>
{`# Set a 90-day expiration with the notify policy
criptenv secrets expire API_KEY --days 90 --policy notify -p <project-id>

# Alert 14 days before expiration
criptenv secrets alert API_KEY --days 14 -p <project-id>

# List secrets close to expiring
criptenv rotation list --days 30 -p <project-id>`}
      </CodeBlock>

      <Callout variant="warning">
        {t('overlapWarning')}
      </Callout>
    </div>
  );
}
