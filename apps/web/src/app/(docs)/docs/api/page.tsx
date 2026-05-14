'use client';

import {
  Breadcrumb,
  Callout,
  CodeBlock,
  InlineCode,
  StatusTable,
  CardGrid,
  DocCard,
} from '@/components/docs';

export default function ApiOverviewPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">API Reference</h1>

      <p className="text-muted-foreground mb-6">
        A API REST do CriptEnv permite integrar o gerenciamento de segredos em qualquer
        pipeline, ferramenta ou aplicação. Esta referência cobre todos os endpoints
        disponíveis, formatos de autenticação, resposta e tratamento de erros.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">URL Base</h2>

      <p className="text-muted-foreground mb-4">
        Todos os endpoints da API são acessados a partir da seguinte URL base:
      </p>

      <CodeBlock language="text">
        {`https://criptenv-api.77mdevseven.tech/api/v1`}
      </CodeBlock>

      <p className="text-muted-foreground mb-4">
        Todas as requisições devem ser feitas sobre HTTPS. Requisições HTTP são
        redirecionadas automaticamente para HTTPS.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Autenticação</h2>

      <p className="text-muted-foreground mb-4">
        A API suporta três tipos de token de autenticação. Cada um é adequado para
        um cenário diferente:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">🍪 Sessão</h3>
          <p className="text-sm text-muted-foreground">
            Cookie HTTP-only gerado pelo login. Ideal para uso no dashboard web.
            TTL de 30 dias.
          </p>
        </div>
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">🔑 API Key</h3>
          <p className="text-sm text-muted-foreground">
            Token com prefixo <InlineCode>cek_</InlineCode> para integrações e scripts.
            Suporta escopos granulares por ambiente.
          </p>
        </div>
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">⚙️ CI Token</h3>
          <p className="text-sm text-muted-foreground">
            Token com prefixo <InlineCode>ci_</InlineCode> para pipelines de CI/CD.
            TTL curto de 1 hora, ideal para builds efêmeros.
          </p>
        </div>
      </div>

      <p className="text-muted-foreground mb-4">
        Para mais detalhes sobre cada método, consulte a{' '}
        <a href="/docs/api/authentication" className="text-emerald-500 hover:underline">
          documentação de autenticação
        </a>.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Formato de Resposta</h2>

      <p className="text-muted-foreground mb-4">
        Todas as respostas são retornadas em JSON com o Content-Type{' '}
        <InlineCode>application/json</InlineCode>.
      </p>

      <h3 className="text-lg font-semibold mt-6 mb-3">Resposta de Sucesso</h3>

      <CodeBlock language="json" title="200 OK">
        {`{
  "id": "proj_k8j2m4n6",
  "name": "meu-projeto",
  "created_at": "2025-01-15T10:30:00Z"
}`}
      </CodeBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Resposta de Sucesso (Lista)</h3>

      <CodeBlock language="json" title="200 OK — Lista paginada">
        {`[
  { "id": "proj_k8j2m4n6", "name": "projeto-a" },
  { "id": "proj_m2n4p6q8", "name": "projeto-b" }
]`}
      </CodeBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Resposta de Erro</h3>

      <CodeBlock language="json" title="Erro padrão">
        {`{
  "detail": "O campo 'name' é obrigatório."
}`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Códigos de Status HTTP</h2>

      <StatusTable
        codes={[
          { code: '200', meaning: 'Sucesso — operação concluída' },
          { code: '201', meaning: 'Criado — recurso criado com sucesso' },
          { code: '204', meaning: 'Sem conteúdo — operação sem retorno (ex: DELETE)' },
          { code: '400', meaning: 'Requisição inválida — erro de validação nos dados enviados' },
          { code: '401', meaning: 'Não autenticado — token ausente ou inválido' },
          { code: '403', meaning: 'Proibido — sem permissão para esta operação' },
          { code: '404', meaning: 'Não encontrado — recurso não existe' },
          { code: '409', meaning: 'Conflito — recurso já existe ou versão desatualizada' },
          { code: '422', meaning: 'Não processável — dados válidos mas semanticamente incorretos' },
          { code: '429', meaning: 'Limite excedido — muitas requisições, tente novamente mais tarde' },
          { code: '500', meaning: 'Erro interno — erro inesperado no servidor' },
        ]}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">Rate Limiting</h2>

      <p className="text-muted-foreground mb-4">
        A API aplica limites de taxa para proteger o serviço contra abuso. Os limites
        variam conforme o tipo de autenticação:
      </p>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">Tipo de Token</th>
              <th className="px-4 py-3 text-left font-semibold">Limite</th>
              <th className="px-4 py-3 text-left font-semibold">Janela</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3">Sessão (pública)</td>
              <td className="px-4 py-3"><InlineCode>100 req</InlineCode></td>
              <td className="px-4 py-3">por minuto</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3">API Key</td>
              <td className="px-4 py-3"><InlineCode>1000 req</InlineCode></td>
              <td className="px-4 py-3">por minuto</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3">CI Token</td>
              <td className="px-4 py-3"><InlineCode>200 req</InlineCode></td>
              <td className="px-4 py-3">por minuto</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3">Auth (IP)</td>
              <td className="px-4 py-3"><InlineCode>5 req</InlineCode></td>
              <td className="px-4 py-3">por minuto</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground mb-4">
        Os headers de rate limit são incluídos em todas as respostas:
      </p>

      <CodeBlock language="text" title="Headers de Rate Limit">
        {`X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1705312800`}
      </CodeBlock>

      <Callout type="warning">
        Quando o limite é excedido, a API retorna <InlineCode>429 Too Many Requests</InlineCode>.
        O header <InlineCode>Retry-After</InlineCode> indica quantos segundos aguardar.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Paginação</h2>

      <p className="text-muted-foreground mb-4">
        Endpoints que retornam listas suportam paginação via query parameters:
      </p>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">Parâmetro</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Descrição</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3"><code className="font-mono text-emerald-500">page</code></td>
              <td className="px-4 py-3"><code className="text-xs font-mono bg-[var(--background-muted)] px-1.5 py-0.5 rounded">integer</code></td>
              <td className="px-4 py-3">Número da página (padrão: 1)</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3"><code className="font-mono text-emerald-500">per_page</code></td>
              <td className="px-4 py-3"><code className="text-xs font-mono bg-[var(--background-muted)] px-1.5 py-0.5 rounded">integer</code></td>
              <td className="px-4 py-3">Itens por página (padrão: 20, máx: 100)</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3"><code className="font-mono text-emerald-500">sort</code></td>
              <td className="px-4 py-3"><code className="text-xs font-mono bg-[var(--background-muted)] px-1.5 py-0.5 rounded">string</code></td>
              <td className="px-4 py-3">Campo para ordenação (ex: <InlineCode>created_at</InlineCode>)</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3"><code className="font-mono text-emerald-500">order</code></td>
              <td className="px-4 py-3"><code className="text-xs font-mono bg-[var(--background-muted)] px-1.5 py-0.5 rounded">string</code></td>
              <td className="px-4 py-3">Direção: <InlineCode>asc</InlineCode> ou <InlineCode>desc</InlineCode> (padrão: desc)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock language="bash" title="Exemplo de paginação">
        {`curl -X GET "https://criptenv-api.77mdevseven.tech/api/v1/projects?page=2&per_page=10" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Referência por Domínio</h2>

      <CardGrid>
        <DocCard
          title="Autenticação"
          description="Detalhes sobre sessões, API Keys, CI Tokens e OAuth."
          href="/docs/api/authentication"
        />
        <DocCard
          title="Projetos"
          description="CRUD de projetos, incluindo operações de vault e re-key."
          href="/docs/api/projects"
        />
        <DocCard
          title="Ambientes"
          description="Gerenciamento de ambientes dentro de um projeto."
          href="/docs/api/environments"
        />
        <DocCard
          title="Vault"
          description="Push, pull e versionamento de segredos criptografados."
          href="/docs/api/vault"
        />
        <DocCard
          title="Membros"
          description="Convites, papéis e gerenciamento de acesso a projetos."
          href="/docs/api/members"
        />
      </CardGrid>
    </div>
  );
}
