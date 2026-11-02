'use client';

import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation"
import {
  CodeBlock,
  DocCard,
  CardGrid,
  Callout,
  Breadcrumb,
} from '@/components/docs';

export default function CliOverviewPage() {
  const t = useTranslations('docs.cli.overview');
  const tRoot = useTranslations('docs');
  return (
    <div className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: 'CLI', href: '/docs/cli' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-2">CriptEnv CLI</h1>
      <p className="text-lg text-muted-foreground mb-8">
        {t('description')}
      </p>

      <h2 className="text-2xl font-semibold mb-4">{t('philosophy.title')}</h2>

      <CardGrid>
        <DocCard
          title={t('philosophy.terminal.title')}
          description={t('philosophy.terminal.description')}
        />
        <DocCard
          title={t('philosophy.zk.title')}
          description={t('philosophy.zk.description')}
        />
        <DocCard
          title={t('philosophy.remote.title')}
          description={t('philosophy.remote.description')}
        />
      </CardGrid>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('features.title')}</h2>

      <CardGrid>
        <DocCard
          title={t('features.secrets.title')}
          description={t('features.secrets.description')}
          href="/docs/cli/commands#secrets"
        />
        <DocCard
          title={t('features.sync.title')}
          description={t('features.sync.description')}
          href="/docs/cli/commands#sync"
        />
        <DocCard
          title={t('features.environments.title')}
          description={t('features.environments.description')}
          href="/docs/cli/commands#environments"
        />
        <DocCard
          title={t('features.cicd.title')}
          description={t('features.cicd.description')}
          href="/docs/cli/commands#cicd"
        />
        <DocCard
          title={t('features.integrations.title')}
          description={t('features.integrations.description')}
          href="/docs/cli/commands#integrations"
        />
        <DocCard
          title={t('features.rotation.title')}
          description={t('features.rotation.description')}
          href="/docs/cli/commands#maintenance"
        />
      </CardGrid>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('install.title')}</h2>

      <CodeBlock
        language="bash"
        code={`# Install with pip
pip install criptenv

# Authenticate the CLI
criptenv login --email-address you@example.com`}
      />

      <Callout variant="info">
        {t('install.requirements')}
      </Callout>

      <Callout variant="info">
        {t.rich('install.after', {
          commands: (chunks) => (
            <Link href="/docs/cli/commands" className="underline font-medium">
              {chunks}
            </Link>
          ),
          configuration: (chunks) => (
            <Link href="/docs/cli/configuration" className="underline font-medium">
              {chunks}
            </Link>
          ),
        })}
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('next.title')}</h2>

      <CardGrid>
        <DocCard
          title={t('next.commands.title')}
          description={t('next.commands.description')}
          href="/docs/cli/commands"
        />
        <DocCard
          title={t('next.configuration.title')}
          description={t('next.configuration.description')}
          href="/docs/cli/configuration"
        />
      </CardGrid>
    </div>
  );
}
