/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./cypress/support/commands.ts":
/*!*************************************!*\
  !*** ./cypress/support/commands.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
function inputByLabel(label) {
    return cy.contains("label", label).parent().find("input, textarea");
}
Cypress.Commands.add("resetDb", () => {
    cy.task("resetDb");
});
// `cy.visit` resolves on the document load event, which in the dev server fires
// before React hydrates. Anything typed or clicked in that window only touches
// the server-rendered DOM: inputs accept the text, but no handler is attached
// yet, so the submit button is inert and no request leaves the browser.
// The app's session bootstrap is a React effect, so it can only run once the
// tree has hydrated - waiting for it guarantees the page is interactive.
Cypress.Commands.add("visitHydrated", (url) => {
    cy.intercept("GET", "**/api/auth/session").as("sessionBootstrap");
    cy.visit(url);
    cy.wait("@sessionBootstrap", { timeout: 20000 });
});
Cypress.Commands.add("signup", (email = "e2e.user@example.com", password = "Passw0rd!") => {
    cy.visitHydrated("/signup");
    inputByLabel("Nome").type("E2E User");
    inputByLabel("Email").type(email);
    inputByLabel("Senha").type(password);
    inputByLabel("Confirmar Senha").type(password);
    // Mandatory terms acceptance: the form blocks submission until the
    // checkbox is marked (client-side Zod + API 422 without it).
    cy.get("#accept-terms").check();
    cy.contains("button", "Criar Conta").click();
    // After signup, user is redirected to verify-email/sent
    cy.location("pathname", { timeout: 15000 }).should("eq", "/verify-email/sent");
    // In E2E environment, email service is disabled; send-verification exposes dev_token
    cy.request("POST", "http://localhost:8000/api/auth/send-verification", { email }).then((response) => {
        expect(response.status).to.eq(200);
        const token = response.body.dev_token;
        expect(token).to.be.a("string");
        cy.visit(`/verify-email?token=${token}`);
        cy.contains("Email verificado!", { timeout: 15000 }).should("be.visible");
        cy.contains("a", "Entrar na conta").click();
    });
    // Login after verification
    cy.location("pathname", { timeout: 15000 }).should("eq", "/login");
    inputByLabel("Email").type(email);
    inputByLabel("Senha").type(password);
    cy.contains("button", "Entrar").click();
    cy.location("pathname", { timeout: 15000 }).should("eq", "/dashboard");
});
Cypress.Commands.add("createProject", (name = "e2e-project", vaultPassword = "VaultPassw0rd!") => {
    cy.visitHydrated("/projects");
    cy.intercept("POST", "**/api/v1/projects").as("createProject");
    cy.contains("button", "Novo Projeto").click();
    inputByLabel("Nome do projeto").type(name);
    inputByLabel("Descrição").type("Created by Cypress E2E");
    inputByLabel("Senha do vault").type(vaultPassword);
    inputByLabel("Confirmar senha do vault").type(vaultPassword);
    cy.contains("button", "Criar Projeto").click();
    cy.contains(name, { timeout: 15000 }).should("be.visible");
    return cy.wait("@createProject")
        .its("response.body.id")
        .should("be.a", "string");
});



/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!********************************!*\
  !*** ./cypress/support/e2e.ts ***!
  \********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _commands__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./commands */ "./cypress/support/commands.ts");

