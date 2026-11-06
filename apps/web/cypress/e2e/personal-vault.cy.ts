function inputByLabel(label: string | RegExp) {
  return cy.contains("label", label).parent().find("input, textarea")
}

// PBKDF2 at 600k iterations runs in the browser; give key derivation room.
const CRYPTO_TIMEOUT = 30000

describe("personal vault", () => {
  const master = "MestraForte123!"
  const extra = "Extra1234!"

  beforeEach(() => {
    cy.resetDb()
    cy.signup()
  })

  it("creates the vault, stores a protected login and reopens it", () => {
    cy.visitHydrated("/vault")
    cy.contains("Crie seu cofre pessoal", { timeout: 15000 }).should("be.visible")
    inputByLabel("Senha mestra").type(master)
    inputByLabel("Confirme a senha mestra").type(master)
    inputByLabel("Senha de proteção extra").type(extra)
    inputByLabel("Confirme a senha extra").type(extra)
    cy.contains("button", "Continuar").click()

    cy.contains("Guardei a chave de recuperação", { timeout: CRYPTO_TIMEOUT }).click()
    cy.contains("button", "Concluir").click()

    cy.contains("button", "Novo item", { timeout: 15000 }).click()
    inputByLabel("Título").type("Instagram")
    inputByLabel("Usuário").type("jean")
    inputByLabel(/^Senha$/).type("s3nh@-insta")
    cy.contains("label", "Proteção extra").click()
    inputByLabel("Senha de proteção extra").type(extra)
    cy.contains("button", "Salvar").click()
    cy.contains("Instagram", { timeout: CRYPTO_TIMEOUT }).should("be.visible")

    cy.contains("button", "Novo item").click()
    cy.get("#vault-item-type").select("note")
    inputByLabel("Título").type("Wi-Fi")
    inputByLabel("Conteúdo").type("senha-do-wifi")
    cy.contains("button", "Salvar").click()
    cy.contains("Wi-Fi", { timeout: 15000 }).should("be.visible")

    // The server only ever sees envelopes, never the titles or secrets.
    cy.request("/api/v1/personal-vault/items").then(({ body }) => {
      expect(body).to.have.length(2)
      expect(JSON.stringify(body)).not.to.contain("Instagram")
      expect(JSON.stringify(body)).not.to.contain("s3nh@-insta")
    })

    cy.reload()
    cy.contains("Cofre trancado", { timeout: 15000 }).should("be.visible")
    inputByLabel("Senha mestra").type(master)
    cy.contains("button", "Abrir cofre").click()
    cy.contains("Instagram", { timeout: CRYPTO_TIMEOUT }).should("be.visible")
    cy.contains("Wi-Fi").should("be.visible")

    cy.get('[aria-label="Revelar Instagram"]').click()
    inputByLabel("Senha de proteção extra").type(extra)
    cy.contains("button", "Desbloquear").click()
    cy.contains("s3nh@-insta", { timeout: CRYPTO_TIMEOUT }).should("be.visible")
  })

  it("refuses Authorization headers (CLI, API keys, CI tokens)", () => {
    cy.request({
      url: "/api/v1/personal-vault/items",
      headers: { Authorization: "Bearer cek_anything" },
      failOnStatusCode: false,
    })
      .its("status")
      .should("eq", 403)
  })
})
