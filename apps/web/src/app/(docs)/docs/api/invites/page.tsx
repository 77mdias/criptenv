'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
  Callout,
} from '@/components/docs';

export default function InvitesPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Invites' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Invites</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Gerencie convites por email para adicionar novos membros a um projeto.
        Convites possuem expiração de 7 dias e são vinculados a um papel
        específico.
      </p>

      <Callout type="info">
        Todos os endpoints abaixo requerem autenticação e pertencem à rota base{' '}
        <code className="bg-muted px-1 rounded text-sm">
          /api/v1/projects/{'{pid}'}/invites
        </code>
        .
      </Callout>

      {/* POST /invites */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="post" /> Criar convite
        </h2>
        <p className="text-muted-foreground mb-4">
          Envia um convite por email para um novo membro. O convite expira em 7
          dias automaticamente.
        </p>

        <ParamTable
          params={[
            {
              name: 'email',
              type: 'string',
              required: true,
              description: 'Email do convidado',
            },
            {
              name: 'role',
              type: 'string',
              required: true,
              description: 'Papel do membro: viewer, editor, admin',
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST https://api.criptenv.dev/api/v1/projects/{pid}/invites \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "dev@example.com",
    "role": "editor"
  }'`}
        />

        <ResponseBlock
          code={`{
  "id": "inv_abc123",
  "email": "dev@example.com",
  "role": "editor",
  "status": "pending",
  "expires_at": "2025-02-07T12:00:00Z",
  "created_at": "2025-01-31T12:00:00Z"
}`}
        />
      </section>

      {/* GET /invites */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="get" /> Listar convites
        </h2>
        <p className="text-muted-foreground mb-4">
          Retorna todos os convites do projeto, incluindo pendentes, aceitos e
          revogados.
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://api.criptenv.dev/api/v1/projects/{pid}/invites \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "invites": [
    {
      "id": "inv_abc123",
      "email": "dev@example.com",
      "role": "editor",
      "status": "pending",
      "expires_at": "2025-02-07T12:00:00Z",
      "created_at": "2025-01-31T12:00:00Z"
    }
  ]
}`}
        />
      </section>

      {/* POST /invites/:id/accept */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="post" /> Aceitar convite
        </h2>
        <p className="text-muted-foreground mb-4">
          Aceita um convite pendente. O usuário autenticado passa a ter acesso ao
          projeto com o papel definido no convite.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X POST https://api.criptenv.dev/api/v1/projects/{pid}/invites/inv_abc123/accept \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "id": "inv_abc123",
  "status": "accepted",
  "accepted_at": "2025-02-01T10:00:00Z"
}`}
        />
      </section>

      {/* POST /invites/:id/revoke */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="post" /> Revogar convite
        </h2>
        <p className="text-muted-foreground mb-4">
          Revoga um convite pendente. Convites aceitos não podem ser revogados.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X POST https://api.criptenv.dev/api/v1/projects/{pid}/invites/inv_abc123/revoke \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "id": "inv_abc123",
  "status": "revoked"
}`}
        />
      </section>

      {/* DELETE /invites/:id */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="delete" /> Remover convite
        </h2>
        <p className="text-muted-foreground mb-4">
          Remove permanentemente um convite do projeto.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X DELETE https://api.criptenv.dev/api/v1/projects/{pid}/invites/inv_abc123 \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock code={`{ "deleted": true }`} />
      </section>
    </div>
  );
}
