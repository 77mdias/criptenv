'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function VercelIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Integrações', href: '/docs/integrations' },
          { label: 'Vercel', href: '/docs/integrations/vercel' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Integração com Vercel</h1>
      <p className="text-muted-foreground mb-8">
        Configure a sincronização automática de variáveis de ambiente entre o
        CriptEnv e o Vercel. Assim que você atualizar seus secrets no CriptEnv,
        eles serão automaticamente propagados para seus projetos no Vercel.
      </p>

      <Callout type="info">
        A integração com Vercel utiliza a API oficial do Vercel para criar e
        atualizar Environment Variables de forma segura.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Configuração</h2>

      <Steps>
        <Step title="Gere um token de acesso do Vercel">
          <p className="text-muted-foreground">
            Acesse{' '}
            <a
              href="https://vercel.com/account/tokens"
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              vercel.com/account/tokens
            </a>{' '}
            e crie um novo token com permissão de escrita.
          </p>
        </Step>

        <Step title="Conecte o Vercel no painel do CriptEnv">
          <p className="text-muted-foreground">
            No painel do CriptEnv, navegue até{' '}
            <strong>Projeto → Integrações → Vercel</strong> e cole o token
            gerado. Selecione o projeto Vercel que deseja sincronizar.
          </p>
        </Step>

        <Step title="Configure o mapeamento de ambientes">
          <p className="text-muted-foreground">
            Mapeie os ambientes do CriptEnv para os ambientes do Vercel:
          </p>
          <CodeBlock language="text" title="Mapeamento de ambientes">
{`CriptEnv         →  Vercel
─────────────────────────────
production       →  Production
staging          →  Preview
development      →  Development`}
          </CodeBlock>
        </Step>

        <Step title="Ative a sincronização automática">
          <p className="text-muted-foreground">
            Ative a opção de sincronização automática para que alterações no
            CriptEnv sejam propagadas automaticamente ao Vercel.
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Sincronização Manual via CLI
      </h2>
      <p className="text-muted-foreground mb-4">
        Você também pode sincronizar manualmente usando o CLI do CriptEnv:
      </p>
      <CodeBlock language="bash" title="Sincronizar com Vercel">
{`# Sincronizar todas as variáveis
criptenv sync --provider vercel --project meu-projeto

# Sincronizar apenas o ambiente de produção
criptenv sync --provider vercel --project meu-projeto --environment production`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Exemplo de Projeto Vercel
      </h2>
      <CodeBlock language="json" title="vercel.json">
{`{
  "framework": "nextjs",
  "env": {
    "DATABASE_URL": "@criptenv/database-url",
    "API_SECRET": "@criptenv/api-secret"
  }
}`}
      </CodeBlock>

      <Callout type="warning">
        Ao ativar a sincronização automática, o CriptEnv sobrescreverá as
        variáveis existentes no Vercel com o mesmo nome. Certifique-se de que
        os nomes das variáveis estão corretos.
      </Callout>
    </div>
  );
}
