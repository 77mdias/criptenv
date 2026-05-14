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
        <li>Uma conta no CriptEnv (gratuita)</li>
        <li>Python 3.10+ instalado</li>
        <li>Acesso ao terminal</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Passo a passo</h2>

      <Steps>
        <Step title="Crie sua conta">
          <p className="text-muted-foreground">
            Acesse{' '}
            <a href="https://criptenv.77mdevseven.tech" className="underline">
              criptenv.77mdevseven.tech
            </a>{' '}
            e crie sua conta gratuitamente. Você pode usar login com GitHub,
            Google ou Discord para agilizar o processo.
          </p>
        </Step>

        <Step title="Instale o CLI">
          <CodeBlock language="bash" title="Instalar CLI">
{`pip install criptenv`}
          </CodeBlock>
        </Step>

        <Step title="Inicialize e faça login">
          <CodeBlock language="bash" title="Inicializar e autenticar">
{`criptenv init
criptenv login --email you@example.com`}
          </CodeBlock>
        </Step>

        <Step title="Crie um novo projeto">
          <p className="text-muted-foreground">
            Crie um projeto via CLI (você também pode criar pelo dashboard web):
          </p>
          <CodeBlock language="bash" title="Criar projeto">
{`criptenv projects create meu-app`}
          </CodeBlock>
          <Callout type="tip" className="mt-3">
            Você será solicitado a definir uma senha de vault para o projeto.
            Essa senha é usada para criptografar os secrets deste projeto.
          </Callout>
        </Step>

        <Step title="Adicione suas variáveis de ambiente">
          <p className="text-muted-foreground">
            Adicione seus secrets via CLI:
          </p>
          <CodeBlock language="bash" title="Adicionar secrets">
{`criptenv set DATABASE_URL="postgres://user:pass@host/db"
criptenv set API_KEY="your_api_key_here"`}
          </CodeBlock>
        </Step>

        <Step title="Sincronize com a nuvem">
          <p className="text-muted-foreground">
            Envie seus secrets criptografados para o servidor:
          </p>
          <CodeBlock language="bash" title="Push para nuvem">
{`criptenv push -p <project-id>`}
          </CodeBlock>
        </Step>

        <Step title="Carregue as variáveis no seu projeto">
          <p className="text-muted-foreground">
            Exporte os secrets para um arquivo .env local:
          </p>
          <CodeBlock language="bash" title="Exportar para .env">
{`criptenv export -o .env.local`}
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
          <a href="/docs/cli/commands" className="underline">
            Explore a referência completa de comandos
          </a>
        </li>
      </ul>
    </div>
  );
}
