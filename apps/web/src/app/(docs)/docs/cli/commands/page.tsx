'use client';

import {
  CodeBlock,
  InlineCode,
  Callout,
  ParamTable,
  Steps,
  Step,
  Tabs,
  Tab,
  Breadcrumb,
} from '@/components/docs';

export default function CliCommandsPage() {
  return (
    <div className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'CLI', href: '/docs/cli' },
          { label: 'Comandos', href: '/docs/cli/commands' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-2">Referência de Comandos</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Documentação completa de todos os comandos do CriptEnv CLI, organizados
        por categoria.
      </p>

      {/* ── CORE ────────────────────────────────────────────── */}
      <h2 id="core" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Comandos Core
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv init</InlineCode>
      </h3>
      <p className="mb-4">
        Inicializa o diretório <InlineCode>~/.criptenv/</InlineCode>, cria o banco de dados
        SQLite (<InlineCode>vault.db</InlineCode>) e configura a senha mestra.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--force', type: 'boolean', required: false, description: 'Sobrescreve a configuração existente' },
          { name: '--no-password', type: 'boolean', required: false, description: 'Inicializa sem senha mestra (não recomendado)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv init
criptenv init --force`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv login</InlineCode>
      </h3>
      <p className="mb-4">
        Autentica com a conta CriptEnv. Armazena o token de sessão localmente.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--email', type: 'string', required: false, description: 'E-mail da conta' },
          { name: '--token', type: 'string', required: false, description: 'Token de API (para scripts)' },
          { name: '--browser', type: 'boolean', required: false, description: 'Abre navegador para OAuth (padrão)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv login
criptenv login --email user@example.com
criptenv login --token YOUR_API_TOKEN`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv logout</InlineCode>
      </h3>
      <p className="mb-4">
        Encerra a sessão atual e remove o token armazenado localmente.
      </p>
      <CodeBlock language="bash" code="criptenv logout" />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv doctor</InlineCode>
      </h3>
      <p className="mb-4">
        Verifica a integridade da configuração local: banco de dados, permissões,
        conectividade e versão do CLI.
      </p>
      <CodeBlock language="bash" code="criptenv doctor" />

      {/* ── SECRETS ─────────────────────────────────────────── */}
      <h2 id="secrets" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Segredos
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv set</InlineCode>
      </h3>
      <p className="mb-4">
        Criptografa e armazena um segredo no vault local. Suporta sintaxe{' '}
        <InlineCode>KEY=value</InlineCode> ou leitura interativa.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY=value', type: 'string', required: true, description: 'Chave e valor do segredo' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente de destino (padrão: development)' },
          { name: '--project', type: 'string', required: false, description: 'Projeto de destino' },
          { name: '--expires', type: 'string', required: false, description: 'Duração até expiração (ex: 30d, 1y)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv set DATABASE_URL=postgres://user:pass@host/db
criptenv set API_KEY --env production
criptenv set SECRET_TOKEN=s3cret --expires 90d`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv get</InlineCode>
      </h3>
      <p className="mb-4">
        Descriptografa e exibe o valor de um segredo.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY', type: 'string', required: true, description: 'Nome do segredo' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente de origem (padrão: development)' },
          { name: '--project', type: 'string', required: false, description: 'Projeto de origem' },
          { name: '--copy', type: 'boolean', required: false, description: 'Copia o valor para a área de transferência' },
          { name: '--version', type: 'number', required: false, description: 'Versão específica do segredo' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv get DATABASE_URL
criptenv get API_KEY --env production --copy
criptenv get SECRET_TOKEN --version 2`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv list</InlineCode>
      </h3>
      <p className="mb-4">
        Lista todas as chaves do vault (nunca exibe os valores).
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--env', type: 'string', required: false, description: 'Filtrar por ambiente' },
          { name: '--project', type: 'string', required: false, description: 'Filtrar por projeto' },
          { name: '--json', type: 'boolean', required: false, description: 'Saída em formato JSON' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv list
criptenv list --env production
criptenv list --json`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv delete</InlineCode>
      </h3>
      <p className="mb-4">
        Remove permanentemente um segredo do vault.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY', type: 'string', required: true, description: 'Nome do segredo a remover' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente de origem' },
          { name: '--force', type: 'boolean', required: false, description: 'Pede confirmação antes de remover' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv delete OLD_API_KEY
criptenv delete DB_PASS --env staging --force`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv rotate</InlineCode>
      </h3>
      <p className="mb-4">
        Cria uma nova versão do segredo. A versão anterior é mantida
        para referência.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY', type: 'string', required: true, description: 'Nome do segredo' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente' },
          { name: '--value', type: 'string', required: false, description: 'Novo valor (se omitido, solicita interativamente)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv rotate API_KEY
criptenv rotate DB_PASS --env production --value newSecurePass123`}
      />

      {/* ── SYNC ────────────────────────────────────────────── */}
      <h2 id="sync" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Sincronização
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv push</InlineCode>
      </h3>
      <p className="mb-4">
        Envia o vault local para a nuvem. Os dados são criptografados localmente
        antes da transmissão.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--project', type: 'string', required: false, description: 'Sincronizar projeto específico' },
          { name: '--env', type: 'string', required: false, description: 'Sincronizar ambiente específico' },
          { name: '--force', type: 'boolean', required: false, description: 'Sobrescreve conflitos sem perguntar' },
          { name: '--dry-run', type: 'boolean', required: false, description: 'Mostra o que seria enviado sem enviar' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv push
criptenv push --env production
criptenv push --dry-run`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv pull</InlineCode>
      </h3>
      <p className="mb-4">
        Baixa segredos da nuvem para o vault local.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--project', type: 'string', required: false, description: 'Projeto específico' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente específico' },
          { name: '--force', type: 'boolean', required: false, description: 'Sobrescreve segredos locais' },
          { name: '--dry-run', type: 'boolean', required: false, description: 'Mostra o que seria baixado sem baixar' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv pull
criptenv pull --env production
criptenv pull --force`}
      />

      {/* ── DATA ────────────────────────────────────────────── */}
      <h2 id="data" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Importação e Exportação
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv import</InlineCode>
      </h3>
      <p className="mb-4">
        Importa segredos de um arquivo <InlineCode>.env</InlineCode> para o vault.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'FILE', type: 'string', required: true, description: 'Caminho para o arquivo .env' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente de destino' },
          { name: '--overwrite', type: 'boolean', required: false, description: 'Sobrescreve chaves existentes' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv import .env
criptenv import .env.production --env production
criptenv import secrets.env --overwrite`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv export</InlineCode>
      </h3>
      <p className="mb-4">
        Exporta segredos do vault para um arquivo <InlineCode>.env</InlineCode> ou JSON.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--format', type: 'string', required: false, description: 'Formato de saída: env (padrão) ou json' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente de origem' },
          { name: '--project', type: 'string', required: false, description: 'Projeto de origem' },
          { name: '--output', type: 'string', required: false, description: 'Arquivo de saída (padrão: stdout)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv export
criptenv export --format json --output secrets.json
criptenv export --env production > .env.production`}
      />

      {/* ── ENVIRONMENTS ────────────────────────────────────── */}
      <h2 id="environments" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Ambientes
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv env list</InlineCode>
      </h3>
      <p className="mb-4">
        Lista todos os ambientes configurados.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--project', type: 'string', required: false, description: 'Filtrar por projeto' },
          { name: '--json', type: 'boolean', required: false, description: 'Saída em JSON' },
        ]}
      />
      <CodeBlock language="bash" code="criptenv env list" />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv env create</InlineCode>
      </h3>
      <p className="mb-4">
        Cria um novo ambiente.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'NAME', type: 'string', required: true, description: 'Nome do ambiente (ex: staging)' },
          { name: '--project', type: 'string', required: false, description: 'Projeto ao qual pertence' },
          { name: '--clone-from', type: 'string', required: false, description: 'Clonar segredos de outro ambiente' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv env create staging
criptenv env create staging --clone-from development`}
      />

      {/* ── PROJECTS ────────────────────────────────────────── */}
      <h2 id="projects" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Projetos
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv projects create</InlineCode>
      </h3>
      <p className="mb-4">
        Cria um novo projeto.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'NAME', type: 'string', required: true, description: 'Nome do projeto' },
          { name: '--description', type: 'string', required: false, description: 'Descrição do projeto' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv projects create meusite
criptenv projects create meusite --description "Backend do MeuSite"`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv projects list</InlineCode>
      </h3>
      <p className="mb-4">
        Lista todos os projetos.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--json', type: 'boolean', required: false, description: 'Saída em JSON' },
        ]}
      />
      <CodeBlock language="bash" code="criptenv projects list" />

      {/* ── CI/CD ───────────────────────────────────────────── */}
      <h2 id="cicd" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        CI/CD
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv ci login</InlineCode>
      </h3>
      <p className="mb-4">
        Autenticação headless para ambientes de CI/CD.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--token', type: 'string', required: true, description: 'Token de CI/CD' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv ci login --token $CI_TOKEN`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv ci logout</InlineCode>
      </h3>
      <p className="mb-4">
        Encerra a sessão de CI/CD.
      </p>
      <CodeBlock language="bash" code="criptenv ci logout" />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv ci secrets</InlineCode>
      </h3>
      <p className="mb-4">
        Injeta segredos como variáveis de ambiente no pipeline.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--env', type: 'string', required: false, description: 'Ambiente (padrão: production)' },
          { name: '--project', type: 'string', required: false, description: 'Projeto' },
          { name: '--format', type: 'string', required: false, description: 'Formato: dotenv, json, shell' },
          { name: '--prefix', type: 'string', required: false, description: 'Prefixo para as variáveis' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv ci secrets --env production
criptenv ci secrets --format shell --prefix APP_
eval $(criptenv ci secrets --format shell)`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv ci deploy</InlineCode>
      </h3>
      <p className="mb-4">
        Executa deploy com segredos injetados.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--env', type: 'string', required: false, description: 'Ambiente de deploy' },
          { name: '--project', type: 'string', required: false, description: 'Projeto' },
          { name: '--command', type: 'string', required: true, description: 'Comando de deploy a executar' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv ci deploy --command "npm run deploy"`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv ci tokens</InlineCode>
      </h3>
      <p className="mb-4">
        Gerencia tokens de CI/CD.
      </p>

      <Tabs defaultValue="list">
        <Tab value="list" label="list">
          <p className="mb-2">Lista todos os tokens de CI/CD.</p>
          <ParamTable
            title="Opções"
            rows={[
              { name: '--json', type: 'boolean', required: false, description: 'Saída em JSON' },
            ]}
          />
          <CodeBlock language="bash" code="criptenv ci tokens list" />
        </Tab>
        <Tab value="create" label="create">
          <p className="mb-2">Cria um novo token de CI/CD.</p>
          <ParamTable
            title="Opções"
            rows={[
              { name: '--name', type: 'string', required: true, description: 'Nome do token' },
              { name: '--expires', type: 'string', required: false, description: 'Duração (ex: 90d, 1y)' },
              { name: '--env', type: 'string', required: false, description: 'Ambiente permitido' },
              { name: '--project', type: 'string', required: false, description: 'Projeto permitido' },
            ]}
          />
          <CodeBlock
            language="bash"
            code={`criptenv ci tokens create --name "GitHub Actions" --expires 1y`}
          />
        </Tab>
        <Tab value="revoke" label="revoke">
          <p className="mb-2">Revoga um token de CI/CD.</p>
          <ParamTable
            title="Opções"
            rows={[
              { name: 'TOKEN_ID', type: 'string', required: true, description: 'ID do token a revogar' },
              { name: '--force', type: 'boolean', required: false, description: 'Pula confirmação' },
            ]}
          />
          <CodeBlock language="bash" code="criptenv ci tokens revoke tkn_abc123" />
        </Tab>
      </Tabs>

      {/* ── INTEGRATIONS ────────────────────────────────────── */}
      <h2 id="integrations" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Integrações
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv integrations list</InlineCode>
      </h3>
      <p className="mb-4">
        Lista integrações de provedores de nuvem disponíveis e conectados.
      </p>
      <CodeBlock language="bash" code="criptenv integrations list" />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv integrations connect</InlineCode>
      </h3>
      <p className="mb-4">
        Conecta um novo provedor de nuvem.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'PROVIDER', type: 'string', required: true, description: 'Provedor (aws, gcp, azure, vercel, netlify)' },
          { name: '--key', type: 'string', required: false, description: 'Chave de API do provedor' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv integrations connect vercel
criptenv integrations connect aws --key AKIA...`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv integrations disconnect</InlineCode>
      </h3>
      <p className="mb-4">
        Desconecta um provedor de nuvem.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'PROVIDER', type: 'string', required: true, description: 'Provedor a desconectar' },
          { name: '--force', type: 'boolean', required: false, description: 'Pula confirmação' },
        ]}
      />
      <CodeBlock language="bash" code="criptenv integrations disconnect vercel" />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv integrations sync</InlineCode>
      </h3>
      <p className="mb-4">
        Sincroniza segredos do CriptEnv com o provedor conectado.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'PROVIDER', type: 'string', required: true, description: 'Provedor alvo' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente a sincronizar' },
          { name: '--project', type: 'string', required: false, description: 'Projeto' },
          { name: '--dry-run', type: 'boolean', required: false, description: 'Mostra o que seria sincronizado' },
          { name: '--direction', type: 'string', required: false, description: 'push ou pull (padrão: push)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv integrations sync vercel --env production
criptenv integrations sync aws --dry-run`}
      />

      {/* ── MAINTENANCE ─────────────────────────────────────── */}
      <h2 id="maintenance" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Manutenção
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv secrets expire</InlineCode>
      </h3>
      <p className="mb-4">
        Define ou atualiza a data de expiração de um segredo.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY', type: 'string', required: true, description: 'Nome do segredo' },
          { name: '--expires', type: 'string', required: true, description: 'Duração até expiração (ex: 30d, 90d, 1y)' },
          { name: '--env', type: 'string', required: false, description: 'Ambiente' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv secrets expire API_KEY --expires 90d
criptenv secrets expire DB_PASS --expires 30d --env production`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv secrets alert</InlineCode>
      </h3>
      <p className="mb-4">
        Configura alertas de expiração para segredos.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--before', type: 'string', required: false, description: 'Alertar N dias antes da expiração (padrão: 7d)' },
          { name: '--channel', type: 'string', required: false, description: 'Canal do alerta: email, slack, webhook' },
          { name: '--webhook-url', type: 'string', required: false, description: 'URL do webhook (se canal=webhook)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv secrets alert --before 14d --channel email
criptenv secrets alert --before 7d --channel slack`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv rotation list</InlineCode>
      </h3>
      <p className="mb-4">
        Lista segredos com rotação pendente ou expirados.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--env', type: 'string', required: false, description: 'Filtrar por ambiente' },
          { name: '--project', type: 'string', required: false, description: 'Filtrar por projeto' },
          { name: '--expired', type: 'boolean', required: false, description: 'Apenas segredos já expirados' },
          { name: '--json', type: 'boolean', required: false, description: 'Saída em JSON' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv rotation list
criptenv rotation list --expired
criptenv rotation list --env production --json`}
      />

      <Callout type="info">
        Para mais detalhes sobre a configuração do CLI, consulte a{' '}
        <a href="/docs/cli/configuration" className="underline font-medium">
          página de Configuração
        </a>.
      </Callout>
    </div>
  );
}
