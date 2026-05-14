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

export default function InstallationPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Getting Started', href: '/docs/getting-started' },
          { label: 'Instalação' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Instalação</h1>
      <p className="text-lg text-muted-foreground mb-8">
        O CriptEnv CLI é distribuído via PyPI. Instale em qualquer sistema com
        Python 3.10+.
      </p>

      <Callout variant="info">
        Requisito mínimo: Python 3.10 ou superior. O CLI é multiplataforma e
        funciona em macOS, Linux e Windows.
      </Callout>

      <h2 className="text-2xl font-bold mt-12 mb-4">
        Instalação via pip
      </h2>
      <p className="text-muted-foreground mb-6">
        A maneira mais rápida de instalar o CriptEnv:
      </p>

      <Tabs defaultValue="pip">
        <Tab value="pip" label="pip">
          <div className="space-y-4">
            <CodeBlock
              language="bash"
              code={`pip install criptenv`}
            />
            <Callout variant="tip">
              Recomendamos usar{' '}
              <code className="bg-muted px-1 rounded text-sm">pipx</code> para
              instalar ferramentas de CLI globalmente, evitando conflitos de
              dependências:
              <CodeBlock language="bash" code="pipx install criptenv" />
            </Callout>
          </div>
        </Tab>

        <Tab value="dev" label="Desenvolvimento">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Para contribuir ou modificar o código, clone o repositório e
              instale em modo editável:
            </p>
            <CodeBlock
              language="bash"
              code={`git clone https://github.com/77mdias/criptenv.git
cd criptenv/apps/cli
pip install -e ".[dev]"`}
            />
          </div>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-bold mt-12 mb-4">
        Verificação da Instalação
      </h2>
      <p className="text-muted-foreground mb-4">
        Após instalar, verifique se tudo está funcionando corretamente com o
        comando de diagnóstico:
      </p>
      <CodeBlock language="bash" code="criptenv --version" />
      <div className="mt-4">
        <CodeBlock
          language="bash"
          code={`criptenv doctor
# ✔ CLI instalado
# ✔ Python: 3.12.1
# ✔ Vault local: OK
# ✔ Conectividade: OK`}
        />
      </div>

      <Callout variant="info" className="mt-4">
        O comando{' '}
        <code className="bg-muted px-1 rounded text-sm">criptenv doctor</code>{' '}
        verifica a instalação, dependências, configuração e conectividade com a
        nuvem. Se algo estiver incorreto, ele fornecerá instruções para
        correção.
      </Callout>

      <h2 className="text-2xl font-bold mt-12 mb-4">Desinstalação</h2>
      <p className="text-muted-foreground mb-4">
        Para remover completamente o CriptEnv do seu sistema:
      </p>
      <CodeBlock
        language="bash"
        code={`pip uninstall criptenv
rm -rf ~/.criptenv`}
      />

      <Callout variant="warning" className="mt-4">
        A desinstalação do CLI não remove seus dados locais automaticamente.
        Para remover também o vault e dados locais, delete o diretório{' '}
        <code className="bg-muted px-1 rounded text-sm">~/.criptenv</code>.
      </Callout>
    </div>
  );
}
