'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function TeamSetupPage() {
  const t = useTranslations('docs.guides.teamSetup');
  const tRoot = useTranslations('docs');
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('guides.overview.title'), href: '/docs/guides' },
          { label: t('title'), href: '/docs/guides/team-setup' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        {t('title')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('invite.title')}</h2>

      <Steps>
        <Step title={t('invite.step1.title')}>
          <p className="text-muted-foreground">
            {t.rich('invite.step1.body', { strong })}
          </p>
        </Step>

        <Step title={t('invite.step2.title')}>
          <p className="text-muted-foreground">
            {t.rich('invite.step2.body', { strong })}
          </p>
          <CodeBlock language="text" title={t('invite.step2.codeTitle')}>
{`Email: dev@company.com
Role: Developer
Projects: my-app, api-gateway`}
          </CodeBlock>
        </Step>

        <Step title={t('invite.step3.title')}>
          <p className="text-muted-foreground">
            {t('invite.step3.body')}
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('roles.title')}</h2>
      <p className="text-muted-foreground mb-4">
        {t('roles.body')}
      </p>

      <div className="border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">{t('roles.role')}</th>
              <th className="text-left p-3 font-medium">{t('roles.view')}</th>
              <th className="text-left p-3 font-medium">{t('roles.edit')}</th>
              <th className="text-left p-3 font-medium">{t('roles.manageTeam')}</th>
              <th className="text-left p-3 font-medium">{t('roles.settings')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3 font-medium">Owner</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3 font-medium">Admin</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">❌</td>
            </tr>
            <tr className="border-t">
              <td className="p-3 font-medium">Developer</td>
              <td className="p-3">✅</td>
              <td className="p-3">❌</td>
              <td className="p-3">❌</td>
              <td className="p-3">❌</td>
            </tr>
            <tr className="border-t">
              <td className="p-3 font-medium">Viewer</td>
              <td className="p-3">✅</td>
              <td className="p-3">❌</td>
              <td className="p-3">❌</td>
              <td className="p-3">❌</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mb-6">{t('roles.restricted')}</p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('perProject.title')}
      </h2>
      <p className="text-muted-foreground mb-4">
        {t('perProject.body')}
      </p>
      <CodeBlock language="text" title={t('perProject.codeTitle')}>
{`Member: dev@company.com
├── my-app          → Developer
├── api-gateway     → Developer
└── infra-secrets   → Viewer`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('cli.title')}
      </h2>
      <CodeBlock language="bash" title={t('cli.codeTitle')}>
{`# List project members
criptenv members list -p <project-id>

# Invite a new member by email
criptenv invites create dev@company.com --role developer -p <project-id>

# Change a member's role (member ID from \`members list\`)
criptenv members update <member-id> --role admin -p <project-id>

# Remove a member
criptenv members remove <member-id> -p <project-id>`}
      </CodeBlock>

      <Callout variant="tip">
        {t('leastPrivilege')}
      </Callout>

      <Callout variant="warning">
        {t.rich('ownerWarning', { strong })}
      </Callout>
    </div>
  );
}
