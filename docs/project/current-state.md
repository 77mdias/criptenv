# Current State — CriptEnv

**Última atualização:** 2026-11-12 (testes rodados em 2026-11-11). A auditoria completa anterior é de 2026-09-19.
**Status:** Phase 1, 2 e 3.5 completas. Phase 3 com o código quase todo entregue; falta a integração com o Railway, publicar a GitHub Action e validar em produção o que só o ambiente real mostra.

## Resumo

O CriptEnv é um gerenciador de segredos zero-knowledge com três superfícies: CLI Python, API FastAPI e dashboard web Vinext/React. Os segredos são cifrados no cliente com AES-256-GCM; a API armazena blobs opacos e metadados. A implantação atual documentada no repositório é:

- Web: Cloudflare Pages + Worker em `https://criptenv.77mdevseven.tech`.
- API: Docker na VPS, exposta por Cloudflare Tunnel em `https://criptenv-api.77mdevseven.tech`. A imagem nova é buscada pelo Watchtower a cada 5 minutos, então a API entra no ar alguns minutos depois do site.
- Dados: PostgreSQL 15 local no Compose da VPS.
- Rate limit: Redis no mesmo Compose.
- Jobs: serviço `scheduler` separado, com um worker (alertas de expiração, ciclo de cobrança, deploy agrupado).
- Avatares: Cloudflare R2 quando `AVATAR_STORAGE_BACKEND=r2`; Supabase Storage permanece como backend compatível.

`RenderProvider`, `VercelProvider` e `CloudflareWorkersProvider` são integrações de produto; `RailwayProvider` ainda não existe.

## Fases

| Fase | Estado | Observação |
|---|---|---|
| Phase 1 (CLI) | Completa | CLI remota, criptografia, import/export e diagnóstico. |
| Phase 2 (Web) | Completa | Auth, dashboard, projetos, ambientes, vault, equipes e auditoria. |
| Phase 3 (CI/CD) | Quase completa | API pública, tokens de CI, GitHub Action, integrações Vercel/Render/Cloudflare, rotação, alertas (API, CLI e web), notificações e OAuth implementados. Faltam Railway, a publicação da Action e a validação dos alertas em produção. |
| Phase 3.5 (Experiência autenticada) | Completa (2026-11-11) | Dashboard central, visão do projeto, detalhe do segredo, telas Atividade, Acessos, Segurança e Comparar, busca rápida. |
| Planos de assinatura | No código, desligado | Free, Pro e Max com limites; cobrança pelo Mercado Pago entra com `BILLING_ENABLED=false` até o teste manual passar. |
| Phase 4 (Enterprise) | Planejada | SSO/SAML, SCIM, SIEM e políticas avançadas. |

## Entregas verificadas no código

### CLI

- Autenticação humana e CI, sessões locais cifradas e `doctor`.
- Projetos, ambientes (inclusive restritos), membros, convites, sessões e chaves de API.
- `set`, `get`, `list`, `delete`, `run`, `diff`, import/export, `push`/`pull` como aliases remotos.
- Rotação, expiração e alertas de secrets.
- Integrações Vercel/Render/Cloudflare e comandos CI.
- A senha de projeto é usada para cifrar/desbloquear o vault; plaintext não é persistido pelo fluxo remoto.

### API

- Auth por cookie HTTP-only, OAuth GitHub/Google/Discord, email verification, reset de senha e 2FA/TOTP com trusted devices. A sessão cai depois de 20 dias sem uso e dura no máximo 30.
- RBAC de projeto: `owner`, `admin`, `developer` e `viewer`. Gravar segredos exige `admin`.
- Ambientes extras por plano (3, 5 ou 7 por projeto) e ambientes restritos a dono e admins.
- API versionada em `/api/v1`, tokens de CI e rate limiting. Chaves de API `cek_` só leem (`read:secrets`, `read:audit`); usadas numa rota que grava, recebem 403 com o motivo.
- Vault com `expected_version` para evitar sobrescrita concorrente; tipos Config/Secret por variável.
- Rotação/expiração, auditoria com janela por plano, webhooks, notificações in-app e contribuições Pix.
- Alertas de projeto: settings owner/admin, canais in-app/email/webhook, persistência idempotente, retries/fencing, payload canônico versão 1 e scheduler de expiração.
- Visões do usuário em `/api/v1/me`: overview, atividade por dia, auditoria de todos os projetos, credenciais e plano.
- Cofre pessoal (só pelo site), com pastas e ícones de site.
- Planos e limites (`PlanLimits`, 402 ao criar acima do limite); envio automático, deploy e sync por CI no Max; cobrança pelo Mercado Pago atrás de `BILLING_ENABLED`.
- Configurações de integrações cifradas em repouso com `INTEGRATION_CONFIG_SECRET`.
- Upload de avatar em R2 ou Supabase Storage.

