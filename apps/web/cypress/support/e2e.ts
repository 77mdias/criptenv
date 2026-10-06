import "./commands"

// O middleware next-intl negocia o locale com a precedência
// cookie NEXT_LOCALE > header Accept-Language. O Chromium que o Cypress
// controla roda com en-US, o que redirecionaria todas as navegações para
// /en/* e quebraria as asserções em pt-BR da suíte. Fixa pt-BR para os E2E.
beforeEach(() => {
  cy.setCookie("NEXT_LOCALE", "pt-BR")
})
