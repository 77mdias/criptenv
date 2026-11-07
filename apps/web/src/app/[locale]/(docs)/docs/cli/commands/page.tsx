'use client';

import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation"
import {
  CodeBlock,
  InlineCode,
  Callout,
  ParamTable,
  Breadcrumb,
} from '@/components/docs';

type Param = readonly [name: string, type: string, required: boolean];

interface Command {
  /** i18n key under `docs.cli.commands.items` */
  key: string;
  name: string;
  params?: readonly Param[];
  code: string;
  /** Renders `items.<key>.note` as an info callout. */
  note?: boolean;
}

// Literal list so the i18n auditor can resolve the dynamic `items.${key}` lookups.
// Option names and examples mirror apps/cli/src/criptenv/commands/*.py.
export const SECTIONS = [
  {
    id: 'core',
    commands: [
      { key: 'init', name: 'criptenv init', code: 'criptenv init' },
      {
        key: 'login',
        name: 'criptenv login',
        params: [
          ['--email-address', 'string', false],
          ['--email', 'boolean', false],
          ['--device', 'boolean', false],
          ['--api-key', 'string', false],
        ],
        code: `criptenv login
criptenv login --email-address user@example.com
CRIPTENV_API_KEY=cek_xxx criptenv login`,
      },
      { key: 'logout', name: 'criptenv logout', code: 'criptenv logout' },
      { key: 'doctor', name: 'criptenv doctor', code: 'criptenv doctor' },
    ],
  },
  {
    id: 'secrets',
    commands: [
      {
        key: 'set',
        name: 'criptenv set',
        params: [['KEY=value', 'string', true], ['--env, -e', 'string', false], ['--project, -p', 'string', false], ['--secret / --config', 'boolean', false]],
        code: `criptenv set DATABASE_URL=postgres://user:pass@host/db
criptenv set API_KEY=your_api_key_here -e staging
criptenv set STRIPE_SECRET_KEY=sk_live_xxx --secret`,
      },
      {
        key: 'get',
        name: 'criptenv get',
        params: [['KEY', 'string', true], ['--env, -e', 'string', false], ['--project, -p', 'string', false], ['--clipboard, -c', 'boolean', false]],
        code: `criptenv get DATABASE_URL
criptenv get API_KEY -e production -c`,
      },
      {
        key: 'list',
        name: 'criptenv list',
        params: [['--env, -e', 'string', false], ['--project, -p', 'string', false]],
        code: `criptenv list
criptenv list -e production`,
      },
      {
        key: 'delete',
        name: 'criptenv delete',
        params: [['KEY', 'string', true], ['--env, -e', 'string', false], ['--force, -f', 'boolean', false]],
        code: `criptenv delete OLD_API_KEY
criptenv delete DB_PASS -e staging -f`,
      },
      {
        key: 'rotate',
        name: 'criptenv rotate',
        params: [['KEY', 'string', true], ['--env, -e', 'string', false], ['--value, -v', 'string', false], ['--force, -f', 'boolean', false]],
        code: `criptenv rotate API_KEY
criptenv rotate DB_PASS -e production -v newSecurePass123`,
      },
    ],
  },
  {
    id: 'sync',
    commands: [
      {
        key: 'push',
        name: 'criptenv push',
        params: [['FILE', 'string', true], ['--project, -p', 'string', false], ['--env, -e', 'string', false], ['--overwrite', 'boolean', false]],
        code: `criptenv push .env -p <project-id>
criptenv push .env.production -e production -p <project-id> --overwrite`,
      },
      {
        key: 'pull',
        name: 'criptenv pull',
        params: [['--project, -p', 'string', false], ['--env, -e', 'string', false], ['--output, -o', 'string', true], ['--format', 'string', false]],
        code: `criptenv pull -p <project-id> --output .env
criptenv pull -e production -p <project-id> -o .env.production`,
      },
    ],
  },
  {
    id: 'data',
    commands: [
      {
        key: 'import',
        name: 'criptenv import',
        params: [['FILE', 'string', true], ['--env, -e', 'string', false], ['--project, -p', 'string', false], ['--overwrite', 'boolean', false]],
        code: `criptenv import .env
criptenv import .env.production -e production
criptenv import secrets.env --overwrite`,
      },
      {
        key: 'export',
        name: 'criptenv export',
        params: [['--format', 'string', false], ['--env, -e', 'string', false], ['--project, -p', 'string', false], ['--output, -o', 'string', false]],
        code: `criptenv export
criptenv export --format json -o secrets.json
criptenv export -e production -o .env.production`,
      },
      {
        key: 'run',
        name: 'criptenv run',
        params: [['--env, -e', 'string', false], ['--project, -p', 'string', false]],
        code: `criptenv run -- npm start
criptenv run -e staging -- python manage.py migrate`,
      },
      {
        key: 'diff',
        name: 'criptenv diff',
        params: [['--env, -e', 'string', false], ['--project, -p', 'string', false], ['--show-values', 'boolean', false]],
        code: `criptenv diff .env
criptenv diff .env -e production --show-values`,
      },
    ],
  },
  {
    id: 'environments',
    commands: [
      {
        key: 'envList',
        name: 'criptenv env list',
        params: [['--project, -p', 'string', false]],
        code: `criptenv env list
criptenv env list -p <project-id>`,
      },
      {
        key: 'envCreate',
        name: 'criptenv env create',
        params: [['NAME', 'string', true], ['--project, -p', 'string', false], ['--display-name, -d', 'string', false]],
        code: `criptenv env create staging -p <project-id>
criptenv env create production -p <project-id> -d "Production Environment"`,
      },
    ],
  },
  {
    id: 'projects',
    commands: [
      {
        key: 'projectsCreate',
        name: 'criptenv projects create',
        params: [['NAME', 'string', true], ['--slug', 'string', false], ['--description', 'string', false]],
        code: `criptenv projects create my-site
criptenv projects create my-site --description "My Site backend"`,
      },
      { key: 'projectsList', name: 'criptenv projects list', code: 'criptenv projects list' },
    ],
  },
  {
    id: 'cicd',
    commands: [
      {
        key: 'ciLogin',
        name: 'criptenv ci login',
        params: [['--token', 'string', true], ['--project', 'string', false]],
        code: 'criptenv ci login --token $CI_TOKEN',
      },
      { key: 'ciLogout', name: 'criptenv ci logout', code: 'criptenv ci logout' },
      {
        key: 'ciSecrets',
        name: 'criptenv ci secrets',
        params: [['--env', 'string', true]],
        code: 'criptenv ci secrets --env production',
      },
      {
        key: 'ciDeploy',
        name: 'criptenv ci deploy',
        note: true,
        params: [['--file, -f', 'string', true], ['--env', 'string', true], ['--dry-run', 'boolean', false], ['--provider', 'string', false], ['--target', 'string', false]],
        code: `CRIPTENV_VAULT_PASSWORD="$VAULT_PASSWORD" criptenv ci deploy --file .env.production --env production
# Then push the whole environment to a connected provider
CRIPTENV_VAULT_PASSWORD="$VAULT_PASSWORD" criptenv ci deploy --file .env.production --env production --provider vercel`,
      },
      {
        key: 'ciTokensList',
        name: 'criptenv ci tokens list',
        params: [['--project, -p', 'string', false], ['--include-revoked', 'boolean', false]],
        code: 'criptenv ci tokens list -p <project-id>',
      },
      {
        key: 'ciTokensCreate',
        name: 'criptenv ci tokens create',
        params: [['--name', 'string', true], ['--scopes', 'string', false], ['--environment', 'string', false], ['--expires-in', 'int', false], ['--project, -p', 'string', false]],
        code: `criptenv ci tokens create --name "GitHub Actions"
# For ci deploy: write access, restricted to one environment
criptenv ci tokens create --name "Deploy" --scopes read:secrets,write:secrets --environment production`,
      },
      {
        key: 'ciTokensRevoke',
        name: 'criptenv ci tokens revoke',
        params: [['TOKEN_ID', 'string', true]],
        code: 'criptenv ci tokens revoke <token-id>',
      },
    ],
  },
  {
    id: 'integrations',
    commands: [
      {
        key: 'integrationsList',
        name: 'criptenv integrations list',
        params: [['--project, -p', 'string', false]],
        code: 'criptenv integrations list',
      },
      {
        key: 'integrationsConnect',
        name: 'criptenv integrations connect',
        params: [['PROVIDER', 'string', true], ['--token', 'string', false], ['--name', 'string', false], ['--project-id', 'string', false], ['--project', 'string', false], ['--team-id', 'string', false], ['--account-id', 'string', false]],
        code: `criptenv integrations connect vercel --project-id <project> --team-id <team-id>
criptenv integrations connect render --token <render-api-key> --project-id <srv-id>
criptenv integrations connect cloudflare --account-id <account-id> --project-id <worker-name>`,
      },
      {
        key: 'integrationsDisconnect',
        name: 'criptenv integrations disconnect',
        params: [['INTEGRATION_ID', 'string', true], ['--project', 'string', false], ['--force', 'boolean', false]],
        code: 'criptenv integrations disconnect <integration-id>',
      },
      {
        key: 'integrationsValidate',
        name: 'criptenv integrations validate',
        params: [['INTEGRATION_ID', 'string', true], ['--project', 'string', false]],
        code: 'criptenv integrations validate <integration-id>',
      },
      {
        key: 'integrationsSync',
        name: 'criptenv integrations sync',
        params: [['--provider', 'string', true], ['--env', 'string', false], ['--direction', 'string', false], ['--project', 'string', false], ['--target', 'string', false], ['--integration', 'string', false], ['--overwrite', 'boolean', false]],
        code: `criptenv integrations sync --provider vercel --env production
criptenv integrations sync --provider vercel --env staging --target preview
criptenv integrations sync --provider render --env production --direction pull`,
      },
    ],
  },
  {
    id: 'maintenance',
    commands: [
      {
        key: 'secretsExpire',
        name: 'criptenv secrets expire',
        params: [['KEY', 'string', true], ['--days, -d', 'int', true], ['--policy', 'string', false], ['--env, -e', 'string', false], ['--project, -p', 'string', false]],
        code: `criptenv secrets expire API_KEY --days 90
criptenv secrets expire DB_PASS --days 30 --policy auto -e production`,
      },
      {
        key: 'secretsAlert',
        name: 'criptenv secrets alert',
        params: [['KEY', 'string', true], ['--days, -d', 'int', true], ['--env, -e', 'string', false], ['--project, -p', 'string', false]],
        code: `criptenv secrets alert API_KEY --days 30
criptenv secrets alert DB_PASS --days 14 -e staging`,
      },
      {
        key: 'rotationList',
        name: 'criptenv rotation list',
        params: [['--env, -e', 'string', false], ['--project, -p', 'string', false], ['--days, -d', 'int', false]],
        code: `criptenv rotation list
criptenv rotation list --days 7 -e production`,
      },
      {
        key: 'rotationHistory',
        name: 'criptenv rotation history',
        params: [['KEY', 'string', true], ['--env, -e', 'string', false], ['--project, -p', 'string', false]],
        code: `criptenv rotation history API_KEY
criptenv rotation history DB_PASS -e staging`,
      },
    ],
  },
] as const satisfies readonly { id: string; commands: readonly Command[] }[];

