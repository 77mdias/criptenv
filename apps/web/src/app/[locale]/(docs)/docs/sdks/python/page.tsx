'use client';

import { Breadcrumb, Callout } from '@/components/docs';

export default function PythonSDKPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'SDKs', href: '/docs/sdks' },
          { label: 'Python', href: '/docs/sdks/python' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">SDK Python</h1>

      <Callout type="info">
        O SDK oficial para Python está em desenvolvimento.
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
        Enquanto o SDK não é lançado, você pode usar o{' '}
        <a href="/docs/cli" className="underline">CLI</a> diretamente
        ou a <a href="/docs/api" className="underline">API REST</a> para integrações programáticas.
      </p>
    </div>
  );
}
