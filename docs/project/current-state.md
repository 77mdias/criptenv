# Current State — CriptEnv

**Última auditoria:** 2026-09-18
**Status:** Phase 3 em andamento, com o núcleo web/API/CLI operacional e lacunas de produto/operação explicitamente listadas abaixo.

## Resumo

O CriptEnv é um gerenciador de segredos zero-knowledge com três superfícies: CLI Python, API FastAPI e dashboard web Vinext/React. Os segredos são cifrados no cliente com AES-256-GCM; a API armazena blobs opacos e metadados. A implantação atual documentada no repositório é:

- Web: Cloudflare Pages + Worker em `https://criptenv.77mdevseven.tech`.
- API: Docker na VPS, exposta por Cloudflare Tunnel em `https://criptenv-api.77mdevseven.tech`.
- Dados: PostgreSQL 15 local no Compose da VPS.
- Rate limit: Redis no mesmo Compose.
- Jobs: serviço `scheduler` separado, com um worker.
- Avatares: Cloudflare R2 quando `AVATAR_STORAGE_BACKEND=r2`; Supabase Storage permanece como backend compatível.

Render e Railway continuam como artefatos de rollback/legado para hospedagem. `RenderProvider` é uma integração de produto; `RailwayProvider` ainda não existe.

## Fases

| Fase | Estado | Observação |
|---|---|---|
| Phase 1 (CLI) | Completa | CLI remota, criptografia, import/export e diagnóstico. |
| Phase 2 (Web) | Completa | Auth, dashboard, projetos, ambientes, vault, equipes e auditoria. |
| Phase 3 (CI/CD) | Em andamento | API pública, tokens CI, GitHub Action, integrações Vercel/Render, rotação, notificações e OAuth implementados. |
| Phase 4 (Enterprise) | Planejada | SSO/SAML, SCIM, SIEM e políticas avançadas. |

## Entregas verificadas no código

### CLI

- Autenticação humana e CI, sessões locais cifradas e `doctor`.
- Projetos, ambientes, membros, convites, sessões e chaves de API.
- `set`, `get`, `list`, `delete`, import/export, `push`/`pull` como aliases remotos.
- Rotação, expiração e alertas de secrets.
- Integrações Vercel/Render e comandos CI.
- A senha de projeto é usada para cifrar/desbloquear o vault; plaintext não é persistido pelo fluxo remoto.

### API

- Auth por cookie HTTP-only, OAuth GitHub/Google/Discord, email verification, reset de senha e 2FA/TOTP com trusted devices.
- RBAC de projeto: `owner`, `admin`, `developer` e `viewer`.
- API versionada em `/api/v1`, API keys `cek_`, tokens CI e rate limiting.
- Vault com `expected_version` para evitar sobrescrita concorrente.
- Rotação/expiração, auditoria, webhooks, notificações in-app e contribuições Pix.
- Configurações de integrações cifradas em repouso com `INTEGRATION_CONFIG_SECRET`.
- Upload de avatar em R2 ou Supabase Storage.

### Web

- Landing, autenticação, dashboard, projetos, ambientes, secrets, auditoria, membros, settings, conta, integrações e contribuições.
- Permissões administrativas aplicadas no dashboard; developers/viewers não recebem controles destrutivos.
- Seleção e exclusão em lote de secrets apenas para `admin`/`owner`, com um único push cifrado.
- Notification bell com badge, polling e painel seguro para mobile.
- Documentação navegável em `/docs`, incluindo CLI, API, segurança, guias e integrações.

## Lacunas atuais

| Item | Estado | Ação recomendada |
|---|---|---|
| RailwayProvider | Não implementado | Implementar estratégia, testes, UI e documentação quando a integração for priorizada. |
| Configuração de alertas no dashboard | Parcial | Expor no web as políticas que já existem na API/CLI. |
| GitHub Action Marketplace | Não publicado | Criar README do pacote, release/tag e publicação. |
| Operação da VPS | Parcial | Formalizar backup testado, patching, rotação de logs, firewall e monitoramento. |
| E2E de produção | Não revalidado nesta auditoria | Executar smoke test com credenciais e ambiente de produção controlados. |

## Validação local em 2026-09-18

- API: `416 passed, 2 skipped`.
- CLI: `184 passed`, com um warning de `RuntimeWarning` sobre coroutine não aguardada em `test_status_logged_in`.
- Web unit: `84 passed` em 23 suites.
- `npm run lint`: passou.
- `npm run check:vinext`: passou com 100% de compatibilidade.
- `npm run build`: passou; o Vinext emitiu apenas warning de chunks grandes e classificação dinâmica de rotas.
- Cypress E2E e smoke test contra produção: ainda não executados nesta auditoria.

## Riscos e cuidados

- Nunca documentar uma integração como implementada apenas porque seu nome aparece em schemas ou docs.
- `RESEND_API_KEY`, tokens OAuth, credenciais R2 e `TUNNEL_TOKEN` só devem existir em secrets do ambiente; nunca em commits.
- O scheduler deve continuar isolado em um único worker.
- A afirmação zero-knowledge não cobre plaintext exibido no terminal, browser ou arquivos exportados após a descriptografia pelo usuário.
