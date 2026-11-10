'use client';

import { useTranslations } from 'next-intl';
import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
  Callout,
} from '@/components/docs';

const API = 'https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/integrations';
const codeClass = 'bg-muted px-1 rounded text-sm';

const INTEGRATION = `{
  "id": "5d6e7f8a-9b0c-4d1e-2f3a-4b5c6d7e8f9a",
  "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "provider": "vercel",
  "name": "Production",
  "status": "active",
  "last_sync_at": "2026-02-01T10:00:00Z",
  "last_error": null,
  "created_at": "2026-01-31T12:00:00Z",
  "auto_sync_targets": {},
  "redeploy": false
}`;

export default function IntegrationsPage() {
  const t = useTranslations('docs.api.integrations');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <code className={codeClass}>{chunks}</code>;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Integrations' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Integrations</h1>
      <p className="text-lg text-muted-foreground mb-8">{t('description')}</p>

      <Callout variant="info">{t.rich('callout', { code })}</Callout>

      {/* POST /integrations */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('create.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('create.body')}</p>

        <ParamTable
          params={[
            { name: 'provider', type: 'string', required: true, description: t('create.params.provider') },
            { name: 'name', type: 'string', required: true, description: t('create.params.name') },
            { name: 'config', type: 'object', required: true, description: t('create.params.config') },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST ${API} \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "vercel",
    "name": "Production",
    "config": {
      "api_token": "<vercel-token>",
      "project_id": "prj_abc123"
    }
  }'`}
        />

        <ResponseBlock status={201}>{INTEGRATION}</ResponseBlock>
      </section>

      {/* GET /integrations */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('list.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('list.body')}</p>

        <CodeBlock
          language="bash"
          code={`curl ${API} \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "integrations": [
    ${INTEGRATION.split('\n').join('\n    ')}
  ],
  "total": 1,
  "available_providers": ["vercel", "render"]
}`}</ResponseBlock>
      </section>

      {/* GET /integrations/:id */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('get.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('get.body')}</p>

        <CodeBlock
          language="bash"
          code={`curl ${API}/{integration_id} \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{INTEGRATION}</ResponseBlock>
      </section>

      {/* PATCH /integrations/:id */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="PATCH" /> {t('update.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t.rich('update.body', { code })}</p>

        <ParamTable
          params={[
            { name: 'auto_sync_targets', type: 'object', required: false, description: t('update.params.auto_sync_targets') },
            { name: 'redeploy', type: 'boolean', required: false, description: t('update.params.redeploy') },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X PATCH ${API}/{integration_id} \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{"auto_sync_targets": {"{environment_id}": "production"}, "redeploy": true}'`}
        />

        <ResponseBlock status={200}>{`{
  "id": "5d6e7f8a-9b0c-4d1e-2f3a-4b5c6d7e8f9a",
  "provider": "vercel",
  "name": "Production",
  "status": "active",
  "auto_sync_targets": {"{environment_id}": "production"},
  "redeploy": true
}`}</ResponseBlock>
      </section>

      {/* DELETE /integrations/:id */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="DELETE" /> {t('delete.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('delete.body')}</p>

        <CodeBlock
          language="bash"
          code={`curl -X DELETE ${API}/{integration_id} \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={204}>{`(no content)`}</ResponseBlock>
      </section>

      {/* POST /integrations/:id/sync */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('sync.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t.rich('sync.body', { code })}</p>

        <ParamTable
          params={[
            { name: 'direction', type: 'string', required: true, description: t('sync.params.direction') },
            { name: 'environment', type: 'string', required: false, description: t('sync.params.environment') },
            { name: 'secrets', type: 'object[]', required: false, description: t('sync.params.secrets') },
            { name: 'delete_keys', type: 'string[]', required: false, description: t('sync.params.delete_keys') },
          ]}
        />
        <p className="text-muted-foreground mb-4">{t.rich('sync.plan', { code })}</p>

        <CodeBlock
          language="bash"
          code={`curl -X POST ${API}/{integration_id}/sync \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{"direction": "push", "environment": "production",
       "secrets": [{"key": "DATABASE_URL", "value": "postgres://..."}]}'`}
        />

        <ResponseBlock status={200}>{`{
  "success": true,
  "message": "Successfully synced push (production)",
  "synced_count": 1,
  "secrets": null,
  "deploy_scheduled": false
}`}</ResponseBlock>

        <CodeBlock
          language="bash"
          code={`curl -X POST ${API}/{integration_id}/sync \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{"direction": "pull", "environment": "production"}'`}
        />

        <ResponseBlock status={200}>{`{
  "success": true,
  "message": "Successfully synced pull (production)",
  "synced_count": 1,
  "secrets": [{"key": "DATABASE_URL", "value": "postgres://..."}]
}`}</ResponseBlock>
      </section>

      {/* POST /integrations/:id/validate */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('validate.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('validate.body')}</p>

        <CodeBlock
          language="bash"
          code={`curl -X POST ${API}/{integration_id}/validate \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "valid": true,
  "error": null
}`}</ResponseBlock>
      </section>
    </div>
  );
}
