'use client';

import {
  CodeBlock,
  InlineCode,
  Callout,
  ParamTable,
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
      <CodeBlock
        language="bash"
        code={`criptenv init`}
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
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv login
criptenv login --email user@example.com`}
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
        Criptografa e armazena um segredo no vault local. Use a sintaxe{' '}
        <InlineCode>KEY=value</InlineCode>.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY=value', type: 'string', required: true, description: 'Chave e valor do segredo' },
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente de destino' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto de destino' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv set DATABASE_URL=postgres://user:pass@host/db
criptenv set API_KEY=your_api_key_here -e staging`}
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
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente de origem' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto de origem' },
          { name: '--clipboard, -c', type: 'boolean', required: false, description: 'Copia o valor para a área de transferência' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv get DATABASE_URL
criptenv get API_KEY -e production -c`}
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
          { name: '--env, -e', type: 'string', required: false, description: 'Filtrar por ambiente' },
          { name: '--project, -p', type: 'string', required: false, description: 'Filtrar por projeto' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv list
criptenv list -e production`}
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
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente de origem' },
          { name: '--force, -f', type: 'boolean', required: false, description: 'Pula confirmação' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv delete OLD_API_KEY
criptenv delete DB_PASS -e staging -f`}
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
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente' },
          { name: '--value, -v', type: 'string', required: false, description: 'Novo valor (auto-gerado se omitido)' },
          { name: '--force, -f', type: 'boolean', required: false, description: 'Pula confirmação' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv rotate API_KEY
criptenv rotate DB_PASS -e production -v newSecurePass123`}
      />

      {/* ── SYNC ────────────────────────────────────────────── */}
      <h2 id="sync" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Sincronização
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv push</InlineCode>
      </h3>
      <p className="mb-4">
        Envia o vault local criptografado para a nuvem.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto específico' },
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente específico' },
          { name: '--force', type: 'boolean', required: false, description: 'Sobrescreve sem perguntar' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv push -p <project-id>
criptenv push -e production -p <project-id>`}
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
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto específico' },
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente específico' },
          { name: '--force', type: 'boolean', required: false, description: 'Sobrescreve segredos locais' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv pull -p <project-id>
criptenv pull -e production -p <project-id> --force`}
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
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente de destino' },
          { name: '--overwrite', type: 'boolean', required: false, description: 'Sobrescreve chaves existentes' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv import .env
criptenv import .env.production -e production
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
          { name: '--format', type: 'string', required: false, description: 'Formato: env (padrão) ou json' },
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente de origem' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto de origem' },
          { name: '--output, -o', type: 'string', required: false, description: 'Arquivo de saída (padrão: stdout)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv export
criptenv export --format json -o secrets.json
criptenv export -e production -o .env.production`}
      />

      {/* ── ENVIRONMENTS ────────────────────────────────────── */}
      <h2 id="environments" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Ambientes
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv env list</InlineCode>
      </h3>
      <p className="mb-4">
        Lista todos os ambientes do projeto.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--project, -p', type: 'string', required: false, description: 'Filtrar por projeto' },
        ]}
      />
      <CodeBlock language="bash" code="criptenv env list\ncriptenv env list -p <project-id>" />

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
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto ao qual pertence' },
          { name: '--display-name, -d', type: 'string', required: false, description: 'Nome legível para humanos' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv env create staging -p <project-id>
criptenv env create production -p <project-id> -d "Production Environment"`}
      />

      {/* ── PROJECTS ────────────────────────────────────────── */}
      <h2 id="projects" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Projetos
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv projects create</InlineCode>
      </h3>
      <p className="mb-4">
        Cria um novo projeto com senha de vault.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'NAME', type: 'string', required: true, description: 'Nome do projeto' },
          { name: '--slug', type: 'string', required: false, description: 'Slug opcional do projeto' },
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
          { name: '--token', type: 'string', required: true, description: 'Token de CI/CD (começa com ci_)' },
          { name: '--project', type: 'string', required: false, description: 'ID do projeto' },
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
        Lista segredos disponíveis no contexto de CI.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente (padrão: production)' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv ci secrets -e production`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv ci deploy</InlineCode>
      </h3>
      <p className="mb-4">
        Faz push dos segredos locais para a nuvem no contexto de CI.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente de deploy' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv ci deploy -e production -p <project-id>`}
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
          <CodeBlock language="bash" code="criptenv ci tokens list" />
        </Tab>
        <Tab value="create" label="create">
          <p className="mb-2">Cria um novo token de CI/CD.</p>
          <ParamTable
            title="Opções"
            rows={[
              { name: '--name', type: 'string', required: true, description: 'Nome do token' },
              { name: '--env', type: 'string', required: false, description: 'Ambiente permitido' },
            ]}
          />
          <CodeBlock
            language="bash"
            code={`criptenv ci tokens create --name "GitHub Actions"`}
          />
        </Tab>
        <Tab value="revoke" label="revoke">
          <p className="mb-2">Revoga um token de CI/CD.</p>
          <ParamTable
            title="Opções"
            rows={[
              { name: 'TOKEN_ID', type: 'string', required: true, description: 'ID do token a revogar' },
            ]}
          />
          <CodeBlock language="bash" code="criptenv ci tokens revoke <token-id>" />
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
        Lista integrações de provedores de nuvem conectadas.
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
          { name: 'PROVIDER', type: 'string', required: true, description: 'Provedor: vercel ou render' },
          { name: '--token', type: 'string', required: false, description: 'Token de API do provedor' },
          { name: '--name', type: 'string', required: false, description: 'Nome da integração' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv integrations connect vercel
criptenv integrations connect render --token <render-api-key>`}
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
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente a sincronizar' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv integrations sync vercel -e production
criptenv integrations sync render -e production`}
      />

      {/* ── MAINTENANCE ─────────────────────────────────────── */}
      <h2 id="maintenance" className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
        Manutenção
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv secrets expire</InlineCode>
      </h3>
      <p className="mb-4">
        Define a data de expiração de um segredo.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY', type: 'string', required: true, description: 'Nome do segredo' },
          { name: '--days, -d', type: 'int', required: true, description: 'Dias até expiração' },
          { name: '--policy', type: 'string', required: false, description: 'Política: manual, notify (padrão), auto' },
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv secrets expire API_KEY --days 90
criptenv secrets expire DB_PASS --days 30 --policy auto -e production`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv secrets alert</InlineCode>
      </h3>
      <p className="mb-4">
        Configura alertas de expiração para um segredo.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY', type: 'string', required: true, description: 'Nome do segredo' },
          { name: '--days, -d', type: 'int', required: true, description: 'Dias antes da expiração para alertar' },
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv secrets alert API_KEY --days 30
criptenv secrets alert DB_PASS --days 14 -e staging`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv rotation list</InlineCode>
      </h3>
      <p className="mb-4">
        Lista segredos com rotação pendente.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: '--env, -e', type: 'string', required: false, description: 'Filtrar por ambiente' },
          { name: '--project, -p', type: 'string', required: false, description: 'Filtrar por projeto' },
          { name: '--days, -d', type: 'int', required: false, description: 'Dias à frente para verificar (padrão: 30)' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv rotation list
criptenv rotation list --days 7 -e production`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">
        <InlineCode>criptenv rotation history</InlineCode>
      </h3>
      <p className="mb-4">
        Mostra o histórico de rotações de um segredo.
      </p>
      <ParamTable
        title="Opções"
        rows={[
          { name: 'KEY', type: 'string', required: true, description: 'Nome do segredo' },
          { name: '--env, -e', type: 'string', required: false, description: 'Ambiente' },
          { name: '--project, -p', type: 'string', required: false, description: 'Projeto' },
        ]}
      />
      <CodeBlock
        language="bash"
        code={`criptenv rotation history API_KEY
criptenv rotation history DB_PASS -e staging`}
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
