'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
  Callout,
} from '@/components/docs';

export default function AuditPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Audit Logs' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Audit Logs</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Consulte o registro completo de ações realizadas no projeto. Os audit
        logs rastreiam todas as operações sensíveis — criação, leitura,
        atualização e exclusão de segredos, membros, convites e configurações.
      </p>

      <Callout type="info">
        Os audit logs são armazenados por 90 dias. Para retenção prolongada,
        exporte os logs periodicamente ou configure integração com seu SIEM.
      </Callout>

      {/* GET /audit */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="get" /> Listar audit logs
        </h2>
        <p className="text-muted-foreground mb-4">
          Retorna os logs de auditoria do projeto de forma paginada e filtrável.
          Cada entrada contém o autor, ação, recurso afetado e timestamp.
        </p>

        <h3 className="text-lg font-semibold mt-6 mb-3">Query Parameters</h3>
        <ParamTable
          params={[
            {
              name: 'page',
              type: 'integer',
              required: false,
              description: 'Página (padrão: 1)',
            },
            {
              name: 'per_page',
              type: 'integer',
              required: false,
              description: 'Itens por página (padrão: 20, máx: 100)',
            },
            {
              name: 'action',
              type: 'string',
              required: false,
              description:
                'Filtrar por ação: secret.create, secret.update, secret.delete, member.invite, member.remove, etc.',
            },
            {
              name: 'resource_type',
              type: 'string',
              required: false,
              description:
                'Filtrar por tipo de recurso: secret, member, invite, integration, ci_token',
            },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl "https://api.criptenv.dev/api/v1/projects/{pid}/audit?page=1&per_page=20&action=secret.create" \\
  -H "Authorization: Bearer {token}"`}
        />

        <ResponseBlock
          code={`{
  "logs": [
    {
      "id": "log_xyz789",
      "action": "secret.create",
      "resource_type": "secret",
      "resource_id": "sec_abc123",
      "actor": {
        "id": "usr_123",
        "email": "admin@example.com"
      },
      "metadata": {
        "secret_name": "DATABASE_URL",
        "environment": "production"
      },
      "ip_address": "203.0.113.42",
      "created_at": "2025-01-31T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 142
  }
}`}
        />
      </section>
    </div>
  );
}
