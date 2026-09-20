describe("project alert settings", () => {
  const widths = [320, 375, 390, 430]

  beforeEach(() => {
    cy.resetDb()
    cy.signup()
  })

  it("lets the project owner configure alerts without mobile overflow", () => {
    cy.createProject("alerts-e2e").then((projectId) => {
      cy.intercept("GET", `**/api/v1/projects/${projectId}/alert-settings`, {
        statusCode: 200,
        body: {
          enabled: true,
          default_notify_days_before: 7,
          channels: { in_app: true, email: false, webhook: false },
          webhook_url_preview: null,
          webhook_configured: false,
        },
      }).as("getAlertSettings")
      cy.intercept("PATCH", `**/api/v1/projects/${projectId}/alert-settings`, (request) => {
        expect(request.body).to.deep.include({
          enabled: true,
          default_notify_days_before: 14,
          channels: { in_app: true, email: true, webhook: false },
        })
        request.reply({
          statusCode: 200,
          body: {
            enabled: true,
            default_notify_days_before: 14,
            channels: { in_app: true, email: true, webhook: false },
            webhook_url_preview: null,
            webhook_configured: false,
          },
        })
      }).as("patchAlertSettings")

      widths.forEach((width) => {
        cy.viewport(width, 900)
        cy.visit(`/projects/${projectId}/settings`)
        cy.wait("@getAlertSettings")
        cy.contains("h2", "Alertas de expiração", { timeout: 15000 }).should("be.visible")
        cy.get("html").then(($html) => {
          expect($html[0].scrollWidth).to.be.at.most(width)
        })

        cy.get('[aria-label="Canal email"]').click()
        cy.get("#alert-lead-time").select("14")
        cy.contains("button", "Salvar configurações").click()
        cy.wait("@patchAlertSettings")
        cy.contains("Configurações de alertas salvas.").should("be.visible")
      })
    })
  })
})
