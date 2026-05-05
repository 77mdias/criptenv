'use client';

import {
  CodeBlock,
  DocCard,
  CardGrid,
  Callout,
  Breadcrumb,
} from '@/components/docs';

export default function CliOverviewPage() {
  return (
    <div className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'CLI', href: '/docs/cli' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-2">CriptEnv CLI</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Gerencie seus segredos diretamente do terminal — com criptografia
        de ponta a ponta e zero conhecimento do lado do servidor.
      </p>

      <h2 className="text-2xl font-semibold mb-4">Filosofia</h2>

      <CardGrid>
        <DocCard
          title="Terminal-First"
          description="Todas as operações acontecem no seu terminal. Sem painéis web obrigatórios, sem dependências visuais. Se você consegue abrir um shell, consegue usar o CriptEnv."
        />
        <DocCard
          title="Zero-Knowledge"
          description="Seus segredos são criptografados localmente com AES-256-GCM antes de qualquer sincronização. O servidor nunca vê seus dados em texto claro — nem mesmo nós."
        />
        <DocCard
          title="Offline-Ready"
          description="O vault local funciona sem internet. Sincronize com a nuvem quando quiser, da maneira que quiser (push/pull)."
        />
      </CardGrid>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Recursos</h2>

      <CardGrid>
        <DocCard
          title="Gestão de Segredos"
          description="Armazene, rotacione, importe e exporte variáveis de ambiente com criptografia forte e versionamento."
          href="/docs/cli/commands#secrets"
        />
        <DocCard
          title="Sincronização"
          description="Push e pull do vault local para a nuvem, mantendo seus ambientes sempre atualizados."
          href="/docs/cli/commands#sync"
        />
        <DocCard
          title="Multi-Ambientes"
          description="Crie e gerencie ambientes isolados (dev, staging, production) dentro de um mesmo projeto."
          href="/docs/cli/commands#environments"
        />
        <DocCard
          title="CI/CD"
          description="Integre com pipelines de CI/CD. Faça login headless, injete segredos e faça deploy sem expor credenciais."
          href="/docs/cli/commands#cicd"
        />
        <DocCard
          title="Integrações"
          description="Conecte provedores de nuvem (AWS, GCP, Azure, Vercel, Netlify) e sincronize segredos automaticamente."
          href="/docs/cli/commands#integrations"
        />
        <DocCard
          title="Rotação e Expiração"
          description="Configure alertas de expiração e rotacione chaves com versionamento automático."
          href="/docs/cli/commands#maintenance"
        />
      </CardGrid>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Instalação Rápida</h2>

      <CodeBlock
        language="bash"
        code={`# Instalar via npm
npm install -g criptenv

# Ou via Homebrew
brew install criptenv

# Inicializar o vault local
criptenv init`}
      />

      <Callout type="info">
        Após a instalação, consulte a{' '}
        <a href="/docs/cli/commands" className="underline font-medium">
          Referência de Comandos
        </a>{' '}
        para ver todas as opções disponíveis, ou a{' '}
        <a href="/docs/cli/configuration" className="underline font-medium">
          Configuração
        </a>{' '}
        para personalizar o comportamento do CLI.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Próximos Passos</h2>

      <CardGrid>
        <DocCard
          title="Referência de Comandos"
          description="Lista completa de todos os comandos, opções e exemplos de uso."
          href="/docs/cli/commands"
        />
        <DocCard
          title="Configuração"
          description="Estrutura do ~/.criptenv/, variáveis de ambiente, banco de dados e senha mestra."
          href="/docs/cli/configuration"
        />
      </CardGrid>
    </div>
  );
}
