'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
  Callout,
} from '@/components/docs';

export default function IntegrationsPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Integrations' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Integrations</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Conecte o CriptEnv a provedores de hospedagem para sincronizar segredos
        automaticamente. Suportados: Vercel, Railway e Render.
      </p>

      <Callout variant="info">
        As integrações permitem sincronização bidirecional — você pode enviar
        segredos do CriptEnv para o provedor (push) ou importar do provedor para
        o CriptEnv (pull).
      </Callout>

      {/* POST /integrations */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> Criar integração
        </h2>
        <p className="text-muted-foreground mb-4">
          Conecta uma nova integração com um provedor de hospedagem.
        </p>

        <ParamTable
          params={[
            {
              name: 'provider',
              type: 'string',
              required: true,
              description: 'Provedor: vercel, railway, render',
            },
            {
              name: 'api_key',
              type: 'string',
              required: true,
              description: 'Chave de API do provedor',
            },
            {
              name: 'project_id',
              type: 'string',
              required: true,
              description: 'ID do projeto no provedor',
            },
            {
              name: 'environment',
              type: 'string',
              required: false,
              description: 'Ambiente alvo no provedor (ex: production)',
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/integrations \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "vercel",
    "api_key": "vercel_token_xxx",
    "project_id": "prj_abc123",
    "environment": "production"
  }'`}
        />

        <ResponseBlock status={201}>{`{
  "id": "int_xyz789",
  "provider": "vercel",
  "status": "connected",
  "project_id": "prj_abc123",
  "environment": "production",
  "created_at": "2025-01-31T12:00:00Z"
}`}</ResponseBlock>
      </section>

      {/* GET /integrations */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> Listar integrações
        </h2>
        <p className="text-muted-foreground mb-4">
          Retorna todas as integrações configuradas no projeto.
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/integrations \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "integrations": [
    {
      "id": "int_xyz789",
      "provider": "vercel",
      "status": "connected",
      "environment": "production",
      "last_sync_at": "2025-02-01T10:00:00Z"
    }
  ]
}`}</ResponseBlock>
      </section>

      {/* GET /integrations/:id */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> Obter integração
        </h2>
        <p className="text-muted-foreground mb-4">
          Retorna os detalhes de uma integração específica.
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/integrations/int_xyz789 \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "id": "int_xyz789",
  "provider": "vercel",
  "status": "connected",
  "project_id": "prj_abc123",
  "environment": "production",
  "created_at": "2025-01-31T12:00:00Z",
  "last_sync_at": "2025-02-01T10:00:00Z"
}`}</ResponseBlock>
      </section>

      {/* DELETE /integrations/:id */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="DELETE" /> Remover integração
        </h2>
        <p className="text-muted-foreground mb-4">
          Remove a integração e desfaz a conexão com o provedor.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X DELETE https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/integrations/int_xyz789 \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{ "deleted": true }`}</ResponseBlock>
      </section>

      {/* POST /integrations/:id/sync */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> Sincronizar
        </h2>
        <p className="text-muted-foreground mb-4">
          Executa uma sincronização entre o CriptEnv e o provedor. Use{' '}
          <code className="bg-muted px-1 rounded text-sm">direction: push</code>{' '}
          para enviar segredos ao provedor ou{' '}
          <code className="bg-muted px-1 rounded text-sm">pull</code> para
          importar.
        </p>

        <ParamTable
          params={[
            {
              name: 'direction',
              type: 'string',
              required: true,
              description: 'Direção: push ou pull',
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/integrations/int_xyz789/sync \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{"direction": "push"}'`}
        />

        <ResponseBlock status={200}>{`{
  "sync_id": "sync_abc123",
  "direction": "push",
  "status": "completed",
  "secrets_synced": 5,
  "completed_at": "2025-02-01T10:05:00Z"
}`}</ResponseBlock>
      </section>

      {/* POST /integrations/:id/validate */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> Validar integração
        </h2>
        <p className="text-muted-foreground mb-4">
          Verifica se a conexão com o provedor está funcionando corretamente.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X POST https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/integrations/int_xyz789/validate \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock status={200}>{`{
  "valid": true,
  "provider": "vercel",
  "project_name": "meu-app",
  "checked_at": "2025-02-01T10:10:00Z"
}`}</ResponseBlock>
      </section>
    </div>
  );
}
