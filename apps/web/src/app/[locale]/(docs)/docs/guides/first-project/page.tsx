'use client';

import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation"
import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function FirstProjectPage() {
  const t = useTranslations('docs.guides.firstProject');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('guides.overview.title'), href: '/docs/guides' },
          { label: t('title'), href: '/docs/guides/first-project' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        {t('title')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('prerequisites.title')}
      </h2>
      <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6">
        <li>{t('prerequisites.account')}</li>
        <li>{t('prerequisites.python')}</li>
        <li>{t('prerequisites.terminal')}</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('steps.title')}</h2>

      <Steps>
        <Step title={t('steps.account.title')}>
          <p className="text-muted-foreground">
            {t.rich('steps.account.body', {
              link: (chunks) => (
                <a href="https://criptenv.77mdevseven.tech" className="underline">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </Step>

        <Step title={t('steps.install.title')}>
          <CodeBlock language="bash" title={t('steps.install.codeTitle')}>
{`pip install criptenv`}
          </CodeBlock>
        </Step>

        <Step title={t('steps.login.title')}>
          <CodeBlock language="bash" title={t('steps.login.codeTitle')}>
{`criptenv login --email-address you@example.com`}
          </CodeBlock>
        </Step>

        <Step title={t('steps.project.title')}>
          <p className="text-muted-foreground">
            {t('steps.project.body')}
          </p>
          <CodeBlock language="bash" title={t('steps.project.codeTitle')}>
{`criptenv projects create my-app`}
          </CodeBlock>
          <Callout variant="tip" className="mt-3">
            {t('steps.project.tip')}
          </Callout>
        </Step>

        <Step title={t('steps.secrets.title')}>
          <p className="text-muted-foreground">
            {t('steps.secrets.body')}
          </p>
          <CodeBlock language="bash" title={t('steps.secrets.codeTitle')}>
{`criptenv set DATABASE_URL="postgres://user:pass@host/db"
criptenv set API_KEY="your_api_key_here"`}
          </CodeBlock>
        </Step>

        <Step title={t('steps.import.title')}>
          <p className="text-muted-foreground">
            {t('steps.import.body')}
          </p>
          <CodeBlock language="bash" title={t('steps.import.codeTitle')}>
{`criptenv push .env -p <project-id>`}
          </CodeBlock>
        </Step>

        <Step title={t('steps.export.title')}>
          <p className="text-muted-foreground">
            {t('steps.export.body')}
          </p>
          <CodeBlock language="bash" title={t('steps.export.codeTitle')}>
{`criptenv export -o .env.local`}
          </CodeBlock>
        </Step>
      </Steps>

      <Callout variant="tip">
        {t('done')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('next.title')}</h2>
      <ul className="list-disc list-inside text-muted-foreground space-y-2">
        <li>
          {t.rich('next.action', { link: (chunks: React.ReactNode) => (
            <Link href="/docs/integrations/github-action" className="underline">
              {chunks}
            </Link>
          ) })}
        </li>
        <li>
          {t.rich('next.team', { link: (chunks: React.ReactNode) => (
            <Link href="/docs/guides/team-setup" className="underline">
              {chunks}
            </Link>
          ) })}
        </li>
        <li>
          {t.rich('next.commands', { link: (chunks: React.ReactNode) => (
            <Link href="/docs/cli/commands" className="underline">
              {chunks}
            </Link>
          ) })}
        </li>
      </ul>
    </div>
  );
}
