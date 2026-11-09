describe("plan limits", () => {
  // The API only stores the vault config; the browser is what gives it meaning.
  const anyVault = {
    vault_config: { salt: "s", proof_salt: "p", verifier_iv: "i", verifier_ciphertext: "c", verifier_auth_tag: "t" },
    vault_proof: "proof",
  }

  function openCreateDialog() {
    cy.visitHydrated("/projects")
    cy.contains("button", "Novo Projeto").click()
  }

  beforeEach(() => {
    cy.resetDb()
    cy.signup()
  })

  it("stops a free account at 3 projects and frees the slot when one is deleted", () => {
    cy.createProject("first-e2e").then((firstId) => {
      cy.request("POST", "/api/v1/projects", { name: "second-e2e", ...anyVault })
      cy.request("POST", "/api/v1/projects", { name: "third-e2e", ...anyVault })

      openCreateDialog()
      cy.contains("3 de 3 projetos", { timeout: 15000 }).should("be.visible")
      cy.contains("Você chegou ao limite de 3 projetos do seu plano").should("be.visible")
      cy.contains("button", "Criar Projeto").should("be.disabled")

      // The server refuses too, whatever the screen says.
      cy.request({ method: "POST", url: "/api/v1/projects", body: { name: "fourth-e2e", ...anyVault }, failOnStatusCode: false })
        .its("status")
        .should("eq", 402)

      // Over or at the limit, what exists still opens and can be deleted.
      cy.request(`/api/v1/projects/${firstId}`).its("status").should("eq", 200)
      cy.request("DELETE", `/api/v1/projects/${firstId}`).its("status").should("eq", 204)

      openCreateDialog()
      cy.contains("2 de 3 projetos", { timeout: 15000 }).should("be.visible")
      cy.contains("button", "Criar Projeto").should("not.be.disabled")
    })
  })
})
