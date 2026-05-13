declare global {
  // Cypress exposes command augmentation through its global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      resetDb(): Chainable<void>
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

Cypress.Commands.add(
  "signup",
  (email = "e2e.user@example.com", password = "Passw0rd!") => {
    cy.visit("/signup")
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
  cy.visit("/projects")
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
