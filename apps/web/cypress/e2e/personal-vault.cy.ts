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

  function createVault() {
    cy.visitHydrated("/vault")
    cy.contains("Crie seu cofre pessoal", { timeout: 15000 }).should("be.visible")
    inputByLabel("Senha mestra").type(master)
    inputByLabel("Confirme a senha mestra").type(master)
    inputByLabel("Senha de proteção extra").type(extra)
    inputByLabel("Confirme a senha extra").type(extra)
    cy.contains("button", "Continuar").click()

    cy.contains("Guardei a chave de recuperação", { timeout: CRYPTO_TIMEOUT }).click()
    cy.contains("button", "Concluir").click()
  }

  function addNote(title: string, content: string) {
    cy.contains("button", "Novo item", { timeout: 15000 }).click()
    cy.get("#vault-item-type").select("note")
    inputByLabel("Título").type(title)
    inputByLabel("Conteúdo").type(content)
    cy.contains("button", "Salvar").click()
    cy.contains(title, { timeout: 15000 }).should("be.visible")
  }

  it("creates the vault, stores a protected login and reopens it", () => {
    createVault()

    cy.contains("button", "Novo item", { timeout: 15000 }).click()
    inputByLabel("Título").type("Instagram")
    inputByLabel("Usuário").type("jean")
    inputByLabel(/^Senha$/).type("s3nh@-insta")
    cy.contains("label", "Proteção extra").click()
    inputByLabel("Senha de proteção extra").type(extra)
    cy.contains("button", "Salvar").click()
    cy.contains("Instagram", { timeout: CRYPTO_TIMEOUT }).should("be.visible")

    addNote("Wi-Fi", "senha-do-wifi")

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

  it("a stale edit gets the conflict notice and keeps the other tab's save (real Postgres)", () => {
    createVault()
    addNote("Wi-Fi", "senha-do-wifi")

    cy.get('[aria-label="Editar Wi-Fi"]').click()
    inputByLabel("Título").should("have.value", "Wi-Fi")

    // Another tab saves first: same envelopes, version moves on.
    cy.request("/api/v1/personal-vault/items").then(({ body }) => {
      const [item] = body
      cy.request("PUT", `/api/v1/personal-vault/items/${item.id}`, {
        protected: item.protected,
        summary: item.summary,
        body: item.body,
        expected_version: item.version,
      })
        .its("body.version")
        .should("eq", item.version + 1)
    })

    inputByLabel("Título").clear().type("Wi-Fi casa")
    cy.contains("button", "Salvar").click()
    cy.contains("Este item mudou em outra aba. Recarregamos a versão mais recente.", { timeout: 15000 }).should(
      "be.visible",
    )
    cy.contains("Wi-Fi casa").should("not.exist")
    cy.contains("Wi-Fi").should("be.visible")
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

  it("shows a login's site icon and stops asking for it when turned off", () => {
    cy.intercept("GET", "**/api/v1/icons/github.com/icon.png", {
      fixture: "site-icon.png",
      headers: { "content-type": "image/png" },
    }).as("icon")
    createVault()

    cy.contains("button", "Novo item", { timeout: 15000 }).click()
    inputByLabel("Título").type("GitHub")
    inputByLabel("URL").type("https://github.com/login")
    inputByLabel(/^Senha$/).type("s3nh@-gh")
    cy.contains("button", "Salvar").click()

    cy.get('img[src*="/api/v1/icons/github.com/icon.png"]', { timeout: CRYPTO_TIMEOUT })
      .should("be.visible")
      .and(($img) => expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0))

    cy.contains("button", "Configurações").click()
    cy.contains("label", "Mostrar ícones de sites").click()
    cy.get("body").type("{esc}")
    cy.get('img[src*="/api/v1/icons/"]').should("not.exist")
    cy.get("@icon.all").should("have.length", 1)
  })
})
