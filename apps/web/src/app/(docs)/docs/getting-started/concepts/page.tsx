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
        Entenda como projetos, ambientes, vaults e o CLI remoto se conectam
        para proteger secrets de ponta a ponta.
      </p>

      <Callout type="info">
        CriptEnv é zero-knowledge: secrets são criptografados no cliente e o
        servidor armazena apenas blobs cifrados.
      </Callout>

      <CardGrid columns={2} className="mt-10">
        <DocCard
          title="Zero-Knowledge"
          icon="🔒"
          description="Toda criptografia acontece no seu dispositivo. A API nunca recebe secrets em texto claro nem a Vault password do projeto."
        />
        <DocCard
          title="Projetos"
          icon="📁"
          description="Projetos agrupam secrets relacionados e possuem uma Vault password própria para proteger seus dados."
        />
        <DocCard
          title="Ambientes"
          icon="🌐"
          description="Ambientes separam configurações por estágio, como development, staging e production."
        />
        <DocCard
          title="Vault Remoto"
          icon="🗄️"
          description="O vault remoto é a fonte de verdade. Ele guarda blobs criptografados e fica sincronizado entre CLI, web e equipe."
        />
        <DocCard
          title="Vault Password"
          icon="🔑"
          description="Senha do projeto usada somente no cliente para derivar chaves, descriptografar em memória e provar acesso ao vault."
        />
        <DocCard
          title="Import/Export"
          icon="🔄"
          description="Push importa arquivos .env para o vault remoto. Pull exporta secrets remotos para arquivos locais."
        />
      </CardGrid>

      <h2 className="text-2xl font-bold mt-14 mb-4">
        Zero-Knowledge — Como funciona?
      </h2>
      <ol className="list-decimal pl-6 space-y-3 text-muted-foreground mb-6">
        <li>
          O CLI lê a Vault password do projeto por prompt ou{' '}
          <code className="bg-muted px-1 rounded text-sm">CRIPTENV_VAULT_PASSWORD</code>.
        </li>
        <li>
          A chave do ambiente é derivada localmente com PBKDF2-HMAC-SHA256 e HKDF.
        </li>
        <li>
          Secrets são criptografados ou descriptografados em memória com AES-256-GCM.
        </li>
        <li>
          A API recebe somente ciphertext, IV, auth tag, checksum e metadata.
        </li>
      </ol>
      <Callout type="tip">
        Se a Vault password do projeto for perdida, os secrets cifrados daquele
        projeto não podem ser recuperados pelo servidor.
      </Callout>

      <h2 className="text-2xl font-bold mt-14 mb-4">Projetos e Ambientes</h2>
      <p className="text-muted-foreground mb-4">
        Projetos são namespaces de colaboração. Ambientes isolam valores por
        estágio sem misturar produção, homologação e desenvolvimento.
      </p>
      <CodeBlock
        language="bash"
        code={`criptenv projects create meu-app
criptenv env create staging -p <project-id>
criptenv set DATABASE_URL="postgres://prod/db" -p <project-id> -e production
criptenv list -p <project-id> -e production`}
      />

      <h2 className="text-2xl font-bold mt-14 mb-4">CLI como Terminal Remoto</h2>
      <p className="text-muted-foreground mb-4">
        A CLI não mantém um vault local de secrets como fluxo principal. Ela
        resolve projeto e ambiente pela API, baixa blobs criptografados, opera
        em memória e envia os novos blobs criptografados de volta.
      </p>
      <CodeBlock
        language="bash"
        code={`criptenv get API_KEY -p <project-id> -e production
criptenv rotate API_KEY -p <project-id> -e production`}
      />

      <h2 className="text-2xl font-bold mt-14 mb-4">Import e Export</h2>
      <p className="text-muted-foreground mb-4">
        Use arquivos quando precisar migrar de um <code className="bg-muted px-1 rounded text-sm">.env</code>{' '}
        existente ou materializar secrets para execução local:
      </p>
      <CodeBlock
        language="bash"
        code={`criptenv push .env.production -p <project-id> -e production
criptenv pull -p <project-id> -e production --output .env.production`}
      />

      <Callout type="warning" className="mt-8">
        Arquivos exportados como <code className="bg-muted px-1 rounded text-sm">.env</code>{' '}
        contêm plaintext. Adicione-os ao <code className="bg-muted px-1 rounded text-sm">.gitignore</code>{' '}
        e trate-os como secrets locais.
      </Callout>
    </div>
  );
}
