/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/*!**********************************!*\
  !*** ./cypress/e2e/zz-min.cy.ts ***!
  \**********************************/

const check = (url) => {
    cy.visit(url);
    cy.wait(5000);
    cy.document().then((doc) => {
        var _a, _b, _c;
        const h1 = (_c = (_b = (_a = doc.querySelector("h1")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.slice(0, 50)) !== null && _c !== void 0 ? _c : "(sem h1)";
        const header = !!doc.querySelector("header");
        const err = doc.body.innerText.includes("Algo deu errado");
        cy.task("log", `${url} | h1=${h1} | header=${header} | erroPage=${err}`);
    });
};
describe("diagnóstico por rota", () => {
    it("/", () => check("/"));
    it("/pt-BR/", () => check("/pt-BR/"));
    it("/en/", () => check("/en/"));
    it("/es/", () => check("/es/"));
    it("/signup", () => check("/signup"));
});

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoienotbWluLmN5LnRzLmpzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLE1BQU0sS0FBSyxHQUFHLENBQUMsR0FBVyxFQUFFLEVBQUU7SUFDNUIsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUM7SUFDYixFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNiLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRTs7UUFDekIsTUFBTSxFQUFFLEdBQUcscUJBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLDBDQUFFLFdBQVcsMENBQUUsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsbUNBQUksVUFBVTtRQUMzRSxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUM7UUFDNUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDO1FBQzFELEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsR0FBRyxTQUFTLEVBQUUsYUFBYSxNQUFNLGVBQWUsR0FBRyxFQUFFLENBQUM7SUFDMUUsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVELFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7SUFDcEMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDekIsRUFBRSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDckMsRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDL0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDL0IsRUFBRSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly93ZWIvLi9jeXByZXNzL2UyZS96ei1taW4uY3kudHMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgY2hlY2sgPSAodXJsOiBzdHJpbmcpID0+IHtcbiAgY3kudmlzaXQodXJsKVxuICBjeS53YWl0KDUwMDApXG4gIGN5LmRvY3VtZW50KCkudGhlbigoZG9jKSA9PiB7XG4gICAgY29uc3QgaDEgPSBkb2MucXVlcnlTZWxlY3RvcihcImgxXCIpPy50ZXh0Q29udGVudD8uc2xpY2UoMCwgNTApID8/IFwiKHNlbSBoMSlcIlxuICAgIGNvbnN0IGhlYWRlciA9ICEhZG9jLnF1ZXJ5U2VsZWN0b3IoXCJoZWFkZXJcIilcbiAgICBjb25zdCBlcnIgPSBkb2MuYm9keS5pbm5lclRleHQuaW5jbHVkZXMoXCJBbGdvIGRldSBlcnJhZG9cIilcbiAgICBjeS50YXNrKFwibG9nXCIsIGAke3VybH0gfCBoMT0ke2gxfSB8IGhlYWRlcj0ke2hlYWRlcn0gfCBlcnJvUGFnZT0ke2Vycn1gKVxuICB9KVxufVxuXG5kZXNjcmliZShcImRpYWduw7NzdGljbyBwb3Igcm90YVwiLCAoKSA9PiB7XG4gIGl0KFwiL1wiLCAoKSA9PiBjaGVjayhcIi9cIikpXG4gIGl0KFwiL3B0LUJSL1wiLCAoKSA9PiBjaGVjayhcIi9wdC1CUi9cIikpXG4gIGl0KFwiL2VuL1wiLCAoKSA9PiBjaGVjayhcIi9lbi9cIikpXG4gIGl0KFwiL2VzL1wiLCAoKSA9PiBjaGVjayhcIi9lcy9cIikpXG4gIGl0KFwiL3NpZ251cFwiLCAoKSA9PiBjaGVjayhcIi9zaWdudXBcIikpXG59KTtcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==