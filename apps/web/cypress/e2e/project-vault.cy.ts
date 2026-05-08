function inputByLabel(label: string) {
  return cy.contains("label", label).parent().find("input, textarea")
}

describe("project vault and secrets", () => {
  const vaultPassword = "VaultPassw0rd!"

  beforeEach(() => {
    cy.resetDb()
    cy.signup()
  })

  it("creates a project and default environments through the real API", () => {
    cy.createProject("e2e-project", vaultPassword).then((projectId) => {
      cy.request(`/api/v1/projects/${projectId}/environments`)
        .its("body.environments")
        .should("have.length", 3)

      cy.visit(`/projects/${projectId}`)
      cy.contains("e2e-project", { timeout: 15000 }).should("be.visible")
    })
  })

  it("unlocks the vault and manages a secret lifecycle", () => {
    cy.createProject("secrets-e2e", vaultPassword).then((projectId) => {
      cy.visit(`/projects/${projectId}/secrets`)
      cy.contains("Desbloquear vault", { timeout: 15000 }).should("be.visible")
      inputByLabel("Senha mestra").type(vaultPassword)
      cy.contains("button", "Desbloquear").click()

      cy.contains("Vault desbloqueado apenas nesta sessão", { timeout: 15000 }).should("be.visible")
      cy.contains("Criar Secret").click()

      inputByLabel("Chave").type("database_url")
      inputByLabel("Valor").type("postgres://example")
      cy.contains("button", "Salvar").click()

      cy.contains("DATABASE_URL", { timeout: 15000 }).should("be.visible")
      cy.contains("postgres://example").should("not.exist")
      cy.get('[aria-label="Revelar secret"]').click()
      cy.contains("postgres://example").should("be.visible")

      cy.get('[aria-label="Copiar valor"]').click()
      cy.contains("copiado").should("be.visible")

      cy.get('[aria-label="Ocultar secret"]').click()
      cy.get('[aria-label="Editar secret"]').click()
      inputByLabel("Valor").clear().type("postgres://updated")
      cy.contains("button", "Salvar").click()
      cy.contains("postgres://updated", { timeout: 15000 }).should("not.exist")
      cy.get('[aria-label="Revelar secret"]').click()
      cy.contains("postgres://updated").should("be.visible")

      cy.on("window:confirm", () => true)
      cy.get('[aria-label="Remover secret"]').click()
      cy.contains("DATABASE_URL").should("not.exist")
      cy.contains("Nenhum secret neste ambiente", { timeout: 15000 }).should("be.visible")
    })
  })
})
