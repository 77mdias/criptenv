'use client';

import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Tabs,
  Tab,
} from '@/components/docs';

const codeClass = "bg-muted px-1 rounded text-sm";

export default function InstallationPage() {
  const t = useTranslations("docs.gettingStarted.installation");
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
      <p className="text-lg text-muted-foreground mb-8">{t("intro")}</p>

      <Callout variant="info">{t("requirements")}</Callout>

      <h2 className="text-2xl font-bold mt-12 mb-4">{t("pip.title")}</h2>
      <p className="text-muted-foreground mb-6">{t("pip.text")}</p>

      <Tabs defaultValue="pip">
        <Tab value="pip" label="pip">
          <div className="space-y-4">
            <CodeBlock
              language="bash"
              code={`pip install criptenv`}
            />
            <Callout variant="tip">
              {t.rich("pipxTip", {
                code: (chunks) => <code className={codeClass}>{chunks}</code>,
              })}
              <CodeBlock language="bash" code="pipx install criptenv" />
            </Callout>
          </div>
        </Tab>

        <Tab value="dev" label={t("devTab.label")}>
          <div className="space-y-4">
            <p className="text-muted-foreground">{t("devTab.text")}</p>
            <CodeBlock
              language="bash"
              code={`git clone https://github.com/77mdias/criptenv.git
cd criptenv/apps/cli
pip install -e ".[dev]"`}
            />
          </div>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-bold mt-12 mb-4">{t("binary.title")}</h2>
      <p className="text-muted-foreground mb-4">{t("binary.text")}</p>
      <CodeBlock
        language="bash"
        code={`curl -fsSLo criptenv https://github.com/77mdias/criptenv/releases/latest/download/criptenv-linux-x86_64
chmod +x criptenv && sudo mv criptenv /usr/local/bin/`}
      />
      <p className="text-muted-foreground mt-6 mb-4">{t("binary.dockerText")}</p>
      <CodeBlock
        language="dockerfile"
        code={`FROM node:22-slim
COPY --from=ghcr.io/77mdias/criptenv-cli:latest /usr/local/bin/criptenv /usr/local/bin/criptenv`}
      />
      <Callout variant="info">{t("binary.note")}</Callout>

      <h2 className="text-2xl font-bold mt-12 mb-4">{t("verify.title")}</h2>
      <p className="text-muted-foreground mb-4">{t("verify.text")}</p>
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
        {t.rich("doctorNote", {
          code: (chunks) => <code className={codeClass}>{chunks}</code>,
        })}
      </Callout>

      <h2 className="text-2xl font-bold mt-12 mb-4">{t("uninstall.title")}</h2>
      <p className="text-muted-foreground mb-4">{t("uninstall.text")}</p>
      <CodeBlock
        language="bash"
        code={`pip uninstall criptenv
rm -rf ~/.criptenv`}
      />

      <Callout variant="warning" className="mt-4">
        {t.rich("uninstallWarning", {
          code: (chunks) => <code className={codeClass}>{chunks}</code>,
        })}
      </Callout>
    </div>
  );
}