export default function CliCommandsPage() {
  const t = useTranslations('docs.cli.commands');
  const tRoot = useTranslations('docs');
  const code = (chunks: React.ReactNode) => <InlineCode>{chunks}</InlineCode>;

  return (
    <div className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'CLI', href: '/docs/cli' },
          { label: t('breadcrumb'), href: '/docs/cli/commands' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-2">{t('title')}</h1>
      <p className="text-lg text-muted-foreground mb-8">{t('description')}</p>

      {SECTIONS.map((section) => (
        <section key={section.id}>
          <h2 id={section.id} className="text-2xl font-semibold mt-12 mb-4 scroll-mt-20">
            {t(`sections.${section.id}`)}
          </h2>

          {section.commands.map((command: Command) => (
            <div key={command.key}>
              <h3 className="text-xl font-semibold mt-8 mb-3">
                <InlineCode>{command.name}</InlineCode>
              </h3>
              <p className="mb-4">{t.rich(`items.${command.key}.description`, { code })}</p>
              {command.note && (
                <Callout variant="info">{t.rich(`items.${command.key}.note`, { code })}</Callout>
              )}
              {command.params && (
                <ParamTable
                  title={t('options')}
                  rows={command.params.map(([name, type, required], i) => ({
                    name,
                    type,
                    required,
                    description: t(`items.${command.key}.params.${i}`),
                  }))}
                />
              )}
              <CodeBlock language="bash" code={command.code} />
            </div>
          ))}
        </section>
      ))}

      <Callout variant="info">
        {t.rich('configurationLink', {
          link: (chunks) => (
            <Link href="/docs/cli/configuration" className="underline font-medium">
              {chunks}
            </Link>
          ),
        })}
      </Callout>
    </div>
  );
}
