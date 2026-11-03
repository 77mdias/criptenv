'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function MigrationPage() {
  const t = useTranslations('docs.guides.migration');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <code>{chunks}</code>;
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('guides.overview.title'), href: '/docs/guides' },
          { label: t('breadcrumb'), href: '/docs/guides/migration' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">
        {t.rich('description', { code })}
      </p>

      <Steps>
        <Step title={t('step1.title')}>
          <p className="text-muted-foreground">
            {t('step1.body')}
          </p>
          <CodeBlock language="bash" title={t('step1.codeTitle')}>
{`criptenv projects create my-app
criptenv env create development -p my-app
criptenv use my-app   # default project for the next commands`}
          </CodeBlock>
        </Step>

        <Step title={t('step2.title')}>
          <p className="text-muted-foreground">
            {t.rich('step2.body', { code })}
          </p>
          <CodeBlock language="bash" title={t('step2.codeTitle')}>
{`criptenv import .env -e development`}
          </CodeBlock>
        </Step>

        <Step title={t('step3.title')}>
          <p className="text-muted-foreground">
            {t.rich('step3.body', { code })}
          </p>
          <CodeBlock language="bash" title={t('step3.codeTitle')}>
{`criptenv diff .env -e development`}
          </CodeBlock>
        </Step>

        <Step title={t('step4.title')}>
          <p className="text-muted-foreground">
            {t.rich('step4.body', { code })}
          </p>
          <CodeBlock language="bash" title={t('step4.codeTitle')}>
{`criptenv run -e development -- npm run dev`}
          </CodeBlock>
        </Step>

        <Step title={t('step5.title')}>
          <p className="text-muted-foreground">
            {t.rich('step5.body', { code })}
          </p>
          <CodeBlock language="bash" title={t('step5.codeTitle')}>
{`shred -u .env`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('servers.title')}</h2>
      <p className="text-muted-foreground mb-4">
        {t.rich('servers.body', { code })}
      </p>
      <CodeBlock language="bash" title="Container">
{`CRIPTENV_API_KEY=cek_... CRIPTENV_VAULT_PASSWORD=... \\
  criptenv run -p my-app -e production -- node server.js`}
      </CodeBlock>

      <Callout variant="warning">
        {t.rich('exportWarning', { code })}
      </Callout>
    </div>
  );
}
