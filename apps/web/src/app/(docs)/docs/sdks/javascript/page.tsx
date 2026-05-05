'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  ParamTable,
} from '@/components/docs';

export default function JavaScriptSDKPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'SDKs', href: '/docs/sdks' },
          { label: 'JavaScript', href: '/docs/sdks/javascript' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        SDK JavaScript / TypeScript
      </h1>
      <p className="text-muted-foreground mb-8">
        O SDK oficial do CriptEnv para JavaScript e TypeScript. Funciona com
        Node.js, Deno e navegadores. Tipos TypeScript inclusos.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Instalação</h2>

      <Tabs defaultValue="npm">
        <Tab value="npm" label="npm">
          <CodeBlock language="bash">
{`npm install @criptenv/sdk`}
          </CodeBlock>
        </Tab>
        <Tab value="yarn" label="yarn">
          <CodeBlock language="bash">
{`yarn add @criptenv/sdk`}
          </CodeBlock>
        </Tab>
        <Tab value="pnpm" label="pnpm">
          <CodeBlock language="bash">
{`pnpm add @criptenv/sdk`}
          </CodeBlock>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Inicialização</h2>

      <Steps>
        <Step title="Importe o SDK">
          <CodeBlock language="typescript" title="Importação">
{`import { CriptEnv } from '@criptenv/sdk';`}
          </CodeBlock>
        </Step>

        <Step title="Crie uma instância">
          <CodeBlock language="typescript" title="Inicialização">
{`const criptenv = new CriptEnv({
  token: process.env.CRIPTENV_TOKEN!,
  projectId: 'seu-project-id',
  environment: 'production', // opcional, padrão: 'production'
});`}
          </CodeBlock>
        </Step>

        <Step title="Descriptografe suas variáveis">
          <CodeBlock language="typescript" title="Uso básico">
{`// Carrega todas as variáveis de ambiente
const env = await criptenv.load();

// As variáveis estão disponíveis como objeto
console.log(env.DATABASE_URL);
console.log(env.API_SECRET);

// Ou injeta no process.env
await criptenv.loadToProcess();`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Referência da API</h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">Construtor</h3>
      <ParamTable
        params={[
          {
            name: 'token',
            type: 'string',
            required: true,
            description: 'Token de API do CriptEnv.',
          },
          {
            name: 'projectId',
            type: 'string',
            required: true,
            description: 'ID do projeto no CriptEnv.',
          },
          {
            name: 'environment',
            type: 'string',
            required: false,
            description: 'Ambiente alvo. Padrão: "production".',
          },
          {
            name: 'cache',
            type: 'boolean',
            required: false,
            description: 'Habilitar cache local. Padrão: true.',
          },
          {
            name: 'cacheTTL',
            type: 'number',
            required: false,
            description: 'Tempo de vida do cache em segundos. Padrão: 300.',
          },
        ]}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">Métodos</h3>

      <CodeBlock language="typescript" title="criptenv.load()">
{`// Retorna todas as variáveis como um objeto
const env: Record<string, string> = await criptenv.load();`}
      </CodeBlock>

      <CodeBlock language="typescript" title="criptenv.get(key)">
{`// Retorna uma variável específica
const dbUrl = await criptenv.get('DATABASE_URL');`}
      </CodeBlock>

      <CodeBlock language="typescript" title="criptenv.loadToProcess()">
{`// Injeta todas as variáveis no process.env
await criptenv.loadToProcess();
// Agora process.env.DATABASE_URL está disponível`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Exemplos Práticos
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        Com Express.js
      </h3>
      <CodeBlock language="typescript" title="server.ts">
{`import express from 'express';
import { CriptEnv } from '@criptenv/sdk';

const criptenv = new CriptEnv({
  token: process.env.CRIPTENV_TOKEN!,
  projectId: 'seu-project-id',
});

async function main() {
  // Carrega as variáveis antes de iniciar o servidor
  await criptenv.loadToProcess();

  const app = express();
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log(\`Servidor rodando na porta \${port}\`);
  });
}

main();`}
      </CodeBlock>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        Com Next.js
      </h3>
      <CodeBlock language="typescript" title="criptenv.ts (lib)">
{`import { CriptEnv } from '@criptenv/sdk';

const criptenv = new CriptEnv({
  token: process.env.CRIPTENV_TOKEN!,
  projectId: process.env.CRIPTENV_PROJECT_ID!,
  environment: process.env.VERCEL_ENV || 'development',
});

export default criptenv;`}
      </CodeBlock>

      <Callout type="tip">
        Em produção, recomendamos usar{' '}
        <code>criptenv.loadToProcess()</code> no início da aplicação para que
        todas as variáveis estejam disponíveis via <code>process.env</code>.
      </Callout>
    </div>
  );
}
