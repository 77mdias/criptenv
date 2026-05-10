'use client';

import {
  Breadcrumb,
  Callout,
  CodeBlock,
  InlineCode,
  Tabs,
  Tab,
} from '@/components/docs';

export default function ApiAuthenticationPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Autenticação', href: '/docs/api/authentication' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Autenticação</h1>

      <p className="text-muted-foreground mb-6">
        A API do CriptEnv suporta múltiplos métodos de autenticação para atender
        diferentes cenários: dashboard web, integrações de terceiros e pipelines de CI/CD.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Visão Geral</h2>

      <p className="text-muted-foreground mb-4">
        Todas as requisições autenticadas devem incluir um token válido. A API identifica
        automaticamente o tipo de token pelo formato:
      </p>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Prefixo</th>
              <th className="px-4 py-3 text-left font-semibold">TTL</th>
              <th className="px-4 py-3 text-left font-semibold">Uso</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3">Sessão</td>
              <td className="px-4 py-3"><InlineCode>cookie</InlineCode></td>
              <td className="px-4 py-3">30 dias</td>
              <td className="px-4 py-3">Dashboard web</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3">API Key</td>
              <td className="px-4 py-3"><InlineCode>cek_</InlineCode></td>
              <td className="px-4 py-3">Permanente (revogável)</td>
              <td className="px-4 py-3">Integrações, scripts</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3">CI Token</td>
              <td className="px-4 py-3"><InlineCode>ci_</InlineCode></td>
              <td className="px-4 py-3">1 hora</td>
              <td className="px-4 py-3">CI/CD pipelines</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Sessão (Cookies)</h2>

      <p className="text-muted-foreground mb-4">
        Quando você faz login pelo dashboard web, o servidor cria um cookie HTTP-only
        seguro que é enviado automaticamente em todas as requisições subsequentes do navegador.
      </p>

      <Callout type="info">
        O cookie de sessão é <InlineCode>HttpOnly</InlineCode>,{' '}
        <InlineCode>Secure</InlineCode> e usa <InlineCode>SameSite=Lax</InlineCode>.
        Ele não pode ser acessado via JavaScript, protegendo contra ataques XSS.
      </Callout>

      <h3 className="text-lg font-semibold mt-6 mb-3">Fluxo de Login</h3>

      <CodeBlock language="bash" title="Login via API">
        {`# Fazer login e receber cookie de sessão
curl -X POST "https://criptenv-api.77mdevseven.tech/v1/auth/login" \\
  -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{
    "email": "usuario@exemplo.com",
    "password": "senha-segura-123"
  }'`}
      </CodeBlock>

      <CodeBlock language="bash" title="Usar sessão em requisições subsequentes">
        {`# Usar o cookie salvo em requisições seguintes
curl -X GET "https://criptenv-api.77mdevseven.tech/v1/projects" \\
  -b cookies.txt`}
      </CodeBlock>

      <CodeBlock language="json" title="Resposta do login (200 OK)">
        {`{
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "email": "usuario@exemplo.com",
      "name": "João Silva"
    },
    "expires_at": "2025-02-14T10:30:00Z"
  }
}`}
      </CodeBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Refresh de Sessão</h3>

      <p className="text-muted-foreground mb-4">
        A sessão é renovada automaticamente a cada requisição bem-sucedida. Se nenhuma
        requisição for feita por 30 dias, a sessão expira e é necessário fazer login novamente.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">API Keys</h2>

      <p className="text-muted-foreground mb-4">
        API Keys são tokens permanentes (até serem revogados) com prefixo{' '}
        <InlineCode>cek_</InlineCode>. Elas são ideais para integrações de terceiros,
        scripts e ferramentas que precisam de acesso programático à API.
      </p>

      <h3 className="text-lg font-semibold mt-6 mb-3">Escopos</h3>

      <p className="text-muted-foreground mb-4">
        Cada API Key pode ter escopos granulares que controlam quais operações ela pode
        executar:
      </p>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">Escopo</th>
              <th className="px-4 py-3 text-left font-semibold">Permissão</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3"><InlineCode>read</InlineCode></td>
              <td className="px-4 py-3">Leitura de projetos, ambientes e segredos</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3"><InlineCode>write</InlineCode></td>
              <td className="px-4 py-3">Push de segredos e criação de ambientes</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3"><InlineCode>admin</InlineCode></td>
              <td className="px-4 py-3">Gerenciamento de projetos e membros</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3"><InlineCode>env:production</InlineCode></td>
              <td className="px-4 py-3">Acesso restrito ao ambiente de produção</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3"><InlineCode>env:staging</InlineCode></td>
              <td className="px-4 py-3">Acesso restrito ao ambiente de staging</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-3">Criar uma API Key</h3>

      <CodeBlock language="bash" title="Criar API Key via painel ou API">
        {`curl -X POST "https://criptenv-api.77mdevseven.tech/v1/auth/api-keys" \\
  -H "Authorization: Bearer sessao_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "GitHub Actions Deploy",
    "scopes": ["read", "write"],
    "environment_scope": ["staging", "production"]
  }'`}
      </CodeBlock>

      <CodeBlock language="json" title="Resposta (201 Created)">
        {`{
  "data": {
    "id": "key_m2n4p6q8",
    "name": "GitHub Actions Deploy",
    "prefix": "cek_",
    "key": "cek_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "scopes": ["read", "write"],
    "environment_scope": ["staging", "production"],
    "created_at": "2025-01-15T10:30:00Z"
  }
}`}
      </CodeBlock>

      <Callout type="warning">
        O campo <InlineCode>key</InlineCode> é retornado apenas na criação. Guarde-o em
        um local seguro. Se perder, será necessário revogar e criar uma nova chave.
      </Callout>

      <h3 className="text-lg font-semibold mt-6 mb-3">Usar API Key nas requisições</h3>

      <Tabs>
        <Tab label="Header Authorization">
          <CodeBlock language="bash" title="Bearer token no header">
            {`curl -X GET "https://criptenv-api.77mdevseven.tech/v1/projects" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"`}
          </CodeBlock>
        </Tab>
        <Tab label="Header X-API-Key">
          <CodeBlock language="bash" title="Header dedicado">
            {`curl -X GET "https://criptenv-api.77mdevseven.tech/v1/projects" \\
  -H "X-API-Key: cek_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"`}
          </CodeBlock>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-semibold mt-10 mb-4">CI Tokens</h2>

      <p className="text-muted-foreground mb-4">
        CI Tokens são tokens de curta duração (1 hora) com prefixo <InlineCode>ci_</InlineCode>,
        projetados para pipelines de CI/CD. Eles são gerados sob demanda e expiram
        automaticamente, eliminando o risco de tokens esquecidos.
      </p>

      <h3 className="text-lg font-semibold mt-6 mb-3">Gerar um CI Token</h3>

      <CodeBlock language="bash" title="Gerar CI Token temporário">
        {`curl -X POST "https://criptenv-api.77mdevseven.tech/v1/auth/ci-tokens" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "proj_k8j2m4n6",
    "scopes": ["read"],
    "environment": "production"
  }'`}
      </CodeBlock>

      <CodeBlock language="json" title="Resposta (201 Created)">
        {`{
  "data": {
    "token": "ci_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4",
    "expires_at": "2025-01-15T11:30:00Z",
    "scopes": ["read"],
    "environment": "production"
  }
}`}
      </CodeBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Usar CI Token no GitHub Actions</h3>

      <CodeBlock language="yaml" title=".github/workflows/deploy.yml">
        {`name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate CI Token
        id: ci-token
        run: |
          TOKEN=\$(curl -s -X POST "https://criptenv-api.77mdevseven.tech/v1/auth/ci-tokens" \\
            -H "Authorization: Bearer \${{ secrets.CRIPTENV_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "project_id": "\${{ secrets.CRIPTENV_PROJECT_ID }}",
              "scopes": ["read"],
              "environment": "production"
            }' | jq -r '.data.token')
          echo "token=$TOKEN" >> "$GITHUB_OUTPUT"

      - name: Pull secrets
        run: |
          curl -s "https://criptenv-api.77mdevseven.tech/v1/vault/pull" \\
            -H "Authorization: Bearer \${{ steps.ci-token.outputs.token }}" \\
            -o .env`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">OAuth</h2>

      <p className="text-muted-foreground mb-4">
        O CriptEnv suporta login social via OAuth 2.0 com os seguintes provedores:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">GitHub</h3>
          <p className="text-sm text-muted-foreground">
            Ideal para desenvolvedores que já usam GitHub no dia a dia.
          </p>
        </div>
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">Google</h3>
          <p className="text-sm text-muted-foreground">
            Login rápido com sua conta Google corporativa ou pessoal.
          </p>
        </div>
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">Discord</h3>
          <p className="text-sm text-muted-foreground">
            Para membros da comunidade CriptEnv no Discord.
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-3">Fluxo OAuth 2.0</h3>

      <CodeBlock language="bash" title="1. Iniciar fluxo OAuth — redirecionar o usuário">
        {`# Redirecionar o usuário para:
https://criptenv-api.77mdevseven.tech/v1/auth/oauth/github/authorize
  ?redirect_uri=https://app.criptenv.dev/callback
  &state=random_csrf_token`}
      </CodeBlock>

      <CodeBlock language="bash" title="2. Trocar o código por sessão (callback)">
        {`curl -X POST "https://criptenv-api.77mdevseven.tech/v1/auth/oauth/github/callback" \\
  -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{
    "code": "codigo_recebido_no_callback",
    "state": "random_csrf_token"
  }'`}
      </CodeBlock>

      <CodeBlock language="json" title="Resposta do callback (200 OK)">
        {`{
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "email": "usuario@exemplo.com",
      "name": "João Silva",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345"
    },
    "is_new_user": false
  }
}`}
      </CodeBlock>

      <Callout type="info">
        Após o login OAuth bem-sucedido, um cookie de sessão é criado automaticamente.
        As requisições subsequentes usam esse cookie normalmente.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Erros de Autenticação</h2>

      <CodeBlock language="json" title="401 Unauthorized — Token inválido ou expirado">
        {`{
  "error": {
    "code": "unauthorized",
    "message": "Token inválido ou expirado."
  }
}`}
      </CodeBlock>

      <CodeBlock language="json" title="403 Forbidden — Escopo insuficiente">
        {`{
  "error": {
    "code": "forbidden",
    "message": "Esta API Key não tem permissão para escrever neste ambiente.",
    "details": {
      "required_scope": "write",
      "current_scopes": ["read"]
    }
  }
}`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Boas Práticas</h2>

      <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6">
        <li>Use <strong>API Keys</strong> para integrações server-to-server com escopos mínimos necessários.</li>
        <li>Use <strong>CI Tokens</strong> em pipelines para limitar a janela de exposição a 1 hora.</li>
        <li>Nunca exponha API Keys no frontend ou em logs de CI.</li>
        <li>Rotacione API Keys periodicamente e revogue chaves não utilizadas.</li>
        <li>Use escopos de ambiente (<InlineCode>env:production</InlineCode>) para limitar o impacto de uma chave comprometida.</li>
      </ul>
    </div>
  );
}
