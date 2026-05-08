# Current Task — CriptEnv

## Status atual

**Blocking CI/Test/Security Gates — implementação local concluída, aguardando verificação final.**

---

## Tarefa em foco

Fechar lacunas de testes do frontend, backend e CLI; estabilizar lint/E2E; e criar workflows GitHub Actions para CI, E2E, segurança e build.

---

## O que foi implementado nesta sessão

### CI/Test/Security Gates ✅
- Corrigido lint do web e compatibilidade `vinext check`.
- Corrigido cache stale do client API após mutations.
- Corrigido Cypress project creation para usar o response do POST.
- Corrigida duplicação de rotas `/api/v1/api/v1`.
- Scheduler de expiração agora usa sessão DB por execução.
- Adicionados testes para signup/proxy no frontend, manifesto de rotas/API scheduler, CLI integrations/CI deploy e GitHub Action.
- Criados workflows: CI, E2E, Security, Docker Build e Dependabot.

---

## Documentação atualizada

- [x] `docs/project/decisions.md` — DEC-019
- [x] `docs/development/CHANGELOG.md` — seção Blocking CI/Test/Security Gates
- [x] `docs/tasks/task-history.md` — registro dos gates
- [x] `docs/tasks/current-task.md` — este arquivo

---

## Próximos passos recomendados

1. Rodar a verificação completa local e corrigir qualquer falha residual.
2. Monitorar primeiros PRs para ruído de `npm audit`, `pip-audit`, Gitleaks e Trivy.
3. Expandir Cypress para Web Alert UI quando essa tela for implementada.

---

**Document Version**: 1.8
**Last Updated**: 2026-05-08
**Status**: CI/Test/Security gates implemented locally
