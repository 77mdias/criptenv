'use client';

import { useTranslations } from 'next-intl';
import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  InlineCode,
  Callout,
  ParamTable,
  ResponseBlock,
} from '@/components/docs';

const BASE = 'https://criptenv-api.77mdevseven.tech/api/v1/projects/{project_id}/environments';

const ENVIRONMENT = `{
  "id": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "name": "staging",
  "display_name": "Staging",
  "is_default": false,
  "restricted": false,
  "secrets_version": 0,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}`;

export default function ApiEnvironmentsPage() {
  const t = useTranslations('docs.api.environments');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <InlineCode>{chunks}</InlineCode>;
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  const projectIdParam = { name: 'project_id', type: 'string', required: true, description: t('params.projectId') };
  const environmentIdParam = { name: 'environment_id', type: 'string', required: true, description: t('params.environmentId') };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: t('title'), href: '/docs/api/environments' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>

      <p className="text-muted-foreground mb-6">{t.rich('description', { code })}</p>

      <CodeBlock language="text">{BASE}</CodeBlock>

      <p className="text-muted-foreground my-4">{t.rich('limits', { code })}</p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('restricted.title')}</h2>
      <Callout variant="info">{t.rich('restricted.body', { code })}</Callout>

      {/* ─── POST ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> {t('create.title')}
      </h2>

      <p className="text-muted-foreground mb-4">{t.rich('create.body', { code })}</p>

      <ParamTable
        params={[
          projectIdParam,
          { name: 'name', type: 'string', required: true, description: t('create.params.name') },
          { name: 'display_name', type: 'string', description: t('create.params.displayName') },
          { name: 'is_default', type: 'boolean', default: 'false', description: t('create.params.isDefault') },
          { name: 'restricted', type: 'boolean', default: 'false', description: t('create.params.restricted') },
        ]}
      />

      <CodeBlock language="bash" title={t('create.example')}>
        {`curl -X POST "${BASE}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "staging",
    "display_name": "Staging"
  }'`}
      </CodeBlock>

      <ResponseBlock status={201} statusText="Created">
        <CodeBlock language="json">{ENVIRONMENT}</CodeBlock>
      </ResponseBlock>

      <ResponseBlock status={409} statusText="Conflict">
        <CodeBlock language="json">{`{ "detail": "Environment 'staging' already exists" }`}</CodeBlock>
      </ResponseBlock>

      {/* ─── GET list ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> {t('list.title')}
      </h2>

      <p className="text-muted-foreground mb-4">{t.rich('list.body', { code })}</p>

      <ParamTable params={[projectIdParam]} />

      <CodeBlock language="bash" title={t('list.example')}>
        {`curl "${BASE}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "environments": [
    ${ENVIRONMENT.split('\n').join('\n    ')}
  ],
  "total": 1,
  "api_key_environment_scope": null
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── GET by id ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> {t('get.title')}
      </h2>

      <p className="text-muted-foreground mb-4">{t('get.body')}</p>

      <ParamTable params={[projectIdParam, environmentIdParam]} />

      <CodeBlock language="bash" title={t('get.example')}>
        {`curl "${BASE}/{environment_id}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">{ENVIRONMENT}</CodeBlock>
      </ResponseBlock>

      <ResponseBlock status={404} statusText="Not Found">
        <CodeBlock language="json">{`{ "detail": "Environment not found" }`}</CodeBlock>
      </ResponseBlock>

      {/* ─── PATCH ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="PATCH" /> {t('update.title')}
      </h2>

      <p className="text-muted-foreground mb-4">{t.rich('update.body', { code })}</p>

      <ParamTable
        params={[
          projectIdParam,
          environmentIdParam,
          { name: 'display_name', type: 'string', description: t('update.params.displayName') },
          { name: 'is_default', type: 'boolean', description: t('update.params.isDefault') },
          { name: 'restricted', type: 'boolean', description: t('update.params.restricted') },
        ]}
      />

      <CodeBlock language="bash" title={t('update.example')}>
        {`curl -X PATCH "${BASE}/{environment_id}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{ "display_name": "Staging v2" }'`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">{ENVIRONMENT.replace('"Staging"', '"Staging v2"')}</CodeBlock>
      </ResponseBlock>

      {/* ─── DELETE ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="DELETE" /> {t('delete.title')}
      </h2>

      <p className="text-muted-foreground mb-4">{t.rich('delete.body', { code, strong })}</p>

      <Callout variant="warning">{t('delete.callout')}</Callout>

      <CodeBlock language="bash" title={t('delete.example')}>
        {`curl -X DELETE "${BASE}/{environment_id}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>

      <ResponseBlock status={204} statusText="No Content">
        <p className="text-sm text-muted-foreground">{t('delete.response')}</p>
      </ResponseBlock>

      <ResponseBlock status={400} statusText="Bad Request">
        <CodeBlock language="json">{`{ "detail": "Cannot delete default environment" }`}</CodeBlock>
      </ResponseBlock>
    </div>
  );
}
