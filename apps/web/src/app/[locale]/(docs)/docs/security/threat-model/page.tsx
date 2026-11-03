'use client';

import { useTranslations } from 'next-intl';
import {
  Breadcrumb,
  Callout,
  CodeBlock,
} from '@/components/docs';

// Literal list so the i18n auditor can resolve the dynamic `threats.${key}` lookups.
export const THREATS = [
  { key: 'database', risk: 'critical', items: 4 },
  { key: 'admin', risk: 'high', items: 3 },
  { key: 'mitm', risk: 'high', items: 4 },
  { key: 'xss', risk: 'high', items: 3 },
  { key: 'session', risk: 'medium', items: 3 },
  { key: 'bruteForce', risk: 'medium', items: 4 },
] as const;

const RISK_BADGE = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
} as const;

export default function ThreatModelPage() {
  const t = useTranslations('docs.security.threatModel');
  const tRoot = useTranslations('docs');
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('security.overview.title'), href: '/docs/security' },
          { label: t('title'), href: '/docs/security/threat-model' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">{t('title')}</h1>

      <p className="text-muted-foreground mb-6">{t('description')}</p>

      <Callout variant="info">{t('assumption')}</Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('summary.title')}</h2>

      <ThreatTable
        columns={[t('summary.scenario'), t('summary.risk'), t('summary.impact'), t('summary.status')]}
        rows={THREATS.map((threat) => [
          t(`threats.${threat.key}.title`),
          t(`risk.${threat.risk}`),
          t(`threats.${threat.key}.impact`),
          t(`threats.${threat.key}.status`),
        ])}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('detail.title')}</h2>

      <div className="space-y-6">
        {THREATS.map((threat) => (
          <div key={threat.key} className="border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className={`${RISK_BADGE[threat.risk]} text-xs font-medium px-2.5 py-0.5 rounded`}>
                {t(`riskBadge.${threat.risk}`)}
              </span>
              <h3 className="font-semibold">{t(`threats.${threat.key}.title`)}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t.rich(`threats.${threat.key}.scenario`, { strong })}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              <strong>{t('detail.mitigation')}</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-3">
              {Array.from({ length: threat.items }, (_, i) => (
                <li key={i}>{t(`threats.${threat.key}.mitigations.${i}`)}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {t.rich(`threats.${threat.key}.result`, { strong })}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">{t('layers.title')}</h2>

      <CodeBlock
        language="text"
        code={`Layer 1: Transport
  └─ TLS + HSTS

Layer 2: Client-side encryption
  └─ AES-256-GCM with locally derived keys

Layer 3: Key derivation
  └─ PBKDF2 (100k iterations) + per-environment HKDF

Layer 4: Vault authorization
  └─ Vault proof (independent salt, stored as a bcrypt hash)

Layer 5: Session
  └─ Session expiration + revocation

Layer 6: Infrastructure
  └─ Rate limiting + CSP`}
      />

      <Callout variant="warning">{t.rich('userResponsibility', { strong })}</Callout>
    </div>
  );
}

// StatusTable only renders HTTP status codes; this page needs a generic grid.
function ThreatTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-[var(--border)] last:border-0">
              {row.map((cell, i) => (
                <td key={i} className="px-4 py-3 text-[var(--text-secondary)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
