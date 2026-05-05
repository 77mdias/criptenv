'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  DocCard,
  CardGrid,
} from '@/components/docs';

export default function ConceptsPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Getting Started', href: '/docs/getting-started' },
          { label: 'Conceitos' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Conceitos Fundamentais</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Entenda os conceitos-chave por trás do CriptEnv e como eles se
        relacionam para proteger seus segredos de ponta a ponta.
      </p>

      <Callout type="info">
        O CriptEnv é uma plataforma de gerenciamento de segredos com
        criptografia zero-knowledge. Isso significa que seus dados nunca saem do
        seu dispositivo em texto claro — nem mesmo os servidores do CriptEnv
        conseguem ler seus segredos.
      </Callout>

      <CardGrid columns={2} className="mt-10">
        <DocCard
          title="Zero-Knowledge"
          icon="🔒"
          description="O princípio fundamental do CriptEnv. Toda a criptografia acontece no seu dispositivo (client-side). Os servidores armazenam apenas dados cifrados que não podem ser decifrados sem a sua senha mestra."
        />

        <DocCard
          title="Projetos"
          icon="📁"
          description="Projetos são a unidade de organização do CriptEnv. Cada projeto agrupa segredos relacionados — por exemplo, um projeto para sua aplicação web e outro para um serviço de backend."
        />

        <DocCard
          title="Ambientes"
          icon="🌐"
          description="Ambientes permitem separar configurações por estágio: development, staging e production. Cada ambiente dentro de um projeto tem seu próprio conjunto de segredos independentes."
        />

        <DocCard
          title="Vault"
          icon="🗄️"
          description="O Vault é onde seus segredos cifrados são armazenados. Pode ser local (.criptenv no seu projeto) ou na nuvem (CriptEnv Cloud). Ambos usam a mesma criptografia AES-256-GCM."
        />

        <DocCard
          title="Senha Mestre vs Senha do Vault"
          icon="🔑"
          description="A Senha Mestre (Master Password) protege sua conta na nuvem. A Senha do Vault (Vault Password) criptografa os segredos locais. São independentes — você pode ter vaults locais sem conta na nuvem."
        />

        <DocCard
          title="Push/Pull Sync"
          icon="🔄"
          description="Push envia seus segredos locais cifrados para a nuvem. Pull baixa e mescla segredos da nuvem para o local. A sincronização é sempre criptografada e segura."
        />
      </CardGrid>

      <h2 className="text-2xl font-bold mt-14 mb-4">
        Zero-Knowledge — Como funciona?
      </h2>
      <p className="text-muted-foreground mb-4">
        A arquitetura zero-knowledge do CriptEnv garante que seus segredos nunca
        existam em texto claro nos servidores. O fluxo é o seguinte:
      </p>
      <ol className="list-decimal pl-6 space-y-3 text-muted-foreground mb-6">
        <li>
          Quando você executa{' '}
          <code className="bg-muted px-1 rounded text-sm">criptenv set</code>,
          o valor é criptografado localmente usando AES-256-GCM com uma chave
          derivada da sua senha.
        </li>
        <li>
          O valor cifrado (não o original) é enviado para os servidores
          CriptEnv.
        </li>
        <li>
          Quando você executa{' '}
          <code className="bg-muted px-1 rounded text-sm">criptenv get</code>,
          o valor cifrado é baixado e decifrado localmente no seu dispositivo.
        </li>
      </ol>
      <Callout type="tip">
        Se você perder sua senha, seus segredos são irrecuperáveis. Não há
        backdoor ou mecanismo de recuperação — esse é o compromisso do
        zero-knowledge.
      </Callout>

      <h2 className="text-2xl font-bold mt-14 mb-4">Projetos</h2>
      <p className="text-muted-foreground mb-4">
        Projetos são a forma principal de organizar seus segredos. Pense neles
        como namespaces independentes:
      </p>
      <CodeBlock
        language="bash"
        code={`# Criar um novo projeto
criptenv project create meu-app

# Listar projetos
criptenv project list

# Alternar entre projetos
criptenv project use outro-projeto`}
      />
      <p className="mt-4 text-sm text-muted-foreground">
        Cada projeto mantém sua própria lista de ambientes e segredos.
        Alternar entre projetos é instantâneo e não afeta o estado local.
      </p>

      <h2 className="text-2xl font-bold mt-14 mb-4">Ambientes</h2>
      <p className="text-muted-foreground mb-4">
        Ambientes permitem que você mantenha diferentes conjuntos de segredos
        para cada estágio do seu ciclo de desenvolvimento:
      </p>
      <CodeBlock
        language="bash"
        code={`# Definir um segredo no ambiente de desenvolvimento
criptenv set --env development DATABASE_URL="postgres://localhost/dev"

# Definir o mesmo segredo no ambiente de produção
criptenv set --env production DATABASE_URL="postgres://prod-server/db"

# Listar segredos de um ambiente específico
criptenv list --env production`}
      />
      <Callout type="info" className="mt-4">
        O ambiente padrão é{' '}
        <code className="bg-muted px-1 rounded text-sm">development</code>.
        Você pode alterar o padrão com{' '}
        <code className="bg-muted px-1 rounded text-sm">
          criptenv env use staging
        </code>
        .
      </Callout>

      <h2 className="text-2xl font-bold mt-14 mb-4">Vault — Local e Nuvem</h2>
      <p className="text-muted-foreground mb-4">
        O CriptEnv suporta dois tipos de armazenamento para o vault:
      </p>

      <h3 className="text-xl font-semibold mt-8 mb-3">Vault Local</h3>
      <p className="text-muted-foreground mb-4">
        O vault local armazena os segredos cifrados em um arquivo dentro do seu
        projeto, no diretório{' '}
        <code className="bg-muted px-1 rounded text-sm">.criptenv/</code>:
      </p>
      <CodeBlock
        language="text"
        code={`meu-projeto/
├── .criptenv/
│   ├── config.json      # Configuração do projeto
│   ├── vault.enc         # Segredos cifrados (AES-256-GCM)
│   └── .key              # Chave derivada (protegida por senha)
├── src/
└── ...`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">Vault na Nuvem</h3>
      <p className="text-muted-foreground mb-4">
        O CriptEnv Cloud sincroniza seus segredos entre dispositivos e membros
        da equipe. Os dados na nuvem são sempre cifrados — o servidor nunca
        vê texto claro:
      </p>
      <CodeBlock
        language="bash"
        code={`# Fazer login na conta CriptEnv
criptenv login

# Enviar segredos para a nuvem
criptenv push

# Baixar segredos da nuvem
criptenv pull`}
      />

      <h2 className="text-2xl font-bold mt-14 mb-4">
        Senha Mestre vs Senha do Vault
      </h2>
      <p className="text-muted-foreground mb-4">
        O CriptEnv usa dois tipos de senhas para proteger seus dados em
        diferentes camadas:
      </p>
      <CardGrid columns={2} className="mb-6">
        <DocCard
          title="Senha Mestre (Master Password)"
          icon="🔐"
          description="Protege sua conta no CriptEnv Cloud. Usada para autenticação e para derivar a chave de criptografia dos dados na nuvem. Definida no primeiro login."
        />
        <DocCard
          title="Senha do Vault"
          icon="🗝️"
          description="Protege o vault local do projeto. Pode ser diferente para cada projeto. Usada para criptografar e decifrar o arquivo .criptenv/vault.enc."
        />
      </CardGrid>
      <Callout type="warning">
        Você pode usar o CriptEnv totalmente offline com apenas a Senha do
        Vault. A Senha Mestre é necessária apenas quando deseja sincronizar com
        a nuvem ou colaborar com a equipe.
      </Callout>

      <h2 className="text-2xl font-bold mt-14 mb-4">Push/Pull — Sincronização</h2>
      <p className="text-muted-foreground mb-4">
        O sistema de sincronização Push/Pull permite manter seus segredos
        atualizados entre o vault local e a nuvem:
      </p>
      <CodeBlock
        language="bash"
        code={`# Enviar todos os segredos locais para a nuvem (cifrados)
criptenv push

# Baixar segredos da nuvem e mesclar com os locais
criptenv pull

# Push de um ambiente específico
criptenv push --env production

# Pull forçado (sobrescreve o local)
criptenv pull --force`}
      />
      <p className="mt-4 text-muted-foreground mb-4">
        O processo de sincronização:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          Os segredos são sempre cifrados antes de sair do seu dispositivo
        </li>
        <li>
          O merge é inteligente — conflitos são reportados para você resolver
        </li>
        <li>
          Histórico de alterações é mantido para auditoria
        </li>
        <li>
          Múltiplos membros da equipe podem sincronizar com o mesmo projeto
        </li>
      </ul>

      <Callout type="tip" className="mt-8">
        Dica: adicione{' '}
        <code className="bg-muted px-1 rounded text-sm">.criptenv/</code> ao
        seu{' '}
        <code className="bg-muted px-1 rounded text-sm">.gitignore</code> se
        estiver usando o vault local para evitar que segredos cifrados sejam
        commitados no repositório. Ou use{' '}
        <code className="bg-muted px-1 rounded text-sm">criptenv push</code>{' '}
        como fonte de verdade.
      </Callout>
    </div>
  );
}
