"use client"

import { Cloud, KeyRound, Lock, Terminal, Workflow } from "lucide-react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"

// Prose lives in `messages/<locale>/marketing.json` under `landing.access`;
// these module-scope literals only carry stable keys, commands and links, never copy.
const ACCESS_TYPES = [
  { key: "login", icon: Terminal, example: "criptenv login", href: "/docs/cli/commands" },
  { key: "ciToken", icon: Workflow, example: "criptenv ci login", href: "/docs/api/ci-tokens" },
  { key: "apiKey", icon: KeyRound, example: "CRIPTENV_API_KEY", href: "/docs/api/authentication" },
  { key: "hosting", icon: Cloud, example: "criptenv integrations sync", href: "/docs/integrations" },
] as const

/**
 * Landing: the four ways into a project (login, CI token, API key, hosting integration),
 * who each one is for and what it can do. The same table lives in the API docs (Authentication).
 */
export function AccessTypesSection() {
  const t = useTranslations("marketing.landing.access")

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div data-motion="reveal" className="mb-12 max-w-2xl">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-(--text-muted)">{t("label")}</span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">{t("title")}</h2>
        <p className="mt-4 text-(--text-tertiary)">{t("description")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {ACCESS_TYPES.map(({ key, icon: Icon, example, href }) => {
          const name = t(`items.${key}.name`)
          return (
            <article
              key={key}
              aria-label={name}
              data-motion="reveal"
              className="flex flex-col rounded-xl border border-(--border) bg-(--surface)/80 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-(--accent)/30"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-(--accent)/20 bg-(--accent)/10">
                <Icon className="h-5 w-5 text-(--accent)" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-(--text-primary)">{name}</h3>
              <p className="mt-1 text-sm text-(--text-secondary)">{t(`items.${key}.for`)}</p>

              <ul className="mt-4 flex-1 space-y-2 text-sm text-(--text-tertiary)">
                {(t.raw(`items.${key}.can`) as string[]).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-(--accent)" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <code className="mt-5 block overflow-x-auto rounded-lg border border-(--border) bg-(--background) px-3 py-2 font-mono text-xs text-(--text-primary)">
                {example}
              </code>
              <Link
                href={href}
                aria-label={t("docsFor", { name })}
                className="mt-4 text-sm font-medium text-(--accent) hover:underline"
              >
                {t("docs")}
              </Link>
            </article>
          )
        })}
      </div>

      <p data-motion="reveal" className="mt-8 flex items-start gap-2 text-sm text-(--text-secondary)">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-(--accent)" aria-hidden />
        <span>{t("restricted")}</span>
      </p>
    </div>
  )
}
