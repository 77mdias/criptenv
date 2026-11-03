'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Tabs,
  Tab,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function ZeroKnowledgePage() {
  const t = useTranslations('docs.security.zeroKnowledge');
  const tRoot = useTranslations('docs');
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  const em = (chunks: React.ReactNode) => <em>{chunks}</em>;
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('security.overview.title'), href: '/docs/security' },
          { label: 'Zero-Knowledge', href: '/docs/security/zero-knowledge' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>

      <p className="text-muted-foreground mb-6">
        {t.rich('description', { strong })}
      </p>

      <Callout variant="info">
        {t('simpleCallout')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('what.title')}</h2>

      <p className="text-muted-foreground mb-4">
        {t('what.p1')}
      </p>

      <p className="text-muted-foreground mb-4">
        {t.rich('what.p2', { em })}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('clientSide.title')}</h2>

      <p className="text-muted-foreground mb-4">
        {t('clientSide.body')}
      </p>

      <CodeBlock
        language="text"
        code={`┌──────────────────────────────────────────────────────────────┐
│                    USER'S BROWSER                            │
│                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │   Vault     │───▶│   PBKDF2     │───▶│   Vault key    │  │
│  │  Password   │    │  (100k iter) │    │   (256-bit)    │  │
│  └─────────────┘    └──────────────┘    └───────┬────────┘  │
│                                                  │           │
│  ┌─────────────┐    ┌──────────────┐            │           │
│  │  Secret     │───▶│  AES-256-GCM │◀───────────┘           │
│  │  (plaintext)│    │              │    + HKDF(env_id)       │
│  └─────────────┘    └──────┬───────┘                        │
│                            │                                 │
│                     Ciphertext                               │
│                  (IV + data + tag)                           │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         ▼  Only ciphertext is sent
┌──────────────────────────────────────────────────────────────┐
│                    SERVER                                    │
│                                                              │
│   Stores: ciphertext (useless without the key)              │
│   Receives: vault proof (for verification)                  │
│   Never sees: password, keys, plaintext values              │
└──────────────────────────────────────────────────────────────┘`}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('visibility.title')}</h2>

      <Tabs defaultValue="sees">
        <Tab value="sees" label={t('visibility.seesTab')}>
          <div className="mt-4">
            <CodeBlock
              language="text"
              code={t('visibility.sees')}
            />
          </div>
        </Tab>

        <Tab value="not_sees" label={t('visibility.notSeesTab')}>
          <div className="mt-4">
            <CodeBlock
              language="text"
              code={t('visibility.notSees')}
            />
          </div>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('proof.title')}</h2>

      <p className="text-muted-foreground mb-4">
        {t('proof.body')}
      </p>

      <CodeBlock
        language="text"
        code={`Vault proof generation:
━━━━━━━━━━━━━━━━━━━━━━━

Vault password + proof_salt (random, per project)
         │
         ▼
   PBKDF2-HMAC-SHA256 (100,000 iterations)
         │
         ▼
   Vault proof (256-bit)
         │
         ▼
   Sent to the server for verification

The server stores only a bcrypt hash of the proof.
On unlock it compares the submitted proof with that hash:
match → access granted, no match → access denied.`}
      />

      <Callout variant="warning">
        {t('proof.callout')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('implications.title')}</h2>

      <div className="space-y-4 mb-8">
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold mb-2">🔑 {t('implications.forgot.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t.rich('implications.forgot.body', { strong })}
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold mb-2">🏢 {t('implications.teams.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('implications.teams.body')}
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold mb-2">🔍 {t('implications.audit.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('implications.audit.body')}
          </p>
        </div>
      </div>
    </div>
  );
}
