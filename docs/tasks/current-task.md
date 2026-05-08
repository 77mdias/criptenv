# Current Task — CriptEnv

## Status atual

**Mercado Pago Pix Contribution Flow — implementação local concluída, em verificação final.**

---

## Tarefa em foco

Finalizar a integração pública de contribuições via Mercado Pago Pix na rota `/contribute`.

---

## O que foi implementado nesta sessão

### Mercado Pago Pix Contribution Flow ✅
- Criada rota pública `/contribute` com formulário React Hook Form + Zod.
- Valor do input numérico é convertido para `number` via `valueAsNumber` antes da validação.
- Nome/email opcionais são trimados e omitidos quando vazios.
- Página integra criação de Pix, QR code, Pix copia-e-cola, pending, paid, expired e error states.
- Status usa webhook como fonte primária e polling/sync leve como fallback de UX.
- Backend permite criação anônima de contribuição e mantém validação de valor/metadados.
- Testes adicionados para schema, página de contribuição e criação anônima no backend.

---

## Documentação atualizada

- [x] `docs/project/decisions.md` — DEC-020
- [x] `docs/development/CHANGELOG.md` — seção Mercado Pago Pix Contribution Flow
- [x] `docs/tasks/task-history.md` — registro do fluxo de contribuição
- [x] `docs/tasks/current-task.md` — este arquivo

---

## Próximos passos recomendados

1. Rodar a verificação completa local e corrigir qualquer falha residual.
2. Validar o fluxo manualmente com credenciais sandbox do Mercado Pago.
3. Confirmar webhook público em produção após deploy.

---

**Document Version**: 1.9
**Last Updated**: 2026-05-08
**Status**: Mercado Pago contribution flow implemented locally
