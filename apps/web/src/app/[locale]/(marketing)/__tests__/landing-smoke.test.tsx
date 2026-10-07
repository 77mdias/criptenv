import { Fragment, type ReactNode } from "react";
import { screen } from "@testing-library/react";

// Renderiza a landing page inteira (async Server Component) com os catálogos
// reais — reproduz regressões de catálogo/merge na landing.
jest.mock("next-intl/server", () => ({
  getTranslations: jest.requireActual("@/test/server-intl").mockGetTranslations,
}));

// Seções Server Component async não podem ser renderizadas no jsdom (render
// client do react-dom rejeita componentes async). No runtime real (RSC/vinext)
// elas rodam no servidor; aqui as substituímos por stubs no corpo da página e
// renderizamos o resultado resolvido (`await Section()`) separadamente, para
// manter a cobertura de catálogo dessas seções.
jest.mock("@/components/marketing/platform-preview-section", () => ({
  PlatformPreviewSection: () => <div data-testid="platform-preview-stub" />,
}));
jest.mock("@/components/marketing/pricing-trust-section", () => ({
  PricingTrustSection: () => <div data-testid="pricing-trust-stub" />,
}));
jest.mock("@/components/layout/footer", () => ({
  Footer: () => <div data-testid="footer-stub" />,
}));

import { renderWithIntl } from "@/test/render-with-intl";
import LandingPage from "../page";

// Versões reais (não mockadas) das seções async, para cobrir seus catálogos.
const {
  PlatformPreviewSection,
}: typeof import("@/components/marketing/platform-preview-section") =
  jest.requireActual("@/components/marketing/platform-preview-section");
const {
  PricingTrustSection,
}: typeof import("@/components/marketing/pricing-trust-section") =
  jest.requireActual("@/components/marketing/pricing-trust-section");
const { Footer }: typeof import("@/components/layout/footer") =
  jest.requireActual("@/components/layout/footer");

async function renderAsyncSection(factory: () => Promise<ReactNode>) {
  // Resolve a seção como o runtime de servidor faria, gerando uma árvore
  // síncrona que o jsdom consegue renderizar.
  return factory();
}

describe("LandingPage (smoke de render pós-merge)", () => {
  it("renderiza sem lançar", async () => {
    const realPlatformPreview = await renderAsyncSection(PlatformPreviewSection);
    const realPricingTrust = await renderAsyncSection(PricingTrustSection);
    const realFooter = await renderAsyncSection(Footer);

    const ui = await LandingPage();
    renderWithIntl(
      <Fragment>
        {ui}
        {realPlatformPreview}
        {realPricingTrust}
        {realFooter}
      </Fragment>,
    );

    // findAllByText também cobre suspensões de seções com lazy loading.
    expect((await screen.findAllByText(/Secrets/i)).length).toBeGreaterThan(0);
  });
});
