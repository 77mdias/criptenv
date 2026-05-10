# Current Task — CriptEnv

## Status atual

**VPS DuckDNS Drift Recovery — configuração e runbook documentados.**

---

## Tarefa em foco

Reduzir quedas públicas do backend causadas por drift do A record do DuckDNS e documentar o diagnóstico para quando API/Nginx internos estão saudáveis, mas `https://criptenv.duckdns.org` não conecta publicamente.

---

## O que foi implementado nesta sessão

### VPS DuckDNS Drift Recovery ✅
- Confirmado que a API e o Nginx Proxy Manager estavam saudáveis na VPS.
- Identificado drift entre o IPv4 público da VPS e `dig +short criptenv.duckdns.org`.
- `duckdns-updater` passa a detectar o IPv4 público via `api4.ipify.org` e enviar esse IP explicitamente ao DuckDNS.
- Adicionado `DUCKDNS_FORCE_IP` para override opcional em VPS com IPv4 fixo.
- Documentado runbook para comparação IP/DNS, teste local com `--resolve` e update manual.

---

## Documentação atualizada

- [x] `deploy/vps/README.md` — runbook de DuckDNS drift.
- [x] `docs/technical/deployment-guide.md` — recuperação, env vars e checklist.
- [x] `docs/project/current-state.md` — estado/riscos de VPS atualizados.
- [x] `docs/project/decisions.md` — DEC-021.
- [x] `docs/development/CHANGELOG.md` — seção VPS DuckDNS Drift Recovery.
- [x] `docs/tasks/task-history.md` — registro da correção operacional.
- [x] `docs/tasks/current-task.md` — este arquivo.

---

## Próximos passos recomendados

1. Aplicar a alteração na VPS com `docker compose -f deploy/vps/docker-compose.yml up -d duckdns-updater`.
2. Verificar logs do updater e confirmar que ele publica o IPv4 esperado.
3. Procurar por outro updater DuckDNS concorrente se o registro voltar a apontar para outro IP.

---

**Document Version**: 1.11
**Last Updated**: 2026-05-10
**Status**: VPS DuckDNS drift recovery documented and configured
