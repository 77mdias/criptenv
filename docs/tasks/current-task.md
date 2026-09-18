# Current Task — CriptEnv

**Data:** 2026-09-18
**Status:** Auditoria e atualização sistêmica/documental em andamento.

## Objetivo

Conferir o estado real do software, dados operacionais, dependências, uso, deployment e documentação. A documentação deve refletir o código e os arquivos de configuração atuais, sem promover itens de backlog para funcionalidades entregues.

## Achados verificados

- A produção documentada usa Cloudflare Worker/Pages, Cloudflare Tunnel, API em Docker na VPS, PostgreSQL 15 local e Redis.
- R2 é suportado para avatares e está configurado como backend recomendado nos exemplos de ambiente/deploy.
- RBAC, notificações in-app, bulk secrets, email verification, 2FA e sessões ativas já estão implementados.
- RailwayProvider ainda não está implementado; a presença de `railway` em schemas não representa uma integração funcional.
- O README da VPS citava scripts ausentes para setup, migração e backup automático; as instruções foram corrigidas para comandos que existem ou são explicitamente manuais.
- Teste de email era dependente de `RESEND_API_KEY` externo; o teste agora isola o envio de boas-vindas.

## Verificações

- `make test`: API passa após o isolamento do teste de email; CLI deve ser validado separadamente.
- `npm run lint`: passou.
- `npm run check:vinext`: passou com 100% de compatibilidade.
- Build de produção, Cypress E2E e smoke test contra produção: ainda pendentes nesta sessão.

## Próximas ações

1. Executar `make cli-test` e `npm run test:unit`.
2. Executar build Vinext e registrar o resultado/limitação real do ambiente.
3. Revisar os documentos técnicos restantes para referências históricas incorretas.
4. Planejar separadamente RailwayProvider, web alert UI e baseline operacional da VPS.

**Document Version:** 2.0
**Last Updated:** 2026-09-18
