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

const BASE = 'https://criptenv-api.77mdevseven.tech/api/v1/projects/{project_id}/environments/{environment_id}/vault';

const BLOB = `{
  "key_id": "DATABASE_URL",
  "iv": "MTIzNDU2Nzg5MDEy",
  "ciphertext": "YWJjZGVmZ2hpamtsbW5vcA==",
  "auth_tag": "QUJDREVGR0hJSktMTU5P",
  "checksum": "9b74c9897bac770ffc029102a200c5de",
  "version": 1
}`;

const PULLED_BLOB = `{
  "id": "7e8f9a0b-1c2d-4e3f-4a5b-6c7d8e9f0a1b",
  "project_id": "9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
  "environment_id": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  "key_id": "DATABASE_URL",
  "iv": "MTIzNDU2Nzg5MDEy",
  "ciphertext": "YWJjZGVmZ2hpamtsbW5vcA==",
  "auth_tag": "QUJDREVGR0hJSktMTU5P",
  "version": 1,
  "checksum": "9b74c9897bac770ffc029102a200c5de",
  "created_at": "2026-01-20T14:30:00Z"
}`;

const indent = (text: string, spaces: number) => text.split('\n').join(`\n${' '.repeat(spaces)}`);

export default function ApiVaultPage() {
  const t = useTranslations('docs.api.vault');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <InlineCode>{chunks}</InlineCode>;
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Vault', href: '/docs/api/vault' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Vault</h1>

      <p className="text-muted-foreground mb-6">{t('description')}</p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('flow.title')}</h2>

      <p className="text-muted-foreground mb-4">{t('flow.body')}</p>

      <CodeBlock
        language="text"
        code={`Push:
  1. Read the project's vault password
  2. Derive the vault key with PBKDF2 (100k iterations)
  3. Derive the environment key with HKDF (salt = environment_id)
  4. Encrypt each value with AES-256-GCM
  5. Send every blob (iv + ciphertext + auth_tag) plus the vault proof

Pull:
  1. Download the environment's blobs
  2. Derive the same keys
  3. Decrypt locally with AES-256-GCM`}
      />

      <Callout variant="info">{t.rich('permissions', { code })}</Callout>

      <CodeBlock language="text">{BASE}</CodeBlock>

      {/* ─── POST push ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> {t('push.title')}
      </h2>

      <p className="text-muted-foreground mb-4">{t.rich('push.body', { code, strong })}</p>

      <ParamTable
        params={[
          { name: 'blobs', type: 'object[]', required: true, description: t('push.params.blobs') },
          { name: 'blobs[].key_id', type: 'string', required: true, description: t('push.params.keyId') },
          { name: 'blobs[].iv', type: 'string', required: true, description: t('push.params.iv') },
          { name: 'blobs[].ciphertext', type: 'string', required: true, description: t('push.params.ciphertext') },
          { name: 'blobs[].auth_tag', type: 'string', required: true, description: t('push.params.authTag') },
          { name: 'blobs[].checksum', type: 'string', required: true, description: t('push.params.checksum') },
          { name: 'blobs[].version', type: 'integer', required: true, description: t('push.params.version') },
          { name: 'vault_proof', type: 'string', description: t('push.params.vaultProof') },
          { name: 'expected_version', type: 'integer', description: t('push.params.expectedVersion') },
        ]}
      />

      <CodeBlock language="bash" title={t('push.example')}>
        {`curl -X POST "${BASE}/push" \\
  -H "Authorization: Bearer <YOUR_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expected_version": 5,
    "vault_proof": "<vault-proof>",
    "blobs": [
      ${indent(BLOB, 6)}
    ]
  }'`}
      </CodeBlock>

      <ResponseBlock status={201} statusText="Created">
        <CodeBlock language="json">
          {`{
  "blobs": [
    ${indent(PULLED_BLOB, 4)}
  ],
  "version": 6
}`}
        </CodeBlock>
      </ResponseBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">{t('conflict.title')}</h3>

      <p className="text-muted-foreground mb-4">{t.rich('conflict.body', { code })}</p>

      <ResponseBlock status={409} statusText="Conflict">
        <CodeBlock language="json">
          {`{
  "detail": {
    "message": "Version conflict detected",
    "current_version": 7,
    "expected_version": 5
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <ResponseBlock status={403} statusText="Forbidden">
        <CodeBlock language="json">{`{ "detail": "Invalid vault password" }`}</CodeBlock>
      </ResponseBlock>

      <Callout variant="warning">{t.rich('conflict.callout', { code })}</Callout>

      {/* ─── GET pull ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> {t('pull.title')}
      </h2>

      <p className="text-muted-foreground mb-4">{t('pull.body')}</p>

      <CodeBlock language="bash" title={t('pull.example')}>
        {`curl "${BASE}/pull" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "blobs": [
    ${indent(PULLED_BLOB, 4)}
  ],
  "version": 6
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── GET version ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> {t('version.title')}
      </h2>

      <p className="text-muted-foreground mb-4">{t('version.body')}</p>

      <CodeBlock language="bash" title={t('version.example')}>
        {`curl "${BASE}/version" \\
  -H "Authorization: Bearer <YOUR_TOKEN>"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">{`{
  "version": 6,
  "blob_count": 14
}`}</CodeBlock>
      </ResponseBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('deploy.title')}</h2>

      <p className="text-muted-foreground mb-4">{t('deploy.body')}</p>

      <CodeBlock language="bash" title={t('deploy.example')}>
        {`# The CLI pulls, derives the keys and decrypts in memory; nothing is written to disk.
export CRIPTENV_API_KEY="cek_..."            # read:secrets, optionally scoped to production
export CRIPTENV_VAULT_PASSWORD="$VAULT_PASSWORD"

criptenv run -p <project-id> -e production -- docker compose up -d`}
      </CodeBlock>
    </div>
  );
}
