'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function RailwayIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Integrações', href: '/docs/integrations' },
          { label: 'Railway', href: '/docs/integrations/railway' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        Integração com Railway
      </h1>
      <p className="text-muted-foreground mb-8">
        Sincronize suas variáveis de ambiente criptografadas com os serviços do
        Railway de forma automática e segura. Ideal para times que utilizam o
        Railway como plataforma de deploy.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Configuração</h2>

      <Steps>
        <Step title="Obtenha o token do Railway">
          <p className="text-muted-foreground">
            No Railway, acesse <strong>Account Settings → Tokens</strong> e
            gere um novo token de API com permissão de gerenciamento de
            variáveis de ambiente.
          </p>
        </Step>

        <Step title="Conecte o Railway no CriptEnv">
          <p className="text-muted-foreground">
            No painel do CriptEnv, vá em{' '}
            <strong>Projeto → Integrações → Railway</strong>. Cole o token e
            selecione o serviço e o projeto Railway que deseja sincronizar.
          </p>
        </Step>

        <Step title="Mapeie suas variáveis">
          <p className="text-muted-foreground">
            Selecione quais variáveis do CriptEnv devem ser sincronizadas com o
            Railway. Você pode escolher sincronizar todas ou selecionar
            variáveis específicas.
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Sincronização via CLI
      </h2>
      <CodeBlock language="bash" title="Sincronizar com Railway">
{`# Instalar o CLI (se ainda não tiver)
npm install -g @criptenv/cli

# Autenticar
criptenv auth login

# Sincronizar variáveis com o Railway
criptenv sync --provider railway --service meu-servico

# Sincronizar com ambiente específico
criptenv sync --provider railway --service meu-servico --environment production`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Configuração via railway.toml
      </h2>
      <CodeBlock language="toml" title="railway.toml">
{`[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"

# As variáveis de ambiente são gerenciadas pelo CriptEnv
# Não coloque secrets neste arquivo`}
      </CodeBlock>

      <Callout type="tip">
        Para garantir que suas variáveis estejam sempre atualizadas no Railway,
        configure a sincronização automática no painel do CriptEnv. Assim,
        qualquer alteração nos secrets será propagada em tempo real.
      </Callout>
    </div>
  );
}
