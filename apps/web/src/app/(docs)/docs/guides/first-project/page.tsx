'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function FirstProjectPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Guias', href: '/docs/guides' },
          { label: 'Primeiro Projeto', href: '/docs/guides/first-project' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        Seu Primeiro Projeto
      </h1>
      <p className="text-muted-foreground mb-8">
        Aprenda a configurar o CriptEnv do zero e gerenciar seus primeiros
        secrets de forma segura. Este guia leva menos de 5 minutos.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Pré-requisitos
      </h2>
      <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6">
        <li>Uma conta no CriptEnv (gratuito para projetos pessoais)</li>
        <li>Node.js 18+ instalado (para o CLI)</li>
        <li>Acesso ao terminal</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Passo a passo</h2>

      <Steps>
        <Step title="Crie sua conta">
          <p className="text-muted-foreground">
            Acesse{' '}
            <a href="https://criptenv.dev" className="underline">
              criptenv.dev
            </a>{' '}
            e crie sua conta gratuitamente. Você pode usar login com GitHub
            para agilizar o processo.
          </p>
        </Step>

        <Step title="Crie um novo projeto">
          <p className="text-muted-foreground">
            No painel, clique em <strong>&quot;Novo Projeto&quot;</strong> e
            dê um nome ao seu projeto (ex: <code>meu-app</code>). Escolha uma
            região de armazenamento preferida.
          </p>
          <CodeBlock language="text" title="Exemplo de configuração">
{`Nome: meu-app
Região: São Paulo (sa-east-1)
Plano: Gratuito`}
          </CodeBlock>
        </Step>

        <Step title="Adicione suas variáveis de ambiente">
          <p className="text-muted-foreground">
            No painel do projeto, vá em <strong>Variáveis</strong> e adicione
            seus secrets. Você pode adicionar manualmente ou importar de um
            arquivo <code>.env</code>.
          </p>
          <CodeBlock language="bash" title="Importar de arquivo .env">
{`# Use o CLI para importar variáveis existentes
npx @criptenv/cli import .env`}
          </CodeBlock>
        </Step>

        <Step title="Instale o CLI">
          <CodeBlock language="bash" title="Instalar CLI">
{`# Instalar globalmente
npm install -g @criptenv/cli

# Ou usar diretamente com npx
npx @criptenv/cli --version`}
          </CodeBlock>
        </Step>

        <Step title="Autentique o CLI">
          <CodeBlock language="bash" title="Autenticação">
{`# Login interativo
criptenv auth login

# Ou use um token diretamente
criptenv auth --token SEU_TOKEN`}
          </CodeBlock>
        </Step>

        <Step title="Carregue as variáveis no seu projeto">
          <p className="text-muted-foreground">
            Use o CLI para descriptografar e carregar as variáveis de
            ambiente no seu projeto.
          </p>
          <CodeBlock language="bash" title="Carregar variáveis">
{`# Carregar e exportar como variáveis de ambiente
criptenv load --project meu-app

# Ou gerar um arquivo .env local
criptenv load --project meu-app --output .env.local`}
          </CodeBlock>
        </Step>
      </Steps>

      <Callout type="success">
        Parabéns! Seu primeiro projeto está configurado. Agora seus secrets
        estão criptografados e seguros no CriptEnv.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Próximos passos</h2>
      <ul className="list-disc list-inside text-muted-foreground space-y-2">
        <li>
          <a href="/docs/integrations/github-action" className="underline">
            Configure o GitHub Action
          </a>{' '}
          para sincronizar secrets no CI/CD
        </li>
        <li>
          <a href="/docs/guides/team-setup" className="underline">
            Convide sua equipe
          </a>{' '}
          para colaborar no gerenciamento de secrets
        </li>
        <li>
          <a href="/docs/sdks/javascript" className="underline">
            Use o SDK
          </a>{' '}
          para integrar diretamente na sua aplicação
        </li>
      </ul>
    </div>
  );
}
