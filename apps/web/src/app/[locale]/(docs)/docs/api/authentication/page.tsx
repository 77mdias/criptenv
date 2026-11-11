"use client";

import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  Callout,
  CodeBlock,
  InlineCode,
} from "@/components/docs";

const API = "https://criptenv-api.77mdevseven.tech";

// Literal lists so the i18n auditor can resolve the dynamic lookups below.
export const TOKEN_TYPES = ["session", "apiKey", "ciToken"] as const;
export const SCOPES = ["readSecrets", "readAudit", "envScope", "envNull"] as const;
export const PROVIDERS = ["github", "google", "discord"] as const;
export const PRACTICES = ["apiKeys", "ciTokens", "noFrontend", "rotate", "envScope"] as const;

const SCOPE_LABELS: Record<(typeof SCOPES)[number], string> = {
  readSecrets: "read:secrets",
  readAudit: "read:audit",
  envScope: 'environment_scope: "production"',
  envNull: "environment_scope: null",
};

export default function ApiAuthenticationPage() {
  const t = useTranslations("docs.api.authentication");
  const tRoot = useTranslations("docs");
  const code = (chunks: React.ReactNode) => <InlineCode>{chunks}</InlineCode>;
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot("breadcrumb.docs"), href: "/docs" },
          { label: "API Reference", href: "/docs/api" },
          { label: t("title"), href: "/docs/api/authentication" },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t("title")}</h1>
      <p className="text-muted-foreground mb-6">{t("description")}</p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t("overview.title")}</h2>
      <p className="text-muted-foreground mb-4">{t("overview.body")}</p>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">{t("overview.type")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("overview.prefix")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("overview.ttl")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("overview.use")}</th>
            </tr>
          </thead>
          <tbody>
            {TOKEN_TYPES.map((type) => (
              <tr key={type} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-medium">{t(`overview.rows.${type}.name`)}</td>
                <td className="px-4 py-3 font-mono">{t(`overview.rows.${type}.prefix`)}</td>
                <td className="px-4 py-3">{t(`overview.rows.${type}.ttl`)}</td>
                <td className="px-4 py-3">{t(`overview.rows.${type}.use`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-4">{t("overview.note")}</p>

      {/* Session */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">{t("session.title")}</h2>
      <p className="text-muted-foreground mb-4">{t("session.body")}</p>
      <Callout variant="info">{t.rich("session.cookie", { code })}</Callout>

      <h3 className="text-xl font-semibold mt-8 mb-3">{t("session.loginTitle")}</h3>
      <CodeBlock language="bash">
        {`# Sign in and store the session cookie
curl -X POST "${API}/api/auth/signin" \\
  -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{ "email": "user@example.com", "password": "secure-password-123" }'

# Reuse the cookie on the next requests
curl "${API}/api/v1/projects" -b cookies.txt`}
      </CodeBlock>
      <CodeBlock language="json">
        {`{
  "user": { "id": "1a2b3c4d-…", "email": "user@example.com", "name": "Jane Doe", "...": "..." },
  "session": {
    "id": "5e6f7a8b-…",
    "user_id": "1a2b3c4d-…",
    "expires_at": "2026-03-02T10:30:00Z",
    "created_at": "2026-01-31T10:30:00Z",
    "last_accessed_at": "2026-01-31T10:30:00Z"
  }
}`}
      </CodeBlock>

      <p className="text-muted-foreground mb-4">{t("session.twoFactor")}</p>
      <CodeBlock language="json">{`{ "requires_two_factor": true, "expires_at": "2026-05-28T10:40:00Z" }`}</CodeBlock>
      <CodeBlock language="bash">
        {`curl -X POST "${API}/api/auth/2fa/challenge/verify" \\
  -H "Content-Type: application/json" \\
  -b cookies.txt -c cookies.txt \\
  -d '{ "code": "123456", "remember_device": true }'`}
      </CodeBlock>

      <h3 className="text-xl font-semibold mt-8 mb-3">{t("session.expiryTitle")}</h3>
      <p className="text-muted-foreground mb-4">{t("session.expiry")}</p>

      {/* API keys */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">{t("apiKeys.title")}</h2>
      <p className="text-muted-foreground mb-4">{t.rich("apiKeys.body", { code })}</p>

      <h3 className="text-xl font-semibold mt-8 mb-3">{t("apiKeys.scopesTitle")}</h3>
      <p className="text-muted-foreground mb-4">{t.rich("apiKeys.scopesBody", { code })}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">{t("apiKeys.scope")}</th>
              <th className="px-4 py-3 text-left font-semibold">{t("apiKeys.permission")}</th>
            </tr>
          </thead>
          <tbody>
            {SCOPES.map((scope) => (
              <tr key={scope} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3"><InlineCode>{SCOPE_LABELS[scope]}</InlineCode></td>
                <td className="px-4 py-3">{t(`apiKeys.scopes.${scope}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-semibold mt-8 mb-3">{t("apiKeys.createTitle")}</h3>
      <CodeBlock language="bash">
        {`curl -X POST "${API}/api/v1/projects/{project_id}/api-keys" \\
  -H "Authorization: Bearer <SESSION_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Read Bot", "scopes": ["read:secrets"], "environment_scope": "production" }'`}
      </CodeBlock>
      <CodeBlock language="json">
        {`{
  "id": "4c5d6e7f-…",
  "name": "Read Bot",
  "key": "cek_live_<KEY>",
  "prefix": "cek_live_",
  "scopes": ["read:secrets"],
  "environment_scope": "production",
  "expires_at": null,
  "created_at": "2026-05-28T10:30:00Z"
}`}
      </CodeBlock>
      <Callout variant="warning">{t.rich("apiKeys.keyOnce", { code })}</Callout>

      <h3 className="text-xl font-semibold mt-8 mb-3">{t("apiKeys.useTitle")}</h3>
      <CodeBlock language="bash">
        {`curl "${API}/api/v1/projects" \\
  -H "Authorization: Bearer cek_live_<KEY>"`}
      </CodeBlock>

      {/* CI tokens */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">{t("ci.title")}</h2>
      <p className="text-muted-foreground mb-4">{t.rich("ci.body", { code })}</p>

      <h3 className="text-xl font-semibold mt-8 mb-3">{t("ci.createTitle")}</h3>
      <CodeBlock language="bash">
        {`curl -X POST "${API}/api/v1/projects/{project_id}/tokens" \\
  -H "Authorization: Bearer <SESSION_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "GitHub Actions", "scopes": ["read:secrets", "write:secrets"], "environment_scope": "production" }'`}
      </CodeBlock>

      <h3 className="text-xl font-semibold mt-8 mb-3">{t("ci.actionTitle")}</h3>
      <p className="text-muted-foreground mb-4">{t.rich("ci.actionBody", { code })}</p>
      <CodeBlock language="yaml">
        {`name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: 77mdias/criptenv/packages/github-action@github-action-v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          vault-password: \${{ secrets.CRIPTENV_VAULT_PASSWORD }}
          project: \${{ secrets.CRIPTENV_PROJECT_ID }}
          environment: production
      - run: npm run deploy`}
      </CodeBlock>

      {/* OAuth */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">OAuth</h2>
      <p className="text-muted-foreground mb-4">{t("oauth.body")}</p>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
        {PROVIDERS.map((provider) => (
          <li key={provider}>{t.rich(`oauth.providers.${provider}`, { strong })}</li>
        ))}
      </ul>
      <CodeBlock language="text">
        {`# Open in the browser (provider: github | google | discord)
${API}/api/auth/oauth/github`}
      </CodeBlock>
      <p className="text-muted-foreground mb-4">{t.rich("oauth.flow", { code })}</p>

      {/* Errors */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">{t("errors.title")}</h2>
      <p className="text-muted-foreground mb-4">{t.rich("errors.body", { code })}</p>
      <CodeBlock language="json">{`// 401
{ "detail": "Invalid or expired session" }`}</CodeBlock>
      <CodeBlock language="json">
        {`// 403
{
  "detail": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "API key requires read:secrets scope",
    "required_scope": "read:secrets"
  }
}`}
      </CodeBlock>

      {/* Best practices */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">{t("practices.title")}</h2>
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        {PRACTICES.map((practice) => (
          <li key={practice}>{t.rich(`practices.items.${practice}`, { code, strong })}</li>
        ))}
      </ul>
    </div>
  );
}
