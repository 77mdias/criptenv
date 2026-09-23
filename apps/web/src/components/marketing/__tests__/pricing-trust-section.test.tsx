import { screen } from "@testing-library/react";

import { renderWithIntl } from "@/test/render-with-intl"
import { mockGetTranslations } from "@/test/server-intl"

import { PricingTrustSection } from "../pricing-trust-section";

// The section is an async Server Component; getTranslations needs a request
// context jsdom does not have, so it is replaced by a catalogue-backed
// translator (see src/test/server-intl.ts).
jest.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}))

describe("PricingTrustSection", () => {
  it("highlights contribution as the primary pricing action", async () => {
    renderWithIntl(await PricingTrustSection());

    expect(
      screen.getByRole("heading", { name: "Apoie o CriptEnv" }),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 5+")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Contribute now/i }),
    ).toHaveAttribute("href", "/contribute");
  });

  it("keeps free open-source adoption visible", async () => {
    renderWithIntl(await PricingTrustSection());

    expect(screen.getByText("Open Source")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start free/i })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("surfaces trust proof points and transparency copy", async () => {
    renderWithIntl(await PricingTrustSection());

    expect(screen.getAllByText("MIT")).toHaveLength(2);
    expect(screen.getByText("0 plaintext")).toBeInTheDocument();
    expect(screen.getByText("self-hostable")).toBeInTheDocument();
    expect(screen.getByText("roadmap aberto")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver transparencia" }),
    ).toHaveAttribute("href", "/docs");
  });
});
