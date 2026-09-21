declare global {
  // Cypress exposes command augmentation through its global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      resetDb(): Chainable<void>
      visitHydrated(url: string): Chainable<void>
      signup(email?: string, password?: string): Chainable<void>
      createProject(name?: string, vaultPassword?: string): Chainable<string>
    }
  }
}

function inputByLabel(label: string) {
  return cy.contains("label", label).parent().find("input, textarea")
}

Cypress.Commands.add("resetDb", () => {
  cy.task("resetDb")
})

// `cy.visit` resolves on the document load event, which in the dev server fires
// before React hydrates. Anything typed or clicked in that window only touches
// the server-rendered DOM: inputs accept the text, but no handler is attached
// yet, so the submit button is inert and no request leaves the browser.
// The app's session bootstrap is a React effect, so it can only run once the
// tree has hydrated - waiting for it guarantees the page is interactive.
Cypress.Commands.add("visitHydrated", (url: string) => {
  cy.intercept("GET", "**/api/auth/session").as("sessionBootstrap")
  cy.visit(url)
  cy.wait("@sessionBootstrap", { timeout: 20000 })
})

Cypress.Commands.add(
  "signup",
  (email = "e2e.user@example.com", password = "Passw0rd!") => {
    cy.visitHydrated("/signup")
    inputByLabel("Nome").type("E2E User")
    inputByLabel("Email").type(email)
    inputByLabel("Senha").type(password)
    inputByLabel("Confirmar Senha").type(password)
    cy.contains("button", "Criar Conta").click()

    // After signup, user is redirected to verify-email/sent
    cy.location("pathname", { timeout: 15000 }).should("eq", "/verify-email/sent")

    // In E2E environment, email service is disabled; send-verification exposes dev_token
    cy.request("POST", "http://localhost:8000/api/auth/send-verification", { email }).then(
      (response) => {
        expect(response.status).to.eq(200)
        const token = response.body.dev_token
        expect(token).to.be.a("string")

        cy.visit(`/verify-email?token=${token}`)
        cy.contains("Email verificado!", { timeout: 15000 }).should("be.visible")
        cy.contains("a", "Entrar na conta").click()
      }
    )

    // Login after verification
    cy.location("pathname", { timeout: 15000 }).should("eq", "/login")
    inputByLabel("Email").type(email)
    inputByLabel("Senha").type(password)
    cy.contains("button", "Entrar").click()
    cy.location("pathname", { timeout: 15000 }).should("eq", "/dashboard")
  }
)

Cypress.Commands.add("createProject", (name = "e2e-project", vaultPassword = "VaultPassw0rd!") => {
  cy.visitHydrated("/projects")
  cy.intercept("POST", "**/api/v1/projects").as("createProject")
  cy.contains("button", "Novo Projeto").click()
  inputByLabel("Nome do projeto").type(name)
  inputByLabel("Descrição").type("Created by Cypress E2E")
  inputByLabel("Senha do vault").type(vaultPassword)
  inputByLabel("Confirmar senha do vault").type(vaultPassword)
  cy.contains("button", "Criar Projeto").click()
  cy.contains(name, { timeout: 15000 }).should("be.visible")

  return cy.wait("@createProject")
    .its("response.body.id")
    .should("be.a", "string")
})

export {}
