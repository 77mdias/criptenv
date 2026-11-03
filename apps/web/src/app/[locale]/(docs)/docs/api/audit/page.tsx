'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
  Callout,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function AuditPage() {
  const t = useTranslations('docs.api.audit');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Audit Logs' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Audit Logs</h1>
      <p className="text-lg text-muted-foreground mb-8">
        {t('description')}
      </p>

      <Callout variant="info">
        {t('callout')}
      </Callout>

      {/* GET /audit */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('list.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('list.body')}
        </p>

        <h3 className="text-lg font-semibold mt-6 mb-3">Query Parameters</h3>
        <ParamTable
          params={[
            {
              name: 'page',
              type: 'integer',
              required: false,
              description: t('list.params.page'),
            },
            {
              name: 'per_page',
              type: 'integer',
              required: false,
              description: t('list.params.perPage'),
            },
            {
              name: 'action',
              type: 'string',
              required: false,
              description: t('list.params.action'),
            },
            {
              name: 'resource_type',
              type: 'string',
              required: false,
              description: t('list.params.resourceType'),
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl "https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/audit?page=1&per_page=50&action=vault.pushed" \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "logs": [
    {
      "id": "8d3f2c1a-5b6e-4f70-9a81-2c3d4e5f6a7b",
      "user_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
      "action": "vault.pushed",
      "resource_type": "vault",
      "resource_id": "4b5c6d7e-8f9a-4b0c-1d2e-3f4a5b6c7d8e",
      "metadata": { "environment": "production" },
      "ip_address": "203.0.113.42",
      "user_agent": "criptenv-cli/0.3.0",
      "created_at": "2026-01-31T12:00:00Z",
      "actor": {
        "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
        "name": "Admin",
        "email": "admin@example.com",
        "avatar_url": null
      },
      "auth_type": "session"
    }
  ],
  "total": 142,
  "page": 1,
  "per_page": 50
}`}</ResponseBlock>
      </section>
    </div>
  );
}
