describe("auth and route smoke", () => {
  beforeEach(() => {
    cy.resetDb()
  })

  it("renders landing and redirects protected dashboard visitors to login", () => {
    cy.visit("/")
    cy.contains("Secrets seguros", { timeout: 15000 }).should("be.visible")

    cy.visit("/dashboard")
    cy.location("pathname", { timeout: 15000 }).should("eq", "/login")
    cy.contains("Entrar").should("be.visible")
  })

  it("signs up with the real API and reaches the dashboard", () => {
    cy.signup()
    cy.contains("Dashboard", { timeout: 15000 }).should("be.visible")
    cy.getCookie("session_token").should("exist")
  })
})
