'use client';

import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation"
import {
  Breadcrumb,
  Callout,
  CodeBlock,
  InlineCode,
  StatusTable,
  CardGrid,
  DocCard,
} from '@/components/docs';

// Literal lists so the i18n auditor can resolve the dynamic lookups below.
export const TOKEN_CARDS = [
  { key: 'session', icon: '🍪' },
  { key: 'apiKey', icon: '🔑' },
  { key: 'ciToken', icon: '⚙️' },
] as const;
export const STATUS_CODES = ['200', '201', '204', '400', '401', '403', '404', '409', '422', '429', '500'] as const;
export const RATE_LIMITS = [
  { key: 'public', limit: '100 req' },
  { key: 'apiKey', limit: '1000 req' },
  { key: 'ciToken', limit: '200 req' },
  { key: 'auth', limit: '5 req' },
] as const;
export const DOMAINS = [
  { key: 'authentication', href: '/docs/api/authentication' },
  { key: 'projects', href: '/docs/api/projects' },
  { key: 'environments', href: '/docs/api/environments' },
  { key: 'vault', href: '/docs/api/vault' },
  { key: 'members', href: '/docs/api/members' },
  { key: 'invites', href: '/docs/api/invites' },
  { key: 'ciTokens', href: '/docs/api/ci-tokens' },
  { key: 'rotation', href: '/docs/api/rotation' },
  { key: 'integrations', href: '/docs/api/integrations' },
  { key: 'audit', href: '/docs/api/audit' },
  { key: 'health', href: '/docs/api/health' },
] as const;

export default function ApiReferencePage() {
  const t = useTranslations('docs.api.overview');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <InlineCode>{chunks}</InlineCode>;

  return (
    <div className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-2">API Reference</h1>
      <p className="text-lg text-muted-foreground mb-8">{t('description')}</p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('baseUrl.title')}</h2>
      <p className="mb-4">{t('baseUrl.body')}</p>
      <CodeBlock language="text">{`https://criptenv-api.77mdevseven.tech/api/v1`}</CodeBlock>
      <p className="mb-4">{t.rich('baseUrl.authNote', { code })}</p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('auth.title')}</h2>
      <p className="mb-4">{t('auth.body')}</p>
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        {TOKEN_CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border border-[var(--border)] p-4">
            <h3 className="font-semibold mb-2">{card.icon} {t(`auth.cards.${card.key}.title`)}</h3>
            <p className="text-sm text-muted-foreground">{t.rich(`auth.cards.${card.key}.body`, { code })}</p>
          </div>
        ))}
      </div>
      <p className="mb-4">
        {t.rich('auth.more', {
          link: (chunks) => (
            <Link href="/docs/api/authentication" className="underline font-medium">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('format.title')}</h2>
      <p className="mb-4">{t.rich('format.body', { code })}</p>

      <h3 className="text-xl font-semibold mt-6 mb-3">{t('format.success')}</h3>
      <CodeBlock language="json" title="200 OK">
        {`{
  "id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "name": "my-project",
  "created_at": "2026-01-15T10:30:00Z"
}`}
      </CodeBlock>

      <h3 className="text-xl font-semibold mt-6 mb-3">{t('format.list')}</h3>
      <p className="mb-4">{t('format.listBody')}</p>
      <CodeBlock language="json" title="200 OK">
        {`{
  "projects": [
    { "id": "9f8e7d6c-…", "name": "project-a" },
    { "id": "3a4b5c6d-…", "name": "project-b" }
  ],
  "total": 2
}`}
      </CodeBlock>

      <h3 className="text-xl font-semibold mt-6 mb-3">{t('format.error')}</h3>
      <CodeBlock language="json">{`{ "detail": "Project not found" }`}</CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('status.title')}</h2>
      <StatusTable
        codes={STATUS_CODES.map((statusCode) => ({ code: statusCode, meaning: t(`status.codes.${statusCode}`) }))}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('rateLimit.title')}</h2>
      <p className="mb-4">{t('rateLimit.body')}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">{t('rateLimit.type')}</th>
              <th className="px-4 py-3 text-left font-semibold">{t('rateLimit.limit')}</th>
              <th className="px-4 py-3 text-left font-semibold">{t('rateLimit.window')}</th>
            </tr>
          </thead>
          <tbody>
            {RATE_LIMITS.map((row) => (
              <tr key={row.key} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">{t(`rateLimit.rows.${row.key}`)}</td>
                <td className="px-4 py-3"><InlineCode>{row.limit}</InlineCode></td>
                <td className="px-4 py-3">{t('rateLimit.perMinute')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mb-4">{t('rateLimit.headers')}</p>
      <CodeBlock language="text">
        {`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705312800`}
      </CodeBlock>
      <Callout variant="warning">{t.rich('rateLimit.exceeded', { code })}</Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('pagination.title')}</h2>
      <p className="mb-4">{t.rich('pagination.body', { code })}</p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('domains.title')}</h2>
      <CardGrid>
        {DOMAINS.map((domain) => (
          <DocCard
            key={domain.key}
            title={t(`domains.items.${domain.key}.title`)}
            description={t(`domains.items.${domain.key}.description`)}
            href={domain.href}
          />
        ))}
      </CardGrid>
    </div>
  );
}
