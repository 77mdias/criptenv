'use client';

import { useTranslations } from 'next-intl';
import {
  Breadcrumb,
  Callout,
  CodeBlock,
  EndpointBadge,
  InlineCode,
  ParamTable,
  ResponseBlock,
} from '@/components/docs';

const BASE = 'https://criptenv-api.77mdevseven.tech/api/v1/projects';

const VAULT_CONFIG = `{
  "version": 1,
  "kdf": "PBKDF2-SHA256",
  "iterations": 100000,
  "salt": "<base64>",
  "proof_salt": "<base64>",
  "verifier_iv": "<base64>",
  "verifier_ciphertext": "<base64>",
  "verifier_auth_tag": "<base64>"
}`;

const PROJECT = `{
  "id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "owner_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "name": "my-app",
  "slug": "my-app",
  "description": "Main API",
  "encryption_key_id": null,
  "settings": {},
  "vault_config": { "version": 1, "kdf": "PBKDF2-SHA256", "iterations": 100000, "...": "..." },
  "current_user_role": "owner",
  "archived": false,
  "created_at": "2026-01-10T08:00:00Z",
  "updated_at": "2026-01-10T08:00:00Z"
}`;

const indent = (text: string, spaces: number) => text.split('\n').join(`\n${' '.repeat(spaces)}`);

export default function ApiProjectsPage() {
  const t = useTranslations('docs.api.projects');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <InlineCode>{chunks}</InlineCode>;
  const projectIdParam = { name: 'project_id', type: 'string', required: true, description: t('params.projectId') };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: t('title'), href: '/docs/api/projects' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-6">{t('description')}</p>

      <Callout variant="info">{t.rich('vaultCallout', { code })}</Callout>

      <CodeBlock language="text">{BASE}</CodeBlock>

      {/* POST */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> {t('create.title')}
      </h2>
      <p className="text-muted-foreground mb-4">{t('create.body')}</p>
      <ParamTable
        params={[
          { name: 'name', type: 'string', required: true, description: t('create.params.name') },
          { name: 'slug', type: 'string', description: t('create.params.slug') },
          { name: 'description', type: 'string', description: t('create.params.description') },
          { name: 'settings', type: 'object', description: t('create.params.settings') },
          { name: 'vault_config', type: 'object', required: true, description: t('create.params.vaultConfig') },
          { name: 'vault_proof', type: 'string', required: true, description: t('create.params.vaultProof') },
        ]}
      />
      <CodeBlock language="bash" title={t('create.example')}>
        {`curl -X POST "${BASE}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-app",
    "description": "Main API",
    "vault_config": ${indent(VAULT_CONFIG, 4)},
    "vault_proof": "<base64>"
  }'`}
      </CodeBlock>
      <ResponseBlock status={201} statusText="Created">
        <CodeBlock language="json">{PROJECT}</CodeBlock>
      </ResponseBlock>

      {/* GET list */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> {t('list.title')}
      </h2>
      <p className="text-muted-foreground mb-4">{t('list.body')}</p>
      <ParamTable
        params={[{ name: 'include_archived', type: 'boolean', default: 'false', description: t('list.params.includeArchived') }]}
      />
      <CodeBlock language="bash" title={t('list.example')}>
        {`curl "${BASE}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>
      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "projects": [
    ${indent(PROJECT, 4)}
  ],
  "total": 1
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* GET one */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> {t('get.title')}
      </h2>
      <p className="text-muted-foreground mb-4">{t('get.body')}</p>
      <ParamTable params={[projectIdParam]} />
      <CodeBlock language="bash">
        {`curl "${BASE}/{project_id}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>

      {/* PATCH */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="PATCH" /> {t('update.title')}
      </h2>
      <p className="text-muted-foreground mb-4">{t.rich('update.body', { code })}</p>
      <ParamTable
        params={[
          projectIdParam,
          { name: 'name', type: 'string', description: t('update.params.name') },
          { name: 'description', type: 'string', description: t('update.params.description') },
          { name: 'settings', type: 'object', description: t('update.params.settings') },
          { name: 'archived', type: 'boolean', description: t('update.params.archived') },
        ]}
      />
      <CodeBlock language="bash" title={t('update.example')}>
        {`curl -X PATCH "${BASE}/{project_id}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{ "description": "Main API (v2)" }'`}
      </CodeBlock>

      {/* DELETE */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="DELETE" /> {t('delete.title')}
      </h2>
      <p className="text-muted-foreground mb-4">{t.rich('delete.body', { code })}</p>
      <Callout variant="warning">{t('delete.callout')}</Callout>
      <CodeBlock language="bash" title={t('delete.example')}>
        {`curl -X DELETE "${BASE}/{project_id}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>
      <ResponseBlock status={204} statusText="No Content">
        <p className="text-sm text-muted-foreground">{t('delete.response')}</p>
      </ResponseBlock>

      {/* POST rekey */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> {t('rekey.title')}
      </h2>
      <p className="text-muted-foreground mb-4">{t.rich('rekey.body', { code })}</p>
      <ParamTable
        params={[
          projectIdParam,
          { name: 'current_vault_proof', type: 'string', required: true, description: t('rekey.params.currentProof') },
          { name: 'new_vault_config', type: 'object', required: true, description: t('rekey.params.newConfig') },
          { name: 'new_vault_proof', type: 'string', required: true, description: t('rekey.params.newProof') },
          { name: 'environments', type: 'object[]', required: true, description: t('rekey.params.environments') },
        ]}
      />
      <CodeBlock language="bash" title={t('rekey.example')}>
        {`curl -X POST "${BASE}/{project_id}/vault/rekey" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "current_vault_proof": "<base64>",
    "new_vault_config": { "...": "..." },
    "new_vault_proof": "<base64>",
    "environments": [
      { "environment_id": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", "blobs": [ ... ] }
    ]
  }'`}
      </CodeBlock>
      <ResponseBlock status={200} statusText="OK">
        <p className="text-sm text-muted-foreground">{t('rekey.response')}</p>
      </ResponseBlock>
    </div>
  );
}
