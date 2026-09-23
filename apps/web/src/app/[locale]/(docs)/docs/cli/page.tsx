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
          description="Todas as operações acontecem no seu terminal. Se você consegue abrir um shell, consegue usar o CriptEnv."
        />
        <DocCard
          title="Zero-Knowledge"
          description="Seus segredos são criptografados localmente com AES-256-GCM antes de qualquer sincronização. O servidor nunca vê seus dados em texto claro."
        />
        <DocCard
          title="Terminal Remoto"
          description="A CLI opera no vault remoto do projeto, mantendo tudo sincronizado com o dashboard web e com a equipe."
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
          description="Push importa arquivos .env para o vault remoto; pull exporta o vault remoto para arquivos locais."
          href="/docs/cli/commands#sync"
        />
        <DocCard
          title="Multi-Ambientes"
          description="Crie e gerencie ambientes isolados (dev, staging, production) dentro de um mesmo projeto."
          href="/docs/cli/commands#environments"
        />
        <DocCard
          title="CI/CD"
          description="Integre com pipelines de CI/CD. Faça login headless, liste segredos e faça deploy sem expor credenciais."
          href="/docs/cli/commands#cicd"
        />
        <DocCard
          title="Integrações"
          description="Conecte provedores de nuvem (Vercel, Render) e sincronize segredos automaticamente."
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
        code={`# Instalar via pip
pip install criptenv

# Autenticar a CLI
criptenv login --email you@example.com`}
      />

      <Callout type="info">
        Requer Python 3.10 ou superior. O CLI é multiplataforma e
        funciona em macOS, Linux e Windows.
      </Callout>

      <Callout type="info">
        Após a instalação, consulte a{' '}
        <a href="/docs/cli/commands" className="underline font-medium">
          Referência de Comandos
        </a>{' '}
        para ver todas as opções disponíveis, ou a{' '}
        <a href="/docs/cli/configuration" className="underline font-medium">
          Configuração
        </a>{' '}
        para entender a estrutura local.
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
          description="Estrutura do ~/.criptenv/, sessão local, Vault password e variáveis de ambiente."
          href="/docs/cli/configuration"
        />
      </CardGrid>
    </div>
  );
}
