/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/*!**************************************************!*\
  !*** ./cypress/e2e/project-alert-settings.cy.ts ***!
  \**************************************************/

describe("project alert settings", () => {
    const widths = [320, 375, 390, 430];
    beforeEach(() => {
        cy.resetDb();
        cy.signup();
    });
    it("lets the project owner configure alerts without mobile overflow", () => {
        cy.createProject("alerts-e2e").then((projectId) => {
            cy.intercept("GET", `**/api/v1/projects/${projectId}/alert-settings`, {
                statusCode: 200,
                body: {
                    enabled: true,
                    default_notify_days_before: 7,
                    channels: { in_app: true, email: false, webhook: false },
                    webhook_url_preview: null,
                    webhook_configured: false,
                },
            }).as("getAlertSettings");
            cy.intercept("PATCH", `**/api/v1/projects/${projectId}/alert-settings`, (request) => {
                expect(request.body).to.deep.include({
                    enabled: true,
                    default_notify_days_before: 14,
                    channels: { in_app: true, email: true, webhook: false },
                });
                request.reply({
                    statusCode: 200,
                    body: {
                        enabled: true,
                        default_notify_days_before: 14,
                        channels: { in_app: true, email: true, webhook: false },
                        webhook_url_preview: null,
                        webhook_configured: false,
                    },
                });
            }).as("patchAlertSettings");
            widths.forEach((width) => {
                cy.viewport(width, 900);
                cy.visit(`/projects/${projectId}/settings`);
                cy.wait("@getAlertSettings");
                cy.contains("h2", "Alertas de expiração", { timeout: 15000 }).should("be.visible");
                cy.get("html").then(($html) => {
                    expect($html[0].scrollWidth).to.be.at.most(width);
                });
                cy.get('[aria-label="Canal email"]').click();
                cy.get("#alert-lead-time").select("14");
                cy.contains("button", "Salvar configurações").click();
                cy.wait("@patchAlertSettings");
                cy.contains("Configurações de alertas salvas.").should("be.visible");
            });
        });
    });
});

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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S0FBSyxFQUFFO2dCQUM1QyxFQUFFLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDdkMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsc0JBQXNCLENBQUMsQ0FBQyxLQUFLLEVBQUU7Z0JBQ3JELEVBQUUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUM7Z0JBQzlCLEVBQUUsQ0FBQyxRQUFRLENBQUMsa0NBQWtDLENBQUMsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO1lBQ3RFLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL3dlYi8uL2N5cHJlc3MvZTJlL3Byb2plY3QtYWxlcnQtc2V0dGluZ3MuY3kudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZGVzY3JpYmUoXCJwcm9qZWN0IGFsZXJ0IHNldHRpbmdzXCIsICgpID0+IHtcbiAgY29uc3Qgd2lkdGhzID0gWzMyMCwgMzc1LCAzOTAsIDQzMF1cblxuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBjeS5yZXNldERiKClcbiAgICBjeS5zaWdudXAoKVxuICB9KVxuXG4gIGl0KFwibGV0cyB0aGUgcHJvamVjdCBvd25lciBjb25maWd1cmUgYWxlcnRzIHdpdGhvdXQgbW9iaWxlIG92ZXJmbG93XCIsICgpID0+IHtcbiAgICBjeS5jcmVhdGVQcm9qZWN0KFwiYWxlcnRzLWUyZVwiKS50aGVuKChwcm9qZWN0SWQpID0+IHtcbiAgICAgIGN5LmludGVyY2VwdChcIkdFVFwiLCBgKiovYXBpL3YxL3Byb2plY3RzLyR7cHJvamVjdElkfS9hbGVydC1zZXR0aW5nc2AsIHtcbiAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICBib2R5OiB7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBkZWZhdWx0X25vdGlmeV9kYXlzX2JlZm9yZTogNyxcbiAgICAgICAgICBjaGFubmVsczogeyBpbl9hcHA6IHRydWUsIGVtYWlsOiBmYWxzZSwgd2ViaG9vazogZmFsc2UgfSxcbiAgICAgICAgICB3ZWJob29rX3VybF9wcmV2aWV3OiBudWxsLFxuICAgICAgICAgIHdlYmhvb2tfY29uZmlndXJlZDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9KS5hcyhcImdldEFsZXJ0U2V0dGluZ3NcIilcbiAgICAgIGN5LmludGVyY2VwdChcIlBBVENIXCIsIGAqKi9hcGkvdjEvcHJvamVjdHMvJHtwcm9qZWN0SWR9L2FsZXJ0LXNldHRpbmdzYCwgKHJlcXVlc3QpID0+IHtcbiAgICAgICAgZXhwZWN0KHJlcXVlc3QuYm9keSkudG8uZGVlcC5pbmNsdWRlKHtcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIGRlZmF1bHRfbm90aWZ5X2RheXNfYmVmb3JlOiAxNCxcbiAgICAgICAgICBjaGFubmVsczogeyBpbl9hcHA6IHRydWUsIGVtYWlsOiB0cnVlLCB3ZWJob29rOiBmYWxzZSB9LFxuICAgICAgICB9KVxuICAgICAgICByZXF1ZXN0LnJlcGx5KHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgYm9keToge1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGRlZmF1bHRfbm90aWZ5X2RheXNfYmVmb3JlOiAxNCxcbiAgICAgICAgICAgIGNoYW5uZWxzOiB7IGluX2FwcDogdHJ1ZSwgZW1haWw6IHRydWUsIHdlYmhvb2s6IGZhbHNlIH0sXG4gICAgICAgICAgICB3ZWJob29rX3VybF9wcmV2aWV3OiBudWxsLFxuICAgICAgICAgICAgd2ViaG9va19jb25maWd1cmVkOiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KVxuICAgICAgfSkuYXMoXCJwYXRjaEFsZXJ0U2V0dGluZ3NcIilcblxuICAgICAgd2lkdGhzLmZvckVhY2goKHdpZHRoKSA9PiB7XG4gICAgICAgIGN5LnZpZXdwb3J0KHdpZHRoLCA5MDApXG4gICAgICAgIGN5LnZpc2l0KGAvcHJvamVjdHMvJHtwcm9qZWN0SWR9L3NldHRpbmdzYClcbiAgICAgICAgY3kud2FpdChcIkBnZXRBbGVydFNldHRpbmdzXCIpXG4gICAgICAgIGN5LmNvbnRhaW5zKFwiaDJcIiwgXCJBbGVydGFzIGRlIGV4cGlyYcOnw6NvXCIsIHsgdGltZW91dDogMTUwMDAgfSkuc2hvdWxkKFwiYmUudmlzaWJsZVwiKVxuICAgICAgICBjeS5nZXQoXCJodG1sXCIpLnRoZW4oKCRodG1sKSA9PiB7XG4gICAgICAgICAgZXhwZWN0KCRodG1sWzBdLnNjcm9sbFdpZHRoKS50by5iZS5hdC5tb3N0KHdpZHRoKVxuICAgICAgICB9KVxuXG4gICAgICAgIGN5LmdldCgnW2FyaWEtbGFiZWw9XCJDYW5hbCBlbWFpbFwiXScpLmNsaWNrKClcbiAgICAgICAgY3kuZ2V0KFwiI2FsZXJ0LWxlYWQtdGltZVwiKS5zZWxlY3QoXCIxNFwiKVxuICAgICAgICBjeS5jb250YWlucyhcImJ1dHRvblwiLCBcIlNhbHZhciBjb25maWd1cmHDp8O1ZXNcIikuY2xpY2soKVxuICAgICAgICBjeS53YWl0KFwiQHBhdGNoQWxlcnRTZXR0aW5nc1wiKVxuICAgICAgICBjeS5jb250YWlucyhcIkNvbmZpZ3VyYcOnw7VlcyBkZSBhbGVydGFzIHNhbHZhcy5cIikuc2hvdWxkKFwiYmUudmlzaWJsZVwiKVxuICAgICAgfSlcbiAgICB9KVxuICB9KVxufSlcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==