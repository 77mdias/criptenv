'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
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
        Pré-requisitos: Python 3.10+ instalado no seu sistema. Para macOS, você
        também pode usar o Homebrew.
      </Callout>

      <Steps>
        <Step title="Instale o CLI">
          <p className="mb-4">
            Escolha o método de instalação preferido para o seu sistema
            operacional:
          </p>

          <Tabs defaultValue="macos">
            <Tab value="macos" label="macOS">
              <CodeBlock language="bash" code="brew install criptenv/tap/criptenv" />
            </Tab>
            <Tab value="linux" label="Linux">
              <CodeBlock
                language="bash"
                code="curl -fsSL https://get.criptenv.dev | sh"
              />
            </Tab>
            <Tab value="windows" label="Windows">
              <CodeBlock language="powershell" code="scoop install criptenv" />
            </Tab>
            <Tab value="pip" label="pip">
              <CodeBlock language="bash" code="pip install criptenv" />
            </Tab>
          </Tabs>
        </Step>

        <Step title="Inicialize o CriptEnv">
          <p className="mb-4">
            Execute o comando de inicialização para configurar o diretório local
            do CriptEnv:
          </p>
          <CodeBlock language="bash" code="criptenv init" />
          <p className="mt-3 text-sm text-muted-foreground">
            Isso criará a pasta{' '}
            <code className="bg-muted px-1 rounded text-sm">.criptenv</code> no
            diretório atual, onde ficarão suas configurações e vault local.
          </p>
        </Step>

        <Step title="Crie um projeto">
          <p className="mb-4">
            Crie um novo projeto para organizar seus segredos:
          </p>
          <CodeBlock
            language="bash"
            code={`criptenv project create meu-projeto
criptenv project use meu-projeto`}
          />
          <Callout type="tip" className="mt-3">
            Você pode criar múltiplos projetos e alternar entre eles a qualquer
            momento com{' '}
            <code className="bg-muted px-1 rounded text-sm">
              criptenv project use
            </code>
            .
          </Callout>
        </Step>

        <Step title="Defina seus segredos">
          <p className="mb-4">
            Agora adicione variáveis de ambiente secretas ao projeto:
          </p>
          <CodeBlock
            language="bash"
            code={`criptenv set DATABASE_URL="postgres://user:pass@host/db"
criptenv set API_KEY="sk-1234567890abcdef"
criptenv set STRIPE_SECRET="sk_live_abc123"`}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Todos os segredos são criptografados localmente com AES-256-GCM
            antes de serem armazenados. O CriptEnv nunca envia dados em texto
            claro para a nuvem.
          </p>
        </Step>

        <Step title="Liste seus segredos">
          <p className="mb-4">
            Veja todos os segredos configurados no projeto atual:
          </p>
          <CodeBlock
            language="bash"
            code={`criptenv list
# Saída:
# DATABASE_URL
# API_KEY
# STRIPE_SECRET`}
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
          <p className="mt-3 mb-3 text-sm text-muted-foreground">
            Você também pode injetar os segredos diretamente em um comando:
          </p>
          <CodeBlock
            language="bash"
            code='criptenv run -- node server.js'
          />
        </Step>
      </Steps>

      <h2 className="text-2xl font-bold mt-12 mb-4">Próximos passos</h2>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          Aprenda a{' '}
          <a
            href="/docs/getting-started/concepts"
            className="text-primary hover:underline"
          >
            conceitos fundamentais
          </a>{' '}
          do CriptEnv
        </li>
        <li>
          Configure{' '}
          <a
            href="/docs/environments"
            className="text-primary hover:underline"
          >
            múltiplos ambientes
          </a>{' '}
          (dev, staging, production)
        </li>
        <li>
          Sincronize seus segredos com a nuvem usando{' '}
          <code className="bg-muted px-1 rounded text-sm">criptenv push</code>
        </li>
        <li>
          Integre com seu{' '}
          <a href="/docs/ci-cd" className="text-primary hover:underline">
            pipeline de CI/CD
          </a>
        </li>
      </ul>
    </div>
  );
}
