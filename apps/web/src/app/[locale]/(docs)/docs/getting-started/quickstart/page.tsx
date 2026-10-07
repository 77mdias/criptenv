'use client';

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation"
import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

const codeClass = "bg-muted px-1 rounded text-sm";

export default function QuickstartPage() {
  const t = useTranslations("docs.gettingStarted.quickstart");
  const tRoot = useTranslations("docs");

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: tRoot("breadcrumb.docs"), href: '/docs' },
          { label: t("breadcrumb.gettingStarted"), href: '/docs/getting-started' },
          { label: t("breadcrumb.quickstart") },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">{t("title")}</h1>
      <p className="text-lg text-muted-foreground mb-8">{t("subtitle")}</p>

      <Callout type="info">{t("prerequisites")}</Callout>

      <Steps>
        <Step title={t("steps.install.title")}>
          <p className="mb-4">{t("steps.install.text")}</p>
          <CodeBlock
            language="bash"
            code={`pip install criptenv`}
          />
        </Step>

        <Step title={t("steps.account.title")}>
          <p className="mb-4">
            {t.rich("steps.account.text", {
              link: (chunks) => (
                <a
                  href="https://criptenv.77mdevseven.tech"
                  className="underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
          <CodeBlock language="bash" code="criptenv login --email you@example.com" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t.rich("steps.account.note", {
              code: (chunks) => <code className={codeClass}>{chunks}</code>,
            })}
          </p>
        </Step>

        <Step title={t("steps.project.title")}>
          <p className="mb-4">{t("steps.project.text")}</p>
          <CodeBlock
            language="bash"
            code={`criptenv projects create meu-projeto`}
          />
          <Callout type="tip" className="mt-3">
            {t("steps.project.tip")}
          </Callout>
        </Step>

        <Step title={t("steps.secrets.title")}>
          <p className="mb-4">{t("steps.secrets.text")}</p>
          <CodeBlock
            language="bash"
            code={`criptenv set DATABASE_URL="postgres://user:pass@host/db"
criptenv set API_KEY="your_api_key_here"`}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("steps.secrets.note")}
          </p>
        </Step>

        <Step title={t("steps.list.title")}>
          <p className="mb-4">{t("steps.list.text")}</p>
          <CodeBlock
            language="bash"
            code={`criptenv list
# Saída:
# DATABASE_URL
# API_KEY`}
          />
          <Callout type="info" className="mt-3">
            {t.rich("steps.list.note", {
              code: (chunks) => <code className={codeClass}>{chunks}</code>,
            })}
          </Callout>
        </Step>

        <Step title={t("steps.get.title")}>
          <p className="mb-4">{t("steps.get.text")}</p>
          <CodeBlock
            language="bash"
            code={`criptenv get DATABASE_URL
# Saída: postgres://user:pass@host/db`}
          />
        </Step>

        <Step title={t("steps.files.title")}>
          <p className="mb-4">{t("steps.files.text")}</p>
          <CodeBlock
            language="bash"
            code={`criptenv push .env.production -p <project-id>
criptenv pull -p <project-id> --output .env.production`}
          />
        </Step>
      </Steps>

      <h2 className="text-2xl font-bold mt-12 mb-4">{t("nextSteps.title")}</h2>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          {t.rich("nextSteps.concepts", {
            link: (chunks) => (
              <Link
                href="/docs/getting-started/concepts"
                className="text-primary hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </li>
        <li>
          {t.rich("nextSteps.commands", {
            link: (chunks) => (
              <Link
                href="/docs/cli/commands"
                className="text-primary hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </li>
        <li>
          {t.rich("nextSteps.files", {
            code: (chunks) => <code className={codeClass}>{chunks}</code>,
          })}
        </li>
        <li>
          {t.rich("nextSteps.cicd", {
            link: (chunks) => (
              <Link
                href="/docs/guides/cicd-setup"
                className="text-primary hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </li>
      </ul>
    </div>
  );
}
