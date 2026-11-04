'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Breadcrumb,
  Callout,
  CodeBlock,
  EndpointBadge,
  InlineCode,
  ParamTable,
  ResponseBlock,
} from '@/components/docs';

const BASE = 'https://criptenv-api.77mdevseven.tech/api/v1/projects/{project_id}/members';

const MEMBER = `{
  "id": "6a7b8c9d-0e1f-4a2b-3c4d-5e6f7a8b9c0d",
  "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "user_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "role": "developer",
  "invited_by": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  "created_at": "2026-01-15T10:30:00Z",
  "accepted_at": "2026-01-15T10:30:00Z",
  "name": "Dev",
  "email": "dev@example.com",
  "avatar_url": null
}`;

// Literal list so the i18n auditor can resolve the dynamic `roles.${key}` lookups.
export const ROLES = ['owner', 'admin', 'developer', 'viewer'] as const;

export default function ApiMembersPage() {
  const t = useTranslations('docs.api.members');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <InlineCode>{chunks}</InlineCode>;
  const projectIdParam = { name: 'project_id', type: 'string', required: true, description: t('params.projectId') };
  const memberIdParam = { name: 'member_id', type: 'string', required: true, description: t('params.memberId') };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: t('title'), href: '/docs/api/members' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-6">{t('description')}</p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('roles.title')}</h2>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">{t('roles.role')}</th>
              <th className="px-4 py-3 text-left font-semibold">{t('roles.permissions')}</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3"><InlineCode>{role}</InlineCode></td>
                <td className="px-4 py-3">{t(`roles.${role}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout variant="info">
        {t.rich('rekeyCallout', { code })}
      </Callout>

      <CodeBlock language="text">{BASE}</CodeBlock>

      {/* POST */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> {t('add.title')}
      </h2>
      <p className="text-muted-foreground mb-4">
        {t.rich('add.body', {
          code,
          invites: (chunks) => (
            <Link href="/docs/api/invites" className="underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <ParamTable
        params={[
          projectIdParam,
          { name: 'user_id', type: 'string', required: true, description: t('add.params.userId') },
          { name: 'role', type: 'string', required: true, description: t('params.role') },
        ]}
      />
      <CodeBlock language="bash" title={t('add.example')}>
        {`curl -X POST "${BASE}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{ "user_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "role": "developer" }'`}
      </CodeBlock>
      <ResponseBlock status={201} statusText="Created">
        <CodeBlock language="json">{MEMBER}</CodeBlock>
      </ResponseBlock>

      {/* GET list */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> {t('list.title')}
      </h2>
      <p className="text-muted-foreground mb-4">{t('list.body')}</p>
      <ParamTable params={[projectIdParam]} />
      <CodeBlock language="bash" title={t('list.example')}>
        {`curl "${BASE}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>
      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "members": [
    ${MEMBER.split('\n').join('\n    ')}
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
      <ParamTable params={[projectIdParam, memberIdParam]} />
      <CodeBlock language="bash">
        {`curl "${BASE}/{member_id}" \\
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
          memberIdParam,
          { name: 'role', type: 'string', required: true, description: t('params.role') },
        ]}
      />
      <CodeBlock language="bash" title={t('update.example')}>
        {`curl -X PATCH "${BASE}/{member_id}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{ "role": "admin" }'`}
      </CodeBlock>
      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">{MEMBER.replace('"role": "developer"', '"role": "admin"')}</CodeBlock>
      </ResponseBlock>

      {/* DELETE */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="DELETE" /> {t('remove.title')}
      </h2>
      <p className="text-muted-foreground mb-4">{t.rich('remove.body', { code })}</p>
      <ParamTable params={[projectIdParam, memberIdParam]} />
      <CodeBlock language="bash" title={t('remove.example')}>
        {`curl -X DELETE "${BASE}/{member_id}" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>
      <ResponseBlock status={204} statusText="No Content">
        <p className="text-sm text-muted-foreground">{t('remove.response')}</p>
      </ResponseBlock>
    </div>
  );
}
