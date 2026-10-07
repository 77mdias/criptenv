'use client';

import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  CodeBlock,
  Callout,
  DocCard,
  CardGrid,
} from '@/components/docs';

const codeClass = "bg-muted px-1 rounded text-sm";

const conceptItems = [
  { icon: "🔒", key: "zeroKnowledge" },
  { icon: "📁", key: "projects" },
  { icon: "🌐", key: "environments" },
  { icon: "🗄️", key: "remoteVault" },
  { icon: "🔑", key: "vaultPassword" },
  { icon: "🔄", key: "importExport" },
] as const;

export default function ConceptsPage() {
  const t = useTranslations("docs.gettingStarted.concepts");
  const tRoot = useTranslations("docs");

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: tRoot("breadcrumb.docs"), href: '/docs' },
          { label: t("breadcrumb.gettingStarted"), href: '/docs/getting-started' },
          { label: t("title") },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">{t("title")}</h1>
      <p className="text-lg text-muted-foreground mb-8">{t("subtitle")}</p>

      <Callout type="info">{t("zeroKnowledgeCallout")}</Callout>

      <CardGrid columns={2} className="mt-10">
        {conceptItems.map((item) => (
          <DocCard
            key={item.key}
            icon={item.icon}
            title={t(`cards.${item.key}.title`)}
            description={t(`cards.${item.key}.description`)}
          />
        ))}
      </CardGrid>

      <h2 className="text-2xl font-bold mt-14 mb-4">{t("howItWorks.title")}</h2>
      <ol className="list-decimal pl-6 space-y-3 text-muted-foreground mb-6">
        <li>
          {t.rich("howItWorks.step1", {
            code: (chunks) => <code className={codeClass}>{chunks}</code>,
          })}
        </li>
        <li>{t("howItWorks.step2")}</li>
        <li>{t("howItWorks.step3")}</li>
        <li>{t("howItWorks.step4")}</li>
      </ol>
      <Callout type="tip">{t("vaultPasswordLostTip")}</Callout>

      <h2 className="text-2xl font-bold mt-14 mb-4">{t("projects.title")}</h2>
      <p className="text-muted-foreground mb-4">{t("projects.text")}</p>
      <CodeBlock
        language="bash"
        code={`criptenv projects create meu-app
criptenv env create staging -p <project-id>
criptenv set DATABASE_URL="postgres://prod/db" -p <project-id> -e production
criptenv list -p <project-id> -e production`}
      />

      <h2 className="text-2xl font-bold mt-14 mb-4">{t("remoteCli.title")}</h2>
      <p className="text-muted-foreground mb-4">{t("remoteCli.text")}</p>
      <CodeBlock
        language="bash"
        code={`criptenv get API_KEY -p <project-id> -e production
criptenv rotate API_KEY -p <project-id> -e production`}
      />

      <h2 className="text-2xl font-bold mt-14 mb-4">{t("importExport.title")}</h2>
      <p className="text-muted-foreground mb-4">
        {t.rich("importExport.text", {
          code: (chunks) => <code className={codeClass}>{chunks}</code>,
        })}
      </p>
      <CodeBlock
        language="bash"
        code={`criptenv push .env.production -p <project-id> -e production
criptenv pull -p <project-id> -e production --output .env.production`}
      />

      <Callout type="warning" className="mt-8">
        {t.rich("importExport.warning", {
          code: (chunks) => <code className={codeClass}>{chunks}</code>,
        })}
      </Callout>
    </div>
  );
}
