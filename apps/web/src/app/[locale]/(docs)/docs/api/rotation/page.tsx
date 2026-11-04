'use client';

import { useTranslations } from 'next-intl';
import {
  Breadcrumb,
  Callout,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
} from '@/components/docs';

const API = 'https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}';
const SECRET = `${API}/environments/{eid}/secrets/{secret_key}`;
const codeClass = 'bg-muted px-1 rounded text-sm';

export default function RotationPage() {
  const t = useTranslations('docs.api.rotation');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <code className={codeClass}>{chunks}</code>;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: t('breadcrumb') },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">{t('title')}</h1>
      <p className="text-lg text-muted-foreground mb-8">{t('description')}</p>

      <Callout variant="info">{t.rich('callout', { code })}</Callout>

      {/* POST rotate */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('rotate.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t.rich('rotate.body', { code })}</p>
        <ParamTable
          params={[
            { name: 'new_value', type: 'string', required: true, description: t('rotate.params.newValue') },
            { name: 'iv', type: 'string', required: true, description: t('rotate.params.iv') },
            { name: 'auth_tag', type: 'string', required: true, description: t('rotate.params.authTag') },
            { name: 'reason', type: 'string', required: false, description: t('rotate.params.reason') },
            { name: 'expected_version', type: 'integer', required: false, description: t('rotate.params.expectedVersion') },
          ]}
        />
        <CodeBlock
          language="bash"
          code={`curl -X POST ${SECRET}/rotate \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "new_value": "<ciphertext-base64>",
    "iv": "<iv-base64>",
    "auth_tag": "<auth-tag-base64>",
    "reason": "Scheduled rotation"
  }'`}
        />
        <ResponseBlock status={200}>{`{
  "rotation_id": "0a1b2c3d-4e5f-4a6b-7c8d-9e0f1a2b3c4d",
  "secret_key": "API_KEY",
  "rotated_at": "2026-02-01T10:00:00Z",
  "new_version": 4,
  "previous_version": 3
}`}</ResponseBlock>
      </section>

      {/* POST expiration */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('expiration.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('expiration.body')}</p>
        <ParamTable
          params={[
            { name: 'secret_key', type: 'string', required: true, description: t('expiration.params.secretKey') },
            { name: 'expires_at', type: 'datetime', required: true, description: t('expiration.params.expiresAt') },
            { name: 'rotation_policy', type: 'string', required: false, description: t('expiration.params.policy') },
            { name: 'notify_days_before', type: 'integer', required: false, description: t('expiration.params.notifyDays') },
          ]}
        />
        <CodeBlock
          language="bash"
          code={`curl -X POST ${SECRET}/expiration \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret_key": "API_KEY",
    "expires_at": "2026-05-01T00:00:00Z",
    "rotation_policy": "notify",
    "notify_days_before": 14
  }'`}
        />
        <ResponseBlock status={201}>{`{
  "id": "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
  "secret_key": "API_KEY",
  "expires_at": "2026-05-01T00:00:00Z",
  "rotation_policy": "notify",
  "notify_days_before": 14,
  "last_notified_at": null,
  "is_expired": false,
  "days_until_expiration": 89,
  "needs_rotation": false
}`}</ResponseBlock>
      </section>

      {/* GET rotation status */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('status.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('status.body')}</p>
        <CodeBlock language="bash" code={`curl ${SECRET}/rotation \\
  -H "Authorization: Bearer {token}"`} />
        <ResponseBlock status={200}>{`{
  "secret_key": "API_KEY",
  "current_version": 4,
  "expires_at": "2026-05-01T00:00:00Z",
  "rotation_policy": "notify",
  "rotated_at": "2026-02-01T10:00:00Z",
  "last_notified_at": null
}`}</ResponseBlock>
      </section>

      {/* GET rotation history */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('history.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('history.body')}</p>
        <CodeBlock language="bash" code={`curl ${SECRET}/rotation/history \\
  -H "Authorization: Bearer {token}"`} />
        <ResponseBlock status={200}>{`{
  "items": [
    {
      "id": "0a1b2c3d-4e5f-4a6b-7c8d-9e0f1a2b3c4d",
      "secret_key": "API_KEY",
      "previous_version": 3,
      "new_version": 4,
      "rotated_by": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      "rotated_at": "2026-02-01T10:00:00Z",
      "reason": "Scheduled rotation"
    }
  ],
  "total": 1
}`}</ResponseBlock>
      </section>

      {/* DELETE expiration */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="DELETE" /> {t('removeExpiration.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('removeExpiration.body')}</p>
        <CodeBlock language="bash" code={`curl -X DELETE ${SECRET}/expiration \\
  -H "Authorization: Bearer {token}"`} />
      </section>

      {/* GET expiring */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('expiring.title')}
        </h2>
        <p className="text-muted-foreground mb-4">{t('expiring.body')}</p>
        <ParamTable
          params={[{ name: 'days', type: 'integer', required: false, description: t('expiring.params.days') }]}
        />
        <CodeBlock language="bash" code={`curl "${API}/secrets/expiring?days=30" \\
  -H "Authorization: Bearer {token}"`} />
        <ResponseBlock status={200}>{`{
  "items": [ ... ],
  "total": 1,
  "page": 1,
  "page_size": 50
}`}</ResponseBlock>
      </section>

      {/* Alert settings */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4">{t('alerts.title')}</h2>
        <p className="text-muted-foreground mb-4">{t.rich('alerts.body', { code })}</p>

        <h3 className="text-xl font-semibold mt-6 mb-3 flex items-center gap-2">
          <EndpointBadge method="GET" /> {t('alerts.get')}
        </h3>
        <CodeBlock language="bash" code={`curl ${API}/alert-settings \\
  -H "Authorization: Bearer {token}"`} />
        <ResponseBlock status={200}>{`{
  "enabled": true,
  "default_notify_days_before": 7,
  "channels": { "in_app": true, "email": true, "webhook": false },
  "webhook_url_preview": null,
  "webhook_configured": false
}`}</ResponseBlock>

        <h3 className="text-xl font-semibold mt-6 mb-3 flex items-center gap-2">
          <EndpointBadge method="PATCH" /> {t('alerts.update')}
        </h3>
        <ParamTable
          params={[
            { name: 'enabled', type: 'boolean', required: false, description: t('alerts.params.enabled') },
            { name: 'default_notify_days_before', type: 'integer', required: false, description: t('alerts.params.notifyDays') },
            { name: 'channels', type: 'object', required: false, description: t('alerts.params.channels') },
            { name: 'webhook_url', type: 'string', required: false, description: t('alerts.params.webhookUrl') },
          ]}
        />
        <CodeBlock language="bash" code={`curl -X PATCH ${API}/alert-settings \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "enabled": true,
    "default_notify_days_before": 14,
    "channels": { "in_app": true, "email": true, "webhook": true },
    "webhook_url": "https://hooks.example.com/criptenv"
  }'`} />

        <h3 className="text-xl font-semibold mt-6 mb-3 flex items-center gap-2">
          <EndpointBadge method="POST" /> {t('alerts.test')}
        </h3>
        <p className="text-muted-foreground mb-4">{t('alerts.testBody')}</p>
        <CodeBlock language="bash" code={`curl -X POST ${API}/alert-settings/test-webhook \\
  -H "Authorization: Bearer {token}"`} />
      </section>
    </div>
  );
}
