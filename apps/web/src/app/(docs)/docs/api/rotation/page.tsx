'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
  Callout,
} from '@/components/docs';

export default function RotationPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Secret Rotation' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Secret Rotation</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Gerencie políticas de rotação de segredos para manter suas credenciais
        sempre atualizadas. O CriptEnv suporta três políticas: manual, notificação
        e rotação automática.
      </p>

      <Callout type="info">
        <strong>Políticas disponíveis:</strong>
        <br />• <strong>manual</strong> — você rotaciona quando quiser
        <br />• <strong>notify</strong> — alerta quando o segredo expira
        <br />• <strong>auto</strong> — rotação automática na data de expiração
      </Callout>

      {/* POST /secrets/:id/rotate */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="post" /> Rotacionar segredo
        </h2>
        <p className="text-muted-foreground mb-4">
          Rotaciona o valor de um segredo imediatamente. O valor anterior é
          mantido no histórico.
        </p>

        <ParamTable
          params={[
            {
              name: 'value',
              type: 'string',
              required: true,
              description: 'Novo valor do segredo',
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST https://api.criptenv.dev/api/v1/projects/{pid}/secrets/sec_abc123/rotate \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{"value": "new-secret-value-here"}'`}
        />

        <ResponseBlock
          code={`{
  "id": "sec_abc123",
  "name": "API_KEY",
  "rotated_at": "2025-02-01T10:00:00Z",
  "version": 3
}`}
        />
      </section>

      {/* POST /secrets/:id/expiration */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="post" /> Definir expiração
        </h2>
        <p className="text-muted-foreground mb-4">
          Configura a data de expiração e a política de rotação para um segredo.
        </p>

        <ParamTable
          params={[
            {
              name: 'expires_at',
              type: 'string',
              required: true,
              description: 'Data de expiração (ISO 8601)',
            },
            {
              name: 'policy',
              type: 'string',
              required: true,
              description: 'Política: manual, notify, auto',
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST https://api.criptenv.dev/api/v1/projects/{pid}/secrets/sec_abc123/expiration \\
  -H "Authorization: Bearer {token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expires_at": "2025-03-01T00:00:00Z",
    "policy": "notify"
  }'`}
        />

        <ResponseBlock
          code={`{
  "id": "sec_abc123",
  "expires_at": "2025-03-01T00:00:00Z",
  "rotation_policy": "notify"
}`}
        />
      </section>

      {/* GET /secrets/:id/rotation/status */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="get" /> Status da rotação
        </h2>
        <p className="text-muted-foreground mb-4">
          Consulta o status atual da rotação de um segredo, incluindo política,
          expiração e dias restantes.
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://api.criptenv.dev/api/v1/projects/{pid}/secrets/sec_abc123/rotation/status \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "secret_id": "sec_abc123",
  "rotation_policy": "notify",
  "expires_at": "2025-03-01T00:00:00Z",
  "days_remaining": 28,
  "last_rotated_at": "2025-01-31T12:00:00Z",
  "version": 3
}`}
        />
      </section>

      {/* GET /secrets/:id/rotation/history */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="get" /> Histórico de rotações
        </h2>
        <p className="text-muted-foreground mb-4">
          Retorna o histórico completo de rotações do segredo.
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://api.criptenv.dev/api/v1/projects/{pid}/secrets/sec_abc123/rotation/history \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "history": [
    {
      "version": 3,
      "rotated_at": "2025-02-01T10:00:00Z",
      "rotated_by": "usr_123",
      "reason": "manual"
    },
    {
      "version": 2,
      "rotated_at": "2025-01-15T08:00:00Z",
      "rotated_by": "system",
      "reason": "auto"
    }
  ]
}`}
        />
      </section>

      {/* DELETE /secrets/:id/expiration */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="delete" /> Remover expiração
        </h2>
        <p className="text-muted-foreground mb-4">
          Remove a política de expiração e rotação de um segredo.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X DELETE https://api.criptenv.dev/api/v1/projects/{pid}/secrets/sec_abc123/expiration \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock code={`{ "deleted": true }`} />
      </section>

      {/* GET /secrets/expiring */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="get" /> Segredos expirando
        </h2>
        <p className="text-muted-foreground mb-4">
          Lista todos os segredos do projeto que estão próximos da expiração.
        </p>

        <ParamTable
          params={[
            {
              name: 'days',
              type: 'integer',
              required: false,
              description: 'Dias até a expiração (padrão: 30)',
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl "https://api.criptenv.dev/api/v1/projects/{pid}/secrets/expiring?days=30" \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "expiring": [
    {
      "id": "sec_abc123",
      "name": "API_KEY",
      "expires_at": "2025-02-15T00:00:00Z",
      "days_remaining": 14,
      "rotation_policy": "notify"
    }
  ]
}`}
        />
      </section>
    </div>
  );
}
