'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function RenderIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Integrações', href: '/docs/integrations' },
          { label: 'Render', href: '/docs/integrations/render' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        Integração com Render
      </h1>
      <p className="text-muted-foreground mb-8">
        Integre o CriptEnv ao Render para gerenciar seus Environment Groups de
        forma centralizada. Mantenha seus secrets sincronizados automaticamente
        entre o CriptEnv e os serviços do Render.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Configuração</h2>

      <Steps>
        <Step title="Gere uma API Key do Render">
          <p className="text-muted-foreground">
            No Render, acesse{' '}
            <strong>Account Settings → API Keys</strong> e crie uma nova chave
            de API. Anote o valor, pois ele será exibido apenas uma vez.
          </p>
        </Step>

        <Step title="Conecte o Render no CriptEnv">
          <p className="text-muted-foreground">
            No painel do CriptEnv, navegue até{' '}
            <strong>Projeto → Integrações → Render</strong>. Insira a API Key
            do Render e selecione o Environment Group que deseja sincronizar.
          </p>
        </Step>

        <Step title="Selecione as variáveis para sincronizar">
          <p className="text-muted-foreground">
            Escolha quais variáveis do CriptEnv devem ser sincronizadas. Você
            pode sincronizar todas as variáveis de um ambiente ou selecionar
            individualmente.
          </p>
        </Step>

        <Step title="Ative a sincronização">
          <p className="text-muted-foreground">
            Ative a sincronização automática. A partir de agora, alterações nos
            secrets do CriptEnv serão refletidas no Render automaticamente.
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Sincronização via CLI
      </h2>
      <CodeBlock language="bash" title="Sincronizar com Render">
{`# Sincronizar Environment Group
criptenv sync --provider render --env-group meu-env-group

# Sincronizar com ambiente específico
criptenv sync --provider render --env-group meu-env-group --environment production`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Exemplo com render.yaml
      </h2>
      <CodeBlock language="yaml" title="render.yaml (Blueprint)">
{`services:
  - type: web
    name: meu-app
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - sync: false  # Variáveis gerenciadas pelo CriptEnv
    envVarGroups:
      - name: meu-env-group`}
      </CodeBlock>

      <Callout type="tip">
        Os Environment Groups do Render permitem compartilhar variáveis entre
        múltiplos serviços. Use esta integração para manter todos os seus
        serviços sincronizados com as mesmas variáveis do CriptEnv.
      </Callout>

      <Callout type="warning">
        A API Key do Render tem acesso amplo à sua conta. Recomendamos criar
        uma chave dedicada apenas para a integração com o CriptEnv.
      </Callout>
    </div>
  );
}
