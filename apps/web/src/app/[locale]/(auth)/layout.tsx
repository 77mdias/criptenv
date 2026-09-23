import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Brand } from "@/components/layout/brand"
import { ArrowLeft } from "lucide-react"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth.layout");

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/20 lg:grid-cols-[0.95fr_1.05fr]">
        <Link
          href="/"
          className="absolute right-4 top-4 z-20 inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-xs font-medium text-[var(--text-secondary)] shadow-sm transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 sm:right-5 sm:top-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t("back")}</span>
        </Link>
        <aside className="relative hidden min-h-full overflow-hidden border-r border-[var(--border)] bg-[var(--background-subtle)] p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_38%,rgba(255,255,255,0.04))]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(var(--text-primary)_1px,transparent_1px),linear-gradient(90deg,var(--text-primary)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="relative z-10 space-y-12">
            <Brand compact subtitle="Zero-Knowledge Secrets" />
            <div className="space-y-5">
              <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
                {t("headline")}
              </h2>
              <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                {t("description")}
              </p>
            </div>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                <span>{t("vaultSession")}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.65)]" />
              </div>
              <div className="space-y-3 font-mono text-xs text-[var(--text-secondary)]">
                <div className="flex items-center justify-between rounded-lg bg-[var(--background-muted)] px-3 py-2">
                  <span>{t("plaintext")}</span>
                  <span className="text-[var(--text-primary)]">{t("neverStored")}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[var(--background-muted)] px-3 py-2">
                  <span>{t("aesGcm")}</span>
                  <span className="text-[var(--text-primary)]">{t("clientSide")}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[var(--background-muted)] px-3 py-2">
                  <span>{t("audit")}</span>
                  <span className="text-[var(--text-primary)]">{t("traceable")}</span>
                </div>
              </div>
            </div>
            <p className="text-xs leading-5 text-[var(--text-tertiary)]">
              {t("footnote")}
            </p>
          </div>
        </aside>

        <main className="flex min-h-full items-center justify-center px-5 py-8 sm:px-8 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Brand compact subtitle="Zero-Knowledge Secrets" />
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl shadow-black/10 sm:p-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
