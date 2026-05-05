'use client';

import { Breadcrumb, DocCard, CardGrid } from '@/components/docs';

export default function SDKsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'SDKs', href: '/docs/sdks' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">SDKs</h1>
      <p className="text-muted-foreground mb-8">
        Use os SDKs oficiais do CriptEnv para integrar o gerenciamento de
        secrets diretamente na sua aplicação. Descriptografe variáveis de
        ambiente de forma simples e segura com poucas linhas de código.
      </p>

      <CardGrid>
        <DocCard
          title="JavaScript / TypeScript"
          description="SDK oficial para Node.js, Deno e navegadores. Suporte completo a TypeScript com tipos definidos. Instale via npm, yarn ou pnpm."
          href="/docs/sdks/javascript"
          icon="javascript"
        />
        <DocCard
          title="Python"
          description="SDK oficial para Python 3.8+. Gerencie seus secrets com uma API simples e Pythonica. Instale via pip ou poetry."
          href="/docs/sdks/python"
          icon="python"
        />
      </CardGrid>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Comparação</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Recurso</th>
              <th className="text-left p-3 font-medium">JavaScript</th>
              <th className="text-left p-3 font-medium">Python</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3">Descriptografar variáveis</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Gerenciar secrets</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">TypeScript types</td>
              <td className="p-3">✅</td>
              <td className="p-3">N/A</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Type hints</td>
              <td className="p-3">N/A</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Async/Await</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Cache local</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
