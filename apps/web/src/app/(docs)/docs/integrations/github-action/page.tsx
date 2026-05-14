'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
  ParamTable,
} from '@/components/docs';

export default function GitHubActionPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Integrações', href: '/docs/integrations' },
          { label: 'GitHub Action', href: '/docs/integrations/github-action' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">GitHub Action</h1>
      <p className="text-muted-foreground mb-8">
        Use a Action oficial do CriptEnv (<code>@criptenv/action</code>) para
        descriptografar e injetar suas variáveis de ambiente diretamente nos
        seus workflows do GitHub Actions.
      </p>

      <Callout type="info">
        A GitHub Action do CriptEnv requer um token de API válido. Você pode
        gerar um em{' '}
        <a href="/dashboard/tokens" className="underline">
          Painel → Tokens
        </a>
        .
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Configuração</h2>

      <Steps>
        <Step title="Obtenha seu token de API">
          <p className="text-muted-foreground">
            Acesse o painel do CriptEnv e gere um token de API com permissão de
            leitura. Adicione esse token como um{' '}
            <strong>Repository Secret</strong> no seu repositório GitHub.
          </p>
          <CodeBlock language="bash" title="Adicionar secret no GitHub">
{`Settings → Secrets and variables → Actions → New repository secret
Nome: CRIPTENV_TOKEN
Valor: <seu-token-de-api>`}
          </CodeBlock>
        </Step>

        <Step title="Obtenha o ID do projeto">
          <p className="text-muted-foreground">
            Copie o ID do seu projeto no painel do CriptEnv. Você precisará
            dele para que a action saiba qual projeto descriptografar.
          </p>
        </Step>

        <Step title="Adicione a Action ao workflow">
          <p className="text-muted-foreground">
            Configure o workflow do GitHub Actions para usar a action do
            CriptEnv antes dos seus comandos de build ou deploy.
          </p>
          <CodeBlock language="yaml" title=".github/workflows/deploy.yml">
{`name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Carregar variáveis de ambiente
        uses: criptenv/action@v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          project: 'seu-project-id'
        env:
          CRIPTENV_TOKEN: \${{ secrets.CRIPTENV_TOKEN }}

      - name: Build
        run: npm run build

      - name: Deploy
        run: npm run deploy`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Variáveis de Entrada
      </h2>
      <p className="text-muted-foreground mb-4">
        A Action suporta as seguintes variáveis de entrada:
      </p>

      <ParamTable
        params={[
          {
            name: 'token',
            type: 'string',
            required: true,
            description:
              'Token de CI do CriptEnv (começa com ci_). Recomendado usar via GitHub Secrets.',
          },
          {
            name: 'project',
            type: 'string',
            required: true,
            description: 'ID do projeto no CriptEnv.',
          },
          {
            name: 'environment',
            type: 'string',
            required: false,
            description:
              'Ambiente alvo (ex: production, staging). Padrão: production.',
          },
          {
            name: 'api-url',
            type: 'string',
            required: false,
            description:
              'URL da API do CriptEnv. Padrão: https://criptenv-api.77mdevseven.tech/api/v1.',
          },
          {
            name: 'prefix',
            type: 'string',
            required: false,
            description:
              'Prefixo para as variáveis de ambiente. Padrão: SECRET_.',
          },
        ]}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">Exemplo Completo</h2>
      <CodeBlock language="yaml" title="Workflow com múltiplos ambientes">
{`name: CI/CD

on:
  push:
    branches: [main, staging]

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: criptenv/action@v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          project: 'seu-project-id'
          environment: staging

      - run: npm run build
      - run: npm run deploy:staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: criptenv/action@v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          project: 'seu-project-id'
          environment: production

      - run: npm run build
      - run: npm run deploy:production`}
      </CodeBlock>

      <Callout type="warning">
        Nunca exponha o token do CriptEnv em logs públicos. Use sempre o
        GitHub Secrets para armazenar tokens e credenciais sensíveis.
      </Callout>
    </div>
  );
}
