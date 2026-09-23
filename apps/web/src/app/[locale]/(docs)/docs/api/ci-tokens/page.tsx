'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
  Callout,
} from '@/components/docs';

export default function CITokensPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'CI Tokens' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">CI Tokens</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Crie tokens de autenticação para pipelines de CI/CD. Tokens podem ser
        limitados a escopos e ambientes específicos. O token em texto claro é
        exibido apenas uma vez na criação.
      </p>

      <Callout type="warning">
        O valor do token só é retornado no momento da criação. Guarde-o em um
        local seguro — como um secret manager do seu provedor de CI. Se
        perder, será necessário criar um novo.
      </Callout>

      {/* POST /ci-tokens */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="post" /> Criar token
        </h2>
        <p className="text-muted-foreground mb-4">
          Cria um novo token de CI/CD. O campo{' '}
          <code className="bg-muted px-1 rounded text-sm">token</code> (texto
          claro) é retornado apenas nesta resposta.
        </p>

        <ParamTable
          params={[
            {
              name: 'name',
              type: 'string',
              required: true,
              description: 'Nome descritivo do token',
            },
            {
              name: 'scopes',
              type: 'string[]',
              required: true,
              description: 'Escopos: secrets.read, secrets.write, secrets.list',
            },
            {
              name: 'environment',
              type: 'string',
              required: false,
              description:
                'Limitar a um ambiente específico (ex: production). Se omitido, acesso a todos.',
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/ci-tokens \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "GitHub Actions - Prod",
    "scopes": ["secrets.read"],
    "environment": "production"
  }'`}
        />

        <ResponseBlock
          code={`{
  "id": "cit_abc123",
  "name": "GitHub Actions - Prod",
  "token": "ce_live_a1b2c3d4e5f6g7h8i9j0...",
  "scopes": ["secrets.read"],
  "environment": "production",
  "created_at": "2025-01-31T12:00:00Z"
}`}
        />
      </section>

      {/* GET /ci-tokens */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="get" /> Listar tokens
        </h2>
        <p className="text-muted-foreground mb-4">
          Retorna todos os tokens de CI do projeto. O valor do token nunca é
          retornado após a criação.
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/ci-tokens \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "tokens": [
    {
      "id": "cit_abc123",
      "name": "GitHub Actions - Prod",
      "scopes": ["secrets.read"],
      "environment": "production",
      "last_used_at": "2025-02-01T09:30:00Z",
      "created_at": "2025-01-31T12:00:00Z"
    }
  ]
}`}
        />
      </section>

      {/* POST /ci-tokens/:id/revoke */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="post" /> Revogar token
        </h2>
        <p className="text-muted-foreground mb-4">
          Revoga um token, impedindo seu uso imediatamente.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X POST https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/ci-tokens/cit_abc123/revoke \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "id": "cit_abc123",
  "status": "revoked",
  "revoked_at": "2025-02-01T10:00:00Z"
}`}
        />
      </section>

      {/* DELETE /ci-tokens/:id */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="delete" /> Remover token
        </h2>
        <p className="text-muted-foreground mb-4">
          Remove permanentemente um token de CI do projeto.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X DELETE https://criptenv-api.77mdevseven.tech/api/v1/projects/{pid}/ci-tokens/cit_abc123 \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock code={`{ "deleted": true }`} />
      </section>
    </div>
  );
}