// O middleware next-intl negocia o locale com a precedência
// cookie NEXT_LOCALE > header Accept-Language. O Chromium que o Cypress
// controla roda com en-US, o que redirecionaria todas as navegações para
// /en/* e quebraria as asserções em pt-BR da suíte. Fixa pt-BR para os E2E.
beforeEach(() => {
    cy.setCookie("NEXT_LOCALE", "pt-BR");
});

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q0FBQyxJQUFJLEVBQUUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO0lBRTFELE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztTQUM3QixHQUFHLENBQUMsa0JBQWtCLENBQUM7U0FDdkIsTUFBTSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUM7QUFDN0IsQ0FBQyxDQUFDOzs7Ozs7OztVQ3JGRjtVQUNBOztVQUVBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBOzs7OztXQ3RCQTtXQUNBO1dBQ0E7V0FDQSx1REFBdUQsaUJBQWlCO1dBQ3hFO1dBQ0EsZ0RBQWdELGFBQWE7V0FDN0Q7Ozs7Ozs7Ozs7OztBQ05tQjtBQUVuQiw0REFBNEQ7QUFDNUQsd0VBQXdFO0FBQ3hFLHlFQUF5RTtBQUN6RSw0RUFBNEU7QUFDNUUsVUFBVSxDQUFDLEdBQUcsRUFBRTtJQUNkLEVBQUUsQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQztBQUN0QyxDQUFDLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly93ZWIvLi9jeXByZXNzL3N1cHBvcnQvY29tbWFuZHMudHMiLCJ3ZWJwYWNrOi8vd2ViL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3dlYi93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3dlYi8uL2N5cHJlc3Mvc3VwcG9ydC9lMmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZGVjbGFyZSBnbG9iYWwge1xuICAvLyBDeXByZXNzIGV4cG9zZXMgY29tbWFuZCBhdWdtZW50YXRpb24gdGhyb3VnaCBpdHMgZ2xvYmFsIG5hbWVzcGFjZS5cbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1uYW1lc3BhY2VcbiAgbmFtZXNwYWNlIEN5cHJlc3Mge1xuICAgIGludGVyZmFjZSBDaGFpbmFibGUge1xuICAgICAgcmVzZXREYigpOiBDaGFpbmFibGU8dm9pZD5cbiAgICAgIHZpc2l0SHlkcmF0ZWQodXJsOiBzdHJpbmcpOiBDaGFpbmFibGU8dm9pZD5cbiAgICAgIHNpZ251cChlbWFpbD86IHN0cmluZywgcGFzc3dvcmQ/OiBzdHJpbmcpOiBDaGFpbmFibGU8dm9pZD5cbiAgICAgIGNyZWF0ZVByb2plY3QobmFtZT86IHN0cmluZywgdmF1bHRQYXNzd29yZD86IHN0cmluZyk6IENoYWluYWJsZTxzdHJpbmc+XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGlucHV0QnlMYWJlbChsYWJlbDogc3RyaW5nKSB7XG4gIHJldHVybiBjeS5jb250YWlucyhcImxhYmVsXCIsIGxhYmVsKS5wYXJlbnQoKS5maW5kKFwiaW5wdXQsIHRleHRhcmVhXCIpXG59XG5cbkN5cHJlc3MuQ29tbWFuZHMuYWRkKFwicmVzZXREYlwiLCAoKSA9PiB7XG4gIGN5LnRhc2soXCJyZXNldERiXCIpXG59KVxuXG4vLyBgY3kudmlzaXRgIHJlc29sdmVzIG9uIHRoZSBkb2N1bWVudCBsb2FkIGV2ZW50LCB3aGljaCBpbiB0aGUgZGV2IHNlcnZlciBmaXJlc1xuLy8gYmVmb3JlIFJlYWN0IGh5ZHJhdGVzLiBBbnl0aGluZyB0eXBlZCBvciBjbGlja2VkIGluIHRoYXQgd2luZG93IG9ubHkgdG91Y2hlc1xuLy8gdGhlIHNlcnZlci1yZW5kZXJlZCBET006IGlucHV0cyBhY2NlcHQgdGhlIHRleHQsIGJ1dCBubyBoYW5kbGVyIGlzIGF0dGFjaGVkXG4vLyB5ZXQsIHNvIHRoZSBzdWJtaXQgYnV0dG9uIGlzIGluZXJ0IGFuZCBubyByZXF1ZXN0IGxlYXZlcyB0aGUgYnJvd3Nlci5cbi8vIFRoZSBhcHAncyBzZXNzaW9uIGJvb3RzdHJhcCBpcyBhIFJlYWN0IGVmZmVjdCwgc28gaXQgY2FuIG9ubHkgcnVuIG9uY2UgdGhlXG4vLyB0cmVlIGhhcyBoeWRyYXRlZCAtIHdhaXRpbmcgZm9yIGl0IGd1YXJhbnRlZXMgdGhlIHBhZ2UgaXMgaW50ZXJhY3RpdmUuXG5DeXByZXNzLkNvbW1hbmRzLmFkZChcInZpc2l0SHlkcmF0ZWRcIiwgKHVybDogc3RyaW5nKSA9PiB7XG4gIGN5LmludGVyY2VwdChcIkdFVFwiLCBcIioqL2FwaS9hdXRoL3Nlc3Npb25cIikuYXMoXCJzZXNzaW9uQm9vdHN0cmFwXCIpXG4gIGN5LnZpc2l0KHVybClcbiAgY3kud2FpdChcIkBzZXNzaW9uQm9vdHN0cmFwXCIsIHsgdGltZW91dDogMjAwMDAgfSlcbn0pXG5cbkN5cHJlc3MuQ29tbWFuZHMuYWRkKFxuICBcInNpZ251cFwiLFxuICAoZW1haWwgPSBcImUyZS51c2VyQGV4YW1wbGUuY29tXCIsIHBhc3N3b3JkID0gXCJQYXNzdzByZCFcIikgPT4ge1xuICAgIGN5LnZpc2l0SHlkcmF0ZWQoXCIvc2lnbnVwXCIpXG4gICAgaW5wdXRCeUxhYmVsKFwiTm9tZVwiKS50eXBlKFwiRTJFIFVzZXJcIilcbiAgICBpbnB1dEJ5TGFiZWwoXCJFbWFpbFwiKS50eXBlKGVtYWlsKVxuICAgIGlucHV0QnlMYWJlbChcIlNlbmhhXCIpLnR5cGUocGFzc3dvcmQpXG4gICAgaW5wdXRCeUxhYmVsKFwiQ29uZmlybWFyIFNlbmhhXCIpLnR5cGUocGFzc3dvcmQpXG4gICAgLy8gTWFuZGF0b3J5IHRlcm1zIGFjY2VwdGFuY2U6IHRoZSBmb3JtIGJsb2NrcyBzdWJtaXNzaW9uIHVudGlsIHRoZVxuICAgIC8vIGNoZWNrYm94IGlzIG1hcmtlZCAoY2xpZW50LXNpZGUgWm9kICsgQVBJIDQyMiB3aXRob3V0IGl0KS5cbiAgICBjeS5nZXQoXCIjYWNjZXB0LXRlcm1zXCIpLmNoZWNrKClcbiAgICBjeS5jb250YWlucyhcImJ1dHRvblwiLCBcIkNyaWFyIENvbnRhXCIpLmNsaWNrKClcblxuICAgIC8vIEFmdGVyIHNpZ251cCwgdXNlciBpcyByZWRpcmVjdGVkIHRvIHZlcmlmeS1lbWFpbC9zZW50XG4gICAgY3kubG9jYXRpb24oXCJwYXRobmFtZVwiLCB7IHRpbWVvdXQ6IDE1MDAwIH0pLnNob3VsZChcImVxXCIsIFwiL3ZlcmlmeS1lbWFpbC9zZW50XCIpXG5cbiAgICAvLyBJbiBFMkUgZW52aXJvbm1lbnQsIGVtYWlsIHNlcnZpY2UgaXMgZGlzYWJsZWQ7IHNlbmQtdmVyaWZpY2F0aW9uIGV4cG9zZXMgZGV2X3Rva2VuXG4gICAgY3kucmVxdWVzdChcIlBPU1RcIiwgXCJodHRwOi8vbG9jYWxob3N0OjgwMDAvYXBpL2F1dGgvc2VuZC12ZXJpZmljYXRpb25cIiwgeyBlbWFpbCB9KS50aGVuKFxuICAgICAgKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgIGV4cGVjdChyZXNwb25zZS5zdGF0dXMpLnRvLmVxKDIwMClcbiAgICAgICAgY29uc3QgdG9rZW4gPSByZXNwb25zZS5ib2R5LmRldl90b2tlblxuICAgICAgICBleHBlY3QodG9rZW4pLnRvLmJlLmEoXCJzdHJpbmdcIilcblxuICAgICAgICBjeS52aXNpdChgL3ZlcmlmeS1lbWFpbD90b2tlbj0ke3Rva2VufWApXG4gICAgICAgIGN5LmNvbnRhaW5zKFwiRW1haWwgdmVyaWZpY2FkbyFcIiwgeyB0aW1lb3V0OiAxNTAwMCB9KS5zaG91bGQoXCJiZS52aXNpYmxlXCIpXG4gICAgICAgIGN5LmNvbnRhaW5zKFwiYVwiLCBcIkVudHJhciBuYSBjb250YVwiKS5jbGljaygpXG4gICAgICB9XG4gICAgKVxuXG4gICAgLy8gTG9naW4gYWZ0ZXIgdmVyaWZpY2F0aW9uXG4gICAgY3kubG9jYXRpb24oXCJwYXRobmFtZVwiLCB7IHRpbWVvdXQ6IDE1MDAwIH0pLnNob3VsZChcImVxXCIsIFwiL2xvZ2luXCIpXG4gICAgaW5wdXRCeUxhYmVsKFwiRW1haWxcIikudHlwZShlbWFpbClcbiAgICBpbnB1dEJ5TGFiZWwoXCJTZW5oYVwiKS50eXBlKHBhc3N3b3JkKVxuICAgIGN5LmNvbnRhaW5zKFwiYnV0dG9uXCIsIFwiRW50cmFyXCIpLmNsaWNrKClcbiAgICBjeS5sb2NhdGlvbihcInBhdGhuYW1lXCIsIHsgdGltZW91dDogMTUwMDAgfSkuc2hvdWxkKFwiZXFcIiwgXCIvZGFzaGJvYXJkXCIpXG4gIH1cbilcblxuQ3lwcmVzcy5Db21tYW5kcy5hZGQoXCJjcmVhdGVQcm9qZWN0XCIsIChuYW1lID0gXCJlMmUtcHJvamVjdFwiLCB2YXVsdFBhc3N3b3JkID0gXCJWYXVsdFBhc3N3MHJkIVwiKSA9PiB7XG4gIGN5LnZpc2l0SHlkcmF0ZWQoXCIvcHJvamVjdHNcIilcbiAgY3kuaW50ZXJjZXB0KFwiUE9TVFwiLCBcIioqL2FwaS92MS9wcm9qZWN0c1wiKS5hcyhcImNyZWF0ZVByb2plY3RcIilcbiAgY3kuY29udGFpbnMoXCJidXR0b25cIiwgXCJOb3ZvIFByb2pldG9cIikuY2xpY2soKVxuICBpbnB1dEJ5TGFiZWwoXCJOb21lIGRvIHByb2pldG9cIikudHlwZShuYW1lKVxuICBpbnB1dEJ5TGFiZWwoXCJEZXNjcmnDp8Ojb1wiKS50eXBlKFwiQ3JlYXRlZCBieSBDeXByZXNzIEUyRVwiKVxuICBpbnB1dEJ5TGFiZWwoXCJTZW5oYSBkbyB2YXVsdFwiKS50eXBlKHZhdWx0UGFzc3dvcmQpXG4gIGlucHV0QnlMYWJlbChcIkNvbmZpcm1hciBzZW5oYSBkbyB2YXVsdFwiKS50eXBlKHZhdWx0UGFzc3dvcmQpXG4gIGN5LmNvbnRhaW5zKFwiYnV0dG9uXCIsIFwiQ3JpYXIgUHJvamV0b1wiKS5jbGljaygpXG4gIGN5LmNvbnRhaW5zKG5hbWUsIHsgdGltZW91dDogMTUwMDAgfSkuc2hvdWxkKFwiYmUudmlzaWJsZVwiKVxuXG4gIHJldHVybiBjeS53YWl0KFwiQGNyZWF0ZVByb2plY3RcIilcbiAgICAuaXRzKFwicmVzcG9uc2UuYm9keS5pZFwiKVxuICAgIC5zaG91bGQoXCJiZS5hXCIsIFwic3RyaW5nXCIpXG59KVxuXG5leHBvcnQge31cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgXCIuL2NvbW1hbmRzXCJcblxuLy8gTyBtaWRkbGV3YXJlIG5leHQtaW50bCBuZWdvY2lhIG8gbG9jYWxlIGNvbSBhIHByZWNlZMOqbmNpYVxuLy8gY29va2llIE5FWFRfTE9DQUxFID4gaGVhZGVyIEFjY2VwdC1MYW5ndWFnZS4gTyBDaHJvbWl1bSBxdWUgbyBDeXByZXNzXG4vLyBjb250cm9sYSByb2RhIGNvbSBlbi1VUywgbyBxdWUgcmVkaXJlY2lvbmFyaWEgdG9kYXMgYXMgbmF2ZWdhw6fDtWVzIHBhcmFcbi8vIC9lbi8qIGUgcXVlYnJhcmlhIGFzIGFzc2Vyw6fDtWVzIGVtIHB0LUJSIGRhIHN1w610ZS4gRml4YSBwdC1CUiBwYXJhIG9zIEUyRS5cbmJlZm9yZUVhY2goKCkgPT4ge1xuICBjeS5zZXRDb29raWUoXCJORVhUX0xPQ0FMRVwiLCBcInB0LUJSXCIpXG59KVxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9