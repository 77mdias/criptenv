import { NextIntlClientProvider } from "next-intl"
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement } from "react"

import authPtBR from "../../messages/pt-BR/auth.json"
import commonPtBR from "../../messages/pt-BR/common.json"
import marketingPtBR from "../../messages/pt-BR/marketing.json"

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
const defaultMessages = { auth: authPtBR, common: commonPtBR, marketing: marketingPtBR }

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
