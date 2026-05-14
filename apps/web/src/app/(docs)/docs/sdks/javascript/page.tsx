'use client';

import { Breadcrumb, Callout } from '@/components/docs';

export default function JavaScriptSDKPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'SDKs', href: '/docs/sdks' },
          { label: 'JavaScript', href: '/docs/sdks/javascript' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        SDK JavaScript / TypeScript
      </h1>

      <Callout type="info">
        O SDK oficial para JavaScript/TypeScript está em desenvolvimento.
        Acompanhe o progresso no{' '}
        <a
          href="https://github.com/77mdias/criptenv"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          repositório GitHub
        </a>.
      </Callout>

      <p className="text-muted-foreground mt-6">
        Enquanto o SDK não é lançado, você pode usar a{' '}
        <a href="/docs/api" className="underline">API REST</a> diretamente
        ou a <a href="/docs/integrations/github-action" className="underline">GitHub Action</a> para CI/CD.
      </p>
    </div>
  );
}
