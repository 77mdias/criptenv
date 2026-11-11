import { screen, within } from "@testing-library/react"

import { renderWithIntl } from "@/test/render-with-intl"

import { AccessTypesSection } from "../access-types-section"

const card = (name: string) => screen.getByRole("article", { name })

describe("AccessTypesSection", () => {
  it("presents the four kinds of access, each with who it is for", () => {
    renderWithIntl(<AccessTypesSection />)

    expect(screen.getByRole("heading", { level: 2, name: "Um acesso para cada lugar" })).toBeInTheDocument()
    expect(screen.getAllByRole("article").map((article) => article.getAttribute("aria-label"))).toEqual([
      "Login",
      "Token de CI",
      "Chave de API",
      "Integração com a hospedagem",
    ])
    expect(within(card("Login")).getByText("Você e o time, na própria máquina")).toBeInTheDocument()
    expect(within(card("Token de CI")).getByText("Pipelines: GitHub Actions, deploy")).toBeInTheDocument()
    expect(within(card("Chave de API")).getByText("Contêineres e scripts")).toBeInTheDocument()
    expect(within(card("Integração com a hospedagem")).getByText("Vercel, Render e Cloudflare")).toBeInTheDocument()
  })

  it("says what each one can do, and that an API key never writes", () => {
    renderWithIntl(<AccessTypesSection />)

    expect(within(card("Login")).getByText("Tudo que o seu papel no projeto permite")).toBeInTheDocument()
    expect(within(card("Token de CI")).getByText("Ler e gravar segredos")).toBeInTheDocument()
    expect(within(card("Chave de API")).getByText("Nunca grava nem apaga")).toBeInTheDocument()
    expect(within(card("Integração com a hospedagem")).getByText("No Max: envio automático ao salvar")).toBeInTheDocument()
    for (const name of ["Login", "Token de CI", "Chave de API", "Integração com a hospedagem"]) {
      expect(within(card(name)).getAllByRole("listitem")).toHaveLength(3)
    }
  })

  it("shows a real command or variable for each and links to its documentation", () => {
    renderWithIntl(<AccessTypesSection />)

    const expected: Record<string, [string, string]> = {
      Login: ["criptenv login", "/docs/cli/commands"],
      "Token de CI": ["criptenv ci login", "/docs/api/ci-tokens"],
      "Chave de API": ["CRIPTENV_API_KEY", "/docs/api/authentication"],
      "Integração com a hospedagem": ["criptenv integrations sync", "/docs/integrations"],
    }
    for (const [name, [example, href]] of Object.entries(expected)) {
      expect(within(card(name)).getByText(example)).toBeInTheDocument()
      expect(within(card(name)).getByRole("link", { name: `Ver na documentação: ${name}` })).toHaveAttribute("href", href)
    }
  })

  it("explains the restricted environment under the cards", () => {
    renderWithIntl(<AccessTypesSection />)

    expect(screen.getByText(/só administradores entram/)).toBeInTheDocument()
  })
})
