// UX.5/UX.6 against the real API: Activity, Security, Access and the quick search.
// Cross-user isolation and restricted environments are covered in apps/api/tests/test_me_audit.py
// and test_me_overview.py.
describe("activity, security and access screens", () => {
  beforeEach(() => {
    cy.resetDb()
    cy.signup()
  })

  it("follows a CI token from the security score to its revocation", () => {
    cy.createProject("screens-e2e").then((projectId) => {
      cy.request("POST", `/api/v1/projects/${projectId}/tokens`, { name: "deploy", scopes: ["read:secrets"] })

      // Activity: the project's events, filterable by origin through the URL.
      cy.visitHydrated("/activity")
      cy.contains("screens-e2e", { timeout: 15000 }).should("be.visible")
      cy.contains("project.created").should("be.visible")
      cy.get("select").eq(1).select("ci_session")
      cy.location("search").should("contain", "origin=ci_session")
      cy.contains("Nada com esses filtros", { timeout: 15000 }).should("be.visible")

      // Security: a new account has 2FA off, and the token never expires.
      cy.visitHydrated("/security")
      cy.contains("Autenticação 2FA desligada", { timeout: 15000 }).should("be.visible")
      cy.contains("1 credencial sem expiração").should("be.visible")
      cy.contains("Nota 55 de 100").should("be.visible")

      // Access: revoke it, then it only shows among the revoked ones.
      cy.visitHydrated("/access")
      cy.get('article[aria-label="deploy"]', { timeout: 15000 }).within(() => {
        cy.contains("Sem expiração").should("be.visible")
        cy.contains("button", "Revogar").click()
      })
      cy.get('[role="dialog"]').contains("button", "Revogar").click()
      cy.get('article[aria-label="deploy"]').should("not.exist")
      cy.contains("label", "Situação").find("select").select("revoked")
      cy.get('article[aria-label="deploy"]').contains("Revogada").should("be.visible")

      cy.visitHydrated("/security")
      cy.contains("Nota 70 de 100", { timeout: 15000 }).should("be.visible")
      cy.contains("credencial sem expiração").should("not.exist")
    })
  })

  it("opens a project from the quick search with the keyboard only", () => {
    cy.createProject("palette-e2e").then((projectId) => {
      cy.visitHydrated("/dashboard")
      cy.contains("palette-e2e", { timeout: 15000 }).should("be.visible") // overview loaded and cached
      cy.get("body").type("{ctrl}k")
      cy.get('[role="combobox"]').type("palette-e2e{enter}")
      cy.location("pathname", { timeout: 15000 }).should("eq", `/projects/${projectId}`)
    })
  })
})
