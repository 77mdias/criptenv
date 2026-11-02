'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  ParamTable,
  Tabs,
  Tab,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function EncryptionPage() {
  const t = useTranslations('docs.security.encryption');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('security.overview.title'), href: '/docs/security' },
          { label: t('breadcrumb'), href: '/docs/security/encryption' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>

      <p className="text-muted-foreground mb-6">
        {t('description')}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('flow.title')}</h2>

      <p className="text-muted-foreground mb-4">
        {t('flow.body')}
      </p>

      <CodeBlock
        language="text"
        code={`┌─────────────────────────────────────────────────────────┐
│  1. VAULT PASSWORD (user input, per project)            │
│     Example: "my-secure-password-123"                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  2. PBKDF2-HMAC-SHA256                                  │
│     Iterations: 100,000                                 │
│     Salt: 32 random bytes (per project, with the vault) │
│     Output: 256-bit vault key                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  3. HKDF-SHA256 (per environment)                       │
│     IKM: vault key                                      │
│     Salt: environment_id (environment UUID)             │
│     Info: "criptenv-vault-v1"                           │
│     Output: 256-bit environment key                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  4. AES-256-GCM                                         │
│     Key: 256-bit environment key                        │
│     IV: 12 random bytes (per operation)                 │
│     Auth tag: 128 bits                                  │
│     Output: ciphertext + IV + auth_tag                  │
└─────────────────────────────────────────────────────────┘`}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('params.title')}</h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">{t('params.pbkdf2.title')}</h3>

      <ParamTable
        params={[
          {
            name: t('params.algorithm'),
            type: 'string',
            description: t('params.pbkdf2.algorithm'),
          },
          {
            name: t('params.iterations'),
            type: 'number',
            description: t('params.pbkdf2.iterations'),
          },
          {
            name: t('params.saltSize'),
            type: 'number',
            description: t('params.pbkdf2.salt'),
          },
          {
            name: t('params.keySize'),
            type: 'number',
            description: t('params.pbkdf2.keySize'),
          },
        ]}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">{t('params.hkdf.title')}</h3>

      <ParamTable
        params={[
          {
            name: t('params.algorithm'),
            type: 'string',
            description: t('params.hkdf.algorithm'),
          },
          {
            name: 'IKM (Input Key Material)',
            type: 'string',
            description: t('params.hkdf.ikm'),
          },
          {
            name: 'Salt',
            type: 'string',
            description: t('params.hkdf.salt'),
          },
          {
            name: 'Info',
            type: 'string',
            description: t('params.hkdf.info'),
          },
          {
            name: t('params.keySize'),
            type: 'number',
            description: t('params.hkdf.keySize'),
          },
        ]}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">{t('params.aes.title')}</h3>

      <ParamTable
        params={[
          {
            name: t('params.algorithm'),
            type: 'string',
            description: t('params.aes.algorithm'),
          },
          {
            name: t('params.keySize'),
            type: 'number',
            description: t('params.aes.keySize'),
          },
          {
            name: 'IV (Nonce)',
            type: 'number',
            description: t('params.aes.iv'),
          },
          {
            name: 'Auth Tag',
            type: 'number',
            description: t('params.aes.tag'),
          },
        ]}
      />

      <Callout variant="warning">
        {t('params.ivWarning')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('proof.title')}</h2>

      <p className="text-muted-foreground mb-4">
        {t('proof.body')}
      </p>

      <CodeBlock
        language="text"
        code={`┌─────────────────────────────────────────────────────────┐
│  PBKDF2-HMAC-SHA256                                     │
│     Password: vault password                            │
│     Salt: proof_salt (32 random bytes, per project)     │
│     Iterations: 100,000                                 │
│     Output: vault proof (256-bit)                       │
└─────────────────────────────────────────────────────────┘

The vault proof is sent to the server for verification.
The server stores only a bcrypt hash of the proof.
The actual encryption key is never transmitted.`}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('storage.title')}</h2>

      <Tabs defaultValue="local">
        <Tab value="local" label={t('storage.localTab')}>
          <div className="mt-4">
            <p className="text-muted-foreground mb-4">
              {t('storage.localBody')}
            </p>

            <CodeBlock
              language="text"
              code={`Location: ~/.criptenv/vault.db

Database layout:
├── sessions     → authenticated sessions (encrypted)
├── ci_sessions  → encrypted CI sessions
├── projects     → project metadata/cache
└── environments → environment metadata/cache

Security features:
• Restrictive file permissions (0600)
• Sessions expire automatically
• Separate auth.key to encrypt local tokens
• Expired sessions are cleaned up automatically`}
            />

            <Callout variant="info">
              {t('storage.localCallout')}
            </Callout>
          </div>
        </Tab>

        <Tab value="cloud" label={t('storage.cloudTab')}>
          <div className="mt-4">
            <p className="text-muted-foreground mb-4">
              {t('storage.cloudBody')}
            </p>

            <CodeBlock
              language="text"
              code={`Stored on the server:
┌─────────────────────────────────────────────────────┐
│ • bcrypt hash of the vault proof                    │
│ • PBKDF2 salts (32 bytes each, public)              │
│ • Encrypted values (ciphertext + IV + auth_tag)     │
│ • Variable names (keys) — only values are encrypted │
│ • Environment and project IDs (non-secret)          │
└─────────────────────────────────────────────────────┘

NOT stored:
┌─────────────────────────────────────────────────────┐
│ ✗ Vault password                                    │
│ ✗ Derived vault key                                 │
│ ✗ Environment keys                                  │
│ ✗ Plaintext values                                  │
└─────────────────────────────────────────────────────┘`}
            />
          </div>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('implementation.title')}</h2>

      <p className="text-muted-foreground mb-4">
        {t('implementation.body')}
      </p>

      <CodeBlock
        language="typescript"
        code={`// 1. Derive the vault key with PBKDF2
const masterKey = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveBits', 'deriveKey']
);

const derivedKey = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: salt,           // 32 random bytes
    iterations: 100_000,
    hash: 'SHA-256',
  },
  masterKey,
  { name: 'HKDF' },
  true,
  ['deriveKey']
);

// 2. Derive the environment key with HKDF
const envKey = await crypto.subtle.deriveKey(
  {
    name: 'HKDF',
    salt: new TextEncoder().encode(envId),  // environment UUID
    info: new TextEncoder().encode('criptenv-vault-v1'),
    hash: 'SHA-256',
  },
  derivedKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);

// 3. Encrypt with AES-256-GCM
const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv, tagLength: 128 },
  envKey,
  plaintext
);

// Result: ciphertext + IV (12 bytes) + auth_tag (16 bytes)`}
      />
    </div>
  );
}
