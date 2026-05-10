'use client';

import {
  CodeBlock,
  InlineCode,
  Callout,
  ParamTable,
  Steps,
  Step,
  Breadcrumb,
} from '@/components/docs';

export default function CliConfigurationPage() {
  return (
    <div className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'CLI', href: '/docs/cli' },
          { label: 'Configuração', href: '/docs/cli/configuration' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-2">Configuração do CLI</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Entenda como o CriptEnv organiza seus dados localmente, como funciona a
        senha mestra e como personalizar o comportamento via variáveis de
        ambiente e arquivo de configuração.
      </p>

      {/* ── DIRECTORY STRUCTURE ─────────────────────────────── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Estrutura do Diretório
      </h2>
      <p className="mb-4">
        O CriptEnv armazena todos os dados locais em{' '}
        <InlineCode>~/.criptenv/</InlineCode>. Após executar{' '}
        <InlineCode>criptenv init</InlineCode>, a estrutura é a seguinte:
      </p>
      <CodeBlock
        language="text"
        code={`~/.criptenv/
├── vault.db          # Banco de dados SQLite com segredos criptografados
├── config.toml       # Arquivo de configuração do CLI
├── session.json      # Token de sessão atual (se autenticado)
└── logs/
    └── criptenv.log  # Logs de operações`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">vault.db</h3>
      <p className="mb-4">
        O coração do CriptEnv. Um banco de dados SQLite que armazena todos os
        segredos criptografados localmente com AES-256-GCM. Cada segredo é
        versionado, permitindo rotação sem perder o histórico.
      </p>
      <Callout type="warning">
        Nunca compartilhe ou faça backup do <InlineCode>vault.db</InlineCode>{' '}
        para locais inseguros. O arquivo contém dados criptografados, mas a
        segurança depende da força da sua senha mestra.
      </Callout>

      <p className="mb-4">Tabelas internas do banco:</p>
      <ParamTable
        title="Tabelas do vault.db"
        rows={[
          { name: 'secrets', type: 'tabela', required: false, description: 'Segredos criptografados com metadados (chave, valor cifrado, IV, salt, versão, ambiente, projeto, data de expiração)' },
          { name: 'environments', type: 'tabela', required: false, description: 'Ambientes registrados (dev, staging, production, etc.)' },
          { name: 'projects', type: 'tabela', required: false, description: 'Projetos e suas configurações' },
          { name: 'rotation_history', type: 'tabela', required: false, description: 'Histórico de rotações de segredos' },
          { name: 'audit_log', type: 'tabela', required: false, description: 'Log de auditoria de operações' },
        ]}
      />

      {/* ── MASTER PASSWORD ─────────────────────────────────── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">Senha Mestra</h2>
      <p className="mb-4">
        A senha mestra é usada para derivar a chave de criptografia do vault
        usando PBKDF2 com 600.000 iterações. Ela nunca é armazenada em disco —
        é mantida em memória apenas durante a sessão.
      </p>

      <Steps>
        <Step title="Derivação de Chave">
          A senha é processada com PBKDF2-SHA512 usando um salt único gerado
          durante o <InlineCode>init</InlineCode>. O resultado é uma chave
          AES-256 de 32 bytes.
        </Step>
        <Step title="Desbloqueio do Vault">
          A cada operação que acessa o vault, o CLI solicita a senha mestra
          (a menos que a sessão esteja em cache). A senha é validada contra um
          hash armazenado no banco.
        </Step>
        <Step title="Cache de Sessão">
          Por padrão, a sessão fica em cache por 15 minutos após o último uso.
          O timeout pode ser configurado no <InlineCode>config.toml</InlineCode>.
        </Step>
      </Steps>

      <CodeBlock
        language="bash"
        code={`# Alterar a senha mestra
criptenv init --force

# Limpar cache de sessão (força nova solicitação de senha)
criptenv logout`}
      />

      {/* ── ENVIRONMENT VARIABLES ───────────────────────────── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Variáveis de Ambiente
      </h2>
      <p className="mb-4">
        Todas as opções do CLI podem ser controladas via variáveis de ambiente
        com o prefixo <InlineCode>CRIPTENV_</InlineCode>. Variáveis têm
        prioridade sobre o arquivo de configuração.
      </p>
      <ParamTable
        title="Variáveis de Ambiente"
        rows={[
          { name: 'CRIPTENV_HOME', type: 'string', required: false, description: 'Diretório base (padrão: ~/.criptenv)' },
          { name: 'CRIPTENV_MASTER_PASSWORD', type: 'string', required: false, description: 'Senha mestra (não recomendado para produção)' },
          { name: 'CRIPTENV_SESSION_TIMEOUT', type: 'number', required: false, description: 'Timeout de sessão em segundos (padrão: 900)' },
          { name: 'CRIPTENV_DEFAULT_ENV', type: 'string', required: false, description: 'Ambiente padrão (padrão: development)' },
          { name: 'CRIPTENV_DEFAULT_PROJECT', type: 'string', required: false, description: 'Projeto padrão' },
          { name: 'CRIPTENV_API_URL', type: 'string', required: false, description: 'URL da API (padrão: https://criptenv-api.77mdevseven.tech)' },
          { name: 'CRIPTENV_NO_COLOR', type: 'boolean', required: false, description: 'Desabilita cores no output' },
          { name: 'CRIPTENV_LOG_LEVEL', type: 'string', required: false, description: 'Nível de log: debug, info, warn, error' },
          { name: 'CRIPTENV_CI', type: 'boolean', required: false, description: 'Habilita modo CI/CD (desabilita interações)' },
        ]}
      />

      <CodeBlock
        language="bash"
        code={`# Exemplo: usar o CriptEnv em um script com sessão de 30 minutos
export CRIPTENV_SESSION_TIMEOUT=1800
export CRIPTENV_DEFAULT_ENV=production

criptenv get DATABASE_URL`}
      />

      <Callout type="warning">
        Evite definir <InlineCode>CRIPTENV_MASTER_PASSWORD</InlineCode> em
        variáveis de ambiente em servidores compartilhados. Prefira a leitura
        interativa da senha.
      </Callout>

      {/* ── CONFIG FILE ─────────────────────────────────────── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Arquivo de Configuração
      </h2>
      <p className="mb-4">
        O arquivo <InlineCode>~/.criptenv/config.toml</InlineCode> permite
        personalizar o comportamento do CLI. Todas as opções possuem valores
        padrão sensatos.
      </p>

      <CodeBlock
        language="toml"
        code={`# ~/.criptenv/config.toml

[general]
# Ambiente padrão ao omitir --env
default_env = "development"
# Projeto padrão ao omitir --project
default_project = ""
# Timeout de sessão em segundos
session_timeout = 900
# Modo de output: text, json
output_mode = "text"

[security]
# Iterações do PBKDF2 (padrão: 600000)
pbkdf2_iterations = 600000
# Algoritmo de criptografia (não alterar)
algorithm = "AES-256-GCM"

[cloud]
# URL da API do CriptEnv
api_url = "https://criptenv-api.77mdevseven.tech"
# Timeout de requisições em segundos
request_timeout = 30

[alerts]
# Alertar N dias antes da expiração
default_alert_days = 7
# Canais de alerta: email, slack, webhook
channels = ["email"]

[logs]
# Nível de log: debug, info, warn, error
level = "info"
# Reter logs por N dias
retention_days = 30`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">Opções de Configuração</h3>

      <ParamTable
        title="[general]"
        rows={[
          { name: 'default_env', type: 'string', required: false, description: 'Ambiente padrão (development)' },
          { name: 'default_project', type: 'string', required: false, description: 'Projeto padrão' },
          { name: 'session_timeout', type: 'number', required: false, description: 'Timeout de sessão em segundos (900)' },
          { name: 'output_mode', type: 'string', required: false, description: 'Modo de saída: text ou json' },
        ]}
      />

      <ParamTable
        title="[security]"
        rows={[
          { name: 'pbkdf2_iterations', type: 'number', required: false, description: 'Iterações do PBKDF2 (600000)' },
          { name: 'algorithm', type: 'string', required: false, description: 'Algoritmo de criptografia (AES-256-GCM)' },
        ]}
      />

      <ParamTable
        title="[cloud]"
        rows={[
          { name: 'api_url', type: 'string', required: false, description: 'URL da API (https://criptenv-api.77mdevseven.tech)' },
          { name: 'request_timeout', type: 'number', required: false, description: 'Timeout de requisições em segundos (30)' },
        ]}
      />

      <ParamTable
        title="[alerts]"
        rows={[
          { name: 'default_alert_days', type: 'number', required: false, description: 'Dias de antecedência para alertas (7)' },
          { name: 'channels', type: 'array', required: false, description: 'Canais de alerta: email, slack, webhook' },
        ]}
      />

      <ParamTable
        title="[logs]"
        rows={[
          { name: 'level', type: 'string', required: false, description: 'Nível de log: debug, info, warn, error' },
          { name: 'retention_days', type: 'number', required: false, description: 'Dias de retenção dos logs (30)' },
        ]}
      />

      <Callout type="info">
        Variáveis de ambiente com prefixo <InlineCode>CRIPTENV_</InlineCode>{' '}
        sempre sobrescrevem os valores do arquivo de configuração. Use{' '}
        <InlineCode>criptenv doctor</InlineCode> para verificar a configuração
        efetiva.
      </Callout>
    </div>
  );
}
