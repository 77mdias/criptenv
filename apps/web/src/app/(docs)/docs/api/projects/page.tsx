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

export default function ApiProjectsPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Projetos', href: '/docs/api/projects' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Projetos</h1>

      <p className="text-muted-foreground mb-6">
        Projetos são a unidade organizacional principal do CriptEnv. Cada projeto contém
        ambientes e segredos, e pode ter múltiplos membros com diferentes papéis.
      </p>

      <CodeBlock language="text">
        {`https://api.criptenv.dev/v1/projects`}
      </CodeBlock>

      {/* ─── POST /projects ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> Criar Projeto
      </h2>

      <p className="text-muted-foreground mb-4">
        Cria um novo projeto. O usuário autenticado torna-se automaticamente o
        proprietário (admin) do projeto.
      </p>

      <CodeBlock language="text">
        {`POST /v1/projects`}
      </CodeBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Parâmetros do Body</h3>

      <ParamTable
        params={[
          { name: 'name', type: 'string', required: true, description: 'Nome do projeto (3-64 caracteres, slug-friendly)' },
          { name: 'description', type: 'string', description: 'Descrição opcional do projeto (máx: 256 caracteres)' },
          { name: 'encryption', type: 'string', default: 'aes-256-gcm', description: 'Algoritmo de criptografia. Opções: aes-256-gcm' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Criar projeto">
        {`curl -X POST "https://api.criptenv.dev/v1/projects" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "meu-app",
    "description": "Backend do aplicativo principal"
  }'`}
      </CodeBlock>

      <ResponseBlock status={201} statusText="Created">
        <CodeBlock language="json">
          {`{
  "data": {
    "id": "proj_k8j2m4n6",
    "name": "meu-app",
    "description": "Backend do aplicativo principal",
    "encryption": "aes-256-gcm",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z",
    "owner_id": "usr_a1b2c3d4"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── GET /projects ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> Listar Projetos
      </h2>

      <p className="text-muted-foreground mb-4">
        Retorna todos os projetos dos quais o usuário autenticado é membro.
        Suporta paginação e filtros.
      </p>

      <CodeBlock language="text">
        {`GET /v1/projects`}
      </CodeBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Query Parameters</h3>

      <ParamTable
        params={[
          { name: 'page', type: 'integer', default: '1', description: 'Número da página' },
          { name: 'per_page', type: 'integer', default: '20', description: 'Itens por página (máx: 100)' },
          { name: 'search', type: 'string', description: 'Busca por nome do projeto' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Listar projetos">
        {`curl -X GET "https://api.criptenv.dev/v1/projects?page=1&per_page=10" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": [
    {
      "id": "proj_k8j2m4n6",
      "name": "meu-app",
      "description": "Backend do aplicativo principal",
      "created_at": "2025-01-15T10:30:00Z",
      "member_count": 3,
      "environment_count": 2
    },
    {
      "id": "proj_m2n4p6q8",
      "name": "frontend-app",
      "description": "Aplicação React",
      "created_at": "2025-01-10T08:00:00Z",
      "member_count": 5,
      "environment_count": 3
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total": 2,
    "total_pages": 1
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── GET /projects/:id ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> Obter Projeto por ID
      </h2>

      <p className="text-muted-foreground mb-4">
        Retorna os detalhes completos de um projeto específico, incluindo metadados
        de ambientes e contagem de segredos.
      </p>

      <CodeBlock language="text">
        {`GET /v1/projects/{project_id}`}
      </CodeBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Path Parameters</h3>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (ex: proj_k8j2m4n6)' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Obter projeto">
        {`curl -X GET "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "id": "proj_k8j2m4n6",
    "name": "meu-app",
    "description": "Backend do aplicativo principal",
    "encryption": "aes-256-gcm",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z",
    "owner_id": "usr_a1b2c3d4",
    "member_count": 3,
    "environments": [
      { "id": "env_a1b2c3", "name": "production", "secret_count": 12 },
      { "id": "env_d4e5f6", "name": "staging", "secret_count": 10 }
    ]
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <ResponseBlock status={404} statusText="Not Found">
        <CodeBlock language="json">
          {`{
  "error": {
    "code": "not_found",
    "message": "Projeto não encontrado."
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── PATCH /projects/:id ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="PATCH" /> Atualizar Projeto
      </h2>

      <p className="text-muted-foreground mb-4">
        Atualiza os metadados de um projeto. Requer papel de <InlineCode>admin</InlineCode> no projeto.
      </p>

      <CodeBlock language="text">
        {`PATCH /v1/projects/{project_id}`}
      </CodeBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Parâmetros do Body</h3>

      <ParamTable
        params={[
          { name: 'name', type: 'string', description: 'Novo nome do projeto' },
          { name: 'description', type: 'string', description: 'Nova descrição do projeto' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Atualizar projeto">
        {`curl -X PATCH "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "meu-app-v2",
    "description": "Backend refatorado v2"
  }'`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "id": "proj_k8j2m4n6",
    "name": "meu-app-v2",
    "description": "Backend refatorado v2",
    "encryption": "aes-256-gcm",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-20T14:22:00Z",
    "owner_id": "usr_a1b2c3d4"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── DELETE /projects/:id ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="DELETE" /> Deletar Projeto
      </h2>

      <p className="text-muted-foreground mb-4">
        Remove permanentemente o projeto, todos os seus ambientes, segredos e
        associações de membros. Esta ação é <strong>irreversível</strong>.
      </p>

      <CodeBlock language="text">
        {`DELETE /v1/projects/{project_id}`}
      </CodeBlock>

      <Callout type="warning">
        A exclusão de um projeto é permanente. Todos os segredos criptografados serão
        removidos e não poderão ser recuperados. Certifique-se de ter um backup antes
        de executar esta operação.
      </Callout>

      <CodeBlock language="bash" title="Exemplo — Deletar projeto">
        {`curl -X DELETE "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={204} statusText="No Content">
        <p className="text-sm text-muted-foreground">
          Resposta vazia — o projeto foi removido com sucesso.
        </p>
      </ResponseBlock>

      {/* ─── POST /projects/:id/vault/rekey ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> Re-encrypt Vault
      </h2>

      <p className="text-muted-foreground mb-4">
        Re-criptografa todos os segredos do projeto com uma nova chave mestra. Esta
        operação é necessária quando um membro é removido do projeto para garantir
        que ele não possa mais acessar os segredos (forward secrecy).
      </p>

      <CodeBlock language="text">
        {`POST /v1/projects/{project_id}/vault/rekey`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'new_key_id', type: 'string', required: true, description: 'ID da nova chave de criptografia gerada no cliente' },
          { name: 'reencrypted_secrets', type: 'object[]', required: true, description: 'Array de segredos re-criptografados com a nova chave' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Re-encrypt vault">
        {`curl -X POST "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/vault/rekey" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "new_key_id": "key_new123abc",
    "reencrypted_secrets": [
      {
        "env_id": "env_a1b2c3",
        "secrets": [
          {
            "name": "DATABASE_URL",
            "ciphertext": "base64_novo_ciphertext",
            "nonce": "base64_nonce",
            "tag": "base64_tag"
          }
        ]
      }
    ]
  }'`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "project_id": "proj_k8j2m4n6",
    "reencrypted_count": 25,
    "environments_processed": 3,
    "new_key_id": "key_new123abc",
    "completed_at": "2025-01-20T14:30:00Z"
  }
}`}
        </CodeBlock>
      </ResponseBlock>
    </div>
  );
}
