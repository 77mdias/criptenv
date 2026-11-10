import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderWithIntl } from "@/test/render-with-intl"

import { PricingSection } from "../pricing-section"

const card = (name: string) => screen.getByRole("group", { name })

describe("PricingSection", () => {
  it("shows the three plans with monthly prices", () => {
    renderWithIntl(<PricingSection />)

    expect(within(card("Free")).getByText(/^R\$\s0$/)).toBeInTheDocument()
    expect(within(card("Pro")).getByText(/^R\$\s29$/)).toBeInTheDocument()
    expect(within(card("Max")).getByText(/^R\$\s69$/)).toBeInTheDocument()
    expect(within(card("Pro")).getByText("por mês")).toBeInTheDocument()
  })

  it("switches to yearly prices", async () => {
    renderWithIntl(<PricingSection />)

    await userEvent.click(screen.getByRole("radio", { name: /Anual/ }))

    expect(within(card("Pro")).getByText(/^R\$\s290$/)).toBeInTheDocument()
    expect(within(card("Max")).getByText(/^R\$\s690$/)).toBeInTheDocument()
    expect(within(card("Max")).getByText("por ano")).toBeInTheDocument()
    expect(within(card("Free")).getByText(/^R\$\s0$/)).toBeInTheDocument()
  })

  it("links paid plans to the billing page with the plan chosen", () => {
    renderWithIntl(<PricingSection />)

    expect(screen.getByRole("link", { name: "Começar grátis" })).toHaveAttribute("href", "/signup")
    expect(screen.getByRole("link", { name: "Assinar o Pro" })).toHaveAttribute("href", "/account/billing?plan=pro")
    expect(screen.getByRole("link", { name: "Assinar o Max" })).toHaveAttribute("href", "/account/billing?plan=max")
  })

  it("keeps the contribute link and says self-hosting is free", () => {
    renderWithIntl(<PricingSection />)

    expect(screen.getByRole("link", { name: "Apoiar o projeto por Pix" })).toHaveAttribute("href", "/contribute")
    expect(screen.getByText(/Hospedar o CriptEnv por conta própria é gratuito e sem limites/)).toBeInTheDocument()
  })

  it("lists every feature row of the spec table", () => {
    renderWithIntl(<PricingSection />)

    const table = screen.getByRole("table", { name: "O que cada plano inclui" })
    const rows = within(table).getAllByRole("row").slice(1).map((row) => row.textContent)
    expect(rows).toEqual([
      "Segurançacompletacompletacompleta",
      "Projetos3sem limitesem limite",
      "Ambientes por projeto3sem limitesem limite",
      "Membros por projeto31025",
      "Cofre pessoal120 itens, 10 pastassem limitesem limite",
      "Conexões com hospedagem por projeto1sem limitesem limite",
      "Envio para a hospedagemmanualmanualautomático ao salvar",
      "Novo deploy após o envionãonãosim",
      "Sincronizar a partir de CInãonãosim",
      "Histórico de auditoria visível7 dias30 dias90 dias",
      "Tokens de CI e chaves de APIsem limitesem limitesem limite",
    ])
  })
})
