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

export default function ApiMembersPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Membros', href: '/docs/api/members' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Membros</h1>

      <p className="text-muted-foreground mb-6">
        O sistema de membros controla quem tem acesso a cada projeto e com qual nível
        de permissão. Cada membro é associado a um projeto com um papel específico que
        determina suas capacidades.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Papéis (Roles)</h2>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">Papel</th>
              <th className="px-4 py-3 text-left font-semibold">Permissões</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3"><InlineCode>admin</InlineCode></td>
              <td className="px-4 py-3">
                Acesso total: gerenciar projeto, ambientes, membros, push/pull de segredos,
                re-key do vault
              </td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3"><InlineCode>developer</InlineCode></td>
              <td className="px-4 py-3">
                Push/pull de segredos, criar e editar ambientes. Sem acesso a gerenciamento de membros
              </td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3"><InlineCode>viewer</InlineCode></td>
              <td className="px-4 py-3">
                Apenas leitura: listar projetos, ambientes e nomes de segredos (sem valores)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock language="text">
        {`https://api.criptenv.dev/v1/projects/{project_id}/members`}
      </CodeBlock>

      {/* ─── POST ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> Convidar Membro
      </h2>

      <p className="text-muted-foreground mb-4">
        Envia um convite para um usuário participar do projeto. Se o usuário ainda não
        possui conta no CriptEnv, ele receberá um email de convite. Requer papel de{' '}
        <InlineCode>admin</InlineCode>.
      </p>

      <CodeBlock language="text">
        {`POST /v1/projects/{project_id}/members`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (path parameter)' },
          { name: 'email', type: 'string', required: true, description: 'Email do usuário a ser convidado' },
          { name: 'role', type: 'string', required: true, description: 'Papel do membro: admin, developer ou viewer' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Convidar membro">
        {`curl -X POST "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/members" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "maria@exemplo.com",
    "role": "developer"
  }'`}
      </CodeBlock>

      <ResponseBlock status={201} statusText="Created">
        <CodeBlock language="json">
          {`{
  "data": {
    "id": "mbr_r3s5t7u9",
    "project_id": "proj_k8j2m4n6",
    "user": {
      "id": "usr_d4e5f6g7",
      "email": "maria@exemplo.com",
      "name": "Maria Santos"
    },
    "role": "developer",
    "status": "pending",
    "invited_at": "2025-01-20T14:30:00Z",
    "invited_by": "usr_a1b2c3d4"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <ResponseBlock status={409} statusText="Conflict">
        <CodeBlock language="json">
          {`{
  "error": {
    "code": "already_member",
    "message": "Este usuário já é membro do projeto."
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <Callout type="info">
        Quando o papel é <InlineCode>admin</InlineCode> ou <InlineCode>developer</InlineCode>,
        o membro precisa da senha mestra do projeto (compartilhada criptograficamente) para
        acessar os segredos. O papel <InlineCode>viewer</InlineCode> não necessita da senha,
        pois só vê metadados.
      </Callout>

      {/* ─── GET ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> Listar Membros
      </h2>

      <p className="text-muted-foreground mb-4">
        Retorna todos os membros de um projeto, incluindo seus papéis e status.
      </p>

      <CodeBlock language="text">
        {`GET /v1/projects/{project_id}/members`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (path parameter)' },
          { name: 'page', type: 'integer', default: '1', description: 'Número da página' },
          { name: 'per_page', type: 'integer', default: '20', description: 'Itens por página' },
          { name: 'role', type: 'string', description: 'Filtrar por papel: admin, developer ou viewer' },
          { name: 'status', type: 'string', description: 'Filtrar por status: active, pending ou revoked' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Listar membros">
        {`curl -X GET "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/members" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": [
    {
      "id": "mbr_a1b2c3d4",
      "user": {
        "id": "usr_a1b2c3d4",
        "email": "joao@exemplo.com",
        "name": "João Silva"
      },
      "role": "admin",
      "status": "active",
      "joined_at": "2025-01-10T08:00:00Z"
    },
    {
      "id": "mbr_r3s5t7u9",
      "user": {
        "id": "usr_d4e5f6g7",
        "email": "maria@exemplo.com",
        "name": "Maria Santos"
      },
      "role": "developer",
      "status": "pending",
      "invited_at": "2025-01-20T14:30:00Z"
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

      {/* ─── PATCH ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="PATCH" /> Atualizar Papel do Membro
      </h2>

      <p className="text-muted-foreground mb-4">
        Altera o papel de um membro existente. Requer papel de <InlineCode>admin</InlineCode>.
        O último admin do projeto não pode ter seu papel rebaixado.
      </p>

      <CodeBlock language="text">
        {`PATCH /v1/projects/{project_id}/members/{member_id}`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (path parameter)' },
          { name: 'member_id', type: 'string', required: true, description: 'ID do membro (path parameter)' },
          { name: 'role', type: 'string', required: true, description: 'Novo papel: admin, developer ou viewer' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Promover membro para admin">
        {`curl -X PATCH "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/members/mbr_r3s5t7u9" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "role": "admin"
  }'`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "id": "mbr_r3s5t7u9",
    "project_id": "proj_k8j2m4n6",
    "user": {
      "id": "usr_d4e5f6g7",
      "email": "maria@exemplo.com",
      "name": "Maria Santos"
    },
    "role": "admin",
    "status": "active",
    "updated_at": "2025-01-20T15:00:00Z"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <Callout type="warning">
        Ao promover um membro para <InlineCode>admin</InlineCode>, ele terá acesso a
        gerenciar outros membros e re-criptografar o vault. Certifique-se de que essa
        pessoa é de confiança.
      </Callout>

      {/* ─── DELETE ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="DELETE" /> Remover Membro
      </h2>

      <p className="text-muted-foreground mb-4">
        Remove um membro do projeto. Requer papel de <InlineCode>admin</InlineCode>.
        Após remover um membro, considere executar um <InlineCode>re-key</InlineCode> no
        vault para garantir forward secrecy.
      </p>

      <CodeBlock language="text">
        {`DELETE /v1/projects/{project_id}/members/{member_id}`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'project_id', type: 'string', required: true, description: 'ID do projeto (path parameter)' },
          { name: 'member_id', type: 'string', required: true, description: 'ID do membro a ser removido (path parameter)' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Remover membro">
        {`curl -X DELETE "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/members/mbr_r3s5t7u9" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={204} statusText="No Content">
        <p className="text-sm text-muted-foreground">
          Resposta vazia — o membro foi removido do projeto.
        </p>
      </ResponseBlock>

      <Callout type="warning">
        Após remover um membro que tinha acesso aos segredos (admin ou developer),
        execute <InlineCode>POST /v1/projects/{'{id}'}/vault/re-key</InlineCode> para
        re-criptografar todos os segredos com uma nova chave. Isso garante que o membro
        removido não possa mais acessar os dados, mesmo que tenha copiado a chave
        anteriormente.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Fluxo Completo de Onboarding</h2>

      <CodeBlock language="bash" title="1. Convidar → 2. Aceitar → 3. Compartilhar chave">
        {`# 1. Admin convida o novo membro
curl -X POST "https://api.criptenv.dev/v1/projects/proj_k8j2m4n6/members" \\
  -H "Authorization: Bearer cek_admin_key" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "dev@exemplo.com", "role": "developer"}'

# 2. Novo membro aceita o convite (via dashboard ou API)
# O status muda de "pending" para "active"

# 3. Admin compartilha a chave mestra do projeto (criptografada com a chave pública do novo membro)
# Isso permite que o novo membro descriptografe os segredos`}
      </CodeBlock>
    </div>
  );
}
