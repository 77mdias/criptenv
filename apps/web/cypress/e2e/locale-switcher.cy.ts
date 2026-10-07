beforeEach(() => {
  cy.resetDb()
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      signup(email?: string, password?: string): Chainable<void>
      visitHydrated(url: string): Chainable<void>
    }
  }
}
it("locale switcher troca o idioma do dashboard logado", () => {
  cy.signup()
  cy.location("pathname", { timeout: 15000 }).should("eq", "/dashboard")
  // LocaleSwitcher (Globe) está presente no top-nav
  cy.get('button[aria-label="Alterar idioma"]').should("be.visible")
  // Abre e troca para English
  cy.get('button[aria-label="Alterar idioma"]').click()
  cy.contains("[role=menuitem]", "English").click()
  cy.url({ timeout: 15000 }).should("satisfy", (u: string) => u.includes("/en/dashboard") || u.includes("/en/"))
  // Cookie persiste
  cy.getCookie("NEXT_LOCALE").should("have.property", "value", "en")
})

it("botao de sair da conta traduzido por locale", () => {
  cy.signup()
  cy.location("pathname", { timeout: 15000 }).should("eq", "/dashboard")
  cy.visitHydrated("/account")
  cy.contains("button", "Sair da conta").should("be.visible")
  // Troca para espanhol via NEXT_LOCALE direto (o switcher em si já é
  // coberto pelo teste acima) e recarrega
  cy.setCookie("NEXT_LOCALE", "es")
  cy.visitHydrated("/account")
  cy.contains("button", "Cerrar sesión").should("be.visible")
})
