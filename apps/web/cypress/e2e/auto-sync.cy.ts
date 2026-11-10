function fieldByLabel(label: string) {
  return cy.contains("label", label).parent().find("input, textarea")
}

describe("automatic sync to hosting (Max)", () => {
  const vaultPassword = "VaultPassw0rd!"
  const connection = { provider: "vercel", name: "Site", config: { api_token: "vercel-token-e2e", project_id: "prj_e2e" } }

  beforeEach(() => {
    cy.resetDb()
    cy.signup()
  })

  it("shows the option locked, naming the Max plan, to a free account", () => {
    cy.createProject("locked-e2e", vaultPassword).then((projectId) => {
      cy.request("POST", `/api/v1/projects/${projectId}/integrations`, connection)

      cy.visitHydrated("/integrations")
      cy.contains("h3", "Envio automático", { timeout: 15000 }).should("be.visible")
      cy.contains("Disponível no plano Max.").should("be.visible")
      cy.contains("label", "Production").find("select").should("be.disabled")
      cy.contains("label", "Disparar novo deploy depois do envio").parent().find("input").should("be.disabled")

      // The server refuses too, whatever the screen says.
      cy.request(`/api/v1/projects/${projectId}/integrations`).then(({ body }) => {
        expect(body.features).to.deep.equal([])
        cy.request({
          method: "PATCH",
          url: `/api/v1/projects/${projectId}/integrations/${body.integrations[0].id}`,
          body: { redeploy: true },
          failOnStatusCode: false,
        })
          .its("status")
          .should("eq", 402)
      })
    })
  })

  it("sends the environment on save and removes a deleted variable, without a real provider", () => {
    cy.createProject("auto-e2e", vaultPassword).then((projectId) => {
      cy.request(`/api/v1/projects/${projectId}/environments`).then(({ body }) => {
        // Bind every environment so the test does not depend on which one opens first.
        const targets = Object.fromEntries(
          body.environments.map((environment: { id: string }) => [environment.id, "preview"]),
        )
        cy.intercept("GET", `**/api/v1/projects/${projectId}/integrations`, {
          integrations: [{
            id: "11111111-1111-4111-8111-111111111111", project_id: projectId, provider: "vercel", name: "Site",
            status: "active", last_sync_at: null, last_error: null, created_at: "2026-11-10T00:00:00Z",
            auto_sync_targets: targets, redeploy: true,
          }],
          total: 1,
          available_providers: ["vercel", "render", "cloudflare"],
          features: ["auto_sync", "ci_sync", "sync_redeploy"],
        })
        cy.intercept("POST", `**/api/v1/projects/${projectId}/integrations/*/sync`, {
          success: true, message: null, synced_count: 1, secrets: null, deploy_scheduled: true,
        }).as("sync")

        cy.visit(`/projects/${projectId}/secrets`)
        cy.contains("Desbloquear vault", { timeout: 15000 }).should("be.visible")
        fieldByLabel("Senha mestra").type(vaultPassword)
        cy.contains("button", "Desbloquear").click()
        cy.contains("Vault desbloqueado apenas nesta sessão", { timeout: 15000 }).should("be.visible")

        cy.contains("Criar Secret").click()
        fieldByLabel("Chave").type("database_url")
        fieldByLabel("Valor").type("postgres://example")
        cy.contains("button", "Salvar").click()

        cy.wait("@sync").its("request.body").should((sent) => {
          expect(sent.direction).to.equal("push")
          expect(sent.environment).to.equal("preview")
          expect(sent.secrets.map((secret: { key: string }) => secret.key)).to.deep.equal(["DATABASE_URL"])
          expect(sent.secrets[0].value).to.equal("postgres://example")
          expect(sent).not.to.have.property("delete_keys")
        })
        cy.contains("Enviado para Site (preview).", { timeout: 15000 }).should("be.visible")
        cy.contains("Novo deploy em cerca de 1 minuto.").should("be.visible")

        cy.get('[aria-label="Remover secret"]').click()
        cy.contains("button", "Remover").click()

        cy.wait("@sync").its("request.body").should((sent) => {
          expect(sent.secrets).to.deep.equal([])
          expect(sent.delete_keys).to.deep.equal(["DATABASE_URL"])
        })
        cy.contains("Nenhum secret neste ambiente", { timeout: 15000 }).should("be.visible")
      })
    })
  })
})
