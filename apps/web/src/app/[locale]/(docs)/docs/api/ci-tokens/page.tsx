'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ParamTable,
  ResponseBlock,
  Callout,
} from '@/components/docs';

const API = 'https://criptenv-api.77mdevseven.tech/api/v1';
const codeClass = 'bg-muted px-1 rounded text-sm';

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
        Tokens de autenticação para pipelines de CI/CD. Começam com{' '}
        <code className={codeClass}>ci_</code>, podem ser limitados a escopos e a
        um ambiente, e o valor em texto claro é exibido apenas uma vez, na
        criação. Na pipeline, o token é trocado por uma sessão de 1 hora (
        <code className={codeClass}>ci_s_…</code>).
      </p>

      <Callout variant="warning">
        O token sozinho não decifra nada: os valores são cifrados com a{' '}
        <strong>senha do cofre</strong> do projeto. A pipeline precisa do token{' '}
        <strong>e</strong> da senha do cofre (por exemplo, nos secrets{' '}
        <code className={codeClass}>CRIPTENV_TOKEN</code> e{' '}
        <code className={codeClass}>CRIPTENV_VAULT_PASSWORD</code>).
      </Callout>

      {/* POST /projects/{pid}/tokens */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> Criar token
        </h2>
        <p className="text-muted-foreground mb-4">
          <code className={codeClass}>POST /api/v1/projects/{'{pid}'}/tokens</code>{' '}
          — o campo <code className={codeClass}>token</code> só aparece nesta resposta.
        </p>

        <ParamTable
          params={[
            { name: 'name', type: 'string', required: true, description: 'Nome descritivo do token' },
            { name: 'description', type: 'string', required: false, description: 'Descrição opcional' },
            {
              name: 'scopes',
              type: 'string[]',
              required: false,
              description: 'Escopos no formato acao:recurso. Padrão: ["read:secrets"]',
            },
            {
              name: 'environment_scope',
              type: 'string',
              required: false,
              description: 'Limita o token a um ambiente (ex: production). Se omitido, vale para todos.',
            },
            { name: 'expires_at', type: 'datetime', required: false, description: 'Expiração opcional (ISO 8601)' },
          ]}
        />

        <CodeBlock
          language="bash"
          code={`curl -X POST ${API}/projects/{pid}/tokens \\
  -H "Authorization: Bearer {session_token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "GitHub Actions - Prod",
    "scopes": ["read:secrets"],
    "environment_scope": "production"
  }'`}
        />

        <ResponseBlock status={201}>
          {`{
  "token": "ci_<TOKEN>",
  "token_info": {
    "id": "6f1c…-uuid",
    "project_id": "{pid}",
    "name": "GitHub Actions - Prod",
    "scopes": ["read:secrets"],
    "environment_scope": "production",
    "last_used_at": null,
    "expires_at": null,
    "revoked_at": null,
    "created_at": "2026-01-31T12:00:00Z"
  }
}`}
        </ResponseBlock>
      </section>

      {/* GET /projects/{pid}/tokens */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="GET" /> Listar tokens
        </h2>
        <p className="text-muted-foreground mb-4">
          Retorna os tokens do projeto. O valor do token nunca é retornado após a criação.
        </p>

        <CodeBlock
          language="bash"
          code={`curl ${API}/projects/{pid}/tokens \\
  -H "Authorization: Bearer {session_token}"`}
        />

        <ResponseBlock status={200}>
          {`{
  "tokens": [
    {
      "id": "6f1c…-uuid",
      "name": "GitHub Actions - Prod",
      "scopes": ["read:secrets"],
      "environment_scope": "production",
      "last_used_at": "2026-02-01T09:30:00Z",
      "created_at": "2026-01-31T12:00:00Z"
    }
  ],
  "total": 1
}`}
        </ResponseBlock>
      </section>

      {/* POST /projects/{pid}/tokens/{id}/revoke */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="POST" /> Revogar token
        </h2>
        <p className="text-muted-foreground mb-4">
          Revoga o token imediatamente. Responde <code className={codeClass}>204 No Content</code>.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X POST ${API}/projects/{pid}/tokens/{token_id}/revoke \\
  -H "Authorization: Bearer {session_token}"`}
        />
      </section>

      {/* DELETE /projects/{pid}/tokens/{id} */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="DELETE" /> Remover token
        </h2>
        <p className="text-muted-foreground mb-4">
          Remove o token permanentemente. Responde <code className={codeClass}>204 No Content</code>.
        </p>

        <CodeBlock
          language="bash"
          code={`curl -X DELETE ${API}/projects/{pid}/tokens/{token_id} \\
  -H "Authorization: Bearer {session_token}"`}
        />
      </section>

      {/* Using the token in a pipeline */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4">Usar o token na pipeline</h2>
        <p className="text-muted-foreground mb-4">
          Troque o token por uma sessão de 1 hora e baixe os blobs cifrados do ambiente.
          A decifragem acontece no cliente, com a senha do cofre.
        </p>

        <CodeBlock
          language="bash"
          code={`# 1. Token ci_ → sessão ci_s_ (expira em 3600 s)
curl -X POST ${API}/auth/ci-login \\
  -H "Content-Type: application/json" \\
  -d '{"token": "'"$CRIPTENV_TOKEN"'"}'

# 2. Blobs cifrados do ambiente
curl "${API}/ci/secrets?environment=production" \\
  -H "Authorization: Bearer {ci_session_token}"`}
        />

        <ResponseBlock status={200}>
          {`{
  "session_token": "ci_s_…",
  "expires_in": 3600,
  "project_id": "{pid}",
  "permissions": ["read:secrets"],
  "environment_scope": "production"
}`}
        </ResponseBlock>

        <Callout variant="info">
          Na prática, use a CLI (<code className={codeClass}>criptenv ci login</code>) ou a GitHub
          Action, que fazem a troca e a decifragem por você.
        </Callout>
      </section>
    </div>
  );
}
