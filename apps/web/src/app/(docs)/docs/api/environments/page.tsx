'use client';

import {
  Breadcrumb,
  Callout,
  CodeBlock,
  EndpointBadge,
  InlineCode,
  ParamTable,
  ResponseBlock,
} from '@/components/docs';

export default function ApiEnvironmentsPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Ambientes', href: '/docs/api/environments' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Ambientes</h1>

      <p className="text-muted-foreground mb-6">
        Ambientes permitem isolar conjuntos de segredos dentro de um projeto. Ambientes
        comuns incluem <InlineCode>production</InlineCode>, <InlineCode>staging</InlineCode> e{' '}
        <InlineCode>development</InlineCode>. Cada ambiente possui sua própria chave de
        criptografia derivada da chave mestra do projeto.
      </p>

      <CodeBlock language="text">
        {`https://api.criptenv.dev/v1/projects/{project_id}/environments`}
      </CodeBlock>

      {/* ─── POST ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> Criar Ambiente
      </h2>

      <p className="text-muted-foreground mb-4">
        Cria um novo ambiente dentro de um projeto. Requer papel de{' '}
        <InlineCode>admin</InlineCode> ou <InlineCode>developer</InlineCode>.
      </p>

      <CodeBlock language="text">
        {`POST /v1/projects/{project_id}/environments`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (path parameter)' },
          { name: 'name', type: 'string', required: true, description: 'Nome do ambiente (slug, 2-32 caracteres)' },
          { name: 'description', type: 'string', description: 'Descrição opcional do ambiente' },
          { name: 'color', type: 'string', default: 'auto', description: 'Cor em hexadecimal para identificação visual (ex: #10b981)' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Criar ambiente">
        {`curl -X POST "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/environments" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "staging",
    "description": "Ambiente de staging para testes",
    "color": "#f59e0b"
  }'`}
      </CodeBlock>

      <ResponseBlock status={201} statusText="Created">
        <CodeBlock language="json">
          {`{
  "data": {
    "id": "env_d4e5f6",
    "project_id": "proj_k8j2m4n6",
    "name": "staging",
    "description": "Ambiente de staging para testes",
    "color": "#f59e0b",
    "secret_count": 0,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <ResponseBlock status={409} statusText="Conflict">
        <CodeBlock language="json">
          {`{
  "error": {
    "code": "conflict",
    "message": "Já existe um ambiente com o nome 'staging' neste projeto."
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── GET list ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> Listar Ambientes
      </h2>

      <p className="text-muted-foreground mb-4">
        Retorna todos os ambientes de um projeto. Inclui contagem de segredos
        e metadados de cada ambiente.
      </p>

      <CodeBlock language="text">
        {`GET /v1/projects/{project_id}/environments`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (path parameter)' },
          { name: 'page', type: 'integer', default: '1', description: 'Número da página' },
          { name: 'per_page', type: 'integer', default: '20', description: 'Itens por página' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Listar ambientes">
        {`curl -X GET "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/environments" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": [
    {
      "id": "env_a1b2c3",
      "name": "production",
      "description": "Ambiente de produção",
      "color": "#ef4444",
      "secret_count": 12,
      "created_at": "2025-01-10T08:00:00Z"
    },
    {
      "id": "env_d4e5f6",
      "name": "staging",
      "description": "Ambiente de staging para testes",
      "color": "#f59e0b",
      "secret_count": 10,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 2,
    "total_pages": 1
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── GET by id ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> Obter Ambiente por ID
      </h2>

      <p className="text-muted-foreground mb-4">
        Retorna os detalhes completos de um ambiente específico, incluindo a lista
        de nomes de segredos (sem valores).
      </p>

      <CodeBlock language="text">
        {`GET /v1/projects/{project_id}/environments/{environment_id}`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (path parameter)' },
          { name: 'environment_id', type: 'string', required: true, description: 'ID do ambiente (path parameter)' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Obter ambiente">
        {`curl -X GET "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/environments/env_a1b2c3" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "id": "env_a1b2c3",
    "project_id": "proj_k8j2m4n6",
    "name": "production",
    "description": "Ambiente de produção",
    "color": "#ef4444",
    "secret_count": 12,
    "secrets_preview": [
      "DATABASE_URL",
      "REDIS_URL",
      "JWT_SECRET",
      "STRIPE_API_KEY"
    ],
    "created_at": "2025-01-10T08:00:00Z",
    "updated_at": "2025-01-18T16:45:00Z"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <ResponseBlock status={404} statusText="Not Found">
        <CodeBlock language="json">
          {`{
  "error": {
    "code": "not_found",
    "message": "Ambiente não encontrado."
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── PATCH ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="PATCH" /> Atualizar Ambiente
      </h2>

      <p className="text-muted-foreground mb-4">
        Atualiza os metadados de um ambiente. Requer papel de{' '}
        <InlineCode>admin</InlineCode> ou <InlineCode>developer</InlineCode>.
      </p>

      <CodeBlock language="text">
        {`PATCH /v1/projects/{project_id}/environments/{environment_id}`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (path parameter)' },
          { name: 'environment_id', type: 'string', required: true, description: 'ID do ambiente (path parameter)' },
          { name: 'name', type: 'string', description: 'Novo nome do ambiente' },
          { name: 'description', type: 'string', description: 'Nova descrição do ambiente' },
          { name: 'color', type: 'string', description: 'Nova cor em hexadecimal' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Atualizar ambiente">
        {`curl -X PATCH "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/environments/env_d4e5f6" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "staging-v2",
    "description": "Staging atualizado para v2"
  }'`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "id": "env_d4e5f6",
    "project_id": "proj_k8j2m4n6",
    "name": "staging-v2",
    "description": "Staging atualizado para v2",
    "color": "#f59e0b",
    "secret_count": 10,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-20T14:22:00Z"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── DELETE ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="DELETE" /> Deletar Ambiente
      </h2>

      <p className="text-muted-foreground mb-4">
        Remove permanentemente um ambiente e todos os seus segredos. Esta ação é
        <strong> irreversível</strong>. Requer papel de <InlineCode>admin</InlineCode>.
      </p>

      <CodeBlock language="text">
        {`DELETE /v1/projects/{project_id}/environments/{environment_id}`}
      </CodeBlock>

      <Callout type="warning">
        Ao deletar um ambiente, todos os segredos associados são permanentemente
        removidos. Se você precisa apenas remover o acesso, considere atualizar as
        permissões dos membros em vez de deletar o ambiente.
      </Callout>

      <CodeBlock language="bash" title="Exemplo — Deletar ambiente">
        {`curl -X DELETE "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/environments/env_d4e5f6" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={204} statusText="No Content">
        <p className="text-sm text-muted-foreground">
          Resposta vazia — o ambiente e todos os seus segredos foram removidos.
        </p>
      </ResponseBlock>
    </div>
  );
}
