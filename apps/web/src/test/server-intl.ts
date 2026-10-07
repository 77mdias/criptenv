import { createTranslator } from "next-intl"

import accountPtBR from "../../messages/pt-BR/account.json"
import authPtBR from "../../messages/pt-BR/auth.json"
import commonPtBR from "../../messages/pt-BR/common.json"
import marketingPtBR from "../../messages/pt-BR/marketing.json"

/**
 * Stand-in for `next-intl/server`'s `getTranslations`.
 *
 * Async Server Components cannot be rendered by @testing-library/react (a
 * promise-returning function component renders as an empty node), so their unit
 * tests call the component directly and render the resolved element. Doing that
 * still needs a translator, but `getTranslations` requires a request context
 * that jsdom does not have — hence this catalogue-backed replacement.
 *
 * Usage in the test file:
 *   jest.mock("next-intl/server", () => ({ getTranslations: mockGetTranslations }))
 *   const ui = await PricingTrustSection()
 *   renderWithIntl(ui)
 */
export async function mockGetTranslations(
  namespaceOrOpts?: string | { locale?: string; namespace?: string },
) {
  const namespace =
    typeof namespaceOrOpts === "string"
      ? namespaceOrOpts
      : namespaceOrOpts?.namespace

  return createTranslator({
    locale: "pt-BR",
    messages: {
      account: accountPtBR,
      auth: authPtBR,
      common: commonPtBR,
      marketing: marketingPtBR,
    },
    // `namespace` is caller-supplied, so it is not statically known to be one of
    // next-intl's derived namespace keys — hence the narrowing cast.
    namespace: namespace as never,
  })
}
