# Current Task — Project Alerts

**Data da revisão documental:** 2026-09-19
**Branch:** `uiweb-alerts`
**Status:** Documentação da Task 7 atualizada; validação de release incompleta por migração não aplicada e E2E de alertas bloqueado.

## Objetivo

Central de alertas de expiração do projeto com canais in-app, email e webhook,
destinados somente a owners/admins e sem expor material de secrets.

## Entrega verificada

- Settings persistidos em `projects.settings.alerts`, preservando `settings.vault` e demais chaves.
- `GET`, `PATCH` e `POST .../test-webhook` sob `/api/v1/projects/{project_id}/alert-settings`, com sessão humana e RBAC owner/admin.
- Webhook cifrado em repouso, preview seguro, validação SSRF/DNS/IP em save e delivery, sem URL completa em respostas, logs ou auditoria.
- `alert_deliveries` com identidade única, claim token/fencing, lease, retries e orçamento compartilhado de três tentativas.
- Destinatários: owner e membros aceitos owner/admin; email exige `email_verified=true`; developers/viewers são excluídos.
- Canais in-app, email e webhook isolam falhas e usam o payload canônico versão 1.
- Test webhook usa configuração persistida e `test=true`; scheduler usa `test=false`.
- Scheduler avalia o `notify_days_before` de cada secret; o default do projeto só é usado quando uma nova expiração omite o campo.
- `last_notified_at` é compatibilidade e não é a fonte de deduplicação.
- Card responsivo de Settings e cliente API tipado implementados.
- Payloads não incluem plaintext, ciphertext, IV, tag, senha, URL/segredo de webhook ou credenciais de API.

## Documentação atualizada

- `docs/project/decisions.md`: DEC-057/058 agora registram a arquitetura aceita e semântica de entrega verificada, sem duplicar IDs.
- `docs/development/CHANGELOG.md`: alertas registrados em Unreleased.
- `docs/project/current-state.md`: API, scheduler, UI, migração e limitações de verificação atualizados.
- `docs/features/implemented.md`: alertas de projeto marcados implementados localmente, com E2E/provider explicitamente limitado.
- `docs/features/in-progress.md`: removida a alegação de UI inexistente; permanecem E2E/provider, Slack, rotação modal e auto-rotação.
- `apps/web/src/app/(docs)/docs/api/rotation/page.tsx` e `docs/technical/api.md`: endpoints, canais, payload versão/test, recipients, defaults, retries e zero-knowledge documentados.

## Validação da Implementação

- `./.venv/bin/alembic -c alembic.ini heads`: passou; uma head, `20260918_0010`.
- `./.venv/bin/alembic -c alembic.ini history`: passou; histórico linear até `20260918_0010`.
- `upgrade head`: não aplicado. O `.env` aponta para uma instância PostgreSQL configurada; sem confirmação de banco descartável, aplicar migração seria uma suposição insegura sobre dados vivos. A validação de schema em banco permanece pendente.
- `make test`: passou; API `501 passed, 2 skipped, 28 warnings`; CLI `184 passed, 1 warning` de coroutine não aguardada em `test_status_logged_in`.
- `npm run test:unit -- --runInBand`: passou; `25` suites e `101` testes.
- `npm run lint`: passou.
- `npm run check:vinext`: passou com `100% compatible`.
- `npm run build`: passou; Vinext emitiu apenas warnings existentes de chunks grandes e classificação dinâmica de rotas.
- `npm run test:e2e`: executado com banco isolado; falhou no setup de signup porque o Resend rejeitou o destinatário fixture em `example.com`. Resultado observado: 1 teste passou, 3 foram pulados e 1 falhou; nenhuma asserção do fluxo de alertas chegou a executar. A validação E2E permanece pendente.
- `git diff --check`: executado após as edições; resultado registrado nesta seção.

## Bloqueios e riscos conhecidos

- Cypress precisa de fixture de email aceito pelo Resend ou de Resend desabilitado/mockado; manter esse bloqueio explícito até repetir a suíte.
- Entrega real de email requer `RESEND_API_KEY` e destinatários válidos/verificados; não foi declarada como smoke-test de produção.
- Webhook de produção depende de URL pública permitida pela validação SSRF e de configuração operacional controlada.
- O warning existente do CLI sobre coroutine não aguardada permanece fora do escopo de Task 7.
- O `apps/api/tests/test_project_vault_security.py` e o artefato `apps/web/.vinext/dev/lock.json` já tinham alterações externas e foram preservados.

**Document Version:** 3.0
**Last Updated:** 2026-09-19