### Web

- Landing, autenticação, dashboard, projetos, ambientes, secrets, auditoria, membros, settings, conta, integrações, cofre pessoal, assinatura e contribuições, em pt-BR, en e es.
- Permissões administrativas aplicadas no dashboard; developers/viewers não recebem controles destrutivos.
- Seleção e exclusão em lote de secrets apenas para `admin`/`owner`, com um único push cifrado.
- Alertas de expiração: card responsivo em Settings (canais, padrão por projeto, teste de webhook), prazo e antecedência por segredo, sino de notificações e card de atenção no dashboard.
- Telas Atividade, Acessos, Segurança e Comparar ambientes; busca rápida (Ctrl/Cmd+K).
- Documentação navegável em `/docs`, incluindo CLI, API, segurança, guias e integrações.

## Lacunas atuais

| Item | Estado | Ação recomendada |
|---|---|---|
| RailwayProvider | Não implementado | Implementar estratégia, testes, UI e documentação quando a integração for priorizada. |
| GitHub Action Marketplace | Não publicado | O Marketplace exige o `action.yml` na raiz de um repositório público; a Action hoje vive em `packages/github-action` deste monorepo. Publicar pede um repositório só dela (ou um espelho) e uma release. |
| Alertas em produção | Não validado | Uma entrega real: prazo curto num segredo de teste, esperar o job de hora em hora e conferir sino, e-mail e webhook. |
| Cobrança | Desligada | Rodar o roteiro de `deploy/vps/README.md` ("Ativar a cobrança") com contas de teste do Mercado Pago. |
| Operação da VPS | Parcial | Formalizar backup testado, patching, rotação de logs, firewall e monitoramento. |
| Tipos no web | Dívida | `npx tsc --noEmit` acusa cerca de 1100 erros (conflito de tipos Jest × Cypress e arquivos antigos); o CI do web não roda tsc. |

## Validação local em 2026-11-11

- API: `1108 passed, 2 skipped`.
- CLI: `285 passed`.
- Web unit: `475 passed` em 73 suítes (rodado em 2026-11-12).
- `npm run lint`: 0 erros, 15 avisos antigos.
- `npm run check:i18n`: chaves resolvidas nas 3 locales.
- `npm run build`: passou.
- Cypress E2E: 24 de 24 contra o banco isolado, incluindo `project-alert-settings.cy.ts`, que estava bloqueado em setembro.
- Migrações: a produção roda até `20261110_0021`.

## Riscos e cuidados

- Nunca documentar uma integração como implementada apenas porque seu nome aparece em schemas ou docs.
- `RESEND_API_KEY`, tokens OAuth, credenciais R2 e `TUNNEL_TOKEN` só devem existir em secrets do ambiente; nunca em commits.
- O scheduler deve continuar isolado em um único worker.
- O site sobe antes da API: uma tela nova que depende de rota nova pode falhar por até uns 5 minutos depois do merge. Chamada nova deve falhar sem derrubar a tela.
- A afirmação zero-knowledge não cobre plaintext exibido no terminal, browser ou arquivos exportados após a descriptografia pelo usuário.
- Alertas recebem apenas identificadores e metadados de expiração. O webhook é cifrado em repouso; email/webhook externos são at-least-once após crashes e dependem de configuração válida do provedor.
