# Current Task — CriptEnv

## Status atual

**Landing Pricing Redesign — implementação local em verificação final.**

---

## Tarefa em foco

Refazer a seção pricing da landing mantendo o carousel com 3 cards compatíveis com o estado real do projeto e corrigir a automação de troca dos cards.

---

## O que foi implementado nesta sessão

### Landing Pricing Redesign ✅
- Pricing agora usa os cards `Contribute`, `Open Source` e `Maybe Later`, todos em inglês.
- Card `Contribute` destaca apoio Pix/open source e aponta para `/contribute`.
- Cards comerciais fictícios foram removidos da landing.
- Carousel mantém 3 cards, mas o autoplay agora usa o índice atual real para evitar card inesperado após alguns ciclos.
- Navegação por setas e dots foi alinhada ao mesmo fluxo de estado do autoplay.

---

## Documentação atualizada

- [x] `docs/development/CHANGELOG.md` — seção Landing Pricing Redesign
- [x] `docs/tasks/task-history.md` — registro do redesign de pricing
- [x] `docs/tasks/current-task.md` — este arquivo

---

## Próximos passos recomendados

1. Rodar verificações web e corrigir qualquer falha residual.
2. Validar visualmente a seção pricing em desktop e mobile.
3. Confirmar manualmente o link `/contribute` no card principal.

---

**Document Version**: 1.10
**Last Updated**: 2026-05-08
**Status**: Landing pricing redesign implemented locally
