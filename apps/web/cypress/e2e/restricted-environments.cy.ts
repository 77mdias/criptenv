function fieldByLabel(label: string) {
  return cy.contains("label", label).parent().find("input, textarea")
}

// The developer's side (a restricted environment does not exist for them) is covered route by route in
// apps/api/tests/test_restricted_environment_routes.py; here the owner's screens run against the real API.
describe("environments in the project settings", () => {
  beforeEach(() => {
    cy.resetDb()
    cy.signup()
  })

  it("a free project is at its 3 environments and cannot get a fourth", () => {
    cy.createProject("limit-e2e").then((projectId) => {
      cy.visitHydrated(`/projects/${projectId}/settings`)

      cy.contains("h2", "Ambientes", { timeout: 15000 }).should("be.visible")
      cy.contains("3 de 3 ambientes").should("be.visible")
      cy.contains("Este projeto chegou ao limite de 3 ambientes").should("be.visible")
      cy.contains("button", "Criar ambiente").should("be.disabled")

      // The server refuses too, whatever the screen says.
      cy.request({
        method: "POST",
        url: `/api/v1/projects/${projectId}/environments`,
        body: { name: "fourth" },
        failOnStatusCode: false,
      })
        .its("status")
        .should("eq", 402)
    })
  })

  it("creates a restricted environment once a slot is free, and never restricts a seeded one", () => {
    cy.createProject("restricted-e2e").then((projectId) => {
      const api = `/api/v1/projects/${projectId}/environments`
      // A free project has no spare slot: archive staging to make room.
      cy.request(api).then(({ body }) => {
        const staging = body.environments.find((environment: { name: string }) => environment.name === "staging")
        cy.request("DELETE", `${api}/${staging.id}`)
        const production = body.environments.find((environment: { name: string }) => environment.name === "production")
        cy.request({ method: "PATCH", url: `${api}/${production.id}`, body: { restricted: true }, failOnStatusCode: false })
          .its("status")
          .should("eq", 422)
      })

      cy.visitHydrated(`/projects/${projectId}/settings`)
      cy.contains("2 de 3 ambientes", { timeout: 15000 }).should("be.visible")
      fieldByLabel("Nome").first().type("db-admin")
      fieldByLabel("Nome de exibição").type("Banco (admin)")
      cy.contains("label", "Restrito a administradores").click()
      cy.contains("button", "Criar ambiente").click()

      cy.get('li[aria-label="db-admin"]', { timeout: 15000 }).within(() => {
        cy.contains("Restrito a administradores").should("be.visible")
        cy.contains("button", "Abrir ao time").should("be.visible")
      })
      cy.contains("3 de 3 ambientes").should("be.visible")
      cy.get('li[aria-label="production"]').contains("button", "Restringir").should("not.exist")

      cy.request(api).then(({ body }) => {
        const created = body.environments.find((environment: { name: string }) => environment.name === "db-admin")
        expect(created.restricted).to.eq(true)
      })
    })
  })
})
