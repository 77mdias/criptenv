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

const API = 'https://criptenv-api.77mdevseven.tech/api/v1';
const codeClass = 'bg-muted px-1 rounded text-sm';

export default function CITokensPage() {
  const t = useTranslations('docs.api.ciTokens');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <code className={codeClass}>{chunks}</code>;
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'CI Tokens' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">CI Tokens</h1>
      <p className="text-lg text-muted-foreground mb-8">
        {t.rich('description', { code })}
      </p>

      <Callout variant="warning">
        {t.rich('vaultWarning', { code, strong })}
      </Callout>

      {/* POST /projects/{pid}/tokens */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('create.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          <code className={codeClass}>POST /api/v1/projects/{'{pid}'}/tokens</code>{' '}
          — {t.rich('create.body', { code })}
        </p>

        <ParamTable
          params={[
            { name: 'name', type: 'string', required: true, description: t('create.params.name') },
            { name: 'description', type: 'string', required: false, description: t('create.params.description') },
            {
              name: 'scopes',
              type: 'string[]',
              required: false,
              description: t('create.params.scopes'),
            },
            {
              name: 'environment_scope',
              type: 'string',
              required: false,
              description: t('create.params.environmentScope'),
            },
            { name: 'expires_at', type: 'datetime', required: false, description: t('create.params.expiresAt') },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST ${API}/projects/{pid}/tokens \\
  -H "Authorization: Bearer {session_token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "GitHub Actions - Prod",
    "scopes": ["read:secrets"],
    "environment_scope": "production"
  }'`}
        />

        <ResponseBlock status={201}>
          {`{
  "token": "ci_<TOKEN>",
  "token_info": {
    "id": "6f1c…-uuid",
    "project_id": "{pid}",
    "name": "GitHub Actions - Prod",
    "scopes": ["read:secrets"],
    "environment_scope": "production",
    "last_used_at": null,
    "expires_at": null,
    "revoked_at": null,
    "created_at": "2026-01-31T12:00:00Z"
  }
}`}
        </ResponseBlock>
      </section>

      {/* GET /projects/{pid}/tokens */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('list.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('list.body')}
        </p>

        <CodeBlock
          language="bash"
          code={`curl ${API}/projects/{pid}/tokens \\
  -H "Authorization: Bearer {session_token}"`}
        />

        <ResponseBlock status={200}>
          {`{
  "tokens": [
    {
      "id": "6f1c…-uuid",
      "name": "GitHub Actions - Prod",
      "scopes": ["read:secrets"],
      "environment_scope": "production",
      "last_used_at": "2026-02-01T09:30:00Z",
      "created_at": "2026-01-31T12:00:00Z"
    }
  ],
  "total": 1
}`}
        </ResponseBlock>
      </section>

      {/* POST /projects/{pid}/tokens/{id}/revoke */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('revoke.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t.rich('revoke.body', { code })}
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X POST ${API}/projects/{pid}/tokens/{token_id}/revoke \\
  -H "Authorization: Bearer {session_token}"`}
        />
      </section>

      {/* DELETE /projects/{pid}/tokens/{id} */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="DELETE" /> {t('delete.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t.rich('delete.body', { code })}
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X DELETE ${API}/projects/{pid}/tokens/{token_id} \\
  -H "Authorization: Bearer {session_token}"`}
        />
      </section>

      {/* Using the token in a pipeline */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4">{t('pipeline.title')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('pipeline.body')}
        </p>

        <CodeBlock
          language="bash"
          code={`# 1. ci_ token → ci_s_ session (expires in 3600 s)
curl -X POST ${API}/auth/ci-login \\
  -H "Content-Type: application/json" \\
  -d '{"token": "'"$CRIPTENV_TOKEN"'"}'

# 2. Encrypted blobs for the environment
curl "${API}/ci/secrets?environment=production" \\
  -H "Authorization: Bearer {ci_session_token}"`}
        />

        <ResponseBlock status={200}>
          {`{
  "session_token": "ci_s_…",
  "expires_in": 3600,
  "project_id": "{pid}",
  "permissions": ["read:secrets"],
  "environment_scope": "production"
}`}
        </ResponseBlock>

        <Callout variant="info">
          {t.rich('pipeline.callout', { code })}
        </Callout>
      </section>
    </div>
  );
}
