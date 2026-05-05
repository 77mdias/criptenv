'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Tabs,
  Tab,
  Steps,
  Step,
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
        O CriptEnv pode ser instalado de diversas formas. Escolha o método que
        melhor se adapta ao seu ambiente de desenvolvimento.
      </p>

      <Callout type="info">
        Requisito mínimo: Python 3.10 ou superior. O CLI é multiplataforma e
        funciona em macOS, Linux e Windows.
      </Callout>

      <h2 className="text-2xl font-bold mt-12 mb-4">
        Instalação via Gerenciador de Pacotes
      </h2>
      <p className="text-muted-foreground mb-6">
        A maneira mais rápida de instalar o CriptEnv é usar um gerenciador de
        pacotes nativo do seu sistema operacional.
      </p>

      <Tabs defaultValue="macos">
        <Tab value="macos" label="macOS (Homebrew)">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              No macOS, recomendamos o uso do Homebrew. Caso ainda não tenha o
              Homebrew instalado, visite{' '}
              <a
                href="https://brew.sh"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                brew.sh
              </a>
              .
            </p>
            <CodeBlock
              language="bash"
              code={`# Adicione o tap oficial do CriptEnv
brew tap criptenv/tap

# Instale o CLI
brew install criptenv`}
            />
            <p className="text-sm text-muted-foreground">
              Para atualizar para a versão mais recente:
            </p>
            <CodeBlock language="bash" code="brew upgrade criptenv" />
          </div>
        </Tab>

        <Tab value="linux" label="Linux (curl)">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              No Linux, use o script de instalação automática. Ele detecta sua
              arquitetura e instala o binário correto.
            </p>
            <CodeBlock
              language="bash"
              code={`# Instalação padrão (recomendado)
curl -fsSL https://get.criptenv.dev | sh

# Ou com instalação em diretório personalizado
curl -fsSL https://get.criptenv.dev | sh -s -- --dir ~/.local/bin`}
            />
            <Callout type="tip">
              Certifique-se de que o diretório de instalação está no seu{' '}
              <code className="bg-muted px-1 rounded text-sm">PATH</code>. O
              script padrão instala em{' '}
              <code className="bg-muted px-1 rounded text-sm">/usr/local/bin</code>
              .
            </Callout>
          </div>
        </Tab>

        <Tab value="windows" label="Windows (Scoop)">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              No Windows, recomendamos o Scoop. Se ainda não tiver o Scoop
              instalado, siga as instruções em{' '}
              <a
                href="https://scoop.sh"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                scoop.sh
              </a>
              .
            </p>
            <CodeBlock
              language="powershell"
              code={`# Adicione o bucket do CriptEnv
scoop bucket add criptenv https://github.com/criptenv/scoop-bucket

# Instale o CLI
scoop install criptenv`}
            />
            <p className="text-sm text-muted-foreground">
              Para atualizar:
            </p>
            <CodeBlock language="powershell" code="scoop update criptenv" />
          </div>
        </Tab>

        <Tab value="pip" label="pip (Python)">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Se você tem Python 3.10+ instalado, pode usar o pip em qualquer
              sistema operacional.
            </p>
            <CodeBlock
              language="bash"
              code={`# Instalação global (recomendado com pipx)
pipx install criptenv

# Ou instalação com pip
pip install criptenv`}
            />
            <Callout type="warning">
              Recomendamos usar{' '}
              <code className="bg-muted px-1 rounded text-sm">pipx</code> para
              instalar ferramentas de CLI globalmente, evitando conflitos de
              dependências com outros projetos Python.
            </Callout>
          </div>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-bold mt-12 mb-4">Instalação Manual</h2>
      <p className="text-muted-foreground mb-4">
        Se preferir instalar manualmente, baixe o binário diretamente do
        GitHub Releases:
      </p>

      <Steps>
        <Step title="Baixe o binário">
          <p className="mb-3 text-muted-foreground">
            Acesse a página de releases no GitHub e baixe o arquivo adequado
            para seu sistema:
          </p>
          <CodeBlock
            language="bash"
            code={`# macOS (Apple Silicon)
curl -L -o criptenv https://github.com/criptenv/cli/releases/latest/download/criptenv-darwin-arm64

# macOS (Intel)
curl -L -o criptenv https://github.com/criptenv/cli/releases/latest/download/criptenv-darwin-amd64

# Linux (x86_64)
curl -L -o criptenv https://github.com/criptenv/cli/releases/latest/download/criptenv-linux-amd64

# Linux (ARM64)
curl -L -o criptenv https://github.com/criptenv/cli/releases/latest/download/criptenv-linux-arm64`}
          />
        </Step>

        <Step title="Dê permissão de execução">
          <CodeBlock language="bash" code="chmod +x criptenv" />
        </Step>

        <Step title="Mova para um diretório no PATH">
          <CodeBlock
            language="bash"
            code={`# macOS / Linux
sudo mv criptenv /usr/local/bin/criptenv

# Ou para um diretório do usuário
mv criptenv ~/.local/bin/criptenv`}
          />
        </Step>
      </Steps>

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
# ✔ CLI instalado: v1.4.2
# ✔ Python: 3.12.1
# ✔ Configuração: OK
# ✔ Vault local: OK
# ✔ Conectividade: OK`}
        />
      </div>

      <Callout type="info" className="mt-4">
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
      <Tabs defaultValue="macos-uninstall">
        <Tab value="macos-uninstall" label="Homebrew">
          <CodeBlock
            language="bash"
            code={`brew uninstall criptenv
brew untap criptenv/tap`}
          />
        </Tab>
        <Tab value="linux-uninstall" label="curl / manual">
          <CodeBlock language="bash" code="sudo rm /usr/local/bin/criptenv" />
        </Tab>
        <Tab value="pip-uninstall" label="pip">
          <CodeBlock language="bash" code="pip uninstall criptenv" />
        </Tab>
      </Tabs>

      <Callout type="warning" className="mt-4">
        A desinstalação do CLI não remove seus dados locais. Para remover
        também os dados, delete o diretório{' '}
        <code className="bg-muted px-1 rounded text-sm">.criptenv</code> e o
        arquivo de configuração em{' '}
        <code className="bg-muted px-1 rounded text-sm">
          ~/.config/criptenv
        </code>
        .
      </Callout>
    </div>
  );
}
