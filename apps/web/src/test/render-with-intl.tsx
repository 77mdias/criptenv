import { NextIntlClientProvider } from "next-intl"
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement } from "react"

import accountPtBR from "../../messages/pt-BR/account.json"
import auditPtBR from "../../messages/pt-BR/audit.json"
import authPtBR from "../../messages/pt-BR/auth.json"
import commonPtBR from "../../messages/pt-BR/common.json"
import dashboardPtBR from "../../messages/pt-BR/dashboard.json"
import helpPtBR from "../../messages/pt-BR/help.json"
import integrationsPtBR from "../../messages/pt-BR/integrations.json"
import marketingPtBR from "../../messages/pt-BR/marketing.json"
import membersPtBR from "../../messages/pt-BR/members.json"
import secretsPtBR from "../../messages/pt-BR/secrets.json"
import settingsPtBR from "../../messages/pt-BR/settings.json"

/**
 * Minimal catalogue for unit tests. Assertions in these tests are written
 * against pt-BR copy, so the provider is pinned to pt-BR regardless of the
 * developer's environment.
 *
 * Keys mirror the production shape produced by `loadMessages`: the namespace
 * file name is the top-level key (`common.meta.title`, `auth.login.title`).
 *
 * Pass `messages` to layer extra namespaces (e.g. `marketing`) on top.
 */
const defaultMessages = {
  account: accountPtBR,
  audit: auditPtBR,
  auth: authPtBR,
  common: commonPtBR,
  dashboard: dashboardPtBR,
  help: helpPtBR,
  integrations: integrationsPtBR,
  marketing: marketingPtBR,
  members: membersPtBR,
  secrets: secretsPtBR,
  settings: settingsPtBR,
}

export function renderWithIntl(
  ui: ReactElement,
  options?: RenderOptions & { messages?: Record<string, unknown> },
) {
  const { messages, ...renderOptions } = options ?? {}

  return render(
    <NextIntlClientProvider
      locale="pt-BR"
      messages={{ ...defaultMessages, ...messages }}
    >
      {ui}
    </NextIntlClientProvider>,
    renderOptions,
  )
}
