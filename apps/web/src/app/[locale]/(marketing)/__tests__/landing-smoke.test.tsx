import { screen } from "@testing-library/react";

// Renderiza a landing page inteira (async Server Component) com os catálogos
// reais — reproduz o crash de hidratação relatado no E2E e expõe o stack.
jest.mock("next-intl/server", () => ({
  getTranslations: jest.requireActual("@/test/server-intl").mockGetTranslations,
}));

import { renderWithIntl } from "@/test/render-with-intl";
import LandingPage from "../page";

describe("LandingPage (smoke de render pós-merge)", () => {
  it("renderiza sem lançar", async () => {
    const ui = await LandingPage();
    renderWithIntl(ui);

    expect(screen.getAllByText(/Secrets/i).length).toBeGreaterThan(0);
  });
});
