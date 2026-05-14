'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function QuickstartPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Getting Started', href: '/docs/getting-started' },
          { label: 'Quickstart' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Quickstart</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Comece a usar o CriptEnv em menos de 5 minutos. Este guia rápido vai
        levá-lo da instalação até a leitura do primeiro segredo.
      </p>

      <Callout type="info">
        Pré-requisitos: Python 3.10+ instalado no seu sistema.
      </Callout>

      <Steps>
        <Step title="Instale o CLI">
          <p className="mb-4">
            Instale o CriptEnv via pip:
          </p>
          <CodeBlock
            language="bash"
            code={`pip install criptenv`}
          />
        </Step>

        <Step title="Crie uma conta e faça login">
          <p className="mb-4">
            Acesse{' '}
            <a href="https://criptenv.77mdevseven.tech" className="underline">
              criptenv.77mdevseven.tech
            </a>{' '}
            e crie sua conta gratuitamente. Depois autentique o CLI:
          </p>
          <CodeBlock language="bash" code="criptenv login --email you@example.com" />
          <p className="mt-3 text-sm text-muted-foreground">
            O comando <code className="bg-muted px-1 rounded text-sm">criptenv init</code>{' '}
            é opcional. Ele apenas prepara metadata local em{' '}
            <code className="bg-muted px-1 rounded text-sm">~/.criptenv/</code>.
          </p>
        </Step>

        <Step title="Crie um projeto">
          <p className="mb-4">
            Crie um novo projeto para organizar seus segredos:
          </p>
          <CodeBlock
            language="bash"
            code={`criptenv projects create meu-projeto`}
          />
          <Callout type="tip" className="mt-3">
            Você definirá uma Vault password para o projeto. Ela protege os
            secrets e não é enviada ao servidor.
          </Callout>
        </Step>

        <Step title="Defina seus segredos">
          <p className="mb-4">
            Agora adicione variáveis de ambiente secretas ao projeto:
          </p>
          <CodeBlock
            language="bash"
            code={`criptenv set DATABASE_URL="postgres://user:pass@host/db"
criptenv set API_KEY="your_api_key_here"`}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Todos os segredos são criptografados no CLI com AES-256-GCM antes
            do envio. O CriptEnv nunca recebe dados em texto claro.
          </p>
        </Step>

        <Step title="Liste seus segredos">
          <p className="mb-4">
            Veja todos os segredos configurados:
          </p>
          <CodeBlock
            language="bash"
            code={`criptenv list
# Saída:
# DATABASE_URL
# API_KEY`}
          />
          <Callout type="info" className="mt-3">
            O comando{' '}
            <code className="bg-muted px-1 rounded text-sm">list</code> mostra
            apenas os nomes das variáveis, nunca os valores. Assim é seguro usar
            em logs e CI.
          </Callout>
        </Step>

        <Step title="Leia um segredo">
          <p className="mb-4">
            Recupere o valor de um segredo específico:
          </p>
          <CodeBlock
            language="bash"
            code={`criptenv get DATABASE_URL
# Saída: postgres://user:pass@host/db`}
          />
        </Step>

        <Step title="Importe ou exporte arquivos .env">
          <p className="mb-4">
            O vault remoto já fica sincronizado. Use arquivos quando precisar
            migrar ou materializar variáveis localmente:
          </p>
          <CodeBlock
            language="bash"
            code={`criptenv push .env.production -p <project-id>
criptenv pull -p <project-id> --output .env.production`}
          />
        </Step>
      </Steps>

      <h2 className="text-2xl font-bold mt-12 mb-4">Próximos passos</h2>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          Aprenda os{' '}
          <a
            href="/docs/getting-started/concepts"
            className="text-primary hover:underline"
          >
            conceitos fundamentais
          </a>{' '}
          do CriptEnv
        </li>
        <li>
          Explore a{' '}
          <a
            href="/docs/cli/commands"
            className="text-primary hover:underline"
          >
            referência completa de comandos
          </a>
        </li>
        <li>
          Importe e exporte arquivos com{' '}
          <code className="bg-muted px-1 rounded text-sm">criptenv push FILE</code> e{' '}
          <code className="bg-muted px-1 rounded text-sm">criptenv pull --output FILE</code>
        </li>
        <li>
          Integre com seu{' '}
          <a href="/docs/guides/cicd-setup" className="text-primary hover:underline">
            pipeline de CI/CD
          </a>
        </li>
      </ul>
    </div>
  );
}
