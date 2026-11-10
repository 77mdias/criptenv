function fieldByLabel(label: string) {
  return cy.contains("label", label).parent().find("input, textarea")
}

// The E2E stack has billing off and never talks to Mercado Pago: these specs cover the screens,
// with /api/v1/billing answered here. The real checkout is a manual script (deploy/vps/README.md).
describe("billing (subscription screens)", () => {
  const prices = { pro: { month: "29.00", year: "290.00" }, max: { month: "69.00", year: "690.00" } }
  const empty = { prices, subscription: null, scheduled: null, pending: null, refund_eligible: false }
  const subscription = {
    id: "sub-e2e",
    plan: "pro",
    interval: "month",
    status: "active",
    amount: "29.00",
    cancel_at_period_end: false,
    current_period_start: "2027-04-01T12:00:00Z",
    current_period_end: "2027-05-01T12:00:00Z",
    grace_until: null,
    init_point: null,
    tax_id: "52998224725",
    legal_name: "E2E User",
    address: "Rua A, 1",
    payer_email: "e2e.user@example.com",
  }

  /** The real plan of the account, with billing switched on (and optionally a charge overdue). */
  function billingOn(graceUntil: string | null = null) {
    cy.intercept("GET", "**/api/v1/me/plan", (request) => {
      request.continue((response) => {
        response.body.can_upgrade = true
        response.body.grace_until = graceUntil
      })
    })
  }

  beforeEach(() => {
    cy.resetDb()
    cy.signup()
  })

  it("goes from the pricing section to a checkout with the invoice data", () => {
    billingOn()
    cy.intercept("GET", "**/api/v1/billing", empty)
    cy.intercept("POST", "**/api/v1/billing/checkout", { init_point: "/account/billing?paid=1" }).as("checkout")

    cy.visit("/")
    cy.contains("a", "Assinar o Pro").click()
    cy.location("pathname", { timeout: 15000 }).should("eq", "/account/billing")
    cy.contains("button", "Pro escolhido", { timeout: 15000 }).should("be.visible")
    cy.contains("Vale assim que o pagamento for confirmado.").should("be.visible")

    fieldByLabel("CPF ou CNPJ (só números)").type("529.982.247-25")
    fieldByLabel("Nome ou razão social").type("E2E User")
    fieldByLabel("Endereço completo").type("Rua A, 1, São Paulo")
    fieldByLabel("E-mail da sua conta no Mercado Pago").should("have.value", "e2e.user@example.com")
    cy.contains("button", "Ir para o pagamento").click()

    cy.wait("@checkout").its("request.body").should("deep.equal", {
      plan: "pro",
      interval: "month",
      tax_id: "52998224725",
      legal_name: "E2E User",
      address: "Rua A, 1, São Paulo",
      payer_email: "e2e.user@example.com",
    })
    // The page leaves for the payment page the API named.
    cy.location("search", { timeout: 15000 }).should("eq", "?paid=1")
  })

  it("cancels and says until when the plan holds", () => {
    billingOn()
    cy.intercept("GET", "**/api/v1/billing", { ...empty, subscription })
    cy.intercept("POST", "**/api/v1/billing/cancel", { refunded: false, ends_at: "2027-05-01T12:00:00Z" }).as("cancel")

    cy.visitHydrated("/account/billing")
    cy.contains("Próxima cobrança em 01/05/2027", { timeout: 15000 }).should("be.visible")
    cy.contains("button", "Cancelar assinatura").click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains("o plano vale até 01/05/2027").should("be.visible")
      cy.contains("button", "Cancelar assinatura").click()
    })

    cy.wait("@cancel")
    cy.contains("Assinatura cancelada. O plano vale até 01/05/2027.").should("be.visible")
  })

  it("shows the payment-failed strip across the dashboard during the grace period", () => {
    billingOn("2027-05-08T12:00:00Z")

    cy.visitHydrated("/dashboard")
    cy.contains("Não conseguimos cobrar sua assinatura. Seu plano vale até 08/05/2027.", { timeout: 15000 })
      .should("be.visible")
    cy.contains("a", "Resolver").should("have.attr", "href").and("include", "/account/billing")
  })

  it("has no billing screen or route while billing is off", () => {
    cy.request({ url: "/api/v1/billing", failOnStatusCode: false }).its("status").should("eq", 404)
    cy.request("/api/v1/me/plan").its("body.can_upgrade").should("eq", false)

    cy.visitHydrated("/account/billing")
    cy.location("pathname", { timeout: 15000 }).should("eq", "/account")
    cy.contains("Gerenciar assinatura").should("not.exist")
  })
})
