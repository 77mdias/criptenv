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

export default function InvitesPage() {
  const t = useTranslations('docs.api.invites');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <code className="bg-muted px-1 rounded text-sm">{chunks}</code>;
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Invites' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Invites</h1>
      <p className="text-lg text-muted-foreground mb-8">
        {t('description')}
      </p>

      <Callout variant="info">
        {t.rich('callout', { code })}
      </Callout>

      {/* POST /invites */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('create.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('create.body')}
        </p>

        <ParamTable
          params={[
            {
              name: 'email',
              type: 'string',
              required: true,
              description: t('create.params.email'),
            },
            {
              name: 'role',
              type: 'string',
              required: true,
              description: t('create.params.role'),
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/invites \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "dev@example.com",
    "role": "developer"
  }'`}
        />

        <ResponseBlock status={201}>{`{
  "id": "3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
  "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "email": "dev@example.com",
  "role": "developer",
  "invited_by": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "expires_at": "2026-02-07T12:00:00Z",
  "accepted_at": null,
  "revoked_at": null,
  "created_at": "2026-01-31T12:00:00Z",
  "invited_by_name": "Admin",
  "token": "<invite-token, returned only on creation>"
}`}</ResponseBlock>
      </section>

      {/* GET /invites */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('list.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('list.body')}
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/invites \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "invites": [
    {
      "id": "3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
      "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
      "email": "dev@example.com",
      "role": "developer",
      "invited_by": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      "expires_at": "2026-02-07T12:00:00Z",
      "accepted_at": null,
      "revoked_at": null,
      "created_at": "2026-01-31T12:00:00Z",
      "invited_by_name": "Admin"
    }
  ],
  "total": 1
}`}</ResponseBlock>
      </section>

      {/* POST /invites/:id/accept */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('accept.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('accept.body')}
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X POST https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/invites/{invite_id}/accept \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "id": "3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
  "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "email": "dev@example.com",
  "role": "developer",
  "invited_by": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "expires_at": "2026-02-07T12:00:00Z",
  "accepted_at": "2026-02-01T10:00:00Z",
  "revoked_at": null,
  "created_at": "2026-01-31T12:00:00Z",
  "invited_by_name": "Admin"
}`}</ResponseBlock>
      </section>

      {/* POST /invites/:id/revoke */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('revoke.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('revoke.body')}
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X POST https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/invites/{invite_id}/revoke \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "id": "3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
  "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "email": "dev@example.com",
  "role": "developer",
  "invited_by": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "expires_at": "2026-02-07T12:00:00Z",
  "accepted_at": null,
  "revoked_at": "2026-02-01T10:00:00Z",
  "created_at": "2026-01-31T12:00:00Z",
  "invited_by_name": "Admin"
}`}</ResponseBlock>
      </section>

      {/* DELETE /invites/:id */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="DELETE" /> {t('delete.title')}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t('delete.body')}
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X DELETE https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/invites/{invite_id} \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={204}>{`(no content)`}</ResponseBlock>
      </section>
    </div>
  );
}
