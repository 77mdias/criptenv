import { render, screen } from "@testing-library/react";

import { PricingTrustSection } from "../pricing-trust-section";

describe("PricingTrustSection", () => {
  it("highlights contribution as the primary pricing action", () => {
    render(<PricingTrustSection />);

    expect(
      screen.getByRole("heading", { name: "Apoie o CriptEnv" }),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 5+")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Contribute now/i }),
    ).toHaveAttribute("href", "/contribute");
  });

  it("keeps free open-source adoption visible", () => {
    render(<PricingTrustSection />);

    expect(screen.getByText("Open Source")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start free/i })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("surfaces trust proof points and transparency copy", () => {
    render(<PricingTrustSection />);

    expect(screen.getAllByText("MIT")).toHaveLength(2);
    expect(screen.getByText("0 plaintext")).toBeInTheDocument();
    expect(screen.getByText("self-hostable")).toBeInTheDocument();
    expect(screen.getByText("roadmap aberto")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver transparencia" }),
    ).toHaveAttribute("href", "/docs");
  });
});
