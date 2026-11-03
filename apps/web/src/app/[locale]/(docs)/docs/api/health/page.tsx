'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ResponseBlock,
  Callout,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function HealthPage() {
  const t = useTranslations('docs.api.health');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Health' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Health Checks</h1>
      <p className="text-lg text-muted-foreground mb-8">
        {t('description')}
      </p>

      <Callout variant="info">
        {t('callout')}
      </Callout>

      {/* GET /health */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('status.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('status.body')}
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://criptenv-api.77mdevseven.tech/health`}
        />

        <ResponseBlock status={200}>{`{
  "status": "ok",
  "service": "criptenv-api"
}`}</ResponseBlock>
      </section>

      {/* GET /health/ready */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('ready.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('ready.body')}
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://criptenv-api.77mdevseven.tech/health/ready`}
        />

        <ResponseBlock status={200}>{`{
  "status": "ready",
  "database": "connected"
}`}</ResponseBlock>

        <ResponseBlock status={503}>{`{
  "status": "not ready",
  "database": "disconnected"
}`}</ResponseBlock>
      </section>
    </div>
  );
}
