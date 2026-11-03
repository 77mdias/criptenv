'use client';

import {
  CodeBlock,
  InlineCode,
  Callout,
  Breadcrumb,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function CliConfigurationPage() {
  const t = useTranslations('docs.cli.configuration');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <InlineCode>{chunks}</InlineCode>;
  return (
    <div className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'CLI', href: '/docs/cli' },
          { label: t('breadcrumb'), href: '/docs/cli/configuration' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-2">{t('title')}</h1>
      <p className="text-lg text-muted-foreground mb-8">
        {t('description')}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('remote.title')}
      </h2>
      <p className="mb-4">
        {t('remote.body')}
      </p>
      <Callout variant="info">
        {t('remote.callout')}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('local.title')}
      </h2>
      <p className="mb-4">
        {t.rich('local.body', { code })}
      </p>
      <CodeBlock
        language="text"
        code={`~/.criptenv/
├── auth.key          # local key that encrypts session tokens
└── vault.db          # SQLite with the session, current project and metadata`}
      />

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">{t('local.file')}</th>
              <th className="px-4 py-3 text-left font-semibold">{t('local.description')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3 font-mono text-emerald-500">auth.key</td>
              <td className="px-4 py-3">{t('local.authKey')}</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3 font-mono text-emerald-500">vault.db</td>
              <td className="px-4 py-3">{t('local.vaultDb')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Callout variant="warning">
        {t.rich('local.backupWarning', { code })}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('vaultPassword.title')}
</h2>
      <p className="mb-4">
        {t('vaultPassword.body')}
      </p>

      <CodeBlock
        language="bash"
        code={`criptenv get DATABASE_URL -p <project-id>
> Vault password:`}
      />

      <Callout variant="info">
        {t.rich('vaultPassword.automation', { code })}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('envVars.title')}
      </h2>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">{t('envVars.variable')}</th>
              <th className="px-4 py-3 text-left font-semibold">{t('envVars.type')}</th>
              <th className="px-4 py-3 text-left font-semibold">{t('local.description')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3 font-mono text-emerald-500">CRIPTENV_API_URL</td>
              <td className="px-4 py-3">string</td>
              <td className="px-4 py-3">{t('envVars.apiUrl')}</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3 font-mono text-emerald-500">CRIPTENV_PROJECT</td>
              <td className="px-4 py-3">string</td>
              <td className="px-4 py-3">{t.rich('envVars.project', { code })}</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3 font-mono text-emerald-500">CRIPTENV_VAULT_PASSWORD</td>
              <td className="px-4 py-3">string</td>
              <td className="px-4 py-3">{t('envVars.vaultPassword')}</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3 font-mono text-emerald-500">CRIPTENV_API_KEY</td>
              <td className="px-4 py-3">string</td>
              <td className="px-4 py-3">{t.rich('envVars.apiKey', { code })}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock
        language="bash"
        code={`export CRIPTENV_PROJECT="<project-id>"
export CRIPTENV_VAULT_PASSWORD="project-vault-password"

criptenv export -e production -o .env.production`}
      />

      <Callout variant="warning">
        {t.rich('envVars.warning', { code })}
      </Callout>

      <Callout variant="info">
        {t.rich('doctor', { code })}
      </Callout>
    </div>
  );
}
