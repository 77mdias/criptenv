/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/*!********************************!*\
  !*** ./cypress/e2e/auth.cy.ts ***!
  \********************************/

describe("auth and route smoke", () => {
    beforeEach(() => {
        cy.resetDb();
    });
    it("renders landing and redirects protected dashboard visitors to login", () => {
        cy.visit("/");
        cy.contains("Secrets seguros", { timeout: 15000 }).should("be.visible");
        cy.visit("/dashboard");
        cy.location("pathname", { timeout: 15000 }).should("eq", "/login");
        cy.contains("Entrar").should("be.visible");
    });
    it("signs up with the real API and reaches the dashboard", () => {
        cy.signup();
        cy.contains("Dashboard", { timeout: 15000 }).should("be.visible");
        cy.getCookie("session_token").should("exist");
    });
});

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5jeS50cy5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxRQUFRLENBQUMsc0JBQXNCLEVBQUUsR0FBRyxFQUFFO0lBQ3BDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxFQUFFLENBQUMsT0FBTyxFQUFFO0lBQ2QsQ0FBQyxDQUFDO0lBRUYsRUFBRSxDQUFDLHFFQUFxRSxFQUFFLEdBQUcsRUFBRTtRQUM3RSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQztRQUNiLEVBQUUsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO1FBRXZFLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO1FBQ3RCLEVBQUUsQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUM7UUFDbEUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO0lBQzVDLENBQUMsQ0FBQztJQUVGLEVBQUUsQ0FBQyxzREFBc0QsRUFBRSxHQUFHLEVBQUU7UUFDOUQsRUFBRSxDQUFDLE1BQU0sRUFBRTtRQUNYLEVBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztRQUNqRSxFQUFFLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7SUFDL0MsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vd2ViLy4vY3lwcmVzcy9lMmUvYXV0aC5jeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJkZXNjcmliZShcImF1dGggYW5kIHJvdXRlIHNtb2tlXCIsICgpID0+IHtcbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgY3kucmVzZXREYigpXG4gIH0pXG5cbiAgaXQoXCJyZW5kZXJzIGxhbmRpbmcgYW5kIHJlZGlyZWN0cyBwcm90ZWN0ZWQgZGFzaGJvYXJkIHZpc2l0b3JzIHRvIGxvZ2luXCIsICgpID0+IHtcbiAgICBjeS52aXNpdChcIi9cIilcbiAgICBjeS5jb250YWlucyhcIlNlY3JldHMgc2VndXJvc1wiLCB7IHRpbWVvdXQ6IDE1MDAwIH0pLnNob3VsZChcImJlLnZpc2libGVcIilcblxuICAgIGN5LnZpc2l0KFwiL2Rhc2hib2FyZFwiKVxuICAgIGN5LmxvY2F0aW9uKFwicGF0aG5hbWVcIiwgeyB0aW1lb3V0OiAxNTAwMCB9KS5zaG91bGQoXCJlcVwiLCBcIi9sb2dpblwiKVxuICAgIGN5LmNvbnRhaW5zKFwiRW50cmFyXCIpLnNob3VsZChcImJlLnZpc2libGVcIilcbiAgfSlcblxuICBpdChcInNpZ25zIHVwIHdpdGggdGhlIHJlYWwgQVBJIGFuZCByZWFjaGVzIHRoZSBkYXNoYm9hcmRcIiwgKCkgPT4ge1xuICAgIGN5LnNpZ251cCgpXG4gICAgY3kuY29udGFpbnMoXCJEYXNoYm9hcmRcIiwgeyB0aW1lb3V0OiAxNTAwMCB9KS5zaG91bGQoXCJiZS52aXNpYmxlXCIpXG4gICAgY3kuZ2V0Q29va2llKFwic2Vzc2lvbl90b2tlblwiKS5zaG91bGQoXCJleGlzdFwiKVxuICB9KVxufSlcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==